import type { SupabaseClient } from '@supabase/supabase-js'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import GraficoPeso from '../components/GraficoPeso'
import Icon from '../components/Icon'
import Mascot from '../components/Mascot'
import { Modal, useToast } from '../components/ui'
import { lerSaude } from '../data/nuvem'
import { MODULOS, semana, ultimoPeso, vazio, type Modulo } from '../data/store'
import { DIA_MS, dataBR, dataHoraBR, num, relativo } from '../lib/datas'
import { erroPt } from '../lib/supabase'
import { AuthPainel, usePainel } from './Auth'
import { Cabecalho, PainelLayout } from './Layout'

type Profissional = { id: string; nome: string; profissao: string; registro_conselho: string; uf: string | null; codigo_convite: string; verificado: boolean }

type Paciente = {
  id: string
  nome: string
  atualizado: string
  peso?: number
  proteina?: number
  aplicacoes?: string
  alerta?: string
  modulos: Modulo[]
  expira: string | null
  resumo: string
  pesos?: number[]
}

type LinhaPaciente = { paciente_id: string; nome: string; peso_inicial_kg: number | null; meta_proteina_g: number; meta_agua_ml: number; modulos: Modulo[]; expira_em: string | null }

/** Monta o resumo do paciente só com os módulos autorizados (o banco já não devolve o resto). */
async function montarPaciente(c: SupabaseClient, l: LinhaPaciente): Promise<Paciente> {
  const base = vazio()
  const s = await lerSaude(c, l.paciente_id, { ...base, perfil: { ...base.perfil, nome: l.nome, peso_inicial_kg: Number(l.peso_inicial_kg ?? 0), meta_proteina_g: l.meta_proteina_g, meta_agua_ml: l.meta_agua_ml } })
  const m = l.modulos
  const w = semana(s)
  const up = ultimoPeso(s)
  const datas = [...s.refeicoes.map((r) => r.em), ...s.agua.map((r) => r.em), ...s.pesos.map((r) => r.em), ...s.aplicacoes.map((r) => r.em), ...s.sintomas.map((r) => r.em), ...s.treinos.map((r) => r.em)].sort()
  const ult = datas[datas.length - 1]
  const apl = s.aplicacoes.filter((a) => new Date(a.em).getTime() >= Date.now() - 28 * DIA_MS).length
  const alertas = s.sintomas.filter((x) => x.alerta && new Date(x.em).getTime() >= w.inicio.getTime())
  const pesoIni = s.perfil.peso_inicial_kg || s.pesos[0]?.kg
  const partes: string[] = []
  if (m.includes('nutricao')) partes.push(w.proteinaMedia ? `Proteína na meta em ${w.diasProteinaMeta} de 7 dias (média ${w.proteinaMedia} g/dia). Água na meta em ${w.diasAguaMeta} dias.` : 'Sem refeições registradas na semana.')
  if (m.includes('peso') && s.pesos.length > 1) partes.push(up.kg < pesoIni ? 'Peso em queda desde o início.' : 'Peso estável ou em alta desde o início.')
  if (m.includes('sintomas')) partes.push(w.sintomasSemana.length ? `Sintomas na semana: ${[...new Set(w.sintomasSemana.flatMap((x) => x.sintomas))].join(', ').toLowerCase()}.` : 'Nenhum sintoma registrado.')
  if (m.includes('aplicacoes')) partes.push(`${Math.min(apl, 4)} de 4 aplicações registradas nas últimas 4 semanas.`)
  if (m.includes('bemestar')) partes.push(`${w.treinosForca} treino(s) de força na semana.`)
  return {
    id: l.paciente_id,
    nome: l.nome || 'Paciente',
    atualizado: ult ? relativo(ult) : 'sem registros',
    peso: m.includes('peso') && up && pesoIni && s.pesos.length > 1 ? +(up.kg - pesoIni).toFixed(1) : undefined,
    proteina: m.includes('nutricao') ? w.proteinaMedia : undefined,
    aplicacoes: m.includes('aplicacoes') ? `${Math.min(apl, 4)} de 4` : undefined,
    alerta: m.includes('sintomas') && alertas.length ? 'sintoma forte' : undefined,
    modulos: m,
    expira: l.expira_em,
    resumo: partes.join(' ') || 'Sem dados nos módulos autorizados.',
    pesos: m.includes('peso') ? [...s.pesos].sort((a, b) => +new Date(a.em) - +new Date(b.em)).slice(-8).map((p) => p.kg) : undefined,
  }
}

const ITENS = [
  { to: '/pro', nome: 'Pacientes', icone: 'users' as const, end: true },
  { to: '/pro/convites', nome: 'Convites', icone: 'mail' as const },
  { to: '/pro/relatorios', nome: 'Relatórios', icone: 'file' as const },
  { to: '/pro/conta', nome: 'Minha conta', icone: 'settings' as const },
]

type Relatorio = { id: string; paciente: string; em: string; modulos: Modulo[] }

export default function ProPainel() {
  const { c, estado, avaliar, sair, sessao } = usePainel('pro')
  const [prof, setProf] = useState<Profissional | null | undefined>(undefined)
  const [relatorios, setRelatorios] = useState<Relatorio[]>([])

  const carregarProf = useCallback(async () => {
    const { data, error } = await c.from('professionals').select('*').maybeSingle()
    if (error) throw error
    setProf(data as Profissional | null)
  }, [c])

  useEffect(() => {
    if (estado === 'pronto') carregarProf().catch(() => setProf(null))
    else setProf(undefined)
  }, [estado, carregarProf])

  if (estado !== 'pronto')
    return (
      <AuthPainel
        area="pro"
        c={c}
        estado={estado}
        onPronto={avaliar}
        descricao="Acompanhe seus pacientes entre as consultas, vendo só o que cada um autorizou."
        tituloCadastro="Criar conta"
        camposCadastro={[
          { id: 'nome', rotulo: 'Nome completo (como no conselho)', placeholder: 'Dra. Ana Souza' },
          { id: 'profissao', rotulo: 'Profissão', opcoes: ['Nutricionista', 'Médico(a) endocrinologista', 'Médico(a)', 'Educador(a) físico(a)', 'Psicólogo(a)', 'Outro'] },
          { id: 'registro', rotulo: 'Registro no conselho', placeholder: 'CRN-3 12345' },
          { id: 'uf', rotulo: 'UF', placeholder: 'SP' },
        ]}
        metaCadastro={(v) => ({ tipo: 'profissional', nome: v.nome ?? '', profissao: v.profissao ?? '', registro: v.registro ?? '', uf: (v.uf ?? '').slice(0, 2) })}
      />
    )

  if (prof === undefined) return <div className="p-carregando"><Mascot expressao="pensativo" size={100} /></div>
  if (prof === null) return <CompletarCadastro c={c} onPronto={carregarProf} onSair={sair} />

  return (
    <PainelLayout sufixo="Pro" itens={ITENS} usuario={{ nome: prof.nome, papel: `${prof.profissao} · ${prof.registro_conselho}` }} onSair={sair}>
      <Routes>
        <Route index element={<Pacientes c={c} prof={prof} onRelatorio={(r) => setRelatorios((l) => [r, ...l])} />} />
        <Route path="convites" element={<Convites c={c} prof={prof} />} />
        <Route path="relatorios" element={<Relatorios lista={relatorios} />} />
        <Route path="conta" element={<Conta prof={prof} email={sessao?.user.email ?? ''} />} />
        <Route path="*" element={<Navigate to="/pro" replace />} />
      </Routes>
    </PainelLayout>
  )
}

function CompletarCadastro({ c, onPronto, onSair }: { c: SupabaseClient; onPronto: () => void; onSair: () => void }) {
  const [v, setV] = useState({ nome: '', profissao: 'Nutricionista', registro: '', uf: '' })
  const [erro, setErro] = useState('')
  return (
    <div className="p-carregando">
      <form
        className="p-card p-form-card"
        onSubmit={async (e) => {
          e.preventDefault()
          const { error } = await c.rpc('criar_profissional', { p_nome: v.nome, p_profissao: v.profissao, p_registro: v.registro, p_uf: v.uf })
          if (error) return setErro(erroPt(error))
          onPronto()
        }}
      >
        <Mascot expressao="acenando" size={80} />
        <h2 style={{ marginTop: 8 }}>Complete seu cadastro profissional</h2>
        <p className="p-cinza">Com ele você recebe seu código de convite para os pacientes.</p>
        <label className="rotulo" htmlFor="cn">Nome completo</label>
        <input id="cn" className="campo" value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} required />
        <label className="rotulo" htmlFor="cp">Profissão</label>
        <input id="cp" className="campo" value={v.profissao} onChange={(e) => setV({ ...v, profissao: e.target.value })} required />
        <div className="duas-col">
          <div>
            <label className="rotulo" htmlFor="cr">Registro no conselho</label>
            <input id="cr" className="campo" value={v.registro} onChange={(e) => setV({ ...v, registro: e.target.value })} required />
          </div>
          <div>
            <label className="rotulo" htmlFor="cu">UF</label>
            <input id="cu" className="campo" maxLength={2} value={v.uf} onChange={(e) => setV({ ...v, uf: e.target.value.toUpperCase() })} />
          </div>
        </div>
        {erro && <p className="erro-campo">{erro}</p>}
        <div className="duas-col" style={{ marginTop: 18 }}>
          <button type="button" className="btn btn--contorno" onClick={onSair}>Sair</button>
          <button className="btn btn--primario">Salvar</button>
        </div>
      </form>
    </div>
  )
}

const NA = <span className="p-na">não autorizado</span>

function Pacientes({ c, prof, onRelatorio }: { c: SupabaseClient; prof: Profissional; onRelatorio: (r: Relatorio) => void }) {
  const toast = useToast()
  const [busca, setBusca] = useState('')
  const [lista, setLista] = useState<Paciente[] | null>(null)
  const [erro, setErro] = useState('')
  const [selId, setSelId] = useState<string | null>(null)
  const [pdf, setPdf] = useState(false)
  const [convite, setConvite] = useState(false)
  const registrados = useRef(new Set<string>())

  const carregar = useCallback(async () => {
    try {
      const { data, error } = await c.rpc('pacientes_do_profissional')
      if (error) throw error
      const pacientes = await Promise.all(((data ?? []) as LinhaPaciente[]).map((l) => montarPaciente(c, l)))
      setLista(pacientes)
      setErro('')
    } catch (e) {
      setErro(erroPt(e))
    }
  }, [c])

  // atualiza a cada 20 s: quem revogou some da lista na próxima atualização
  useEffect(() => {
    carregar()
    const iv = setInterval(carregar, 20000)
    return () => clearInterval(iv)
  }, [carregar])

  const filtrada = useMemo(() => (lista ?? []).filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase())), [lista, busca])
  const sel = filtrada.find((p) => p.id === selId) ?? filtrada[0]

  // todo acesso fica no histórico do paciente
  const registrar = useCallback(
    async (p: Paciente, acao: string) => {
      const { error } = await c.rpc('registrar_acesso', { p_paciente: p.id, p_acao: acao })
      if (error) toast(erroPt(error), 'info')
    },
    [c, toast],
  )
  useEffect(() => {
    if (sel && !registrados.current.has(sel.id)) {
      registrados.current.add(sel.id)
      registrar(sel, 'Abriu o resumo do paciente')
    }
  }, [sel, registrar])

  return (
    <>
      <Cabecalho titulo="Pacientes" sub={`${prof.nome} · você vê apenas o que cada paciente autorizou`}>
        <div className="p-busca">
          <Icon name="search" size={18} />
          <input className="campo" placeholder="Buscar paciente" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar paciente" />
        </div>
        <button className="btn btn--primario" onClick={() => setConvite(true)}>+ Convidar paciente</button>
      </Cabecalho>

      {lista === null ? (
        <div className="p-tabela-wrap" style={{ padding: 16, display: 'grid', gap: 10 }}>
          {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 52 }} />)}
        </div>
      ) : lista.length === 0 ? (
        <div className="p-vazio">
          <Mascot expressao="piscando" size={110} />
          <h2>Nenhum paciente ainda</h2>
          <p>Envie seu código <b className="p-mono">{prof.codigo_convite}</b>. O paciente autoriza no app em Perfil → Compartilhar e aparece aqui.</p>
          <button className="btn btn--primario" onClick={() => setConvite(true)}>Convidar paciente</button>
        </div>
      ) : (
        <div className="p-pacientes">
          <div className="p-tabela-wrap">
            <table className="p-tabela">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Atualizado</th>
                  <th>Peso</th>
                  <th>Proteína média</th>
                  <th>Aplicações</th>
                  <th>Alertas</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {filtrada.map((p, i) => (
                    <motion.tr
                      key={p.id}
                      layout
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0, transition: { delay: i * 0.04 } }}
                      exit={{ opacity: 0, x: 40, transition: { duration: 0.3 } }}
                      className={sel?.id === p.id ? 'is-sel' : ''}
                      onClick={() => setSelId(p.id)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setSelId(p.id)}
                    >
                      <td><b>{p.nome}</b></td>
                      <td className="p-cinza">{p.atualizado}</td>
                      <td>{p.peso !== undefined ? `${p.peso < 0 ? '−' : '+'}${num(Math.abs(p.peso))} kg` : p.modulos.includes('peso') ? <span className="p-cinza">{p.pesos?.length === 1 ? '1 registro' : 'sem dados'}</span> : NA}</td>
                      <td>{p.proteina !== undefined ? (p.proteina ? `${p.proteina} g/dia` : 'sem dados') : NA}</td>
                      <td>{p.aplicacoes ?? NA}</td>
                      <td>{p.alerta ? <span className="selo selo--alerta">{p.alerta}</span> : <span className="p-cinza">{p.modulos.includes('sintomas') ? 'nenhum' : '—'}</span>}</td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
            {erro && <div className="p-dica"><Mascot expressao="alerta" size={40} flutuar={false} /><span>{erro}</span></div>}
          </div>

          {sel && (
            <AnimatePresence mode="wait">
              <motion.aside key={sel.id} className="p-resumo" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.3 }}>
                <span className="p-sobre">Resumo do paciente</span>
                <h2>{sel.nome}</h2>
                <p className="p-cinza">Autorizou: {sel.modulos.map((m) => MODULOS.find((x) => x.id === m)!.nome.toLowerCase()).join(', ')}</p>
                <p className="p-cinza">Acesso até: {sel.expira ? dataBR(sel.expira) : 'o paciente revogar'}</p>
                {sel.pesos && sel.pesos.length > 1 && (
                  <div className="p-grafico">
                    <GraficoPeso pontos={sel.pesos} altura={130} />
                  </div>
                )}
                <div className="p-texto-resumo">{sel.resumo}</div>
                <button className="btn btn--contorno btn--bloco" onClick={() => { setPdf(true); registrar(sel, 'Gerou relatório em PDF') }}>
                  <Icon name="file" size={18} /> Gerar relatório em PDF
                </button>
                <p className="legenda" style={{ marginTop: 10 }}>Este acesso fica registrado no histórico do paciente.</p>
              </motion.aside>
            </AnimatePresence>
          )}
        </div>
      )}

      <Modal aberto={pdf} onFechar={() => setPdf(false)} largura={620}>
        {sel && (
          <div className="relatorio" id="relatorio">
            <div className="relatorio__topo">
              <div>
                <b className="logo" style={{ fontSize: 20, color: 'var(--roxo)' }}>canetolino<em>Pro</em></b>
                <p className="legenda">Relatório do período · gerado em {dataHoraBR(new Date())} por {prof.nome}</p>
              </div>
              <Mascot expressao="feliz" size={40} flutuar={false} />
            </div>
            <h3>{sel.nome}</h3>
            <p className="legenda">Módulos autorizados: {sel.modulos.map((m) => MODULOS.find((x) => x.id === m)!.nome).join(' · ')}</p>
            <table className="p-tabela p-tabela--simples">
              <tbody>
                <tr><td>Variação de peso</td><td>{sel.peso !== undefined ? `${num(sel.peso)} kg` : sel.modulos.includes('peso') ? 'sem dados' : 'não autorizado'}</td></tr>
                <tr><td>Proteína média (7 dias)</td><td>{sel.proteina !== undefined ? `${sel.proteina} g/dia (inclui estimativas da IA)` : 'não autorizado'}</td></tr>
                <tr><td>Aplicações (4 semanas)</td><td>{sel.aplicacoes ?? 'não autorizado'}</td></tr>
                <tr><td>Alertas</td><td>{sel.modulos.includes('sintomas') ? sel.alerta ?? 'nenhum' : 'não autorizado'}</td></tr>
              </tbody>
            </table>
            {sel.pesos && sel.pesos.length > 1 && <GraficoPeso pontos={sel.pesos} altura={120} />}
            <p style={{ marginTop: 10 }}>{sel.resumo}</p>
            <p className="legenda" style={{ marginTop: 12 }}>Dados registrados pelo paciente; refeições podem conter estimativas da IA, conferidas por ele. O Canetolino não faz avaliação médica nem recomenda doses.</p>
            <div className="duas-col nao-imprimir" style={{ marginTop: 18 }}>
              <button className="btn btn--contorno" onClick={() => setPdf(false)}>Fechar</button>
              <button
                className="btn btn--primario"
                onClick={() => {
                  onRelatorio({ id: crypto.randomUUID(), paciente: sel.nome, em: new Date().toISOString(), modulos: sel.modulos })
                  window.print()
                }}
              >
                <Icon name="download" size={18} /> Baixar PDF
              </button>
            </div>
          </div>
        )}
      </Modal>
      <ModalConvite aberto={convite} onFechar={() => setConvite(false)} codigo={prof.codigo_convite} />
    </>
  )
}

function ModalConvite({ aberto, onFechar, codigo }: { aberto: boolean; onFechar: () => void; codigo: string }) {
  const toast = useToast()
  const texto = `Oi! Para eu acompanhar seu tratamento no Canetolino, abra o app, vá em Perfil → Compartilhar e use o código ${codigo}. ${window.location.origin}/#/app`
  return (
    <Modal aberto={aberto} onFechar={onFechar}>
      <h3>Convidar paciente</h3>
      <p className="legenda">O paciente usa o código no app e escolhe o que você poderá ver.</p>
      <div className="p-codigo">
        <span>{codigo}</span>
        <button className="btn btn--lilas btn--pequeno" onClick={() => { navigator.clipboard?.writeText(codigo); toast('Código copiado') }}>
          <Icon name="copy" size={16} /> Copiar
        </button>
      </div>
      <div className="duas-col" style={{ marginTop: 18 }}>
        <a className="btn btn--contorno" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer">Enviar no WhatsApp</a>
        <a className="btn btn--primario" href={`mailto:?subject=${encodeURIComponent('Convite Canetolino')}&body=${encodeURIComponent(texto)}`}>Enviar por e-mail</a>
      </div>
    </Modal>
  )
}

function gerarCodigo(nome: string) {
  const base = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^(dra?\.?)\s+/i, '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X')
  return `${base}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
}

function Convites({ c, prof }: { c: SupabaseClient; prof: Profissional }) {
  const toast = useToast()
  const [lista, setLista] = useState<{ code: string; enviado_para: string | null; created_at: string; expira_em: string; usado_em: string | null }[]>([])
  const carregar = useCallback(async () => {
    const { data } = await c.from('invite_codes').select('*').eq('profissional_id', prof.id).order('created_at', { ascending: false })
    setLista(data ?? [])
  }, [c, prof.id])
  useEffect(() => {
    carregar()
  }, [carregar])

  const novo = async () => {
    for (let t = 0; t < 4; t++) {
      const code = gerarCodigo(prof.nome)
      const { error } = await c.from('invite_codes').insert({ code, profissional_id: prof.id, enviado_para: 'código avulso' })
      if (!error) {
        navigator.clipboard?.writeText(code)
        toast(`Código ${code} criado e copiado`)
        return carregar()
      }
    }
    toast('Não foi possível gerar o código agora', 'info')
  }

  const status = (x: (typeof lista)[number]) => (x.usado_em ? 'usado' : new Date(x.expira_em) < new Date() ? 'expirado' : 'pendente')

  return (
    <>
      <Cabecalho titulo="Convites" sub="Códigos avulsos expiram em 7 dias e valem para um paciente">
        <button className="btn btn--primario" onClick={novo}>+ Gerar código avulso</button>
      </Cabecalho>
      <div className="p-card">
        <div className="p-destaque-codigo">
          <div>
            <span className="p-sobre">Seu código permanente</span>
            <div className="p-codigo-grande">{prof.codigo_convite}</div>
            <p className="p-cinza">Compartilhe com seus pacientes. Eles autorizam no app, em Perfil → Compartilhar.</p>
          </div>
          <Mascot expressao="piscando" size={90} />
        </div>
      </div>
      {lista.length > 0 && (
        <div className="p-tabela-wrap" style={{ marginTop: 18 }}>
          <table className="p-tabela">
            <thead><tr><th>Código</th><th>Criado em</th><th>Expira em</th><th>Status</th></tr></thead>
            <tbody>
              <AnimatePresence initial={false}>
                {lista.map((x) => (
                  <motion.tr key={x.code} initial={{ opacity: 0, backgroundColor: '#e2f6ef' }} animate={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0)' }} transition={{ duration: 1.2 }}>
                    <td><b className="p-mono">{x.code}</b></td>
                    <td className="p-cinza">{dataBR(x.created_at)}</td>
                    <td className="p-cinza">{dataBR(x.expira_em)}</td>
                    <td><span className={`selo ${status(x) === 'pendente' ? 'selo--lilas' : status(x) === 'usado' ? 'selo--sucesso' : 'selo--alerta'}`}>{status(x)}</span></td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function Relatorios({ lista }: { lista: Relatorio[] }) {
  return (
    <>
      <Cabecalho titulo="Relatórios" sub="PDFs gerados nesta sessão" />
      {lista.length === 0 ? (
        <div className="p-vazio">
          <Mascot expressao="dormindo" size={110} />
          <h2>Nenhum relatório ainda</h2>
          <p>Selecione um paciente na lista e toque em “Gerar relatório em PDF”.</p>
        </div>
      ) : (
        <div className="p-tabela-wrap">
          <table className="p-tabela">
            <thead><tr><th>Paciente</th><th>Gerado em</th><th>Módulos</th></tr></thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.id}><td><b>{r.paciente}</b></td><td className="p-cinza">{dataHoraBR(r.em)}</td><td>{r.modulos.join(', ')}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function Conta({ prof, email }: { prof: Profissional; email: string }) {
  return (
    <>
      <Cabecalho titulo="Minha conta" />
      <div className="p-grade-2">
        <div className="p-card">
          <span className="p-sobre">Perfil profissional</span>
          <h2 style={{ marginTop: 6 }}>{prof.nome}</h2>
          <p className="p-cinza">{prof.profissao} · {prof.registro_conselho}{prof.uf ? ` · ${prof.uf}` : ''}</p>
          <p className="p-cinza">{email}</p>
          {prof.verificado ? (
            <span className="selo selo--sucesso" style={{ marginTop: 12 }}><Icon name="check" size={14} /> Registro verificado</span>
          ) : (
            <span className="selo selo--lilas" style={{ marginTop: 12 }}>Registro em verificação pela equipe Canetolino</span>
          )}
        </div>
        <div className="p-card">
          <span className="p-sobre">Segurança</span>
          <p style={{ marginTop: 10 }}><Icon name="shield" size={18} className="p-inline-ic" /> Verificação em duas etapas <b>ativa</b></p>
          <p style={{ marginTop: 8 }}><Icon name="eye" size={18} className="p-inline-ic" /> Todo acesso a dados de pacientes gera registro de auditoria visível para o paciente.</p>
        </div>
      </div>
    </>
  )
}
