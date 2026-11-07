import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import GraficoPeso from '../components/GraficoPeso'
import Icon from '../components/Icon'
import Mascot from '../components/Mascot'
import { Anel, Interruptor, Modal, soltarConfete, useToast } from '../components/ui'
import {
  aguaDoDia,
  compartilhamentoAtivo,
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
import { dataBR, dataCurta, dataDiaMes, dataHoraBR, DIA_MS, diasEntre, DIAS_LONGOS, inicioDoDia, mesAno, num, saudacaoData, uid } from '../lib/datas'

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
  const variacao = peso ? peso.kg - s.perfil.peso_inicial_kg : 0
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
            {s.medicamento!.principio} · dose {s.medicamento!.dose_texto.toLowerCase().startsWith('conforme') ? s.medicamento!.dose_texto : `conforme receita (${s.medicamento!.dose_texto})`}
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

      <Cartao i={4} className="card linha-peso" onClick={() => nav('/app/registrar/peso')} role="button" tabIndex={0}>
        <div>
          <b className="card-titulo">Peso</b>
          <div className="peso-num">{peso ? `${num(peso.kg)} kg` : '—'}</div>
        </div>
        {peso && Math.abs(variacao) >= 0.1 && (
          <span className={`selo ${variacao < 0 ? 'selo--sucesso' : 'selo--lilas'}`}>
            {variacao < 0 ? '−' : '+'}
            {num(Math.abs(variacao))} kg desde o início
          </span>
        )}
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
  const [canetaAberta, setCanetaAberta] = useState(false)
  const ordenadas = [...s.aplicacoes].sort((a, b) => +new Date(b.em) - +new Date(a.em))
  const semanaNum = ordenadas.length ? Math.max(1, Math.ceil((diasEntre(ordenadas[ordenadas.length - 1].em, new Date()) + 1) / 7)) : 1
  const canetas = s.canetas.reduce((t, c) => t + c.quantidade, 0)
  const validade = s.canetas.map((c) => c.validade).sort()[0]
  const validadeProxima = validade && new Date(validade + '-01').getTime() - Date.now() < 30 * DIA_MS
  const mes = new Date()
  const gasto = s.compras.filter((c) => new Date(c.em).getMonth() === mes.getMonth() && new Date(c.em).getFullYear() === mes.getFullYear()).reduce((t, c) => t + c.valor_centavos, 0)

  const registrar = (e: React.MouseEvent) => {
    set((x) => ({
      ...x,
      aplicacoes: [...x.aplicacoes, { id: uid(), em: new Date().toISOString(), local, obs: obs || undefined }],
      canetas: x.canetas.map((c, i) => (i === 0 && c.quantidade > 0 ? { ...c, quantidade: c.quantidade - 1 } : c)),
    }))
    soltarConfete({ x: e.clientX, y: e.clientY }, 60)
    toast(`Aplicação registrada: ${LOCAL_LONGO[local]}`)
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
        <input className="campo" style={{ marginTop: 10, minHeight: 46 }} placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
        <button className="btn btn--primario btn--bloco" style={{ marginTop: 12 }} onClick={registrar}>
          Registrar aplicação
        </button>
      </Cartao>

      <h2 className="secao-titulo">Últimas aplicações</h2>
      {ordenadas.length ? (
        <Cartao i={1} className="card lista">
          <AnimatePresence initial={false}>
            {ordenadas.slice(0, 4).map((a) => (
              <motion.div key={a.id} className="lista__linha" layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <span>{dataCurta(a.em)}</span>
                <span className="legenda" style={{ fontSize: 14.5 }}>{LOCAL_LONGO[a.local]}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </Cartao>
      ) : (
        <div className="vazio">
          <Mascot expressao="piscando" size={70} />
          <p>Ainda não há aplicações. Quando aplicar, escolha o local acima e toque em “Registrar aplicação”.</p>
        </div>
      )}

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
  const resumo = useMemo(() => resumoDoDose(s), [s])
  const pesos = [...s.pesos].sort((a, b) => +new Date(a.em) - +new Date(b.em)).slice(-8)
  const variacao = pesos.length > 1 ? pesos[pesos.length - 1].kg - pesos[0].kg : 0
  const intensidade = w.sintomasSemana.length ? Math.max(...w.sintomasSemana.map((x) => x.intensidade)) : 0
  const diasSint = new Set(w.sintomasSemana.map((x) => inicioDoDia(x.em).getTime())).size
  const ativo = s.compartilhamentos.find(compartilhamentoAtivo)

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
            <p className="resumo-dose__txt">{resumo}</p>
            <p className="resumo-dose__aviso">Resumo gerado a partir dos seus registros. Não é avaliação médica.</p>
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
          <b>Peso nas últimas {Math.max(pesos.length, 1)} semanas</b>
          {pesos.length > 1 && <b style={{ color: variacao <= 0 ? 'var(--sucesso)' : 'var(--violeta)' }}>{variacao <= 0 ? '−' : '+'}{num(Math.abs(variacao))} kg</b>}
        </div>
        <GraficoPeso pontos={pesos.map((p) => p.kg)} />
      </Cartao>

      <div className="grade-2" style={{ marginTop: 12 }}>
        <Indicador i={2} rotulo="Proteína média" valor={w.proteinaMedia ? `${w.proteinaMedia} g/dia` : 'sem dados'} />
        <Indicador i={3} rotulo="Água na meta" valor={`${w.diasAguaMeta} de 7 dias`} />
        <Indicador i={4} rotulo="Treino de força" valor={`${w.treinosForca} ${w.treinosForca === 1 ? 'sessão' : 'sessões'}`} />
        <Indicador i={5} rotulo="Sintomas" valor={diasSint ? `${diasSint} ${diasSint === 1 ? 'dia' : 'dias'}, ${intensidade <= 2 ? 'leve' : intensidade <= 3 ? 'moderado' : 'forte'}` : 'nenhum'} />
      </div>

      <button className="btn btn--contorno btn--bloco" style={{ marginTop: 14 }} onClick={() => nav('/app/perfil/compartilhar')}>
        <Icon name="upload" size={20} /> Enviar relatório {ativo ? `à ${ativo.profissao.toLowerCase()}` : 'a um profissional'}
      </button>
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
  const { s, set, zerar, sair } = useStore()
  const nav = useNavigate()
  const toast = useToast()
  const [revogar, setRevogar] = useState<string | null>(null)
  const [excluir, setExcluir] = useState(false)
  const [confirmTxt, setConfirmTxt] = useState('')
  const [senha, setSenha] = useState('')
  const [premium, setPremium] = useState(false)
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
          <p className="legenda">{s.perfil.plano === 'premium' ? 'Plano Premium' : 'Plano gratuito'}</p>
        </div>
        {s.perfil.plano === 'gratuito' && (
          <button className="link-violeta" onClick={() => setPremium(true)}>Ver Premium</button>
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
          <div><b>Fotos só no aparelho</b><span>Fotos de evolução não vão para a nuvem</span></div>
          <Interruptor ligado={s.config.fotosLocal} onChange={(v) => cfg('fotosLocal', v)} rotulo="Fotos só no aparelho" />
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
        <button onClick={exportar}>Exportar meus dados</button>
        <button onClick={() => setAjuda(true)}>Ajuda e termos</button>
        <button onClick={() => { sair(); nav('/app/boas-vindas') }}>Sair</button>
        <button className="texto-alerta" onClick={() => setExcluir(true)}>Excluir minha conta</button>
      </Cartao>

      <Modal aberto={!!revogar} onFechar={() => setRevogar(null)}>
        <h3>Revogar acesso?</h3>
        <p className="legenda" style={{ fontSize: 15 }}>
          {alvo?.nome} deixa de ver seus dados na hora. Você pode compartilhar de novo quando quiser.
        </p>
        <div className="duas-col" style={{ marginTop: 20 }}>
          <button className="btn btn--contorno" onClick={() => setRevogar(null)}>Cancelar</button>
          <button
            className="btn btn--perigo-cheio"
            onClick={() => {
              set((x) => ({
                ...x,
                compartilhamentos: x.compartilhamentos.map((c) => (c.id === revogar ? { ...c, revogado_em: new Date().toISOString() } : c)),
                auditoria: [...x.auditoria, { id: uid(), ator: 'Você', acao: `Revogou o acesso de ${alvo?.nome}`, em: new Date().toISOString() }],
              }))
              toast('Acesso revogado')
              setRevogar(null)
            }}
          >
            Revogar
          </button>
        </div>
      </Modal>

      <Modal aberto={excluir} onFechar={() => setExcluir(false)}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><Mascot expressao="alerta" size={80} /></div>
        <h3 style={{ textAlign: 'center' }}>Excluir minha conta</h3>
        <p className="legenda" style={{ fontSize: 14.5 }}>
          Todos os seus registros serão apagados em até 15 dias. Profissionais perdem o acesso imediatamente. Para confirmar, digite <b>EXCLUIR</b> e sua senha.
        </p>
        <input className="campo" style={{ marginTop: 14 }} placeholder="EXCLUIR" value={confirmTxt} onChange={(e) => setConfirmTxt(e.target.value)} aria-label="Digite EXCLUIR" />
        <input className="campo" style={{ marginTop: 10 }} type="password" placeholder="Sua senha" value={senha} onChange={(e) => setSenha(e.target.value)} aria-label="Senha" />
        <div className="duas-col" style={{ marginTop: 18 }}>
          <button className="btn btn--contorno" onClick={() => setExcluir(false)}>Cancelar</button>
          <button
            className="btn btn--perigo-cheio"
            disabled={confirmTxt !== 'EXCLUIR' || senha.length < 4}
            onClick={() => {
              zerar()
              nav('/app/boas-vindas')
              toast('Conta excluída', 'info')
            }}
          >
            Excluir
          </button>
        </div>
      </Modal>

      <Modal aberto={premium} onFechar={() => setPremium(false)}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><Mascot expressao="comemorando" size={90} /></div>
        <h3 style={{ textAlign: 'center' }}>Canetolino Premium</h3>
        <ul className="lista-premium">
          <li><Icon name="check" size={18} /> Registros por IA ilimitados</li>
          <li><Icon name="check" size={18} /> Relatórios em PDF para o seu médico</li>
          <li><Icon name="check" size={18} /> Módulos Manutenção, Fitness e Wellness</li>
          <li><Icon name="check" size={18} /> Integração com Apple Saúde e Health Connect</li>
        </ul>
        <button
          className="btn btn--turquesa btn--bloco"
          onClick={(e) => {
            set((x) => ({ ...x, perfil: { ...x.perfil, plano: 'premium' } }))
            soltarConfete({ x: e.clientX, y: e.clientY })
            toast('Premium ativado (simulação da loja)')
            setPremium(false)
          }}
        >
          Assinar pela loja · R$ 19,90/mês
        </button>
        <p className="legenda" style={{ textAlign: 'center', marginTop: 8 }}>Cobrança pela App Store ou Google Play. Cancele quando quiser.</p>
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
