import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon, { type IconName } from '../components/Icon'
import Mascot from '../components/Mascot'
import { Modal, soltarConfete, useToast } from '../components/ui'
import { FOODS, VERSAO_TABELA } from '../data/foods'
import { ErroIA, refeicaoPorFoto, refeicaoPorTexto, type ItemIA } from '../lib/ia'
import { criarItem, SINTOMAS, SINTOMAS_ALERTA, ultimoPeso, useStore, type ItemRefeicao } from '../data/store'
import { diasEntre, horaBR, num, uid } from '../lib/datas'

/* ======================= 4. Registrar (+) ======================= */
export function Registrar() {
  const nav = useNavigate()
  const { s, set } = useStore()
  const toast = useToast()
  const [agua, setAgua] = useState(false)
  const ia = s.config.ia

  const rapido: { modo: string; icone: IconName; nome: string }[] = [
    { modo: 'foto', icone: 'camera', nome: 'Foto' },
    { modo: 'voz', icone: 'mic', nome: 'Voz' },
    { modo: 'texto', icone: 'text', nome: 'Texto' },
  ]
  const grade: { icone: IconName; nome: string; acao: () => void }[] = [
    { icone: 'meal', nome: 'Refeição', acao: () => nav('/app/registrar/refeicao?modo=manual') },
    { icone: 'drop', nome: 'Água', acao: () => setAgua(true) },
    { icone: 'pen', nome: 'Aplicação', acao: () => nav('/app/jornada') },
    { icone: 'scale', nome: 'Peso', acao: () => nav('/app/registrar/peso') },
    { icone: 'sad', nome: 'Sintoma', acao: () => nav('/app/registrar/sintoma') },
    { icone: 'dumbbell', nome: 'Treino', acao: () => nav('/app/registrar/treino') },
  ]
  const addAgua = (ml: number) => {
    set((x) => ({ ...x, agua: [...x.agua, { id: uid(), ml, em: new Date().toISOString() }] }))
    toast(`+${ml} ml de água`)
    setAgua(false)
    nav('/app/home')
  }

  return (
    <div className="tela">
      <div className="topo topo--entre">
        <h1 className="titulo-tela" style={{ fontSize: 26 }}>O que vamos registrar?</h1>
        <button className="btn-icone" onClick={() => nav(-1)} aria-label="Fechar">
          <Icon name="close" />
        </button>
      </div>
      <motion.div className="card card--destaque registro-rapido" initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <div className="registro-rapido__topo">
          <div>
            <h2>Registro rápido com o Dose</h2>
            <p>Fale, escreva ou fotografe. Eu organizo e você confirma.</p>
          </div>
          <Mascot expressao="piscando" size={50} />
        </div>
        <div className="registro-rapido__botoes">
          {rapido.map((r, i) => (
            <motion.button
              key={r.modo}
              className={`rr-botao ${i === 0 ? 'rr-botao--turquesa' : ''}`}
              disabled={!ia && r.modo !== 'texto'}
              onClick={() => nav(`/app/registrar/refeicao?modo=${r.modo}`)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.07 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.95 }}
            >
              <Icon name={r.icone} size={26} />
              {r.nome}
            </motion.button>
          ))}
        </div>
        <p className="registro-rapido__ex">{ia ? 'Ex.: "Almocei arroz, feijão e um filé de frango"' : 'Registro com IA desligado no Perfil. Use Texto ou a grade abaixo.'}</p>
      </motion.div>

      <p className="legenda" style={{ margin: '22px 0 10px', fontWeight: 600 }}>Ou escolha o que registrar</p>
      <div className="grade-3">
        {grade.map((g, i) => (
          <motion.button
            key={g.nome}
            className="tile"
            onClick={g.acao}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 + i * 0.05, type: 'spring', stiffness: 300, damping: 22 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.95 }}
          >
            <Icon name={g.icone} size={28} />
            {g.nome}
          </motion.button>
        ))}
      </div>

      <Modal aberto={agua} onFechar={() => setAgua(false)}>
        <h3>Quanto de água?</h3>
        <div className="grade-3" style={{ marginTop: 14 }}>
          {[150, 250, 500].map((ml) => (
            <button key={ml} className="tile" onClick={() => addAgua(ml)}>
              <Icon name="drop" />
              {ml} ml
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}

/* ======================= 5. Refeição por foto / voz / texto (IA) ======================= */
type Etapa = 'captura' | 'analisando' | 'revisao' | 'nao-reconheci'

function tipoPorHora(d = new Date()) {
  const h = d.getHours()
  if (h < 10) return 'Café da manhã'
  if (h < 15) return 'Almoço'
  if (h < 18) return 'Lanche'
  return 'Jantar'
}

// tipagem mínima da Web Speech API
type SR = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void }

export function Refeicao() {
  const [params] = useSearchParams()
  const modo = (params.get('modo') ?? 'foto') as 'foto' | 'voz' | 'texto' | 'manual'
  const nav = useNavigate()
  const { set } = useStore()
  const toast = useToast()
  const [etapa, setEtapa] = useState<Etapa>(modo === 'manual' ? 'revisao' : 'captura')
  const [foto, setFoto] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [ouvindo, setOuvindo] = useState(false)
  const [itens, setItens] = useState<(ItemRefeicao & { uid: string })[]>([])
  const [removidos, setRemovidos] = useState<(ItemRefeicao & { uid: string })[]>([])
  const [editando, setEditando] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [hora] = useState(new Date())
  const timer = useRef<number>(0)
  const rec = useRef<SR | null>(null)
  const origem = modo === 'manual' ? 'manual' : 'ia_estimativa'

  useEffect(() => () => clearTimeout(timer.current), [])

  const [faltaram, setFaltaram] = useState<string[]>([])
  const [erroIA, setErroIA] = useState('')
  const pedido = useRef(0)

  // a IA só sugere; nada é salvo até a pessoa conferir e tocar em "Salvar refeição"
  const analisar = async (chamada: Promise<{ itens: ItemIA[] }>) => {
    const n = ++pedido.current
    setEtapa('analisando')
    setErroIA('')
    try {
      const { itens: sugeridos } = await chamada
      if (n !== pedido.current) return // cancelado
      const achados = sugeridos.filter((i) => !i.nao_encontrado)
      setFaltaram(sugeridos.filter((i) => i.nao_encontrado).map((i) => i.nome))
      if (!sugeridos.length) return setEtapa('nao-reconheci')
      setItens(achados.map((i) => ({ foodId: i.food_id, nome: i.nome, porcao_g: i.porcao_g, porcao_texto: i.porcao_texto, proteina_g: i.proteina_g, energia_kcal: i.energia_kcal, origem: 'ia_estimativa' as const, uid: uid() })))
      setRemovidos([])
      setEtapa('revisao')
    } catch (e) {
      if (n !== pedido.current) return
      setErroIA(e instanceof ErroIA ? e.message : 'Algo deu errado com a IA. Tente de novo.')
      setEtapa('nao-reconheci')
    }
  }

  const onFoto = (f?: File) => {
    if (!f) return
    setFoto(URL.createObjectURL(f))
    analisar(refeicaoPorFoto(f))
  }

  const ouvir = () => {
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition
    if (!Ctor) {
      toast('Seu navegador não tem reconhecimento de voz. Digite abaixo.', 'info')
      return
    }
    if (ouvindo) return rec.current?.stop()
    const r = new Ctor()
    r.lang = 'pt-BR'
    r.interimResults = true
    r.continuous = false
    r.onresult = (e) => setTexto(Array.from(e.results).map((x) => x[0].transcript).join(' '))
    r.onend = () => setOuvindo(false)
    r.onerror = () => {
      setOuvindo(false)
      toast('Não consegui acessar o microfone. Libere nas configurações ou use Texto.', 'info')
    }
    rec.current = r
    setOuvindo(true)
    r.start()
  }

  const total = itens.reduce((t, i) => t + i.proteina_g, 0)
  const sugestoes = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (q.length < 2) return []
    return FOODS.filter((f) => f.nome.toLowerCase().includes(q) || f.sinonimos.some((x) => x.includes(q))).slice(0, 5)
  }, [busca])

  const salvar = (e: React.MouseEvent) => {
    set((x) => ({
      ...x,
      refeicoes: [
        ...x.refeicoes,
        { id: uid(), tipo: tipoPorHora(hora), em: hora.toISOString(), origem, versao_tabela: VERSAO_TABELA, itens: itens.map(({ uid: _u, ...i }) => i) },
      ],
    }))
    soltarConfete({ x: e.clientX, y: e.clientY }, 50)
    toast(`Refeição salva: ${Math.round(total)} g de proteína`)
    nav('/app/home')
  }

  const voltar = () => (etapa === 'revisao' && modo !== 'manual' ? setEtapa('captura') : nav(-1))

  return (
    <div className="tela">
      <div className="topo">
        <button className="btn-icone" onClick={voltar} aria-label="Voltar">
          <Icon name="back" />
        </button>
        <h1 className="titulo-tela" style={{ fontSize: 24 }}>
          {tipoPorHora(hora)} · {horaBR(hora)}
        </h1>
      </div>

      <AnimatePresence mode="wait">
        {etapa === 'captura' && (
          <motion.div key="cap" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {modo === 'foto' && (
              <>
                <label className="captura-foto">
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => onFoto(e.target.files?.[0])} className="sr-only" />
                  <span className="captura-foto__mira" aria-hidden>
                    <i /><i /><i /><i />
                  </span>
                  <Icon name="camera" size={40} />
                  <b>Tirar ou escolher foto</b>
                  <span className="legenda">A foto é reduzida antes do envio</span>
                </label>
                <p className="legenda" style={{ textAlign: 'center', marginTop: 10 }}>A foto é analisada pela IA e não fica guardada.</p>
              </>
            )}
            {(modo === 'voz' || modo === 'texto') && (
              <>
                {modo === 'voz' && (
                  <div className="gravador">
                    <motion.button className={`gravador__btn ${ouvindo ? 'is-on' : ''}`} onClick={ouvir} whileTap={{ scale: 0.92 }} aria-label={ouvindo ? 'Parar' : 'Falar'}>
                      {ouvindo && <span className="gravador__onda" />}
                      <Icon name="mic" size={38} />
                    </motion.button>
                    <p className="legenda">{ouvindo ? 'Estou ouvindo…' : 'Toque e conte o que você comeu'}</p>
                  </div>
                )}
                <label className="rotulo" htmlFor="txt">{modo === 'voz' ? 'Transcrição' : 'O que você comeu?'}</label>
                <textarea id="txt" className="campo" placeholder="Almocei arroz, feijão e um filé de frango" value={texto} onChange={(e) => setTexto(e.target.value)} />
                <button className="btn btn--primario btn--bloco" style={{ marginTop: 14 }} disabled={texto.trim().length < 3} onClick={() => analisar(refeicaoPorTexto(texto))}>
                  Organizar com o Dose
                </button>
              </>
            )}
          </motion.div>
        )}

        {etapa === 'analisando' && (
          <motion.div key="an" className="analisando" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Mascot expressao="pensativo" size={120} />
            <b>Analisando sua refeição…</b>
            <p className="legenda">Identifico os alimentos e busco os nutrientes na tabela TACO.</p>
            <div style={{ display: 'grid', gap: 10, width: '100%', marginTop: 10 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton" style={{ height: 60, animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <button className="btn btn--contorno" style={{ marginTop: 16 }} onClick={() => { pedido.current++; setEtapa('captura') }}>
              Cancelar
            </button>
          </motion.div>
        )}

        {etapa === 'nao-reconheci' && (
          <motion.div key="nr" className="analisando" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Mascot expressao={erroIA ? 'dormindo' : 'alerta'} size={100} />
            <b>{erroIA ? 'A IA não respondeu agora' : 'Hmm, não reconheci os alimentos'}</b>
            <p className="legenda">{erroIA || 'Tente descrever de outro jeito, ou busque cada item manualmente.'}</p>
            <div className="duas-col" style={{ width: '100%', marginTop: 12 }}>
              <button className="btn btn--contorno" onClick={() => setEtapa('captura')}>Tentar de novo</button>
              <button className="btn btn--primario" onClick={() => setEtapa('revisao')}>Buscar alimento</button>
            </div>
          </motion.div>
        )}

        {etapa === 'revisao' && (
          <motion.div key="rev" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {modo !== 'manual' && (
              <div className="foto-prato">
                <span className="selo selo--roxo">Estimativa da IA</span>
                {foto ? <img src={foto} alt="Foto da refeição" /> : <PratoIlustrado />}
              </div>
            )}
            {modo !== 'manual' && (
              <div className="dica-dose" style={{ marginTop: 12 }}>
                <Mascot expressao="feliz" size={34} flutuar={false} />
                <p>Encontrei {itens.length + removidos.length} {itens.length + removidos.length === 1 ? 'item' : 'itens'}. Confira as porções antes de salvar.</p>
              </div>
            )}

            <div className="itens">
              <AnimatePresence initial={false}>
                {itens.map((i) => (
                  <motion.div key={i.uid} layout className="item-ref" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 80, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }} transition={{ duration: 0.3 }}>
                    <button className="item-ref__info" onClick={() => setEditando(editando === i.uid ? null : i.uid)} aria-expanded={editando === i.uid}>
                      <b>{i.nome}</b>
                      <span className="legenda">{i.porcao_texto} · editar</span>
                    </button>
                    <b className="item-ref__prot">{Math.round(i.proteina_g)} g prot.</b>
                    <button className="item-ref__x" aria-label={`Remover ${i.nome}`} onClick={() => { setItens((l) => l.filter((x) => x.uid !== i.uid)); setRemovidos((r) => [...r, i]) }}>
                      <Icon name="close" size={20} />
                    </button>
                    {editando === i.uid && (
                      <div className="item-ref__editar">
                        {[-25, -10, 10, 25].map((d) => (
                          <button
                            key={d}
                            className="chip chip--quadrado"
                            onClick={() =>
                              setItens((l) =>
                                l.map((x) => (x.uid === i.uid ? { ...criarItem(x.foodId, Math.max(10, x.porcao_g + d), x.origem), uid: x.uid } : x)),
                              )
                            }
                          >
                            {d > 0 ? '+' : ''}
                            {d} g
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {faltaram.length > 0 && (
              <div className="aviso" style={{ marginTop: 12 }}>
                <span>
                  Não achei na tabela nutricional: <b>{faltaram.join(', ')}</b>. Busque abaixo um alimento parecido para incluir.
                </span>
              </div>
            )}
            <div className="busca-alimento">
              <Icon name="search" size={18} />
              <input className="campo" placeholder="Incluir alimento (ex.: ovo, whey…)" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar alimento" />
            </div>
            {sugestoes.length > 0 && (
              <div className="sugestoes">
                {sugestoes.map((f) => (
                  <button key={f.id} onClick={() => { setItens((l) => [...l, { ...criarItem(f.id, undefined, 'manual'), uid: uid() }]); setBusca('') }}>
                    <span>{f.nome} <span className="legenda">({f.preparo})</span></span>
                    <span className="legenda">{num(f.proteina_100g)} g/100 g</span>
                  </button>
                ))}
              </div>
            )}

            <div className="total-ref">
              <b>Total da refeição</b>
              <motion.span key={Math.round(total)} initial={{ scale: 1.12 }} animate={{ scale: 1 }}>{Math.round(total)} g de proteína</motion.span>
            </div>
            <p className="legenda">Valores da tabela TACO, para o alimento preparado. Itens marcados como estimativa nos relatórios.</p>

            <div className="duas-col rodape-acao">
              <button className="btn btn--contorno" disabled={!removidos.length} onClick={() => { setItens((l) => [...l, ...removidos]); setRemovidos([]) }}>
                Desfazer remoções
              </button>
              <button className="btn btn--primario" disabled={!itens.length} onClick={salvar}>
                Salvar refeição
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PratoIlustrado() {
  return (
    <svg viewBox="0 0 220 150" width="220" aria-label="Prato de exemplo">
      <ellipse cx="110" cy="78" rx="98" ry="64" fill="#fff" />
      <ellipse cx="110" cy="78" rx="78" ry="50" fill="#f1ecfb" />
      <motion.ellipse cx="80" cy="60" rx="27" ry="17" fill="#f3ecdc" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring' }} />
      <motion.path d="M118 48 q28 -10 40 10 q4 18 -18 22 q-26 2 -22 -32z" fill="#dba26a" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }} />
      <motion.ellipse cx="84" cy="96" rx="25" ry="15" fill="#5b3a2c" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring' }} />
      <motion.g initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: 'spring' }}>
        <circle cx="128" cy="100" r="11" fill="#6fbf6a" />
        <circle cx="146" cy="96" r="12" fill="#4fa84f" />
        <circle cx="158" cy="86" r="6" fill="#e5584a" />
      </motion.g>
    </svg>
  )
}

/* ======================= 7. Registrar sintoma ======================= */
export function SintomaTela() {
  const nav = useNavigate()
  const { s, set } = useStore()
  const toast = useToast()
  const [sel, setSel] = useState<string[]>([])
  const [intensidade, setIntensidade] = useState(2)
  const [obs, setObs] = useState('')
  const alerta = sel.some((x) => SINTOMAS_ALERTA.includes(x))
  const ultApl = [...s.aplicacoes].sort((a, b) => +new Date(b.em) - +new Date(a.em))[0]
  const relacao = ultApl ? diasEntre(ultApl.em, new Date()) : null

  return (
    <div className="tela">
      <div className="topo">
        <button className="btn-icone" onClick={() => nav(-1)} aria-label="Voltar">
          <Icon name="back" />
        </button>
        <h1 className="titulo-tela" style={{ fontSize: 26 }}>Como você está?</h1>
      </div>
      <span className="rotulo" style={{ marginTop: 4 }}>O que você está sentindo?</span>
      <div className="chips">
        {SINTOMAS.map((x) => (
          <button key={x} aria-pressed={sel.includes(x)} className={`chip ${sel.includes(x) ? 'is-on' : ''}`} onClick={() => setSel((l) => (l.includes(x) ? l.filter((y) => y !== x) : [...l, x]))}>
            {x}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {alerta && (
          <motion.div className="card-alerta" role="alert" initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 'auto', marginTop: 16 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}>
            <div className="card-alerta__in">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Icon name="alert" size={24} />
                <b>Procure atendimento agora</b>
              </div>
              <p>Esse sintoma precisa de avaliação. Ligue para o SAMU ou vá a um pronto-atendimento. Avise também seu médico.</p>
              <a href="tel:192" className="btn btn--perigo-cheio btn--bloco">
                <Icon name="phone" size={20} /> Ligar para o SAMU (192)
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <span className="rotulo">Intensidade</span>
      <div className="chips" style={{ flexWrap: 'nowrap' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} aria-pressed={intensidade === n} className={`chip chip--quadrado chip--violeta ${intensidade === n ? 'is-on' : ''}`} onClick={() => setIntensidade(n)} style={{ minHeight: 48 }}>
            {n}
          </button>
        ))}
      </div>
      <div className="entre legenda" style={{ marginTop: 6 }}>
        <span>leve</span>
        <span>muito forte</span>
      </div>
      <label className="rotulo" htmlFor="obs">Observação (opcional)</label>
      <input id="obs" className="campo" placeholder="Ex.: começou depois do almoço" value={obs} onChange={(e) => setObs(e.target.value)} />
      {!alerta && (
        <div className="aviso" style={{ marginTop: 16 }}>
          <span>
            Sintomas leves são comuns nas primeiras semanas. Registrar ajuda seu médico a entender seu tratamento.
            {relacao !== null && relacao <= 7 && <> Sua última aplicação foi {relacao === 0 ? 'hoje' : relacao === 1 ? 'ontem' : `há ${relacao} dias`}.</>}
          </span>
        </div>
      )}
      <div className="rodape-acao">
        <button
          className="btn btn--primario btn--bloco"
          disabled={!sel.length}
          onClick={() => {
            set((x) => ({ ...x, sintomas: [...x.sintomas, { id: uid(), em: new Date().toISOString(), sintomas: sel, intensidade, obs: obs || undefined, alerta }] }))
            toast(alerta ? 'Registrado. Cuide-se e procure atendimento 💜' : 'Registrado. Obrigado por contar 💜')
            nav('/app/home')
          }}
        >
          Salvar registro
        </button>
      </div>
    </div>
  )
}

/* ======================= Peso ======================= */
export function Peso() {
  const nav = useNavigate()
  const { s, set } = useStore()
  const toast = useToast()
  const ult = ultimoPeso(s)
  const [kg, setKg] = useState(ult?.kg ?? 80)
  return (
    <div className="tela">
      <div className="topo">
        <button className="btn-icone" onClick={() => nav(-1)} aria-label="Voltar">
          <Icon name="back" />
        </button>
        <h1 className="titulo-tela" style={{ fontSize: 26 }}>Registrar peso</h1>
      </div>
      <div className="peso-seletor">
        <button className="btn-icone" onClick={() => setKg((k) => +(k - 0.1).toFixed(1))} aria-label="Diminuir 100 g">−</button>
        <motion.div key={kg} initial={{ y: -6, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className="peso-seletor__num">
          {num(kg)}
          <span>kg</span>
        </motion.div>
        <button className="btn-icone" onClick={() => setKg((k) => +(k + 0.1).toFixed(1))} aria-label="Aumentar 100 g">+</button>
      </div>
      <input type="range" min={40} max={200} step={0.1} value={kg} onChange={(e) => setKg(Number(e.target.value))} className="range" aria-label="Peso" />
      {ult && <p className="legenda" style={{ textAlign: 'center', marginTop: 8 }}>Último registro: {num(ult.kg)} kg</p>}
      <div className="dica-dose" style={{ marginTop: 20 }}>
        <Mascot expressao="piscando" size={40} flutuar={false} />
        <p>Pese-se sempre no mesmo horário, de preferência pela manhã. O número do dia é só um ponto da curva.</p>
      </div>
      <div className="rodape-acao">
        <button
          className="btn btn--primario btn--bloco"
          onClick={() => {
            set((x) => ({ ...x, pesos: [...x.pesos, { id: uid(), kg, em: new Date().toISOString() }] }))
            toast(`Peso registrado: ${num(kg)} kg`)
            nav('/app/home')
          }}
        >
          Salvar peso
        </button>
      </div>
    </div>
  )
}

/* ======================= Treino ======================= */
export function Treino() {
  const nav = useNavigate()
  const { set } = useStore()
  const toast = useToast()
  const [tipo, setTipo] = useState('Musculação')
  const [min, setMin] = useState(40)
  const forca = ['Musculação', 'Funcional', 'Pilates'].includes(tipo)
  return (
    <div className="tela">
      <div className="topo">
        <button className="btn-icone" onClick={() => nav(-1)} aria-label="Voltar">
          <Icon name="back" />
        </button>
        <h1 className="titulo-tela" style={{ fontSize: 26 }}>Registrar treino</h1>
      </div>
      <span className="rotulo">Tipo</span>
      <div className="chips">
        {['Musculação', 'Funcional', 'Pilates', 'Caminhada', 'Corrida', 'Bike', 'Natação', 'Dança'].map((t) => (
          <button key={t} className={`chip ${tipo === t ? 'is-on' : ''}`} onClick={() => setTipo(t)}>{t}</button>
        ))}
      </div>
      <span className="rotulo">Duração: {min} min</span>
      <input type="range" min={5} max={180} step={5} value={min} onChange={(e) => setMin(Number(e.target.value))} className="range" aria-label="Duração" />
      <div className="aviso" style={{ marginTop: 16 }}>
        <span>{forca ? 'Conta como treino de força no Radar. Ótimo para preservar massa muscular!' : 'Treino aeróbico. Para o Radar, treinos de força são contados à parte.'}</span>
      </div>
      <div className="rodape-acao">
        <button
          className="btn btn--primario btn--bloco"
          onClick={(e) => {
            set((x) => ({ ...x, treinos: [...x.treinos, { id: uid(), em: new Date().toISOString(), tipo, duracao_min: min, forca }] }))
            soltarConfete({ x: e.clientX, y: e.clientY }, 40)
            toast('Treino registrado 💪')
            nav('/app/home')
          }}
        >
          Salvar treino
        </button>
      </div>
    </div>
  )
}
