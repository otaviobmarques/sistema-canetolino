// Canetolino · lembretes por notificação (Web Push)
// Roda a cada 15 minutos (pg_cron) e também envia um "teste" quando a própria pessoa pede.
// Notificações discretas: sem nome de remédio, peso ou sintoma na tela bloqueada (seção 8).
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-lembretes-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

type Assinatura = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }
type Aviso = { titulo: string; texto: string; chave: string; url: string }

/** Data e hora locais no fuso da pessoa. */
function agoraNoFuso(fuso: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  )
  const dia = `${p.year}-${p.month}-${p.day}`
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday)
  const minutos = (Number(p.hour) % 24) * 60 + Number(p.minute)
  return { dia, dow, minutos, hora: Number(p.hour) % 24 }
}

/** Início do dia local em UTC, para filtrar registros de "hoje". */
function inicioDoDiaUtc(dia: string, fuso: string) {
  const meioDia = new Date(`${dia}T12:00:00Z`)
  const local = new Date(meioDia.toLocaleString('en-US', { timeZone: fuso }))
  const offset = meioDia.getTime() - local.getTime()
  return new Date(new Date(`${dia}T00:00:00Z`).getTime() + offset)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ erro: 'metodo' }, 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: seg } = await admin.from('segredos').select('nome, valor').in('nome', ['VAPID_PRIVATE_KEY', 'VAPID_PUBLIC_KEY', 'LEMBRETES_TOKEN'])
  const s = Object.fromEntries((seg ?? []).map((x) => [x.nome, x.valor]))
  if (!s.VAPID_PRIVATE_KEY || !s.VAPID_PUBLIC_KEY) return json({ erro: 'sem_chaves' }, 503)
  webpush.setVapidDetails('mailto:contato@canetolino.com.br', s.VAPID_PUBLIC_KEY, s.VAPID_PRIVATE_KEY)

  const enviar = async (a: Assinatura, aviso: Omit<Aviso, 'chave'>) => {
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, JSON.stringify(aviso), { TTL: 3600, urgency: 'normal' })
      return true
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', a.id) // aparelho desinscrito
      else await admin.from('push_subscriptions').update({ ultimo_erro: String(status ?? 'erro') }).eq('id', a.id)
      return false
    }
  }

  /* ---------- teste pedido pela própria pessoa ---------- */
  const token = req.headers.get('x-lembretes-token')
  if (!token) {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: u } = await admin.auth.getUser(jwt)
    if (!u.user) return json({ erro: 'nao_autenticado' }, 401)
    const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', u.user.id)
    let ok = 0
    for (const a of (subs ?? []) as Assinatura[]) if (await enviar(a, { titulo: 'Canetolino', texto: 'Tudo certo! Seus lembretes vão chegar assim 💜', url: '/#/app/home' })) ok++
    return json({ enviados: ok, aparelhos: subs?.length ?? 0 })
  }
  if (token !== s.LEMBRETES_TOKEN) return json({ erro: 'negado' }, 403)

  /* ---------- rodada agendada ---------- */
  const { data: subs } = await admin.from('push_subscriptions').select('*')
  const porUsuario = new Map<string, Assinatura[]>()
  for (const a of (subs ?? []) as Assinatura[]) porUsuario.set(a.user_id, [...(porUsuario.get(a.user_id) ?? []), a])
  let enviados = 0

  for (const [userId, aparelhos] of porUsuario) {
    const { data: p } = await admin.from('profiles').select('fuso, config, meta_agua_ml').eq('user_id', userId).maybeSingle()
    if (!p) continue
    const cfg = (p.config ?? {}) as { notificacoesDiscretas?: boolean; lembretesAgua?: boolean }
    const discreto = cfg.notificacoesDiscretas !== false
    const fuso = p.fuso || 'America/Sao_Paulo'
    const agora = agoraNoFuso(fuso)
    const inicioHoje = inicioDoDiaUtc(agora.dia, fuso).toISOString()
    const avisos: Aviso[] = []

    // 1) dia de aplicação: na hora marcada, se ainda não registrou hoje
    const { data: agendas } = await admin.from('application_schedules').select('dia_semana, horario').eq('user_id', userId)
    for (const ag of agendas ?? []) {
      const [h, m] = String(ag.horario).split(':').map(Number)
      const alvo = h * 60 + m
      if (ag.dia_semana === agora.dow && agora.minutos >= alvo && agora.minutos < alvo + 120) {
        const { count } = await admin.from('applications').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('aplicado_em', inicioHoje)
        if (!count)
          avisos.push({
            chave: `aplicacao:${agora.dia}`,
            titulo: 'Canetolino',
            texto: discreto ? 'Hora do seu momento Canetolino 💜' : `Hoje é dia de aplicação (${String(ag.horario).slice(0, 5)}). Registre no app quando aplicar.`,
            url: '/#/app/jornada',
          })
      }
    }

    // 2) água: às 10h, 14h e 18h, se ainda não bateu a meta
    if (cfg.lembretesAgua !== false && [10, 14, 18].includes(agora.hora) && agora.minutos % 60 < 15) {
      const { data: agua } = await admin.from('hydration_records').select('ml').eq('user_id', userId).gte('registrado_em', inicioHoje)
      const total = (agua ?? []).reduce((t, x) => t + x.ml, 0)
      if (total < (p.meta_agua_ml ?? 2000))
        avisos.push({ chave: `agua:${agora.dia}:${agora.hora}`, titulo: 'Canetolino', texto: discreto ? 'Que tal um copo d’água agora? 💧' : `Você está com ${(total / 1000).toFixed(1).replace('.', ',')} L hoje. Que tal um copo agora? 💧`, url: '/#/app/home' })
    }

    // 3) validade das canetas: aviso único 30 dias antes, às 9h
    if (agora.hora === 9 && agora.minutos % 60 < 15) {
      const { data: canetas } = await admin.from('pen_inventory').select('validade, quantidade').eq('user_id', userId).gt('quantidade', 0)
      for (const c of canetas ?? []) {
        if (!/^\d{4}-\d{2}$/.test(c.validade ?? '')) continue
        const dias = (new Date(`${c.validade}-01T00:00:00Z`).getTime() - Date.now()) / 86400000
        if (dias <= 30 && dias > -31) avisos.push({ chave: `validade:${c.validade}`, titulo: 'Canetolino', texto: discreto ? 'Tem um item seu perto da validade. Confira no app.' : 'Uma caneta vence em menos de 30 dias. Confira na sua Jornada.', url: '/#/app/jornada' })
      }
    }

    for (const aviso of avisos) {
      // grava antes de enviar: se já existe, outro ciclo já mandou
      const { error } = await admin.from('reminder_log').insert({ user_id: userId, chave: aviso.chave })
      if (error) continue
      for (const a of aparelhos) if (await enviar(a, aviso)) enviados++
    }
  }
  return json({ usuarios: porUsuario.size, enviados })
})
