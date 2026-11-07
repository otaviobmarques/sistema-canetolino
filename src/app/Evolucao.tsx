import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import GraficoPeso from '../components/GraficoPeso'
import Icon from '../components/Icon'
import Mascot from '../components/Mascot'
import { Modal, useToast } from '../components/ui'
import { PLANOS, precoBR, type Plano } from '../data/planos'
import { TIPOS_MEDIDA, ultimoPeso, useStore, type TipoMedida } from '../data/store'
import { dataBR, dataCurta, num, uid } from '../lib/datas'
import { apagarFoto, listarFotos, salvarFoto, type Angulo, type FotoEvolucao } from '../lib/fotos'
import { hoje, juntar } from './Doses'
import { assinar, cancelarAssinatura, cpfValido, minhaAssinatura } from '../lib/pagamentos'
import { erroPt, sb } from '../lib/supabase'

type Aba = 'peso' | 'medidas' | 'fotos'

/* ======================= Peso, medidas e fotos de evolução ======================= */
export function Corpo() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const aba = (params.get('aba') as Aba) || 'peso'
  const abas: { id: Aba; nome: string }[] = [
    { id: 'peso', nome: 'Peso' },
    { id: 'medidas', nome: 'Medidas' },
    { id: 'fotos', nome: 'Fotos' },
  ]
  return (
    <div className="tela">
      <div className="topo">
        <button className="btn-icone" onClick={() => nav(-1)} aria-label="Voltar">
          <Icon name="back" />
        </button>
        <h1 className="titulo-tela" style={{ fontSize: 26 }}>Minha evolução</h1>
      </div>
      <div className="abas" role="tablist">
        {abas.map((a) => (
          <button key={a.id} role="tab" aria-selected={aba === a.id} className={aba === a.id ? 'is-on' : ''} onClick={() => setParams({ aba: a.id }, { replace: true })}>
            {aba === a.id && <motion.span layoutId="aba-ind" className="abas__ind" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
            <span>{a.nome}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={aba} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {aba === 'peso' && <AbaPeso />}
          {aba === 'medidas' && <AbaMedidas />}
          {aba === 'fotos' && <AbaFotos />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function AbaPeso() {
  const nav = useNavigate()
  const { s, set } = useStore()
  const toast = useToast()
  const ult = ultimoPeso(s)
  const [kg, setKg] = useState(ult?.kg ?? (s.perfil.peso_inicial_kg || 80))
  const [data, setData] = useState(hoje())
  const [todos, setTodos] = useState(false)
  const pesos = [...s.pesos].sort((a, b) => +new Date(a.em) - +new Date(b.em))
  const recentes = [...pesos].reverse()
  return (
    <>
      <div className="peso-seletor">
        <button className="btn-icone" onClick={() => setKg((k) => +(k - 0.1).toFixed(1))} aria-label="Diminuir 100 g">−</button>
        <motion.div key={kg} initial={{ y: -6, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className="peso-seletor__num">
          {num(kg)}
          <span>kg</span>
        </motion.div>
        <button className="btn-icone" onClick={() => setKg((k) => +(k + 0.1).toFixed(1))} aria-label="Aumentar 100 g">+</button>
      </div>
      <input type="range" min={40} max={200} step={0.1} value={kg} onChange={(e) => setKg(Number(e.target.value))} className="range" aria-label="Peso" />
      {pesos.length > 1 && (
        <div className="card" style={{ marginTop: 16 }}>
          <b className="card-titulo">Histórico</b>
          <GraficoPeso pontos={(pesos.length > 12 ? pesos.slice(-12) : pesos).map((p) => p.kg)} altura={120} />
          <p className="legenda">Desde {dataBR(pesos[0].em)}{pesos.length > 12 ? ' · últimas 12 pesagens no gráfico' : ''}</p>
        </div>
      )}
      <label className="rotulo" htmlFor="peso-data">Data da pesagem</label>
      <input id="peso-data" className="campo" type="date" max={hoje()} value={data} onChange={(e) => setData(e.target.value)} />
      {data < hoje() && <p className="legenda" style={{ marginTop: 6 }}>Peso de um dia anterior: entra no gráfico na data certa.</p>}
      {recentes.length > 0 && (
        <div className="card lista" style={{ marginTop: 14 }}>
          {(todos ? recentes : recentes.slice(0, 4)).map((p) => (
            <div key={p.id} className="dose-linha">
              <div className="dose-linha__txt">
                <b>{num(p.kg)} kg</b>
                <span className="legenda">{dataBR(p.em)}{p.retroativo ? ' · registrado depois' : ''}</span>
              </div>
              <button
                className="btn-icone btn-icone--peq btn-icone--perigo"
                aria-label={`Excluir peso de ${dataBR(p.em)}`}
                onClick={() => {
                  set((x) => ({ ...x, pesos: x.pesos.filter((y) => y.id !== p.id) }))
                  toast(`Peso de ${dataBR(p.em)} excluído`, 'info', { rotulo: 'Desfazer', fn: () => set((x) => ({ ...x, pesos: [...x.pesos, p] })) })
                }}
              >
                <Icon name="trash" size={17} />
              </button>
            </div>
          ))}
          {recentes.length > 4 && (
            <button className="btn btn--fantasma btn--bloco btn--pequeno" style={{ margin: '6px 0' }} onClick={() => setTodos(!todos)}>
              {todos ? 'Mostrar menos' : `Ver as ${recentes.length} pesagens`}
            </button>
          )}
        </div>
      )}
      <div className="dica-dose" style={{ marginTop: 16 }}>
        <Mascot expressao="piscando" size={40} flutuar={false} />
        <p>Pese-se sempre no mesmo horário, de preferência pela manhã. O número do dia é só um ponto da curva.</p>
      </div>
      <div className="rodape-acao">
        <button
          className="btn btn--primario btn--bloco"
          onClick={() => {
            const passado = data < hoje()
            const novo = { id: uid(), kg, em: passado ? juntar(data, '08:00') : new Date().toISOString(), ...(passado ? { retroativo: true as const } : {}) }
            set((x) => ({ ...x, pesos: [...x.pesos, novo] }))
            toast(`Peso registrado: ${num(kg)} kg${passado ? ` em ${dataBR(novo.em)}` : ''}`, 'ok', { rotulo: 'Desfazer', fn: () => set((x) => ({ ...x, pesos: x.pesos.filter((y) => y.id !== novo.id) })) })
            if (passado) setData(hoje())
            else nav('/app/home')
          }}
        >
          Salvar peso
        </button>
      </div>
    </>
  )
}

function AbaMedidas() {
  const { s, set } = useStore()
  const toast = useToast()
  const [valores, setValores] = useState<Partial<Record<TipoMedida, string>>>({})
  const ultima = (t: TipoMedida) => [...s.medidas].filter((m) => m.tipo === t).sort((a, b) => +new Date(b.em) - +new Date(a.em))[0]
  const primeira = (t: TipoMedida) => [...s.medidas].filter((m) => m.tipo === t).sort((a, b) => +new Date(a.em) - +new Date(b.em))[0]
  const preenchidas = Object.entries(valores).filter(([, v]) => v && Number(v.replace(',', '.')) >= 10)
  return (
    <>
      <p className="legenda" style={{ marginTop: 4 }}>Meça com fita métrica, sem apertar, sempre no mesmo ponto. Preencha só o que quiser.</p>
      <div className="lista-medidas">
        {TIPOS_MEDIDA.map((t) => {
          const u = ultima(t.id)
          const p = primeira(t.id)
          const dif = u && p && u.id !== p.id ? u.cm - p.cm : null
          return (
            <label key={t.id} className="linha-medida">
              <div>
                <b>{t.nome}</b>
                <span className="legenda">
                  {u ? `${num(u.cm)} cm em ${dataBR(u.em)}` : 'sem registro'}
                  {dif !== null && Math.abs(dif) >= 0.1 && <span className={dif < 0 ? 'texto-sucesso' : ''}> · {dif < 0 ? '−' : '+'}{num(Math.abs(dif))} cm desde o início</span>}
                </span>
              </div>
              <div className="linha-medida__campo">
                <input className="campo" inputMode="decimal" placeholder={u ? num(u.cm) : 'cm'} value={valores[t.id] ?? ''} onChange={(e) => setValores((v) => ({ ...v, [t.id]: e.target.value.replace(/[^\d,.]/g, '') }))} aria-label={`${t.nome} em centímetros`} />
                <span>cm</span>
              </div>
            </label>
          )
        })}
      </div>
      <div className="rodape-acao">
        <button
          className="btn btn--primario btn--bloco"
          disabled={!preenchidas.length}
          onClick={() => {
            const em = new Date().toISOString()
            set((x) => ({ ...x, medidas: [...x.medidas, ...preenchidas.map(([tipo, v]) => ({ id: uid(), tipo: tipo as TipoMedida, cm: Number(v!.replace(',', '.')), em }))] }))
            toast(`${preenchidas.length} ${preenchidas.length === 1 ? 'medida registrada' : 'medidas registradas'}`)
            setValores({})
          }}
        >
          Salvar medidas
        </button>
      </div>
    </>
  )
}

function AbaFotos() {
  const { s } = useStore()
  const toast = useToast()
  const [fotos, setFotos] = useState<FotoEvolucao[] | null>(null)
  const [angulo, setAngulo] = useState<Angulo>('frente')
  const [enviando, setEnviando] = useState(false)
  const [comparar, setComparar] = useState(false)
  const [ver, setVer] = useState<FotoEvolucao | null>(null)
  const [corte, setCorte] = useState(50)
  const local = s.config.fotosLocal

  const carregar = useCallback(() => {
    if (!s.userId) return
    listarFotos(s.userId).then(setFotos).catch(() => setFotos([]))
  }, [s.userId])
  useEffect(() => {
    carregar()
  }, [carregar])

  const doAngulo = useMemo(() => (fotos ?? []).filter((f) => f.angulo === angulo), [fotos, angulo])
  const antes = doAngulo[0]
  const depois = doAngulo[doAngulo.length - 1]

  return (
    <>
      <div className="aviso" style={{ marginTop: 4 }}>
        <Icon name="lock" size={18} />
        <span>{local ? 'Suas fotos ficam só neste aparelho e não vão para a nuvem.' : 'Suas fotos ficam guardadas na nuvem, em área privada só sua.'} Elas nunca são compartilhadas com profissionais. Mude em Perfil → Privacidade.</span>
      </div>
      <div className="chips" style={{ marginTop: 14, flexWrap: 'nowrap' }}>
        {(['frente', 'lado', 'costas'] as Angulo[]).map((a) => (
          <button key={a} className={`chip chip--quadrado ${angulo === a ? 'is-on' : ''}`} onClick={() => setAngulo(a)}>
            {a[0].toUpperCase() + a.slice(1)}
          </button>
        ))}
      </div>

      {fotos === null ? (
        <div className="grade-fotos" style={{ marginTop: 12 }}>{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ aspectRatio: '3/4' }} />)}</div>
      ) : doAngulo.length === 0 ? (
        <div className="vazio" style={{ marginTop: 10 }}>
          <Mascot expressao="piscando" size={70} />
          <p>Nenhuma foto de {angulo} ainda. Tire a primeira hoje: daqui a algumas semanas você vai gostar de comparar.</p>
        </div>
      ) : (
        <div className="grade-fotos" style={{ marginTop: 12 }}>
          {doAngulo.map((f) => (
            <button key={f.id} className="foto-evol" onClick={() => setVer(f)}>
              <img src={f.url} alt={`Foto de ${f.angulo} em ${dataBR(f.em)}`} />
              <span>{dataCurta(f.em)}</span>
            </button>
          ))}
        </div>
      )}

      {doAngulo.length >= 2 && (
        <button className="btn btn--lilas btn--bloco" style={{ marginTop: 12 }} onClick={() => setComparar(true)}>
          Comparar primeira e última
        </button>
      )}

      <div className="rodape-acao">
        <label className={`btn btn--primario btn--bloco ${enviando ? 'is-ocupado' : ''}`} style={{ cursor: 'pointer' }}>
          <input
            type="file"
            accept="image/*"
            capture="user"
            className="sr-only"
            disabled={enviando}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f || !s.userId) return
              setEnviando(true)
              try {
                await salvarFoto(s.userId, f, angulo, local)
                toast('Foto salva')
                carregar()
              } catch (er) {
                toast(erroPt(er), 'info')
              } finally {
                setEnviando(false)
              }
            }}
          />
          <Icon name="camera" size={20} /> {enviando ? 'Salvando…' : `Adicionar foto de ${angulo}`}
        </label>
      </div>

      <Modal aberto={comparar} onFechar={() => setComparar(false)} largura={520}>
        {antes && depois && (
          <>
            <h3>Antes e depois</h3>
            <p className="legenda">{dataBR(antes.em)} → {dataBR(depois.em)} · arraste para comparar</p>
            <div className="comparador">
              <img src={antes.url} alt="Primeira foto" />
              <div className="comparador__depois" style={{ clipPath: `inset(0 0 0 ${corte}%)` }}>
                <img src={depois.url} alt="Última foto" />
              </div>
              <div className="comparador__linha" style={{ left: `${corte}%` }} />
            </div>
            <input type="range" min={0} max={100} value={corte} onChange={(e) => setCorte(Number(e.target.value))} className="range" aria-label="Comparar" />
          </>
        )}
      </Modal>
      <Modal aberto={!!ver} onFechar={() => setVer(null)}>
        {ver && (
          <>
            <img src={ver.url} alt="Foto de evolução" style={{ width: '100%', borderRadius: 16 }} />
            <p className="legenda" style={{ marginTop: 8 }}>{dataBR(ver.em)} · {ver.angulo} · {ver.onde === 'aparelho' ? 'guardada neste aparelho' : 'guardada na nuvem'}</p>
            <div className="duas-col" style={{ marginTop: 14 }}>
              <button className="btn btn--contorno" onClick={() => setVer(null)}>Fechar</button>
              <button
                className="btn btn--perigo"
                onClick={async () => {
                  await apagarFoto(ver)
                  setVer(null)
                  toast('Foto apagada', 'info')
                  carregar()
                }}
              >
                Apagar
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

/* ======================= Planos e assinatura ======================= */
const STATUS_TXT = { ativa: 'ativa', atrasada: 'pagamento atrasado', pendente: 'aguardando pagamento', cancelada: 'cancelada' } as const

export function Planos() {
  const nav = useNavigate()
  const { set } = useStore()
  const toast = useToast()
  const [params] = useSearchParams()
  const [anual, setAnual] = useState(false)
  const [usoIA, setUsoIA] = useState<number | null>(null)
  const [info, setInfo] = useState<Awaited<ReturnType<typeof minhaAssinatura>> | null>(null)
  const [escolha, setEscolha] = useState<Plano | null>(null)
  const [pedirCpf, setPedirCpf] = useState(false)
  const [cpf, setCpf] = useState('')
  const [indo, setIndo] = useState(false)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const voltouDoPagamento = params.get('pagamento') === 'ok'

  const atualizar = useCallback(async () => {
    const r = await minhaAssinatura(sb('app'))
    setInfo(r)
    set((x) => (x.perfil.plano === r.plano ? x : { ...x, perfil: { ...x.perfil, plano: r.plano } }))
    return r
  }, [set])

  useEffect(() => {
    atualizar().catch(() => {})
    const inicio = new Date()
    inicio.setDate(1)
    inicio.setHours(0, 0, 0, 0)
    sb('app')
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .in('tipo', ['refeicao_foto', 'refeicao_texto'])
      .gte('em', inicio.toISOString())
      .then(({ count }) => setUsoIA(count ?? 0))
  }, [atualizar])

  // de volta da página de pagamento: confere a confirmação por alguns minutos
  useEffect(() => {
    if (!info?.pendente && !voltouDoPagamento) return
    let n = 0
    const t = setInterval(async () => {
      n++
      const r = await atualizar().catch(() => null)
      if (r?.ativa && !r.pendente) {
        clearInterval(t)
        toast(`Assinatura ${PLANOS[r.ativa.plano].nome} ativa. Obrigado!`, 'ok')
      }
      if (n > 40) clearInterval(t)
    }, 5000)
    return () => clearInterval(t)
  }, [info?.pendente?.id, voltouDoPagamento, atualizar, toast]) // eslint-disable-line react-hooks/exhaustive-deps

  const ir = async (plano: Plano, comCpf?: string) => {
    setIndo(true)
    setEscolha(plano)
    try {
      const url = await assinar(sb('app'), plano, anual ? 'anual' : 'mensal', comCpf)
      window.location.href = url
    } catch (e) {
      setIndo(false)
      if ((e as { codigo?: string }).codigo === 'cpf') return setPedirCpf(true)
      toast(erroPt(e), 'info')
    }
  }

  const cancelar = async () => {
    setIndo(true)
    try {
      await cancelarAssinatura(sb('app'))
      await atualizar()
      toast('Assinatura cancelada', 'info')
    } catch (e) {
      toast(erroPt(e), 'info')
    }
    setIndo(false)
    setConfirmarCancelar(false)
  }

  const ativa = info?.ativa ?? null
  const atual = ativa?.plano ?? null

  return (
    <div className="tela">
      <div className="topo">
        <button className="btn-icone" onClick={() => nav(-1)} aria-label="Voltar">
          <Icon name="back" />
        </button>
        <h1 className="titulo-tela" style={{ fontSize: 26 }}>Planos</h1>
      </div>

      {ativa && (
        <div className="card">
          <div className="jornada-topo">
            <b>Sua assinatura</b>
            <span className={`selo ${ativa.status === 'ativa' ? 'selo--sucesso' : 'selo--lilas'}`}>{STATUS_TXT[ativa.status]}</span>
          </div>
          <p style={{ margin: '6px 0 0' }}>
            {PLANOS[ativa.plano].nome} {ativa.periodo} · {precoBR(Number(ativa.valor))}/{ativa.periodo === 'anual' ? 'ano' : 'mês'}
          </p>
          {ativa.proximo_vencimento && <p className="legenda">Próxima cobrança em {dataBR(ativa.proximo_vencimento)}</p>}
          <button className="btn btn--fantasma btn--pequeno" style={{ marginTop: 8 }} onClick={() => setConfirmarCancelar(true)}>Cancelar assinatura</button>
        </div>
      )}
      {!ativa && info?.pendente && (
        <div className="card">
          <b>Aguardando a confirmação do pagamento</b>
          <p className="legenda">Pix e cartão confirmam em instantes; boleto pode levar até 3 dias úteis. Esta tela atualiza sozinha.</p>
        </div>
      )}

      {atual === 'basico' && usoIA !== null && (
        <div className="card uso-ia">
          <div className="jornada-topo">
            <b>Registros por IA neste mês</b>
            <b>{usoIA} de 30</b>
          </div>
          <div className="barra-prog"><motion.i initial={{ width: 0 }} animate={{ width: `${Math.min(100, (usoIA / 30) * 100)}%` }} /></div>
          <p className="legenda">Depois dos 30, você continua registrando pela busca de alimentos.</p>
        </div>
      )}

      <div className="alternador" role="radiogroup" aria-label="Período">
        <button role="radio" aria-checked={!anual} className={!anual ? 'is-on' : ''} onClick={() => setAnual(false)}>Mensal</button>
        <button role="radio" aria-checked={anual} className={anual ? 'is-on' : ''} onClick={() => setAnual(true)}>
          Anual <span className="selo selo--sucesso" style={{ padding: '1px 7px' }}>2 meses grátis</span>
        </button>
      </div>

      <div className="planos-tela">
        {(Object.keys(PLANOS) as Plano[]).map((k, i) => {
          const p = PLANOS[k]
          const ehAtual = atual === k && ativa?.periodo === (anual ? 'anual' : 'mensal')
          return (
            <motion.div key={k} className={`plano-card ${k === 'premium' ? 'plano-card--destaque' : ''}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              {k === 'premium' && <span className="plano-card__fita">Mais completo</span>}
              <div className="plano-card__topo">
                <b>{p.nome}</b>
                {atual === k && <span className="selo selo--lilas">seu plano</span>}
              </div>
              <div className="plano__preco">
                {precoBR(anual ? p.anual : p.preco)}
                <small>/{anual ? 'ano' : 'mês'}</small>
              </div>
              {anual && <small className="legenda">equivale a {precoBR(p.anual / 12)}/mês</small>}
              <ul className="lista-premium">
                {p.itens.map((t) => (
                  <li key={t}><Icon name="check" size={16} /> {t}</li>
                ))}
              </ul>
              {!ehAtual && (
                <button className={`btn btn--bloco ${k === 'premium' ? 'btn--turquesa' : 'btn--contorno'}`} disabled={indo || info === null} onClick={() => ir(k)}>
                  {indo && escolha === k ? 'Abrindo o pagamento…' : atual ? `Mudar para o ${p.nome}` : `Assinar ${p.nome}`}
                </button>
              )}
            </motion.div>
          )
        })}
      </div>
      <p className="legenda" style={{ textAlign: 'center', marginTop: 12 }}>Pagamento seguro por Pix, boleto ou cartão. Ao trocar de plano, o anterior é cancelado quando o novo for pago. Cancele quando quiser.</p>

      <Modal aberto={pedirCpf} onFechar={() => setPedirCpf(false)}>
        <h3 style={{ textAlign: 'center' }}>Qual é o seu CPF?</h3>
        <p className="legenda" style={{ textAlign: 'center', fontSize: 14.5 }}>Ele vai só para a emissão da cobrança (exigência da nota e do Pix). O Canetolino não guarda o seu CPF.</p>
        <input className="campo" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} style={{ marginTop: 12 }} />
        {cpf.replace(/\D/g, '').length >= 11 && !cpfValido(cpf) && <p className="erro-campo">Confira o CPF.</p>}
        <button className="btn btn--primario btn--bloco" style={{ marginTop: 16 }} disabled={!cpfValido(cpf) || indo} onClick={() => { setPedirCpf(false); ir(escolha!, cpf) }}>Continuar para o pagamento</button>
      </Modal>

      <Modal aberto={confirmarCancelar} onFechar={() => setConfirmarCancelar(false)}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><Mascot expressao="pensativo" size={80} /></div>
        <h3 style={{ textAlign: 'center' }}>Cancelar a assinatura?</h3>
        <p className="legenda" style={{ textAlign: 'center', fontSize: 14.5 }}>As próximas cobranças param. Seus registros continuam guardados.</p>
        <button className="btn btn--perigo btn--bloco" style={{ marginTop: 16 }} disabled={indo} onClick={cancelar}>{indo ? 'Cancelando…' : 'Cancelar assinatura'}</button>
        <button className="btn btn--fantasma btn--bloco" style={{ marginTop: 8 }} onClick={() => setConfirmarCancelar(false)}>Manter</button>
      </Modal>
    </div>
  )
}

/* ======================= Bem-estar e sono ======================= */
const ESCALAS: { id: 'sono_qualidade' | 'humor' | 'energia' | 'fome'; nome: string; baixo: string; alto: string; rotulos: string[] }[] = [
  { id: 'sono_qualidade', nome: 'Como foi o sono?', baixo: 'ruim', alto: 'ótimo', rotulos: ['😫', '😕', '😐', '🙂', '😴'] },
  { id: 'humor', nome: 'Humor', baixo: 'pra baixo', alto: 'ótimo', rotulos: ['😞', '😕', '😐', '🙂', '😄'] },
  { id: 'energia', nome: 'Energia', baixo: 'sem energia', alto: 'cheia de energia', rotulos: ['🪫', '😮‍💨', '😐', '🙂', '⚡'] },
  { id: 'fome', nome: 'Fome hoje', baixo: 'quase nenhuma', alto: 'muita', rotulos: ['1', '2', '3', '4', '5'] },
]

export function BemEstarTela() {
  const nav = useNavigate()
  const { s, set } = useStore()
  const toast = useToast()
  const [horas, setHoras] = useState(7)
  const [notas, setNotas] = useState<Partial<Record<(typeof ESCALAS)[number]['id'], number>>>({})
  const [obs, setObs] = useState('')
  const ultimos = [...s.bemestar].sort((a, b) => +new Date(b.em) - +new Date(a.em)).slice(0, 7)
  return (
    <div className="tela">
      <div className="topo">
        <button className="btn-icone" onClick={() => nav(-1)} aria-label="Voltar">
          <Icon name="back" />
        </button>
        <h1 className="titulo-tela" style={{ fontSize: 26 }}>Bem-estar e sono</h1>
      </div>
      <span className="rotulo" style={{ marginTop: 4 }}>Quanto você dormiu: {num(horas)} h</span>
      <input type="range" min={0} max={12} step={0.5} value={horas} onChange={(e) => setHoras(Number(e.target.value))} className="range" aria-label="Horas de sono" />
      {ESCALAS.map((e) => (
        <div key={e.id}>
          <span className="rotulo">{e.nome}</span>
          <div className="chips" style={{ flexWrap: 'nowrap' }}>
            {e.rotulos.map((r, i) => (
              <button key={i} aria-pressed={notas[e.id] === i + 1} aria-label={`${e.nome}: ${i + 1} de 5`} className={`chip chip--quadrado chip--violeta escala ${notas[e.id] === i + 1 ? 'is-on' : ''}`} onClick={() => setNotas((n) => ({ ...n, [e.id]: n[e.id] === i + 1 ? undefined : i + 1 }))}>
                {r}
              </button>
            ))}
          </div>
          <div className="entre legenda" style={{ marginTop: 4, fontSize: 12 }}>
            <span>{e.baixo}</span>
            <span>{e.alto}</span>
          </div>
        </div>
      ))}
      <label className="rotulo" htmlFor="beo">Observação (opcional)</label>
      <input id="beo" className="campo" placeholder="Ex.: acordei várias vezes" value={obs} onChange={(e) => setObs(e.target.value)} />
      {ultimos.length > 0 && (
        <div className="card lista" style={{ marginTop: 16 }}>
          {ultimos.map((b) => (
            <div key={b.id} className="lista__linha">
              <span>{dataCurta(b.em)}</span>
              <span className="legenda" style={{ fontSize: 13.5 }}>
                {b.sono_horas != null ? `${num(b.sono_horas)} h de sono` : ''}
                {b.humor ? ` · humor ${b.humor}/5` : ''}
                {b.fome ? ` · fome ${b.fome}/5` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="rodape-acao">
        <button
          className="btn btn--primario btn--bloco"
          onClick={() => {
            set((x) => ({ ...x, bemestar: [...x.bemestar, { id: uid(), em: new Date().toISOString(), sono_horas: horas, ...notas, obs: obs.trim() || undefined }] }))
            toast('Bem-estar registrado 💜')
            nav('/app/home')
          }}
        >
          Salvar
        </button>
      </div>
    </div>
  )
}
