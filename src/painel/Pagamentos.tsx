import type { SupabaseClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import Icon from '../components/Icon'
import { Modal, useToast } from '../components/ui'
import { precoBR } from '../data/planos'
import { dataHoraBR } from '../lib/datas'
import { erroPt, SUPABASE_URL } from '../lib/supabase'
import { Cabecalho } from './Layout'

/* Painel Admin · gateway de pagamento (Asaas, Mercado Pago ou Stripe) e modo Teste/Produção.
   As chaves são gravadas no servidor e nunca voltam inteiras para a tela (só os 4 últimos caracteres). */

type Gw = 'asaas' | 'mercadopago' | 'stripe'
type Modo = 'teste' | 'producao'
type Info = {
  gateway: Gw
  modo: Modo
  atualizado_em: string
  credenciais: Record<Gw, Record<Modo, Record<string, string | null>>>
  assinaturas: Record<string, number>
  receita_mensal: number
  eventos: { gateway: Gw; modo: Modo | null; tipo: string; resultado: string | null; recebido_em: string }[]
}
type Campo = { id: string; nome: string; dica: string; gerar?: boolean }

const GATEWAYS: Record<Gw, { nome: string; resumo: string; chave: string; campos: Campo[]; passos: (modo: Modo) => string[] }> = {
  asaas: {
    nome: 'Asaas',
    resumo: 'Pix, boleto e cartão · pede o CPF do paciente',
    chave: 'api_key',
    campos: [
      { id: 'api_key', nome: 'Chave de API', dica: 'começa com $aact_' },
      { id: 'webhook_token', nome: 'Token de autenticação do webhook', dica: 'gere aqui e cole o mesmo no Asaas', gerar: true },
    ],
    passos: (m) => [
      `Entre em ${m === 'teste' ? 'sandbox.asaas.com (conta de testes)' : 'asaas.com'} → Integrações → Chaves de API e copie a chave para o campo acima.`,
      'Integrações → Webhooks → Adicionar: cole a URL abaixo, versão da API v3, fila sincronizada desligada.',
      'Em “Token de autenticação”, cole o mesmo token gerado acima.',
      'Marque os eventos de Cobranças (confirmada, recebida, vencida, estornada) e de Assinaturas (removida, inativada).',
    ],
  },
  mercadopago: {
    nome: 'Mercado Pago',
    resumo: 'Cartão e saldo em conta · assinatura recorrente',
    chave: 'access_token',
    campos: [
      { id: 'access_token', nome: 'Access Token', dica: m2('TEST-…', 'APP_USR-…') },
      { id: 'webhook_secret', nome: 'Assinatura secreta do webhook', dica: 'aparece depois de salvar o webhook' },
    ],
    passos: (m) => [
      `Entre em mercadopago.com.br/developers → Suas integrações → sua aplicação → Credenciais ${m === 'teste' ? 'de teste' : 'de produção'} e copie o Access Token.`,
      `Webhooks → Configurar notificações → ${m === 'teste' ? 'Modo de teste' : 'Modo produtivo'}: cole a URL abaixo.`,
      'Marque o evento “Planos e assinaturas” e salve.',
      'Copie a “Assinatura secreta” gerada e cole no campo acima.',
    ],
  },
  stripe: {
    nome: 'Stripe',
    resumo: 'Cartão nacional e internacional',
    chave: 'secret_key',
    campos: [
      { id: 'secret_key', nome: 'Chave secreta', dica: m2('sk_test_…', 'sk_live_…') },
      { id: 'webhook_secret', nome: 'Signing secret do webhook', dica: 'começa com whsec_' },
    ],
    passos: (m) => [
      `No dashboard da Stripe, ${m === 'teste' ? 'ligue o “Test mode”' : 'desligue o “Test mode”'} → Developers → API keys e copie a Secret key.`,
      'Developers → Webhooks → Add endpoint: cole a URL abaixo.',
      'Eventos: checkout.session.completed, customer.subscription.created, customer.subscription.updated e customer.subscription.deleted.',
      'Abra o endpoint criado, revele o “Signing secret” e cole no campo acima.',
    ],
  },
}
function m2(teste: string, prod: string) {
  return `teste: ${teste} · produção: ${prod}`
}
const urlWebhook = (g: Gw) => `${SUPABASE_URL}/functions/v1/pagamentos/webhook/${g}`
const NOME_MODO: Record<Modo, string> = { teste: 'Teste', producao: 'Produção' }

export default function Pagamentos({ c }: { c: SupabaseClient }) {
  const toast = useToast()
  const [info, setInfo] = useState<Info | null>(null)
  const [erro, setErro] = useState('')
  const [gw, setGw] = useState<Gw>('asaas')
  const [modo, setModo] = useState<Modo>('teste')
  const [editarGw, setEditarGw] = useState<Gw>('asaas')
  const [editarModo, setEditarModo] = useState<Modo>('teste')
  const [confirmar, setConfirmar] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    const { data, error } = await c.rpc('admin_pagamentos')
    if (error) return setErro(erroPt(error))
    const d = data as Info
    setInfo(d)
    return d
  }, [c])

  useEffect(() => {
    carregar().then((d) => {
      if (!d) return
      setGw(d.gateway)
      setModo(d.modo)
      setEditarGw(d.gateway)
      setEditarModo(d.modo)
    })
  }, [carregar])

  const mudou = info && (gw !== info.gateway || modo !== info.modo)
  const semChave = info && !info.credenciais[gw][modo][GATEWAYS[gw].chave]
  const semWebhook = info && !info.credenciais[gw][modo][GATEWAYS[gw].campos[1].id]

  const aplicar = async () => {
    setSalvando(true)
    const { error } = await c.rpc('admin_config_pagamentos', { p_gateway: gw, p_modo: modo })
    setSalvando(false)
    setConfirmar(false)
    if (error) return toast(erroPt(error), 'info')
    toast(`${GATEWAYS[gw].nome} em modo ${NOME_MODO[modo]}`, 'ok')
    carregar()
  }

  return (
    <>
      <Cabecalho titulo="Pagamentos" sub="Gateway das assinaturas do app e chaves de cada um" />
      {erro && <div className="p-aviso">{erro}</div>}
      {!info ? (
        <div className="skeleton" style={{ height: 220, borderRadius: 20 }} />
      ) : (
        <>
          <div className="p-kpis">
            {[
              { v: info.assinaturas.ativa ?? 0, r: 'Assinaturas ativas', s: `${info.assinaturas.atrasada ?? 0} com pagamento atrasado` },
              { v: info.assinaturas.pendente ?? 0, r: 'Aguardando pagamento', s: 'links abertos ainda não pagos' },
              { v: precoBR(Number(info.receita_mensal)), r: 'Receita recorrente', s: 'por mês (anuais divididos por 12)' },
              { v: NOME_MODO[info.modo], r: 'Modo atual', s: `${GATEWAYS[info.gateway].nome} · números deste modo`, alerta: info.modo === 'teste' },
            ].map((k, i) => (
              <motion.div key={k.r} className="p-kpi" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <span className="p-cinza">{k.r}</span>
                <b className={k.alerta ? 'texto-alerta' : ''}>{k.v}</b>
                <small>{k.s}</small>
              </motion.div>
            ))}
          </div>

          <div className="p-card" style={{ marginTop: 18 }}>
            <h3>Gateway das assinaturas</h3>
            <p className="p-cinza" style={{ marginTop: 4 }}>As novas assinaturas são criadas no gateway e no modo escolhidos aqui. As que já existem continuam no gateway onde foram feitas.</p>
            <div className="p-gateways" role="radiogroup" aria-label="Gateway">
              {(Object.keys(GATEWAYS) as Gw[]).map((g) => (
                <button key={g} role="radio" aria-checked={gw === g} className={`p-gateway ${gw === g ? 'is-on' : ''}`} onClick={() => { setGw(g); setEditarGw(g) }}>
                  <b>
                    {GATEWAYS[g].nome}
                    {info.gateway === g && <span className="selo selo--lilas">em uso</span>}
                  </b>
                  <small>{GATEWAYS[g].resumo}</small>
                </button>
              ))}
            </div>
            <div className="p-modo">
              <label className="rotulo" htmlFor="modo-pag" style={{ margin: 0 }}>Modo</label>
              <select id="modo-pag" className={`p-select ${modo === 'producao' ? 'is-producao' : ''}`} value={modo} onChange={(e) => { setModo(e.target.value as Modo); setEditarModo(e.target.value as Modo) }}>
                <option value="teste">Teste (sandbox, sem cobrança real)</option>
                <option value="producao">Produção (cobrança real)</option>
              </select>
              <button className="btn btn--turquesa btn--pequeno" disabled={!mudou || salvando} onClick={() => (modo === 'producao' ? setConfirmar(true) : aplicar())}>
                {salvando ? 'Aplicando…' : 'Aplicar'}
              </button>
            </div>
            {(semChave || semWebhook) && (
              <div className="p-aviso" style={{ marginTop: 14 }}>
                {semChave
                  ? `Falta a chave de ${NOME_MODO[modo].toLowerCase()} do ${GATEWAYS[gw].nome}: sem ela o app mostra “assinaturas ainda não liberadas”.`
                  : `Falta o segredo do webhook de ${NOME_MODO[modo].toLowerCase()} do ${GATEWAYS[gw].nome}: sem ele os pagamentos não são confirmados no app.`}
              </div>
            )}
          </div>

          <div className="p-card" style={{ marginTop: 18 }}>
            <div className="p-card__cab" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <h3>Chaves e webhook</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div className="p-periodo">
                  {(Object.keys(GATEWAYS) as Gw[]).map((g) => (
                    <button key={g} className={editarGw === g ? 'is-on' : ''} onClick={() => setEditarGw(g)}>{GATEWAYS[g].nome}</button>
                  ))}
                </div>
                <div className="p-periodo">
                  {(['teste', 'producao'] as Modo[]).map((m) => (
                    <button key={m} className={editarModo === m ? 'is-on' : ''} onClick={() => setEditarModo(m)}>{NOME_MODO[m]}</button>
                  ))}
                </div>
              </div>
            </div>
            <Credenciais key={`${editarGw}-${editarModo}`} c={c} gw={editarGw} modo={editarModo} atuais={info.credenciais[editarGw][editarModo]} onSalvo={carregar} />
          </div>

          <div className="p-card" style={{ marginTop: 18 }}>
            <h3>Últimos avisos dos gateways</h3>
            {info.eventos.length === 0 ? (
              <p className="p-cinza" style={{ marginTop: 6 }}>Nenhum aviso recebido ainda. Depois de cadastrar o webhook, use o botão de teste do gateway: o aviso aparece aqui.</p>
            ) : (
              <div className="p-tabela-wrap" style={{ marginTop: 10 }}>
                <table className="p-tabela p-tabela--simples">
                  <thead><tr><th>Quando</th><th>Gateway</th><th>Modo</th><th>Evento</th><th>Resultado</th></tr></thead>
                  <tbody>
                    {info.eventos.map((e, i) => (
                      <tr key={i} style={{ cursor: 'default' }}>
                        <td className="p-cinza">{dataHoraBR(e.recebido_em)}</td>
                        <td>{GATEWAYS[e.gateway]?.nome ?? e.gateway}</td>
                        <td>{e.modo ? NOME_MODO[e.modo] : '—'}</td>
                        <td className="p-mono" style={{ fontSize: 13 }}>{e.tipo}</td>
                        <td>{e.resultado ?? 'processando'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <Modal aberto={confirmar} onFechar={() => setConfirmar(false)}>
        <h3 style={{ textAlign: 'center' }}>Ligar o modo Produção?</h3>
        <p className="legenda" style={{ textAlign: 'center', fontSize: 14.5 }}>
          A partir de agora, quem assinar no app será cobrado de verdade pelo {GATEWAYS[gw].nome}.
        </p>
        <button className="btn btn--primario btn--bloco" style={{ marginTop: 16 }} disabled={salvando} onClick={aplicar}>Sim, cobrar de verdade</button>
        <button className="btn btn--fantasma btn--bloco" style={{ marginTop: 8 }} onClick={() => setConfirmar(false)}>Voltar</button>
      </Modal>
    </>
  )
}

function Credenciais({ c, gw, modo, atuais, onSalvo }: { c: SupabaseClient; gw: Gw; modo: Modo; atuais: Record<string, string | null>; onSalvo: () => void }) {
  const toast = useToast()
  const [valores, setValores] = useState<Record<string, string>>({})
  const [visivel, setVisivel] = useState<Record<string, boolean>>({})
  const [salvando, setSalvando] = useState('')
  const g = GATEWAYS[gw]

  const salvar = async (campo: string, valor: string) => {
    setSalvando(campo)
    const { error } = await c.rpc('admin_salvar_credencial', { p_gateway: gw, p_modo: modo, p_campo: campo, p_valor: valor })
    setSalvando('')
    if (error) return toast(erroPt(error), 'info')
    toast(valor ? 'Chave salva' : 'Chave apagada', valor ? 'ok' : 'info')
    setValores((v) => ({ ...v, [campo]: '' }))
    setVisivel((v) => ({ ...v, [campo]: false }))
    onSalvo()
  }
  const gerar = (campo: string) => {
    const b = crypto.getRandomValues(new Uint8Array(24))
    setValores((v) => ({ ...v, [campo]: [...b].map((x) => x.toString(16).padStart(2, '0')).join('') }))
    setVisivel((v) => ({ ...v, [campo]: true }))
  }
  const copiar = (t: string) => navigator.clipboard?.writeText(t).then(() => toast('Copiado', 'ok'))

  return (
    <div style={{ marginTop: 6 }}>
      {g.campos.map((f) => (
        <div key={f.id}>
          <label className="rotulo" htmlFor={`cred-${f.id}`}>
            {f.nome} · {NOME_MODO[modo]}{' '}
            {atuais[f.id] ? <span className="selo selo--sucesso">salva {atuais[f.id]}</span> : <span className="selo selo--alerta">não configurada</span>}
          </label>
          <div className="p-cred">
            <input
              id={`cred-${f.id}`}
              className="campo"
              type={visivel[f.id] ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder={atuais[f.id] ? 'cole uma nova para trocar' : f.dica}
              value={valores[f.id] ?? ''}
              onChange={(e) => setValores((v) => ({ ...v, [f.id]: e.target.value }))}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              {f.gerar && !valores[f.id] && <button className="btn btn--contorno btn--pequeno" onClick={() => gerar(f.id)}>Gerar</button>}
              {f.gerar && valores[f.id] && visivel[f.id] && <button className="btn btn--contorno btn--pequeno" onClick={() => copiar(valores[f.id])} aria-label="Copiar token"><Icon name="copy" size={16} /></button>}
              <button className="btn btn--turquesa btn--pequeno" disabled={!valores[f.id]?.trim() || salvando === f.id} onClick={() => salvar(f.id, valores[f.id])}>
                {salvando === f.id ? 'Salvando…' : 'Salvar'}
              </button>
              {atuais[f.id] && !valores[f.id] && <button className="btn btn--fantasma btn--pequeno" onClick={() => salvar(f.id, '')}>Apagar</button>}
            </div>
          </div>
          {f.gerar && valores[f.id] && visivel[f.id] && <p className="legenda">Copie este token antes de salvar: depois ele só aparece pelos 4 últimos caracteres.</p>}
        </div>
      ))}

      <label className="rotulo">URL do webhook ({g.nome}, serve para teste e produção)</label>
      <div className="p-url">
        <code>{urlWebhook(gw)}</code>
        <button className="btn btn--contorno btn--pequeno" onClick={() => copiar(urlWebhook(gw))} aria-label="Copiar URL"><Icon name="copy" size={16} /></button>
      </div>
      <ol className="p-passos">
        {g.passos(modo).map((p) => <li key={p}>{p}</li>)}
      </ol>
    </div>
  )
}
