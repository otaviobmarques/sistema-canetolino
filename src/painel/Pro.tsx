import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import GraficoPeso from '../components/GraficoPeso'
import Icon from '../components/Icon'
import Mascot from '../components/Mascot'
import { Modal, useToast } from '../components/ui'
import { compartilhamentoAtivo, MODULOS, semana, ultimoPeso, useStore, type Estado, type Modulo } from '../data/store'
import { DIA_MS, dataBR, dataHoraBR, num, relativo, uid } from '../lib/datas'
import { Cabecalho, LoginPainel, PainelLayout, usarSessao } from './Layout'

/* Pacientes de exemplo (estáticos). Jessica vem do app, ao vivo, conforme a permissão dela. */
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
  aoVivo?: boolean
}

const EXEMPLOS: Paciente[] = [
  { id: 'marcos', nome: 'Marcos L.', atualizado: 'ontem', peso: -3.2, proteina: 71, aplicacoes: '3 de 4', alerta: 'sintoma forte', modulos: ['peso', 'nutricao', 'aplicacoes', 'sintomas'], expira: '2027-01-15', resumo: 'Registrou vômitos persistentes ontem e recebeu o alerta para procurar atendimento. Proteína abaixo da meta em 5 de 7 dias.', pesos: [104.1, 103.5, 102.9, 102.6, 102.2, 101.8, 101.3, 100.9] },
  { id: 'carla', nome: 'Carla M.', atualizado: 'há 5 dias', peso: -1.0, aplicacoes: '4 de 4', modulos: ['peso', 'aplicacoes'], expira: null, resumo: 'Aplicações em dia. Poucos registros nesta semana.', pesos: [76.2, 76.0, 75.9, 75.6, 75.5, 75.4, 75.3, 75.2] },
  { id: 'paulo', nome: 'Paulo R.', atualizado: 'hoje', peso: -8.4, proteina: 102, aplicacoes: '4 de 4', modulos: ['peso', 'nutricao', 'aplicacoes', 'sintomas'], expira: '2026-12-20', resumo: 'Proteína na meta em 6 de 7 dias. Três treinos de força. Nenhum sintoma registrado.', pesos: [112.3, 111.0, 109.8, 108.4, 107.1, 106.0, 104.9, 103.9] },
]

function pacienteDoApp(s: Estado): Paciente | null {
  const c = s.compartilhamentos.find((x) => x.profissionalId === 'ana' && compartilhamentoAtivo(x))
  if (!c || !s.sessao) return null
  const m = c.modulos
  const w = semana(s)
  const up = ultimoPeso(s)
  const ultimos = [
    ...s.refeicoes.map((r) => r.em), ...s.agua.map((r) => r.em), ...s.pesos.map((r) => r.em), ...s.aplicacoes.map((r) => r.em), ...s.sintomas.map((r) => r.em),
  ].sort().pop()
  const quatroSemanas = Date.now() - 28 * DIA_MS
  const apl = s.aplicacoes.filter((a) => new Date(a.em).getTime() >= quatroSemanas).length
  const alertas = s.sintomas.filter((x) => x.alerta && new Date(x.em).getTime() >= w.inicio.getTime())
  const partes: string[] = []
  if (m.includes('nutricao') && w.proteinaMedia) partes.push(`Proteína na meta em ${w.diasProteinaMeta} de 7 dias (média ${w.proteinaMedia} g/dia).`)
  if (m.includes('peso') && s.pesos.length > 1) partes.push(up.kg < s.perfil.peso_inicial_kg ? 'Peso caindo de forma constante.' : 'Peso estável nas últimas semanas.')
  if (m.includes('sintomas')) partes.push(w.sintomasSemana.length ? `Sintomas: ${[...new Set(w.sintomasSemana.flatMap((x) => x.sintomas))].join(', ').toLowerCase()}.` : 'Nenhum sintoma registrado.')
  if (m.includes('aplicacoes')) partes.push(`${Math.min(apl, 4)} de 4 aplicações registradas no último mês.`)
  return {
    id: 'jessica',
    nome: `${s.perfil.nome || 'Paciente'} B.`,
    atualizado: ultimos ? relativo(ultimos) : '—',
    peso: m.includes('peso') && up ? +(up.kg - s.perfil.peso_inicial_kg).toFixed(1) : undefined,
    proteina: m.includes('nutricao') ? w.proteinaMedia : undefined,
    aplicacoes: m.includes('aplicacoes') ? `${Math.min(apl, 4)} de 4` : undefined,
    alerta: m.includes('sintomas') && alertas.length ? 'sintoma forte' : undefined,
    modulos: m,
    expira: c.expira_em,
    resumo: partes.join(' ') || 'Sem dados nos módulos autorizados nesta semana.',
    pesos: m.includes('peso') ? [...s.pesos].sort((a, b) => +new Date(a.em) - +new Date(b.em)).slice(-8).map((p) => p.kg) : undefined,
    aoVivo: true,
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
  const sessao = usarSessao('canetolino:pro')
  const [relatorios, setRelatorios] = useState<Relatorio[]>([])
  if (!sessao.ok)
    return <LoginPainel sufixo="Pro" emailPadrao="ana.souza@nutri.com.br" onEntrar={sessao.entrar} descricao="Acompanhe seus pacientes entre as consultas, vendo só o que cada um autorizou." />
  return (
    <PainelLayout sufixo="Pro" itens={ITENS} usuario={{ nome: 'Dra. Ana Souza', papel: 'Nutricionista · CRN-3' }} onSair={sessao.sair}>
      <Routes>
        <Route index element={<Pacientes onRelatorio={(r) => setRelatorios((l) => [r, ...l])} />} />
        <Route path="convites" element={<Convites />} />
        <Route path="relatorios" element={<Relatorios lista={relatorios} />} />
        <Route path="conta" element={<Conta />} />
        <Route path="*" element={<Navigate to="/pro" replace />} />
      </Routes>
    </PainelLayout>
  )
}

const NA = <span className="p-na">não autorizado</span>

function Pacientes({ onRelatorio }: { onRelatorio: (r: Relatorio) => void }) {
  const { s, set } = useStore()
  const toast = useToast()
  const [busca, setBusca] = useState('')
  const [selId, setSelId] = useState('jessica')
  const [pdf, setPdf] = useState(false)
  const [convite, setConvite] = useState(false)
  const jessica = pacienteDoApp(s)
  const todos = useMemo(() => [...(jessica ? [jessica] : []), ...EXEMPLOS], [jessica])
  const lista = todos.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase()))
  const sel = todos.find((p) => p.id === selId) ?? todos[0]

  const registrar = (acao: string) => {
    if (sel?.aoVivo) set((x) => ({ ...x, auditoria: [...x.auditoria, { id: uid(), ator: 'Dra. Ana Souza', acao, em: new Date().toISOString() }] }))
  }

  return (
    <>
      <Cabecalho titulo="Pacientes" sub="Dra. Ana Souza · você vê apenas o que cada paciente autorizou">
        <div className="p-busca">
          <Icon name="search" size={18} />
          <input className="campo" placeholder="Buscar paciente" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar paciente" />
        </div>
        <button className="btn btn--primario" onClick={() => setConvite(true)}>+ Convidar paciente</button>
      </Cabecalho>

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
                {lista.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    layout
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: i * 0.05 } }}
                    exit={{ opacity: 0, x: 40, transition: { duration: 0.3 } }}
                    className={sel?.id === p.id ? 'is-sel' : ''}
                    onClick={() => {
                      setSelId(p.id)
                      if (p.aoVivo) set((x) => ({ ...x, auditoria: [...x.auditoria, { id: uid(), ator: 'Dra. Ana Souza', acao: 'Abriu o resumo do paciente', em: new Date().toISOString() }] }))
                    }}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setSelId(p.id)}
                  >
                    <td><b>{p.nome}</b>{p.aoVivo && <span className="p-vivo" title="Dados ao vivo do app">ao vivo</span>}</td>
                    <td className="p-cinza">{p.atualizado}</td>
                    <td>{p.peso !== undefined ? `${p.peso < 0 ? '−' : '+'}${num(Math.abs(p.peso))} kg` : NA}</td>
                    <td>{p.proteina !== undefined ? (p.proteina ? `${p.proteina} g/dia` : 'sem dados') : NA}</td>
                    <td>{p.aplicacoes ?? NA}</td>
                    <td>{p.alerta ? <span className="selo selo--alerta">{p.alerta}</span> : <span className="p-cinza">nenhum</span>}</td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {!jessica && (
            <div className="p-dica">
              <Mascot expressao="dormindo" size={48} flutuar={false} />
              <span>A paciente do app (Jessica) não aparece porque o acesso foi revogado, expirou, ou a conta de demonstração não está carregada. Abra o app para autorizar com o código <b>ANA-4821</b>.</span>
            </div>
          )}
          {lista.length === 0 && <p className="p-cinza" style={{ padding: 20 }}>Nenhum paciente encontrado.</p>}
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
              <button className="btn btn--contorno btn--bloco" onClick={() => { setPdf(true); registrar('Gerou relatório em PDF') }}>
                <Icon name="file" size={18} /> Gerar relatório em PDF
              </button>
              <p className="legenda" style={{ marginTop: 10 }}>Este acesso fica registrado no histórico do paciente.</p>
            </motion.aside>
          </AnimatePresence>
        )}
      </div>

      <Modal aberto={pdf} onFechar={() => setPdf(false)} largura={620}>
        {sel && (
          <div className="relatorio" id="relatorio">
            <div className="relatorio__topo">
              <div>
                <b className="logo" style={{ fontSize: 20, color: 'var(--roxo)' }}>canetolino<em>Pro</em></b>
                <p className="legenda">Relatório do período · gerado em {dataHoraBR(new Date())}</p>
              </div>
              <Mascot expressao="feliz" size={40} flutuar={false} />
            </div>
            <h3>{sel.nome}</h3>
            <p className="legenda">Módulos autorizados: {sel.modulos.map((m) => MODULOS.find((x) => x.id === m)!.nome).join(' · ')}</p>
            <table className="p-tabela p-tabela--simples">
              <tbody>
                <tr><td>Variação de peso</td><td>{sel.peso !== undefined ? `${num(sel.peso)} kg` : 'não autorizado'}</td></tr>
                <tr><td>Proteína média</td><td>{sel.proteina !== undefined ? `${sel.proteina} g/dia (inclui estimativas da IA)` : 'não autorizado'}</td></tr>
                <tr><td>Aplicações (4 semanas)</td><td>{sel.aplicacoes ?? 'não autorizado'}</td></tr>
                <tr><td>Alertas</td><td>{sel.alerta ?? 'nenhum'}</td></tr>
              </tbody>
            </table>
            {sel.pesos && sel.pesos.length > 1 && <GraficoPeso pontos={sel.pesos} altura={120} />}
            <p style={{ marginTop: 10 }}>{sel.resumo}</p>
            <p className="legenda" style={{ marginTop: 12 }}>Dados marcados por origem: registrados pelo paciente, importados de integrações e estimados pela IA. O Canetolino não faz avaliação médica nem recomenda doses.</p>
            <div className="duas-col nao-imprimir" style={{ marginTop: 18 }}>
              <button className="btn btn--contorno" onClick={() => setPdf(false)}>Fechar</button>
              <button
                className="btn btn--primario"
                onClick={() => {
                  onRelatorio({ id: uid(), paciente: sel.nome, em: new Date().toISOString(), modulos: sel.modulos })
                  toast('Relatório gerado')
                  window.print()
                }}
              >
                <Icon name="download" size={18} /> Baixar PDF
              </button>
            </div>
          </div>
        )}
      </Modal>
      <ModalConvite aberto={convite} onFechar={() => setConvite(false)} />
    </>
  )
}

function ModalConvite({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  return (
    <Modal aberto={aberto} onFechar={onFechar}>
      <h3>Convidar paciente</h3>
      <p className="legenda">O paciente recebe o código e escolhe, no app, o que você poderá ver.</p>
      <div className="p-codigo">
        <span>ANA-4821</span>
        <button className="btn btn--lilas btn--pequeno" onClick={() => { navigator.clipboard?.writeText('ANA-4821'); toast('Código copiado') }}>
          <Icon name="copy" size={16} /> Copiar
        </button>
      </div>
      <label className="rotulo" htmlFor="ce">Ou envie por e-mail</label>
      <input id="ce" className="campo" type="email" placeholder="paciente@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <div className="duas-col" style={{ marginTop: 18 }}>
        <button className="btn btn--contorno" onClick={onFechar}>Cancelar</button>
        <button className="btn btn--primario" disabled={!email.includes('@')} onClick={() => { toast(`Convite enviado para ${email}`); setEmail(''); onFechar() }}>Enviar convite</button>
      </div>
    </Modal>
  )
}

function Convites() {
  const toast = useToast()
  const [lista, setLista] = useState([
    { codigo: 'ANA-7310', para: 'roberta.s@email.com', criado: new Date(Date.now() - 2 * DIA_MS).toISOString(), status: 'pendente' },
    { codigo: 'ANA-5528', para: 'Link copiado', criado: new Date(Date.now() - 9 * DIA_MS).toISOString(), status: 'expirado' },
  ])
  return (
    <>
      <Cabecalho titulo="Convites" sub="Códigos de convite expiram em 7 dias">
        <button
          className="btn btn--primario"
          onClick={() => {
            const codigo = `ANA-${Math.floor(1000 + Math.random() * 9000)}`
            setLista((l) => [{ codigo, para: 'Link copiado', criado: new Date().toISOString(), status: 'pendente' }, ...l])
            navigator.clipboard?.writeText(codigo)
            toast(`Código ${codigo} criado e copiado`)
          }}
        >
          + Gerar novo código
        </button>
      </Cabecalho>
      <div className="p-card">
        <div className="p-destaque-codigo">
          <div>
            <span className="p-sobre">Seu código permanente</span>
            <div className="p-codigo-grande">ANA-4821</div>
            <p className="p-cinza">Compartilhe com seus pacientes. Eles autorizam no app, em Perfil → Compartilhar.</p>
          </div>
          <Mascot expressao="piscando" size={90} />
        </div>
      </div>
      <div className="p-tabela-wrap" style={{ marginTop: 18 }}>
        <table className="p-tabela">
          <thead><tr><th>Código</th><th>Enviado para</th><th>Criado em</th><th>Status</th></tr></thead>
          <tbody>
            <AnimatePresence initial={false}>
              {lista.map((c) => (
                <motion.tr key={c.codigo} initial={{ opacity: 0, backgroundColor: '#e2f6ef' }} animate={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0)' }} transition={{ duration: 1.2 }}>
                  <td><b className="p-mono">{c.codigo}</b></td>
                  <td>{c.para}</td>
                  <td className="p-cinza">{dataBR(c.criado)}</td>
                  <td><span className={`selo ${c.status === 'pendente' ? 'selo--lilas' : 'selo--alerta'}`}>{c.status}</span></td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
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

function Conta() {
  return (
    <>
      <Cabecalho titulo="Minha conta" />
      <div className="p-grade-2">
        <div className="p-card">
          <span className="p-sobre">Perfil profissional</span>
          <h2 style={{ marginTop: 6 }}>Dra. Ana Souza</h2>
          <p className="p-cinza">Nutricionista · CRN-3 48213 · SP</p>
          <span className="selo selo--sucesso" style={{ marginTop: 12 }}><Icon name="check" size={14} /> Registro verificado</span>
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
