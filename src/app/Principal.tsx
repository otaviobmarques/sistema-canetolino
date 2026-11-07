import BotaoInstalar from '../components/Instalar'
import BotaoMinhaFicha from './MinhaFicha'
import { CampoDose, HistoricoDoses, ModalDose } from './Doses'
import { formatarDose } from '../lib/dose'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import GraficoPeso from '../components/GraficoPeso'
import Icon from '../components/Icon'
import Domma from '../components/Domma'
import Mascot from '../components/Mascot'
import { Anel, Interruptor, Modal, soltarConfete, useToast } from '../components/ui'
import {
  aguaDoDia,
  calcularImc,
  evolucaoPeso,
  textoTotalPeso,
  compartilhamentoAtivo,
  doseAtual,
  inicioDoTratamento,
  dicaDoDose,
  LOCAIS,
  LOCAL_LONGO,
  MODULOS,
  proteinaDoDia,
  proximaAplicacao,
  resumoDoDose,
  semana,
  sugerirLocal,
  ultimoPeso,
  useStore,
  type Local,
} from '../data/store'
import { PLANOS, precoBR } from '../data/planos'
import { resumoSemanal } from '../lib/ia'
import { baixarRelatorio } from '../painel/relatorio'
import { ativar, desativar, situacao, testar, type SituacaoLembretes } from '../lib/notificacoes'
import { erroPt, sb } from '../lib/supabase'
import { dataBR, dataDiaMes, dataHoraBR, DIA_MS, diasEntre, DIAS_LONGOS, inicioDoDia, mesAno, mesmoDia, num, saudacaoData, uid } from '../lib/datas'

const cartaoAnim = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.05 + i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } }),
}
const Cartao = ({ i, className = 'card', children, ...rest }: { i: number; className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
  <motion.div className={className} variants={cartaoAnim} custom={i} initial="hidden" animate="show" {...(rest as object)}>
    {children}
  </motion.div>
)

function rotuloEm(d: Date) {
  const n = diasEntre(new Date(), d)
  if (n <= 0) return 'hoje'
  if (n === 1) return 'amanhã'
  return `em ${n} dias`
}
const horaCurta = (h: string) => (h.endsWith(':00') ? `${Number(h.slice(0, 2))}h` : h.replace(':', 'h'))

/* ======================= 3. Início ======================= */
export function Home() {
  const { s, set } = useStore()
  const nav = useNavigate()
  const toast = useToast()
  const prox = proximaAplicacao(s)
  const prot = Math.round(proteinaDoDia(s))
  const agua = aguaDoDia(s)
  const peso = ultimoPeso(s)
  const imcAtual = calcularImc(peso?.kg, s.perfil.altura_cm)
  const evo = evolucaoPeso(s)
  const mostrarTotal = s.config.mostrarTotalPeso !== false
  const metasBatidas = prot >= s.perfil.meta_proteina_g && agua >= s.perfil.meta_agua_ml
  const [pulo, setPulo] = useState(0)

  const maisCopo = (e: React.MouseEvent) => {
    const antes = agua
    set((x) => ({ ...x, agua: [...x.agua, { id: uid(), ml: 250, em: new Date().toISOString() }] }))
    setPulo((p) => p + 1)
    if (antes < s.perfil.meta_agua_ml && antes + 250 >= s.perfil.meta_agua_ml) {
      soltarConfete({ x: e.clientX, y: e.clientY }, 50)
      toast('Meta de água batida! 💧')
    }
  }

  return (
    <div className="tela tela--com-nav">
      <header className="home-topo">
        <div>
          <p className="legenda">{saudacaoData()}</p>
          <h1 className="titulo-tela" style={{ marginTop: 2 }}>Oi, {s.perfil.nome || 'você'}!</h1>
        </div>
        <Mascot expressao={metasBatidas ? 'comemorando' : 'feliz'} size={56} />
      </header>

      {prox && (
        <Cartao i={0} className="card card--destaque prox-apl">
          <div className="prox-apl__topo">
            <span className="sobretitulo">Próxima aplicação</span>
            <span className="prox-apl__pill">{rotuloEm(prox)}</span>
          </div>
          <h2>
            {DIAS_LONGOS[prox.getDay()].replace(/^./, (c) => c.toUpperCase())}, {dataDiaMes(prox)} · {horaCurta(s.medicamento!.horario)}
          </h2>
          <p className="prox-apl__med">
            {s.medicamento!.principio} · dose {doseAtual(s) ? `conforme receita (${doseAtual(s)})` : s.medicamento!.dose_texto}
          </p>
          <Link to="/app/jornada" className="btn btn--turquesa btn--bloco" style={{ marginTop: 14 }}>
            Ver minha jornada
          </Link>
        </Cartao>
      )}

      <div className="grade-2">
        <Cartao i={1} className="card card-prot" onClick={() => nav('/app/registrar/refeicao')} role="button" tabIndex={0} aria-label="Registrar refeição">
          <b className="card-titulo">Proteína</b>
          {prot > 0 ? (
            <Anel valor={prot} max={s.perfil.meta_proteina_g}>
              <div>
                <div className="anel-num">{prot} g</div>
                <div className="legenda" style={{ fontSize: 12 }}>de {s.perfil.meta_proteina_g} g</div>
              </div>
            </Anel>
          ) : (
            <div className="sem-registro">
              <Mascot expressao="pensativo" size={40} flutuar={false} />
              <span>Sem registro hoje</span>
            </div>
          )}
        </Cartao>
        <Cartao i={2} className="card">
          <b className="card-titulo">Água</b>
          {agua > 0 ? (
            <motion.div key={pulo} className="agua-num" initial={{ scale: 1.15, color: '#2EC4B6' }} animate={{ scale: 1, color: '#3B1A6E' }} transition={{ duration: 0.5 }}>
              {num(agua / 1000)} L
            </motion.div>
          ) : (
            <div className="agua-num agua-num--vazia">Sem registro hoje</div>
          )}
          <div className="barra-prog" aria-hidden>
            <motion.i initial={{ width: 0 }} animate={{ width: `${Math.min(100, (agua / s.perfil.meta_agua_ml) * 100)}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
          </div>
          <p className="legenda">meta de {num(s.perfil.meta_agua_ml / 1000, s.perfil.meta_agua_ml % 1000 ? 1 : 0)} L</p>
          <button className="btn btn--lilas btn--bloco btn--pequeno" style={{ marginTop: 10, minHeight: 44 }} onClick={maisCopo}>
            + 1 copo (250 ml)
          </button>
        </Cartao>
      </div>

      <Cartao i={3} className="card card--lilas dica">
        <span className="sobretitulo sobretitulo--violeta">Dica do Dose</span>
        <p>{dicaDoDose(s)}</p>
      </Cartao>

      <Cartao i={4} className="card linha-peso" onClick={() => nav('/app/evolucao')} role="button" tabIndex={0}>
        <div>
          <b className="card-titulo">Peso</b>
          <div className="peso-num">{peso ? `${num(peso.kg)} kg` : '—'}</div>
          {imcAtual && <span className="legenda">IMC {num(imcAtual.valor)} · {imcAtual.faixa}</span>}
        </div>
        {mostrarTotal && evo.total !== null && Math.abs(evo.total) >= 0.1 && (
          <span className={`selo ${evo.total < 0 ? 'selo--sucesso' : 'selo--lilas'}`}>
            {textoTotalPeso(evo.total)} {evo.total > 0 ? 'desde o início' : `desde ${dataBR(evo.inicial!.em)}`}
          </span>
        )}
        {mostrarTotal && peso && !evo.temEvolucao && <span className="legenda" style={{ maxWidth: 150, textAlign: 'right' }}>Registre seu próximo peso para acompanhar sua evolução</span>}
      </Cartao>
    </div>
  )
}

/* ======================= 6. Jornada ======================= */
export function Jornada() {
  const { s, set } = useStore()
  const toast = useToast()
  const prox = proximaAplicacao(s)
  const sugestao = sugerirLocal(s.aplicacoes)
  const [local, setLocal] = useState<Local>(sugestao)
  const [obs, setObs] = useState('')
  const [dose, setDose] = useState(() => doseAtual(s))
  const [outroDia, setOutroDia] = useState(false)
  const [canetaAberta, setCanetaAberta] = useState(false)
  const ordenadas = [...s.aplicacoes].sort((a, b) => +new Date(b.em) - +new Date(a.em))
  const inicio = inicioDoTratamento(s)
  const semanaNum = inicio ? Math.max(1, Math.ceil((diasEntre(inicio, new Date()) + 1) / 7)) : 1
  const aplicouHoje = ordenadas.some((a) => mesmoDia(a.em, new Date()))
  const canetas = s.canetas.reduce((t, c) => t + c.quantidade, 0)
  const validade = s.canetas.map((c) => c.validade).sort()[0]
  const validadeProxima = validade && new Date(validade + '-01').getTime() - Date.now() < 30 * DIA_MS
  const mes = new Date()
  const gasto = s.compras.filter((c) => new Date(c.em).getMonth() === mes.getMonth() && new Date(c.em).getFullYear() === mes.getFullYear()).reduce((t, c) => t + c.valor_centavos, 0)

  const registrar = (e: React.MouseEvent) => {
    const nova = { id: uid(), em: new Date().toISOString(), local, obs: obs.trim() || undefined, dose: formatarDose(dose) || undefined }
    const antes = { aplicacoes: s.aplicacoes, canetas: s.canetas }
    set((x) => ({
      ...x,
      aplicacoes: [...x.aplicacoes, nova],
      canetas: x.canetas.map((c, i) => (i === 0 && c.quantidade > 0 ? { ...c, quantidade: c.quantidade - 1 } : c)),
    }))
    soltarConfete({ x: e.clientX, y: e.clientY }, 60)
    toast(`Aplicação registrada: ${LOCAL_LONGO[local]}`, 'ok', {
      rotulo: 'Desfazer',
      fn: () => set((x) => ({ ...x, aplicacoes: x.aplicacoes.filter((a) => a.id !== nova.id), canetas: antes.canetas })),
    })
    setObs('')
  }

  return (
    <div className="tela tela--com-nav">
      <h1 className="titulo-tela">Minha jornada</h1>
      <Cartao i={0} className="card" >
        <div className="jornada-topo">
          <b>{prox ? `Próxima: ${DIAS_LONGOS[prox.getDay()]}, ${dataDiaMes(prox)}` : 'Registre sua aplicação'}</b>
          <span className="legenda">Semana {semanaNum}</span>
        </div>
        <p className="legenda" style={{ margin: '6px 0 12px', fontSize: 14 }}>
          Quando aplicar, registre aqui. Sugestão do Dose para o rodízio: <b style={{ color: 'var(--roxo)' }}>{LOCAL_LONGO[sugestao].toLowerCase()}</b>.
        </p>
        <div className="grade-locais" role="radiogroup" aria-label="Local da aplicação">
          {LOCAIS.map((l) => (
            <button key={l} role="radio" aria-checked={local === l} className={`chip chip--quadrado chip--turquesa ${local === l ? 'is-on' : ''}`} onClick={() => setLocal(l)}>
              {l}
              {l === sugestao && <span className="ponto-sugestao" aria-label="sugerido" />}
            </button>
          ))}
        </div>
        <div className="jornada-dose">
          <label className="rotulo" htmlFor="j-dose">Dose</label>
          <CampoDose id="j-dose" value={dose} onChange={setDose} />
        </div>
        <input className="campo" style={{ marginTop: 8, minHeight: 46 }} placeholder="Observação (opcional)" maxLength={200} aria-label="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
        {aplicouHoje && <p className="legenda" style={{ marginTop: 8 }}>Você já registrou uma dose hoje. Se foi engano, edite ou exclua no histórico abaixo.</p>}
        <button className="btn btn--primario btn--bloco" style={{ marginTop: 12 }} onClick={registrar}>
          Registrar aplicação de hoje
        </button>
        <div className="jornada-cards">
          <button className="btn btn--contorno btn--pequeno" onClick={() => setOutroDia(true)}><Icon name="calendar" size={16} /> Foi em outro dia</button>
          <Link to="/app/jornada/anteriores" className="btn btn--contorno btn--pequeno"><Icon name="upload" size={16} /> Doses anteriores</Link>
        </div>
      </Cartao>

      {s.perfil.jornada === 'em_tratamento' && ordenadas.length <= 1 && (
        <Link to="/app/jornada/anteriores" className="card card--dica-link">
          <Mascot expressao="piscando" size={46} flutuar={false} />
          <span><b>Já anotava suas doses?</b> Traga o histórico do bloco de notas ou do caderno para a sua jornada começar do início real.</span>
        </Link>
      )}

      <h2 className="secao-titulo">Histórico de aplicações</h2>
      {ordenadas.length > 0 && (
        <p className="total-aplicacoes">
          Você já fez <b>{ordenadas.length} {ordenadas.length === 1 ? 'aplicação' : 'aplicações'}</b>
          {inicio ? ` desde ${dataBR(inicio)}` : ''}.
        </p>
      )}
      {ordenadas.length ? (
        <HistoricoDoses />
      ) : (
        <div className="vazio">
          <Mascot expressao="piscando" size={70} />
          <p>Ainda não há aplicações. Quando aplicar, escolha o local acima e toque em “Registrar aplicação de hoje”.</p>
        </div>
      )}
      <ModalDose aberto={outroDia} onFechar={() => setOutroDia(false)} />

      <div className="grade-2" style={{ marginTop: 14 }}>
        <Cartao i={2} className="card" role="button" tabIndex={0} onClick={() => setCanetaAberta(true)} style={{ cursor: 'pointer' }}>
          <b className="card-titulo">Minhas canetas</b>
          <div className="peso-num" style={{ fontSize: 22 }}>{canetas} em casa</div>
          <p className={`legenda ${validadeProxima ? 'texto-alerta' : ''}`}>{validade ? `Validade: ${mesAno(validade)}` : 'Toque para adicionar'}</p>
        </Cartao>
        <Cartao i={3} className="card" role="button" tabIndex={0} onClick={() => setCanetaAberta(true)} style={{ cursor: 'pointer' }}>
          <b className="card-titulo">Gasto no mês</b>
          <div className="peso-num" style={{ fontSize: 22 }}>{gasto ? (gasto / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ —'}</div>
          <p className="legenda">{canetas ? `Próxima compra em ~${canetas} ${canetas === 1 ? 'semana' : 'semanas'}` : 'Hora de comprar'}</p>
        </Cartao>
      </div>
      <ModalCanetas aberto={canetaAberta} onFechar={() => setCanetaAberta(false)} />
    </div>
  )
}

function ModalCanetas({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { s, set } = useStore()
  const toast = useToast()
  const [qtd, setQtd] = useState('1')
  const [valor, setValor] = useState('')
  const [validade, setValidade] = useState('2027-06')
  return (
    <Modal aberto={aberto} onFechar={onFechar}>
      <h3>Registrar compra de canetas</h3>
      <p className="legenda">Fica no módulo Custos, só pra você.</p>
      <div className="duas-col">
        <div>
          <label className="rotulo" htmlFor="mq">Quantidade</label>
          <input id="mq" className="campo" inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div>
          <label className="rotulo" htmlFor="mv">Valor pago (R$)</label>
          <input id="mv" className="campo" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value.replace(/[^\d,]/g, ''))} />
        </div>
      </div>
      <label className="rotulo" htmlFor="mval">Validade</label>
      <input id="mval" className="campo" type="month" value={validade} onChange={(e) => setValidade(e.target.value)} />
      <div className="duas-col" style={{ marginTop: 20 }}>
        <button className="btn btn--contorno" onClick={onFechar}>Cancelar</button>
        <button
          className="btn btn--primario"
          disabled={!Number(qtd)}
          onClick={() => {
            const n = Number(qtd)
            set((x) => ({
              ...x,
              canetas: [...x.canetas, { id: uid(), nome: 'Caneta', lote: '—', validade, quantidade: n }],
              compras: [...x.compras, { id: uid(), em: new Date().toISOString(), quantidade: n, valor_centavos: Math.round(Number(valor.replace(',', '.') || 0) * 100) }],
            }))
            toast(`${n} ${n === 1 ? 'caneta adicionada' : 'canetas adicionadas'}`)
            onFechar()
          }}
        >
          Salvar
        </button>
      </div>
      {s.canetas.length > 0 && <p className="legenda" style={{ marginTop: 12 }}>Alerta de validade 30 dias antes do vencimento.</p>}
    </Modal>
  )
}

/* ======================= 8. Radar ======================= */
export function Radar() {
  const { s } = useStore()
  const nav = useNavigate()
  const w = useMemo(() => semana(s), [s])
  const evo = useMemo(() => evolucaoPeso(s), [s])
  const mostrarTotal = s.config.mostrarTotalPeso !== false
  const resumoRegras = useMemo(() => resumoDoDose(s), [s])
  const [resumoIA, setResumoIA] = useState<string | null>(null)
  const [escrevendo, setEscrevendo] = useState(false)
  const chaveDia = new Date(w.fim).toISOString().slice(0, 10)
  const podeIA = !!resumoRegras && s.config.ia
  // indicadores agregados, sem nome, e-mail ou documento
  const indicadores = useMemo(() => {
    const ultApl = [...s.aplicacoes].sort((a, b) => +new Date(b.em) - +new Date(a.em))[0]
    return {
      dias_com_registro: w.diasComRegistro,
      meta_proteina_g: s.perfil.meta_proteina_g,
      proteina_media_g_dia: w.proteinaMedia || null,
      dias_proteina_na_meta: w.diasProteinaMeta,
      dias_agua_na_meta: w.diasAguaMeta,
      treinos_forca: w.treinosForca,
      variacao_peso_kg_semana: evo.semana,
      sintomas: w.sintomasSemana.map((x) => ({ sintomas: x.sintomas, intensidade: x.intensidade, dias_apos_ultima_aplicacao: ultApl ? diasEntre(ultApl.em, x.em) : null })),
      aplicacao_registrada_na_semana: s.aplicacoes.some((a) => new Date(a.em) >= w.inicio),
      sono_medio_horas: w.sonoMedio,
      humor_medio_1a5: w.humorMedio,
      fome_media_1a5: w.fomeMedia,
    }
  }, [s, w, evo])
  useEffect(() => {
    if (!podeIA) return
    let vivo = true
    setEscrevendo(true)
    resumoSemanal(chaveDia, indicadores)
      .then((r) => vivo && setResumoIA(r.bloqueado ? null : r.resumo ?? null))
      .catch(() => vivo && setResumoIA(null))
      .finally(() => vivo && setEscrevendo(false))
    return () => {
      vivo = false
    }
    // gera uma vez por dia; o servidor guarda e devolve o mesmo texto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podeIA, chaveDia])
  const resumo = resumoIA ?? resumoRegras
  const intensidade = w.sintomasSemana.length ? Math.max(...w.sintomasSemana.map((x) => x.intensidade)) : 0
  const diasSint = new Set(w.sintomasSemana.map((x) => inicioDoDia(x.em).getTime())).size
  const ativo = s.compartilhamentos.find(compartilhamentoAtivo)
  const [baixando, setBaixando] = useState(false)
  const toast = useToast()

  return (
    <div className="tela tela--com-nav">
      <h1 className="titulo-tela">Radar da semana</h1>
      <p className="legenda" style={{ marginBottom: 14 }}>
        {dataDiaMes(w.inicio)} a {dataDiaMes(w.fim)}
      </p>

      {resumo ? (
        <Cartao i={0} className="card card--destaque resumo-dose">
          <Mascot expressao="feliz" size={46} flutuar={false} />
          <div>
            <span className="sobretitulo">Resumo do Dose</span>
            {escrevendo && !resumoIA ? (
              <p className="resumo-dose__txt resumo-dose__escrevendo">O Dose está escrevendo seu resumo…</p>
            ) : (
              <motion.p key={resumo} className="resumo-dose__txt" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{resumo}</motion.p>
            )}
            <p className="resumo-dose__aviso">{resumoIA ? 'Resumo escrito pela IA' : 'Resumo gerado'} a partir dos seus registros. Não é avaliação médica.</p>
          </div>
        </Cartao>
      ) : (
        <Cartao i={0} className="card card--lilas vazio vazio--linha">
          <Mascot expressao="dormindo" size={64} />
          <div>
            <b style={{ color: 'var(--roxo)' }}>Semana com poucos dados</b>
            <p className="legenda">Com pelo menos 3 dias de registro eu consigo montar seu resumo. Que tal registrar a água de hoje?</p>
          </div>
        </Cartao>
      )}

      <Cartao i={1} className="card" >
        <div className="jornada-topo">
          <div>
            <b>Peso desde o início</b>
            {evo.inicial && <span className="legenda" style={{ display: 'block' }}>desde {dataBR(evo.inicial.em)}</span>}
          </div>
          {mostrarTotal && evo.total !== null && (
            <div style={{ textAlign: 'right' }}>
              <b style={{ color: evo.total <= 0 ? 'var(--sucesso)' : 'var(--violeta)' }}>{textoTotalPeso(evo.total)}</b>
              {evo.semana !== null && Math.abs(evo.semana) >= 0.1 && <span className="legenda" style={{ display: 'block' }}>{textoTotalPeso(evo.semana)} nesta semana</span>}
            </div>
          )}
        </div>
        <GraficoPeso pontos={evo.serie} ultimaSemana={evo.semanaFinal} />
      </Cartao>

      <div className="grade-2" style={{ marginTop: 12 }}>
        <Indicador i={2} rotulo="Proteína média" valor={w.proteinaMedia ? `${w.proteinaMedia} g/dia` : 'sem dados'} />
        <Indicador i={3} rotulo="Água na meta" valor={`${w.diasAguaMeta} de 7 dias`} />
        <Indicador i={4} rotulo="Treino de força" valor={`${w.treinosForca} ${w.treinosForca === 1 ? 'sessão' : 'sessões'}`} />
        <Indicador i={5} rotulo="Sintomas" valor={diasSint ? `${diasSint} ${diasSint === 1 ? 'dia' : 'dias'}, ${intensidade <= 2 ? 'leve' : intensidade <= 3 ? 'moderado' : 'forte'}` : 'nenhum'} />
        <Indicador i={6} rotulo="Sono médio" valor={w.sonoMedio != null ? `${num(w.sonoMedio)} h/noite` : 'sem registro'} />
        <Indicador i={7} rotulo="Humor médio" valor={w.humorMedio != null ? `${num(w.humorMedio)} de 5` : 'sem registro'} />
      </div>

      <button
        className="btn btn--lilas btn--bloco"
        style={{ marginTop: 14 }}
        disabled={baixando}
        onClick={async () => {
          if (s.perfil.plano !== 'premium') return nav('/app/planos')
          setBaixando(true)
          try {
            await baixarRelatorio(sb('app'), null, 30, s.perfil.nome || 'meu')
          } catch (e) {
            toast(erroPt(e), 'info')
          } finally {
            setBaixando(false)
          }
        }}
      >
        <Icon name="download" size={20} /> {baixando ? 'Gerando PDF…' : 'Baixar meu relatório (30 dias)'}
        {s.perfil.plano !== 'premium' && <span className="selo selo--roxo" style={{ padding: '1px 8px' }}>Premium</span>}
      </button>
      <BotaoMinhaFicha style={{ marginTop: 10 }} />
      <button className="btn btn--contorno btn--bloco" style={{ marginTop: 10 }} onClick={() => nav('/app/perfil/compartilhar')}>
        <Icon name="upload" size={20} /> Enviar relatório {ativo ? `à ${ativo.profissao.toLowerCase()}` : 'a um profissional'}
      </button>
    </div>
  )
}

function CartaoLembretes() {
  const { s, set } = useStore()
  const toast = useToast()
  const [sit, setSit] = useState<SituacaoLembretes | null>(null)
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    situacao().then(setSit).catch(() => setSit('sem-suporte'))
  }, [])
  const texto: Record<SituacaoLembretes, string> = {
    ligado: 'Ligados neste aparelho. Você recebe o aviso do dia de aplicação, da água e da validade das canetas.',
    desligado: 'Receba o aviso do dia de aplicação, da água e da validade das canetas, mesmo com o app fechado.',
    bloqueado: 'As notificações estão bloqueadas neste navegador. Libere nas configurações do site para receber os lembretes.',
    'precisa-instalar': 'No iPhone, os lembretes funcionam com o app na tela de início: toque em Compartilhar → Adicionar à Tela de Início e abra por lá.',
    'sem-suporte': 'Este navegador não recebe notificações. Tente pelo Chrome, Edge, Firefox ou Safari atualizado.',
  }
  return (
    <div className="card lista-config">
      <div className="linha-config" style={{ alignItems: 'flex-start' }}>
        <div>
          <b>Notificações neste aparelho</b>
          <span>{sit ? texto[sit] : 'Verificando…'}</span>
        </div>
        {sit === 'ligado' && <span className="selo selo--sucesso" style={{ flex: 'none' }}>ligados</span>}
      </div>
      {(sit === 'desligado' || sit === 'ligado') && (
        <div className="linha-config" style={{ gap: 8 }}>
          {sit === 'desligado' ? (
            <button
              className="btn btn--primario btn--bloco btn--pequeno"
              disabled={ocupado}
              onClick={async () => {
                setOcupado(true)
                try {
                  await ativar(s.userId!)
                  setSit('ligado')
                  toast('Lembretes ligados 💜')
                } catch (e) {
                  toast(erroPt(e), 'info')
                  setSit(await situacao())
                } finally {
                  setOcupado(false)
                }
              }}
            >
              <Icon name="calendar" size={18} /> Ligar lembretes
            </button>
          ) : (
            <>
              <button
                className="btn btn--lilas btn--pequeno"
                style={{ flex: 1 }}
                disabled={ocupado}
                onClick={async () => {
                  setOcupado(true)
                  try {
                    const n = await testar()
                    toast(n ? 'Lembrete de teste enviado' : 'Não consegui enviar o teste. Tente ligar de novo.', 'info')
                  } catch (e) {
                    toast(erroPt(e), 'info')
                  } finally {
                    setOcupado(false)
                  }
                }}
              >
                Enviar teste
              </button>
              <button className="btn btn--contorno btn--pequeno" style={{ flex: 1 }} disabled={ocupado} onClick={async () => { await desativar(); setSit('desligado'); toast('Lembretes desligados neste aparelho', 'info') }}>
                Desligar
              </button>
            </>
          )}
        </div>
      )}
      <div className="linha-config">
        <div><b>Lembretes de água</b><span>Às 10h, 14h e 18h, se a meta ainda não foi batida</span></div>
        <Interruptor ligado={s.config.lembretesAgua} onChange={(v) => set((x) => ({ ...x, config: { ...x.config, lembretesAgua: v } }))} rotulo="Lembretes de água" />
      </div>
    </div>
  )
}

const Indicador = ({ i, rotulo, valor }: { i: number; rotulo: string; valor: string }) => (
  <Cartao i={i} className="card indicador">
    <span className="legenda">{rotulo}</span>
    <b>{valor}</b>
  </Cartao>
)

/* ======================= 9. Perfil ======================= */
export function Perfil() {
  const { s, set, sair, revogar: revogarAcesso, excluirConta } = useStore()
  const [ocupado, setOcupado] = useState(false)
  const [erroModal, setErroModal] = useState('')
  const nav = useNavigate()
  const toast = useToast()
  const [revogar, setRevogar] = useState<string | null>(null)
  const [excluir, setExcluir] = useState(false)
  const [confirmTxt, setConfirmTxt] = useState('')
  const [senha, setSenha] = useState('')
  const [ajuda, setAjuda] = useState(false)
  const [verAuditoria, setVerAuditoria] = useState(false)
  const ativos = s.compartilhamentos.filter(compartilhamentoAtivo)
  const iniciais = (s.perfil.nome || 'Você').slice(0, 2).toUpperCase()
  const alvo = s.compartilhamentos.find((c) => c.id === revogar)

  const cfg = (k: keyof typeof s.config, v: boolean) => {
    set((x) => ({
      ...x,
      config: { ...x.config, [k]: v },
      consentimentos: k === 'ia' ? [...x.consentimentos, { id: uid(), tipo: 'ia', versao: 'ia-v1.0', em: new Date().toISOString(), detalhe: v ? 'IA ligada' : 'IA desligada' }] : x.consentimentos,
    }))
    if (k === 'ia') toast(v ? 'Registro com IA ligado' : 'IA desligada: foto e voz ficam indisponíveis', 'info')
  }

  const exportar = () => {
    const blob = new Blob([JSON.stringify({ exportado_em: new Date().toISOString(), ...s, sessao: undefined }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `canetolino-meus-dados-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    toast('Arquivo com seus dados gerado')
  }

  return (
    <div className="tela tela--com-nav">
      <h1 className="titulo-tela">Perfil</h1>
      <Cartao i={0} className="card conta">
        <span className="avatar">{iniciais}</span>
        <div style={{ flex: 1 }}>
          <b style={{ fontSize: 17 }}>{s.perfil.nome}</b>
          <p className="legenda">Plano {PLANOS[s.perfil.plano].nome} · {precoBR(PLANOS[s.perfil.plano].preco)}/mês</p>
        </div>
        {s.perfil.plano === 'basico' && (
          <button className="link-violeta" onClick={() => nav('/app/planos')}>Ver Premium</button>
        )}
      </Cartao>

      <h2 className="secao-titulo">Profissionais com acesso</h2>
      <AnimatePresence initial={false}>
        {ativos.map((c) => (
          <motion.div key={c.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -60, height: 0, marginBottom: 0 }} className="card prof-acesso">
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{c.nome} · {c.profissao}</b>
              <p className="legenda">
                Vê {c.modulos.map((m) => MODULOS.find((x) => x.id === m)!.nome.split(' ')[0].toLowerCase()).join(' e ')} · {c.expira_em ? `até ${dataBR(c.expira_em)}` : 'até você revogar'}
              </p>
            </div>
            <button className="btn btn--perigo btn--pequeno" onClick={() => setRevogar(c.id)}>Revogar</button>
          </motion.div>
        ))}
      </AnimatePresence>
      <Link to="/app/perfil/compartilhar" className="btn-tracejado">+ Compartilhar com um profissional</Link>

      <h2 className="secao-titulo">Lembretes</h2>
      <CartaoLembretes />
      <BotaoInstalar className="btn btn--lilas btn--bloco" style={{ marginTop: 10 }} texto="Instalar o Canetolino neste aparelho" />

      <h2 className="secao-titulo">Minha ficha</h2>
      <p className="legenda" style={{ marginTop: -4 }}>Tudo o que você registrou, organizado para imprimir ou salvar em PDF.</p>
      <BotaoMinhaFicha className="btn btn--primario btn--bloco" style={{ marginTop: 8 }} />

      <h2 className="secao-titulo">Privacidade</h2>
      <Cartao i={1} className="card lista-config">
        <div className="linha-config">
          <div><b>Notificações discretas</b><span>Sem nome de remédio ou peso na tela bloqueada</span></div>
          <Interruptor ligado={s.config.notificacoesDiscretas} onChange={(v) => cfg('notificacoesDiscretas', v)} rotulo="Notificações discretas" />
        </div>
        <div className="linha-config">
          <div><b>Registro com IA</b><span>Foto e voz. Desligado, você registra à mão</span></div>
          <Interruptor ligado={s.config.ia} onChange={(v) => cfg('ia', v)} rotulo="Registro com IA" />
        </div>
        <div className="linha-config">
          <div><b>Mostrar quanto já perdi</b><span>O total de peso desde o início, no Início, na Evolução e no Radar</span></div>
          <Interruptor ligado={s.config.mostrarTotalPeso !== false} onChange={(v) => cfg('mostrarTotalPeso', v)} rotulo="Mostrar quanto já perdi" />
        </div>
        <div className="linha-config">
          <div><b>Fotos de evolução</b><span>Guardadas na nuvem, em área privada. Nunca são compartilhadas com profissionais</span></div>
        </div>
      </Cartao>

      <Cartao i={2} className="card lista-links" style={{ marginTop: 14 }}>
        <button onClick={() => setVerAuditoria((v) => !v)}>
          Histórico de acessos <span className="legenda">{s.auditoria.length}</span>
        </button>
        <AnimatePresence>
          {verAuditoria && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
              {s.auditoria.length === 0 && <p className="legenda" style={{ padding: '4px 0 12px' }}>Nenhum profissional acessou seus dados ainda.</p>}
              {[...s.auditoria].reverse().slice(0, 8).map((a) => (
                <div key={a.id} className="auditoria-linha">
                  <b>{a.ator}</b> {a.acao.toLowerCase()}
                  <span className="legenda">{dataHoraBR(a.em)}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={() => nav('/app/evolucao?aba=fotos')}>Minha evolução <span className="legenda">peso, medidas e fotos</span></button>
        <button onClick={() => nav('/app/planos')}>Planos e assinatura <span className="legenda">{PLANOS[s.perfil.plano].nome}</span></button>
        <button onClick={exportar}>Exportar meus dados</button>
        <button onClick={() => setAjuda(true)}>Ajuda e termos</button>
        <button onClick={async () => { await sair(); nav('/app/boas-vindas') }}>Sair</button>
        <button className="texto-alerta" onClick={() => setExcluir(true)}>Excluir minha conta</button>
      </Cartao>

      <Domma />

      <Modal aberto={!!revogar} onFechar={() => setRevogar(null)}>
        <h3>Revogar acesso?</h3>
        <p className="legenda" style={{ fontSize: 15 }}>
          {alvo?.nome} deixa de ver seus dados na hora. Você pode compartilhar de novo quando quiser.
        </p>
        <div className="duas-col" style={{ marginTop: 20 }}>
          <button className="btn btn--contorno" onClick={() => setRevogar(null)}>Cancelar</button>
          <button
            className="btn btn--perigo-cheio"
            disabled={ocupado}
            onClick={async () => {
              if (!revogar) return
              setOcupado(true)
              try {
                await revogarAcesso(revogar)
                toast('Acesso revogado')
                setRevogar(null)
              } catch (e) {
                toast(erroPt(e), 'info')
              } finally {
                setOcupado(false)
              }
            }}
          >
            {ocupado ? 'Revogando…' : 'Revogar'}
          </button>
        </div>
      </Modal>

      <Modal aberto={excluir} onFechar={() => setExcluir(false)}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><Mascot expressao="alerta" size={80} /></div>
        <h3 style={{ textAlign: 'center' }}>Excluir minha conta</h3>
        <p className="legenda" style={{ fontSize: 14.5 }}>
          Todos os seus registros serão apagados. Profissionais perdem o acesso imediatamente. Para confirmar, digite <b>EXCLUIR</b> e sua senha.
        </p>
        <input className="campo" style={{ marginTop: 14 }} placeholder="EXCLUIR" value={confirmTxt} onChange={(e) => setConfirmTxt(e.target.value)} aria-label="Digite EXCLUIR" />
        <input className="campo" style={{ marginTop: 10 }} type="password" placeholder="Sua senha" value={senha} onChange={(e) => setSenha(e.target.value)} aria-label="Senha" />
        {erroModal && <p className="erro-campo">{erroModal}</p>}
        <div className="duas-col" style={{ marginTop: 18 }}>
          <button className="btn btn--contorno" onClick={() => setExcluir(false)}>Cancelar</button>
          <button
            className="btn btn--perigo-cheio"
            disabled={confirmTxt !== 'EXCLUIR' || senha.length < 6 || ocupado}
            onClick={async () => {
              setOcupado(true)
              setErroModal('')
              try {
                // nova autenticação antes de excluir (seção 8)
                const { error } = await sb('app').auth.signInWithPassword({ email: s.perfil.email, password: senha })
                if (error) throw error
                await excluirConta()
                nav('/app/boas-vindas')
                toast('Conta e dados excluídos', 'info')
              } catch (e) {
                setErroModal(erroPt(e))
              } finally {
                setOcupado(false)
              }
            }}
          >
            Excluir
          </button>
        </div>
      </Modal>

      <Modal aberto={ajuda} onFechar={() => setAjuda(false)}>
        <h3>Ajuda e termos</h3>
        <div className="legenda" style={{ fontSize: 14.5, display: 'grid', gap: 10, marginTop: 8 }}>
          <p>O Canetolino é um diário e organizador do seu tratamento. Ele <b>não calcula, recomenda nem altera doses</b>, e não substitui seu médico ou nutricionista.</p>
          <p>Seus dados de saúde são tratados com base no seu consentimento (LGPD). Você pode exportar ou excluir tudo pelo próprio app.</p>
          <p>Em caso de sintomas fortes, procure atendimento. SAMU: <a href="tel:192"><b>192</b></a>.</p>
          <p><b>Consentimentos registrados:</b></p>
          {s.consentimentos.map((c) => (
            <p key={c.id} style={{ fontSize: 13 }}>• {c.tipo} ({c.versao}) em {dataBR(c.em)} {c.detalhe ? `· ${c.detalhe}` : ''}</p>
          ))}
        </div>
        <button className="btn btn--primario btn--bloco" style={{ marginTop: 16 }} onClick={() => setAjuda(false)}>Entendi</button>
      </Modal>
    </div>
  )
}
