// Canetolino · assinaturas pagas
// O gateway (Asaas, Mercado Pago ou Stripe) e o modo (teste ou produção) são escolhidos no painel Admin.
//   POST /pagamentos/checkout           (sessão do paciente) cria a assinatura e devolve o link de pagamento
//   POST /pagamentos/cancelar           (sessão do paciente) cancela a assinatura no gateway
//   POST /pagamentos/admin-cancelar     (sessão do Admin) cancela as assinaturas de uma conta antes de excluí-la
//   POST /pagamentos/webhook/<gateway>  avisos do gateway; a autenticidade é conferida com o token/segredo
//                                       de teste ou de produção, e o modo sai de qual deles bateu
// Os preços ficam aqui no servidor: o app nunca define quanto será cobrado.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

type Gateway = 'asaas' | 'mercadopago' | 'stripe'
type Modo = 'teste' | 'producao'
type Plano = 'basico' | 'premium'
type Periodo = 'mensal' | 'anual'
type Status = 'pendente' | 'ativa' | 'atrasada' | 'cancelada'
type Assinatura = { id: string; user_id: string; gateway: Gateway; modo: Modo; plano: Plano; periodo: Periodo; status: Status; assinatura_externa: string | null }

const PRECOS: Record<Plano, Record<Periodo, number>> = {
  basico: { mensal: 9.9, anual: 99 },
  premium: { mensal: 19.9, anual: 199 },
}
const NOME_PLANO: Record<Plano, string> = { basico: 'Básico', premium: 'Premium' }
const SITE = 'https://canetolino.com.br'
const ORIGENS = [SITE, 'https://www.canetolino.com.br', 'http://localhost:5173', 'http://localhost:4173']

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

/* ---------------- utilidades ---------------- */
async function credenciais(g: Gateway, m: Modo): Promise<Record<string, string>> {
  const prefixo = `${g}_${m}_`.toUpperCase()
  const { data } = await db.from('segredos').select('nome, valor').like('nome', `${prefixo}%`)
  return Object.fromEntries((data ?? []).map((x) => [x.nome.slice(prefixo.length).toLowerCase(), x.valor]))
}

function iguais(a: string, b: string) {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  if (x.length !== y.length) return false
  let d = 0
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i]
  return d === 0
}

async function hmacHex(segredo: string, texto: string) {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const assinatura = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(texto))
  return [...new Uint8Array(assinatura)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

async function http(url: string, init: RequestInit, rotulo: string) {
  const r = await fetch(url, init)
  const texto = await r.text()
  let corpo: any = null
  try {
    corpo = texto ? JSON.parse(texto) : null
  } catch {
    corpo = texto
  }
  if (!r.ok) {
    console.error(rotulo, r.status, texto.slice(0, 500))
    throw new ErroGateway(rotulo, r.status, corpo)
  }
  return corpo
}
class ErroGateway extends Error {
  status: number
  corpo: unknown
  constructor(rotulo: string, status: number, corpo: unknown) {
    super(`${rotulo}: ${status}`)
    this.status = status
    this.corpo = corpo
  }
}

/** Atualiza a assinatura e o plano do paciente. Quando uma assinatura nova fica ativa, as antigas são canceladas (troca de plano). */
async function aplicar(a: Assinatura, mudanca: { status?: Status; assinatura_externa?: string; cliente_externo?: string; proximo_vencimento?: string | null }) {
  const novo = { ...mudanca, atualizado_em: new Date().toISOString() }
  await db.from('assinaturas').update(novo).eq('id', a.id)
  if (mudanca.status === 'ativa' && a.status !== 'ativa') {
    const { data: antigas } = await db.from('assinaturas').select('*').eq('user_id', a.user_id).neq('id', a.id).in('status', ['ativa', 'atrasada', 'pendente'])
    for (const v of (antigas ?? []) as Assinatura[]) {
      try {
        if (v.assinatura_externa) await cancelarNoGateway(v)
      } catch (e) {
        console.error('cancelar antiga', v.id, String(e))
      }
      await db.from('assinaturas').update({ status: 'cancelada', atualizado_em: new Date().toISOString() }).eq('id', v.id)
    }
  }
  await db.rpc('atualizar_plano', { p_user: a.user_id })
}

async function registrarEvento(gateway: Gateway, modo: Modo | null, eventoId: string, tipo: string) {
  const { error } = await db.from('pagamentos_eventos').insert({ gateway, modo, evento_id: eventoId, tipo })
  return !error // false = já recebido antes (o gateway reenviou)
}
/** Processa um evento novo; se der erro, esquece o evento para que o reenvio do gateway seja processado de novo. */
async function processar(gateway: Gateway, modo: Modo, eventoId: string, tipo: string, fn: () => Promise<Response>) {
  if (!(await registrarEvento(gateway, modo, eventoId, tipo))) return json({ ok: true, repetido: true })
  try {
    return await fn()
  } catch (e) {
    await db.from('pagamentos_eventos').delete().eq('gateway', gateway).eq('evento_id', eventoId)
    throw e
  }
}
const concluirEvento = (gateway: Gateway, eventoId: string, resultado: string, assinaturaId?: string) =>
  db.from('pagamentos_eventos').update({ resultado, assinatura_id: assinaturaId ?? null }).eq('gateway', gateway).eq('evento_id', eventoId)

async function porId(id: string | null | undefined) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data } = await db.from('assinaturas').select('*').eq('id', id).maybeSingle()
  return data as Assinatura | null
}
async function porExterna(g: Gateway, ext: string | null | undefined) {
  if (!ext) return null
  const { data } = await db.from('assinaturas').select('*').eq('gateway', g).eq('assinatura_externa', ext).maybeSingle()
  return data as Assinatura | null
}

/* ---------------- Asaas ---------------- */
const asaasBase = (m: Modo) => (m === 'producao' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3')
const asaas = (m: Modo, chave: string, caminho: string, metodo = 'GET', corpo?: unknown) =>
  http(`${asaasBase(m)}${caminho}`, { method: metodo, headers: { access_token: chave, 'Content-Type': 'application/json', 'User-Agent': 'Canetolino' }, body: corpo ? JSON.stringify(corpo) : undefined }, `asaas ${metodo} ${caminho.split('?')[0]}`)

const STATUS_ASAAS: Record<string, Status> = {
  PAYMENT_CONFIRMED: 'ativa',
  PAYMENT_RECEIVED: 'ativa',
  PAYMENT_OVERDUE: 'atrasada',
  PAYMENT_REFUNDED: 'cancelada',
  PAYMENT_CHARGEBACK_REQUESTED: 'cancelada',
  SUBSCRIPTION_DELETED: 'cancelada',
  SUBSCRIPTION_INACTIVATED: 'cancelada',
}

/* ---------------- Mercado Pago ---------------- */
const mp = (token: string, caminho: string, metodo = 'GET', corpo?: unknown) =>
  http(`https://api.mercadopago.com${caminho}`, { method: metodo, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined }, `mercadopago ${metodo} ${caminho}`)
const STATUS_MP: Record<string, Status> = { authorized: 'ativa', paused: 'atrasada', cancelled: 'cancelada', pending: 'pendente' }

/* ---------------- Stripe ---------------- */
function form(obj: Record<string, unknown>, prefixo = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const chave = prefixo ? `${prefixo}[${k}]` : k
    if (v === undefined || v === null) return []
    if (typeof v === 'object') return form(v as Record<string, unknown>, chave)
    return [`${encodeURIComponent(chave)}=${encodeURIComponent(String(v))}`]
  })
}
const stripe = (chave: string, caminho: string, metodo = 'GET', corpo?: Record<string, unknown>) =>
  http(`https://api.stripe.com/v1${caminho}`, { method: metodo, headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: corpo ? form(corpo).join('&') : undefined }, `stripe ${metodo} ${caminho}`)
const STATUS_STRIPE: Record<string, Status> = { active: 'ativa', trialing: 'ativa', past_due: 'atrasada', unpaid: 'atrasada', canceled: 'cancelada', incomplete_expired: 'cancelada', incomplete: 'pendente', paused: 'atrasada' }
const vencimentoStripe = (s: any) => {
  const t = s?.current_period_end ?? s?.items?.data?.[0]?.current_period_end
  return t ? new Date(t * 1000).toISOString() : null
}

/* ---------------- cancelar ---------------- */
async function cancelarNoGateway(a: Assinatura) {
  const c = await credenciais(a.gateway, a.modo)
  if (a.gateway === 'asaas') await asaas(a.modo, c.api_key, `/subscriptions/${a.assinatura_externa}`, 'DELETE')
  else if (a.gateway === 'mercadopago') await mp(c.access_token, `/preapproval/${a.assinatura_externa}`, 'PUT', { status: 'cancelled' })
  else await stripe(c.secret_key, `/subscriptions/${a.assinatura_externa}`, 'DELETE')
}

/* ---------------- checkout ---------------- */
async function checkout(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  const { data: u } = await db.auth.getUser(token)
  if (!u?.user) return json({ erro: 'sessao' }, 401)
  const user = u.user
  const corpo = await req.json().catch(() => ({}))
  const plano = corpo.plano as Plano
  const periodo = corpo.periodo as Periodo
  if (!PRECOS[plano]?.[periodo]) return json({ erro: 'plano' }, 400)
  const origem = ORIGENS.includes(corpo.origem) ? corpo.origem : SITE
  const retorno = `${origem}/#/planos`
  const valor = PRECOS[plano][periodo]

  const { data: cfg } = await db.from('config_pagamentos').select('gateway, modo').single()
  const gateway = cfg!.gateway as Gateway
  const modo = cfg!.modo as Modo
  const c = await credenciais(gateway, modo)
  const chave = gateway === 'asaas' ? c.api_key : gateway === 'mercadopago' ? c.access_token : c.secret_key
  if (!chave) return json({ erro: 'gateway_nao_configurado' }, 503)

  const { data: atual } = await db.from('assinaturas').select('id').eq('user_id', user.id).eq('plano', plano).eq('periodo', periodo).in('status', ['ativa', 'atrasada']).limit(1)
  if (atual?.length) return json({ erro: 'ja_assinante' }, 409)

  const { data: perfil } = await db.from('profiles').select('nome').eq('user_id', user.id).maybeSingle()
  const nome = (perfil?.nome || user.email?.split('@')[0] || 'Paciente').slice(0, 80)
  const descricao = `Canetolino ${NOME_PLANO[plano]} (${periodo})`

  // pendentes antigas deste paciente (links abandonados) saem do caminho
  const { data: pendentes } = await db.from('assinaturas').select('*').eq('user_id', user.id).eq('status', 'pendente')
  for (const v of (pendentes ?? []) as Assinatura[]) {
    try {
      if (v.assinatura_externa) await cancelarNoGateway(v)
    } catch (e) {
      console.error('cancelar pendente', v.id, String(e))
    }
    await db.from('assinaturas').update({ status: 'cancelada', atualizado_em: new Date().toISOString() }).eq('id', v.id)
  }

  const { data: nova, error } = await db.from('assinaturas').insert({ user_id: user.id, gateway, modo, plano, periodo, valor }).select('*').single()
  if (error) throw error
  const a = nova as Assinatura

  try {
    if (gateway === 'asaas') {
      const cpf = String(corpo.cpf ?? '').replace(/\D/g, '')
      if (cpf.length !== 11 && cpf.length !== 14) {
        await db.from('assinaturas').delete().eq('id', a.id)
        return json({ erro: 'cpf' }, 400)
      }
      const achados = await asaas(modo, chave, `/customers?externalReference=${user.id}&limit=1`)
      let cliente = achados?.data?.[0]?.id as string | undefined
      if (!cliente) cliente = (await asaas(modo, chave, '/customers', 'POST', { name: nome, email: user.email, cpfCnpj: cpf, externalReference: user.id })).id
      else await asaas(modo, chave, `/customers/${cliente}`, 'PUT', { cpfCnpj: cpf })
      const sub = await asaas(modo, chave, '/subscriptions', 'POST', {
        customer: cliente, billingType: 'UNDEFINED', value: valor, nextDueDate: hojeSP(), cycle: periodo === 'anual' ? 'YEARLY' : 'MONTHLY',
        description: descricao, externalReference: a.id,
      })
      await db.from('assinaturas').update({ assinatura_externa: sub.id, cliente_externo: cliente }).eq('id', a.id)
      const cobrancas = await asaas(modo, chave, `/subscriptions/${sub.id}/payments`)
      const url = cobrancas?.data?.[0]?.invoiceUrl
      if (!url) throw new Error('asaas sem invoiceUrl')
      return json({ url })
    }

    if (gateway === 'mercadopago') {
      const pre = await mp(chave, '/preapproval', 'POST', {
        reason: descricao, external_reference: a.id, payer_email: user.email, back_url: `${SITE}/#/planos`, status: 'pending',
        auto_recurring: { frequency: periodo === 'anual' ? 12 : 1, frequency_type: 'months', transaction_amount: valor, currency_id: 'BRL' },
      })
      await db.from('assinaturas').update({ assinatura_externa: pre.id }).eq('id', a.id)
      return json({ url: pre.init_point })
    }

    const sessao = await stripe(chave, '/checkout/sessions', 'POST', {
      mode: 'subscription', locale: 'pt-BR', customer_email: user.email, client_reference_id: a.id,
      success_url: `${retorno}?pagamento=ok`, cancel_url: retorno,
      line_items: { 0: { quantity: 1, price_data: { currency: 'brl', unit_amount: Math.round(valor * 100), recurring: { interval: periodo === 'anual' ? 'year' : 'month' }, product_data: { name: descricao } } } },
      metadata: { assinatura_id: a.id }, subscription_data: { metadata: { assinatura_id: a.id } },
    })
    return json({ url: sessao.url })
  } catch (e) {
    await db.from('assinaturas').delete().eq('id', a.id)
    if (e instanceof ErroGateway && e.status === 401) return json({ erro: 'gateway_credencial' }, 502)
    if (e instanceof ErroGateway && gateway === 'asaas' && JSON.stringify(e.corpo).includes('cpfCnpj')) return json({ erro: 'cpf' }, 400)
    throw e
  }
}

async function cancelar(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  const { data: u } = await db.auth.getUser(token)
  if (!u?.user) return json({ erro: 'sessao' }, 401)
  await cancelarTudo(u.user.id)
  return json({ ok: true })
}

async function cancelarTudo(userId: string) {
  const { data } = await db.from('assinaturas').select('*').eq('user_id', userId).in('status', ['ativa', 'atrasada', 'pendente'])
  for (const a of (data ?? []) as Assinatura[]) {
    if (a.assinatura_externa) await cancelarNoGateway(a)
    await aplicar(a, { status: 'cancelada' })
  }
}

/** Usado pelo painel Admin antes de excluir uma conta: cancela as cobranças dessa pessoa. */
async function adminCancelar(req: Request) {
  const cliente = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false }, global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: admin } = await cliente.rpc('eh_admin')
  if (admin !== true) return json({ erro: 'sem_acesso' }, 403)
  const { user_id } = await req.json().catch(() => ({}))
  if (!user_id) return json({ erro: 'usuario' }, 400)
  await cancelarTudo(String(user_id))
  return json({ ok: true })
}

/* ---------------- webhooks ---------------- */
async function webhookAsaas(req: Request) {
  const recebido = req.headers.get('asaas-access-token') ?? ''
  let modo: Modo | null = null
  for (const m of ['producao', 'teste'] as Modo[]) {
    const t = (await credenciais('asaas', m)).webhook_token
    if (t && iguais(t, recebido)) modo = m
  }
  if (!modo) return json({ erro: 'token' }, 401)
  const ev = await req.json()
  const eventoId = String(ev.id ?? `${ev.event}:${ev.payment?.id ?? ev.subscription?.id}:${ev.dateCreated ?? ''}`)
  return processar('asaas', modo, eventoId, String(ev.event), async () => {
  const status = STATUS_ASAAS[ev.event]
  const ext = ev.payment?.subscription ?? ev.subscription?.id
  const a = (await porExterna('asaas', ext)) ?? (await porId(ev.subscription?.externalReference ?? ev.payment?.externalReference))
  if (!status || !a) {
    await concluirEvento('asaas', eventoId, status ? 'assinatura não encontrada' : 'ignorado', a?.id)
    return json({ ok: true })
  }
  let proximo: string | null | undefined
  if (status === 'ativa' && ext) {
    try {
      const sub = await asaas(modo, (await credenciais('asaas', modo)).api_key, `/subscriptions/${ext}`)
      proximo = sub?.nextDueDate ? `${sub.nextDueDate}T12:00:00-03:00` : undefined
    } catch {
      /* segue sem a data */
    }
  }
  await aplicar(a, { status, assinatura_externa: ext ?? undefined, proximo_vencimento: proximo })
  await concluirEvento('asaas', eventoId, status, a.id)
  return json({ ok: true })
  })
}

async function webhookMercadoPago(req: Request) {
  const url = new URL(req.url)
  const corpo = await req.json().catch(() => ({}))
  const dataId = String(url.searchParams.get('data.id') ?? corpo?.data?.id ?? '')
  const tipo = String(url.searchParams.get('type') ?? corpo?.type ?? url.searchParams.get('topic') ?? '')
  const partes = Object.fromEntries((req.headers.get('x-signature') ?? '').split(',').map((p) => p.trim().split('=') as [string, string]))
  const manifesto = `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};request-id:${req.headers.get('x-request-id') ?? ''};ts:${partes.ts ?? ''};`
  let modo: Modo | null = null
  for (const m of ['producao', 'teste'] as Modo[]) {
    const s = (await credenciais('mercadopago', m)).webhook_secret
    if (s && partes.v1 && iguais(await hmacHex(s, manifesto), partes.v1)) modo = m
  }
  if (!modo) return json({ erro: 'assinatura' }, 401)
  const eventoId = `${tipo}:${dataId}:${partes.ts}`
  return processar('mercadopago', modo, eventoId, tipo || 'desconhecido', async () => {
  const token = (await credenciais('mercadopago', modo)).access_token
  let preId: string | null = null
  if (tipo === 'subscription_preapproval') preId = dataId
  else if (tipo === 'subscription_authorized_payment') preId = (await mp(token, `/authorized_payments/${dataId}`))?.preapproval_id ?? null
  if (!preId) {
    await concluirEvento('mercadopago', eventoId, 'ignorado')
    return json({ ok: true })
  }
  const pre = await mp(token, `/preapproval/${preId}`)
  const a = (await porExterna('mercadopago', preId)) ?? (await porId(pre.external_reference))
  const status = STATUS_MP[pre.status]
  if (!a || !status) {
    await concluirEvento('mercadopago', eventoId, a ? `status ${pre.status}` : 'assinatura não encontrada', a?.id)
    return json({ ok: true })
  }
  await aplicar(a, { status, assinatura_externa: preId, cliente_externo: pre.payer_id ? String(pre.payer_id) : undefined, proximo_vencimento: pre.next_payment_date ?? null })
  await concluirEvento('mercadopago', eventoId, status, a.id)
  return json({ ok: true })
  })
}

async function webhookStripe(req: Request) {
  const bruto = await req.text()
  const partes = (req.headers.get('stripe-signature') ?? '').split(',').map((p) => p.split('='))
  const t = partes.find(([k]) => k === 't')?.[1] ?? ''
  const v1s = partes.filter(([k]) => k === 'v1').map(([, v]) => v)
  if (!t || Math.abs(Date.now() / 1000 - Number(t)) > 300) return json({ erro: 'assinatura' }, 401)
  let modo: Modo | null = null
  for (const m of ['producao', 'teste'] as Modo[]) {
    const s = (await credenciais('stripe', m)).webhook_secret
    if (!s) continue
    const esperado = await hmacHex(s, `${t}.${bruto}`)
    if (v1s.some((v) => iguais(v, esperado))) modo = m
  }
  if (!modo) return json({ erro: 'assinatura' }, 401)
  const ev = JSON.parse(bruto)
  return processar('stripe', modo, ev.id, ev.type, async () => {
  const chave = (await credenciais('stripe', modo)).secret_key
  const o = ev.data?.object ?? {}

  let sub: any = null
  let a: Assinatura | null = null
  if (ev.type === 'checkout.session.completed' && o.mode === 'subscription') {
    a = await porId(o.client_reference_id)
    if (a && o.subscription) sub = await stripe(chave, `/subscriptions/${o.subscription}`)
  } else if (ev.type?.startsWith('customer.subscription.')) {
    sub = o
    a = (await porExterna('stripe', o.id)) ?? (await porId(o.metadata?.assinatura_id))
  }
  const status = sub ? STATUS_STRIPE[sub.status] : undefined
  if (!a || !sub || !status) {
    await concluirEvento('stripe', ev.id, a ? 'ignorado' : sub ? 'assinatura não encontrada' : 'ignorado', a?.id)
    return json({ ok: true })
  }
  await aplicar(a, { status, assinatura_externa: sub.id, cliente_externo: typeof sub.customer === 'string' ? sub.customer : undefined, proximo_vencimento: vencimentoStripe(sub) })
  await concluirEvento('stripe', ev.id, status, a.id)
  return json({ ok: true })
  })
}

/* ---------------- roteamento ---------------- */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ erro: 'metodo' }, 405)
  const caminho = new URL(req.url).pathname.replace(/^.*\/pagamentos/, '')
  try {
    if (caminho === '/checkout') return await checkout(req)
    if (caminho === '/cancelar') return await cancelar(req)
    if (caminho === '/admin-cancelar') return await adminCancelar(req)
    if (caminho === '/webhook/asaas') return await webhookAsaas(req)
    if (caminho === '/webhook/mercadopago') return await webhookMercadoPago(req)
    if (caminho === '/webhook/stripe') return await webhookStripe(req)
    return json({ erro: 'rota' }, 404)
  } catch (e) {
    console.error(caminho, String(e))
    return json({ erro: 'falha' }, 500)
  }
})
