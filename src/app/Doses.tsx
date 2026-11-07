import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import Mascot from '../components/Mascot'
import { Modal, useToast } from '../components/ui'
import { doseAtual, LOCAIS, LOCAL_LONGO, numerarAplicacoes, useStore, type Aplicacao, type Estado, type Local, type Peso } from '../data/store'
import { dataBR, DIA_MS, DIAS_CURTOS, DIAS_LONGOS, mesmoDia, num, uid } from '../lib/datas'
import { anotacoesPorTexto } from '../lib/ia'
import { formatarDose, ordinal, separarDose, UNIDADES, type Unidade } from '../lib/dose'

/* Doses: registrar em outra data, editar, excluir (com Desfazer) e trazer o histórico de antes do app
   (uma a uma, em sequência ou colando as anotações do bloco de notas), sempre com confirmação. */

/* ---------------- datas no fuso do aparelho ---------------- */
const doisDig = (n: number) => String(n).padStart(2, '0')
export const paraData = (d: Date | string) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${doisDig(x.getMonth() + 1)}-${doisDig(x.getDate())}`
}
export const paraHora = (d: Date | string) => {
  const x = new Date(d)
  return `${doisDig(x.getHours())}:${doisDig(x.getMinutes())}`
}
export const juntar = (data: string, hora = '08:00') => new Date(`${data}T${hora || '08:00'}:00`).toISOString()
export const hoje = () => paraData(new Date())
const ehPassado = (iso: string) => paraData(iso) < hoje()
export const nomeLocal = (l?: Local) => (l ? LOCAL_LONGO[l] : 'Local não informado')

/* ---------------- campo de dose com unidade ---------------- */
/** Número + unidade (mg já vem escolhido). Devolve o texto pronto, ex.: "2,5 mg". */
export function CampoDose({ id, value, onChange, rotulo = 'Dose' }: { id: string; value: string; onChange: (v: string) => void; rotulo?: string }) {
  const p = separarDose(value)
  const [valor, setValor] = useState(p?.valor ?? '')
  const [unidade, setUnidade] = useState<Unidade>(p?.unidade ?? 'mg')
  const emitir = (v: string, u: Unidade) => onChange(v ? `${v} ${u}` : '')
  return (
    <div className="campo-dose">
      <input
        id={id}
        className="campo"
        inputMode="decimal"
        placeholder="Ex.: 2,5"
        aria-label={rotulo}
        value={valor}
        onChange={(e) => {
          const v = e.target.value.replace('.', ',').replace(/[^\d,]/g, '').replace(/,(?=.*,)/g, '').slice(0, 6)
          setValor(v)
          emitir(v, unidade)
        }}
      />
      <select className="campo" aria-label="Unidade da dose" value={unidade} onChange={(e) => { const u = e.target.value as Unidade; setUnidade(u); emitir(valor, u) }}>
        {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
    </div>
  )
}

/* ---------------- formulário de uma dose ---------------- */
type DadosDose = { data: string; hora: string; dose: string; local: Local | ''; obs: string }

function CamposDose({ v, set, minData }: { v: DadosDose; set: (v: DadosDose) => void; minData?: string }) {
  const up = <K extends keyof DadosDose>(k: K, x: DadosDose[K]) => set({ ...v, [k]: x })
  return (
    <>
      <div className="duas-col">
        <div>
          <label className="rotulo" htmlFor="dd-data">Data</label>
          <input id="dd-data" className="campo" type="date" max={hoje()} min={minData} value={v.data} onChange={(e) => up('data', e.target.value)} />
        </div>
        <div>
          <label className="rotulo" htmlFor="dd-hora">Horário</label>
          <input id="dd-hora" className="campo" type="time" value={v.hora} onChange={(e) => up('hora', e.target.value)} />
        </div>
      </div>
      <label className="rotulo" htmlFor="dd-dose">Dose (como na receita)</label>
      <CampoDose id="dd-dose" value={v.dose} onChange={(x) => up('dose', x)} />
      <span className="rotulo">Local</span>
      <div className="grade-locais" role="radiogroup" aria-label="Local da aplicação">
        {LOCAIS.map((l) => (
          <button key={l} type="button" role="radio" aria-checked={v.local === l} className={`chip chip--quadrado chip--turquesa ${v.local === l ? 'is-on' : ''}`} onClick={() => up('local', v.local === l ? '' : l)}>
            {l}
          </button>
        ))}
      </div>
      <p className="legenda" style={{ marginTop: 6 }}>Não lembra o local? Pode deixar em branco.</p>
      <label className="rotulo" htmlFor="dd-obs">Observação (opcional)</label>
      <input id="dd-obs" className="campo" maxLength={200} value={v.obs} onChange={(e) => up('obs', e.target.value)} />
    </>
  )
}

/** Cria (sem `inicial`) ou edita uma dose. Depois de salvar, o aviso traz "Desfazer". */
export function ModalDose({ aberto, inicial, onFechar }: { aberto: boolean; inicial?: Aplicacao | null; onFechar: () => void }) {
  const { s, set } = useStore()
  const toast = useToast()
  const [v, setV] = useState<DadosDose | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  // reinicia o formulário a cada abertura
  const chave = aberto ? inicial?.id ?? 'nova' : null
  if (chave !== aberta) {
    setAberta(chave)
    if (chave)
      setV(
        inicial
          ? { data: paraData(inicial.em), hora: paraHora(inicial.em), dose: inicial.dose ?? '', local: inicial.local ?? '', obs: inicial.obs ?? '' }
          : { data: hoje(), hora: s.medicamento?.horario ?? '08:00', dose: doseAtual(s), local: '', obs: '' },
      )
  }
  if (!v) return null
  const futura = v.data > hoje()
  const salvar = () => {
    const em = juntar(v.data, v.hora)
    const nova: Aplicacao = {
      id: inicial?.id ?? uid(),
      em,
      local: v.local || undefined,
      dose: formatarDose(v.dose) || undefined,
      obs: v.obs.trim() || undefined,
      retroativo: ehPassado(em) || inicial?.retroativo ? true : undefined,
    }
    if (inicial) {
      const antiga = inicial
      set((x) => ({ ...x, aplicacoes: x.aplicacoes.map((a) => (a.id === antiga.id ? nova : a)) }))
      toast('Dose atualizada', 'ok', { rotulo: 'Desfazer', fn: () => set((x) => ({ ...x, aplicacoes: x.aplicacoes.map((a) => (a.id === antiga.id ? antiga : a)) })) })
    } else {
      set((x) => ({ ...x, aplicacoes: [...x.aplicacoes, nova] }))
      toast(`Dose de ${dataBR(em)} registrada`, 'ok', { rotulo: 'Desfazer', fn: () => set((x) => ({ ...x, aplicacoes: x.aplicacoes.filter((a) => a.id !== nova.id) })) })
    }
    onFechar()
  }
  return (
    <Modal aberto={aberto} onFechar={onFechar}>
      <h3>{inicial ? 'Editar dose' : 'Registrar dose de outro dia'}</h3>
      <CamposDose v={v} set={setV} />
      {futura && <p className="erro-campo">A data não pode ser no futuro.</p>}
      <div className="duas-col" style={{ marginTop: 18 }}>
        <button className="btn btn--contorno" onClick={onFechar}>Cancelar</button>
        <button className="btn btn--primario" disabled={!v.data || futura} onClick={salvar}>Salvar</button>
      </div>
    </Modal>
  )
}

/* ---------------- histórico com editar e excluir ---------------- */
export function HistoricoDoses() {
  const { s, set } = useStore()
  const toast = useToast()
  const [todas, setTodas] = useState(false)
  const [editar, setEditar] = useState<Aplicacao | null>(null)
  const [excluir, setExcluir] = useState<Aplicacao | null>(null)
  const ordenadas = useMemo(() => [...s.aplicacoes].sort((a, b) => +new Date(b.em) - +new Date(a.em)), [s.aplicacoes])
  const numeros = useMemo(() => numerarAplicacoes(s.aplicacoes), [s.aplicacoes])
  const mostrar = todas ? ordenadas : ordenadas.slice(0, 5)

  const confirmarExclusao = () => {
    const a = excluir!
    set((x) => ({ ...x, aplicacoes: x.aplicacoes.filter((y) => y.id !== a.id) }))
    toast(`Dose de ${dataBR(a.em)} excluída`, 'info', { rotulo: 'Desfazer', fn: () => set((x) => ({ ...x, aplicacoes: [...x.aplicacoes, a] })) })
    setExcluir(null)
  }

  if (!ordenadas.length) return null
  return (
    <>
      <div className="card lista">
        <AnimatePresence initial={false}>
          {mostrar.map((a) => (
            <motion.div key={a.id} className="dose-linha" layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <div className="dose-linha__txt">
                <b>{ordinal(numeros.get(a.id) ?? 0)} aplicação · {DIAS_CURTOS[new Date(a.em).getDay()]}, {dataBR(a.em)}</b>
                <span className="legenda">
                  {[formatarDose(a.dose), nomeLocal(a.local)].filter(Boolean).join(' · ')}
                  {a.retroativo && ' · registrada depois'}
                </span>
              </div>
              <div className="dose-linha__acoes">
                <button className="btn-icone btn-icone--peq" aria-label={`Editar dose de ${dataBR(a.em)}`} onClick={() => setEditar(a)}><Icon name="editar" size={17} /></button>
                <button className="btn-icone btn-icone--peq btn-icone--perigo" aria-label={`Excluir dose de ${dataBR(a.em)}`} onClick={() => setExcluir(a)}><Icon name="trash" size={17} /></button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {ordenadas.length > 5 && (
          <button className="btn btn--fantasma btn--bloco btn--pequeno" style={{ margin: '6px 0' }} onClick={() => setTodas(!todas)}>
            {todas ? 'Mostrar menos' : `Ver todas as ${ordenadas.length} doses`}
          </button>
        )}
      </div>
      <ModalDose aberto={!!editar} inicial={editar} onFechar={() => setEditar(null)} />
      <Modal aberto={!!excluir} onFechar={() => setExcluir(null)}>
        <h3 style={{ textAlign: 'center' }}>Excluir esta dose?</h3>
        {excluir && (
          <p className="legenda" style={{ textAlign: 'center', fontSize: 15 }}>
            {ordinal(numeros.get(excluir.id) ?? 0)} aplicação · {DIAS_LONGOS[new Date(excluir.em).getDay()]}, {dataBR(excluir.em)}{excluir.dose ? ` · ${formatarDose(excluir.dose)}` : ''} · {nomeLocal(excluir.local).toLowerCase()}
          </p>
        )}
        <p className="legenda" style={{ textAlign: 'center' }}>A numeração, a próxima aplicação e os lembretes são recalculados na hora.</p>
        <div className="duas-col" style={{ marginTop: 16 }}>
          <button className="btn btn--contorno" onClick={() => setExcluir(null)}>Manter</button>
          <button className="btn btn--perigo-cheio" onClick={confirmarExclusao}>Excluir</button>
        </div>
      </Modal>
    </>
  )
}

/* ---------------- doses anteriores ao app ---------------- */
type Rascunho = { chave: string; tipo: 'dose' | 'peso'; em: string; dose?: string; local?: Local; kg?: number; obs?: string; incluir: boolean; repetida: boolean; trecho?: string }

const repetida = (s: Estado, r: Omit<Rascunho, 'repetida' | 'incluir' | 'chave'>) =>
  r.tipo === 'dose' ? s.aplicacoes.some((a) => mesmoDia(a.em, r.em)) : s.pesos.some((p) => mesmoDia(p.em, r.em) && Math.abs(p.kg - (r.kg ?? 0)) < 0.05)

/** Leitura simples das anotações (sem IA): datas dd/mm[/aa], "x mg", "x kg" e o local por palavras. */
export function lerAnotacoesLocal(texto: string): Omit<Rascunho, 'chave' | 'incluir' | 'repetida'>[] {
  const out: Omit<Rascunho, 'chave' | 'incluir' | 'repetida'>[] = []
  const agora = new Date()
  for (const linha of texto.split(/\n+/)) {
    const m = linha.match(/(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/)
    if (!m) continue
    const dia = Number(m[1]), mes = Number(m[2])
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) continue
    let ano = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : agora.getFullYear()
    let d = new Date(ano, mes - 1, dia, 8, 0)
    if (!m[3] && d > agora) d = new Date(--ano, mes - 1, dia, 8, 0) // sem ano e no futuro: é do ano passado
    if (d > agora || d.getDate() !== dia) continue
    const hora = linha.match(/\b(\d{1,2})[:h](\d{2})\b/)
    if (hora && Number(hora[1]) < 24) d.setHours(Number(hora[1]), Number(hora[2]))
    const em = d.toISOString()
    const resto = linha.replace(m[0], ' ')
    const kg = resto.match(/(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:kg|quilos?)\b/i)
    if (kg) out.push({ tipo: 'peso', em, kg: Number(kg[1].replace(',', '.')), trecho: linha.trim() })
    const dose = resto.match(/(\d+(?:[.,]\d+)?)\s*(mg|ml|ui|unidades|cliques?)\b/i)
    const ehDose = dose || /aplic|dose|caneta|injet|tomei|apliquei/i.test(resto) || !kg
    if (ehDose) {
      const l = resto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      const lado = /\besq/.test(l) ? 'esq.' : /\bdir/.test(l) ? 'dir.' : null
      const parte = /abd|barriga|umbigo/.test(l) ? 'Abdômen' : /coxa|perna/.test(l) ? 'Coxa' : /braco/.test(l) ? 'Braço' : null
      const local = parte && lado ? (`${parte} ${lado}` as Local) : undefined
      out.push({ tipo: 'dose', em, dose: dose ? formatarDose(`${dose[1]} ${dose[2]}`) : undefined, local, trecho: linha.trim() })
    }
  }
  return out
}

type Aba = 'uma' | 'sequencia' | 'pesos' | 'colar'

export function DosesAnteriores() {
  const nav = useNavigate()
  const { s, set } = useStore()
  const toast = useToast()
  const [aba, setAba] = useState<Aba>('sequencia')
  const [lista, setLista] = useState<Rascunho[]>([])
  const [confirmar, setConfirmar] = useState(false)

  // uma a uma
  const [uma, setUma] = useState<DadosDose>({ data: '', hora: s.medicamento?.horario ?? '08:00', dose: doseAtual(s), local: '', obs: '' })
  // em sequência
  const inicioSugerido = s.perfil.inicio_tratamento || paraData(new Date(Date.now() - 28 * DIA_MS))
  const [seq, setSeq] = useState({ inicio: inicioSugerido, fim: paraData(new Date(Date.now() - DIA_MS)), intervalo: 7, hora: s.medicamento?.horario ?? '08:00', dose: doseAtual(s), local: 'rodizio' as Local | 'rodizio' | '' })
  // pesos de datas passadas
  const [peso, setPeso] = useState({ data: '', kg: '' })
  const kgPeso = Number(peso.kg.replace(',', '.'))
  // colar
  const [texto, setTexto] = useState('')
  const [lendo, setLendo] = useState(false)
  const [avisoLeitura, setAvisoLeitura] = useState('')

  const adicionar = (itens: Omit<Rascunho, 'chave' | 'incluir' | 'repetida'>[]) => {
    const novos = itens.map((r) => {
      const rep = repetida(s, r) || lista.some((x) => x.tipo === r.tipo && mesmoDia(x.em, r.em))
      return { ...r, chave: uid(), repetida: rep, incluir: !rep }
    })
    setLista((l) => [...l, ...novos].sort((a, b) => +new Date(a.em) - +new Date(b.em)))
    return novos.length
  }

  const gerarSequencia = () => {
    const ini = new Date(`${seq.inicio}T12:00:00`)
    const fim = new Date(`${seq.fim}T12:00:00`)
    const itens: Omit<Rascunho, 'chave' | 'incluir' | 'repetida'>[] = []
    let i = 0
    for (let d = ini; d <= fim && itens.length < 104; d = new Date(d.getTime() + seq.intervalo * DIA_MS), i++) {
      const local = seq.local === 'rodizio' ? LOCAIS[i % LOCAIS.length] : seq.local || undefined
      itens.push({ tipo: 'dose', em: juntar(paraData(d), seq.hora), dose: formatarDose(seq.dose) || undefined, local })
    }
    const n = adicionar(itens)
    toast(`${n} ${n === 1 ? 'dose adicionada' : 'doses adicionadas'} à lista para conferir`)
  }

  const lerTexto = async () => {
    setLendo(true)
    setAvisoLeitura('')
    let itens: Omit<Rascunho, 'chave' | 'incluir' | 'repetida'>[] = []
    try {
      if (!s.config.ia) throw new Error('ia desligada')
      const r = await anotacoesPorTexto(texto, hoje(), s.perfil.inicio_tratamento || undefined)
      itens = r.registros.map((x) => ({
        tipo: x.tipo,
        em: juntar(x.data, x.hora || s.medicamento?.horario || '08:00'),
        dose: x.tipo === 'dose' ? formatarDose(x.dose) || undefined : undefined,
        local: (LOCAIS as readonly string[]).includes(x.local) ? (x.local as Local) : undefined,
        kg: x.tipo === 'peso' ? x.peso_kg : undefined,
        obs: x.obs || undefined,
        trecho: x.trecho,
      }))
    } catch {
      itens = lerAnotacoesLocal(texto)
      setAvisoLeitura(s.config.ia ? 'O Dose não conseguiu usar a IA agora, então organizei pelas datas que encontrei. Confira com atenção.' : 'A IA está desligada no seu Perfil, então organizei pelas datas que encontrei. Confira com atenção.')
    }
    setLendo(false)
    if (!itens.length) return setAvisoLeitura('Não encontrei datas nesse texto. Escreva uma dose por linha, com a data (ex.: 05/08 2,5 mg abdômen esquerdo).')
    const n = adicionar(itens)
    toast(`Encontrei ${n} ${n === 1 ? 'registro' : 'registros'}. Confira antes de salvar.`)
  }

  const escolhidos = lista.filter((r) => r.incluir)
  const nDoses = escolhidos.filter((r) => r.tipo === 'dose').length
  const nPesos = escolhidos.length - nDoses

  const salvar = () => {
    const doses: Aplicacao[] = escolhidos.filter((r) => r.tipo === 'dose').map((r) => ({ id: uid(), em: r.em, local: r.local, dose: r.dose, obs: r.obs, retroativo: true }))
    const pesos: Peso[] = escolhidos.filter((r) => r.tipo === 'peso' && r.kg).map((r) => ({ id: uid(), em: r.em, kg: r.kg!, retroativo: true }))
    const idsD = new Set(doses.map((d) => d.id))
    const idsP = new Set(pesos.map((p) => p.id))
    set((x) => ({ ...x, aplicacoes: [...x.aplicacoes, ...doses], pesos: [...x.pesos, ...pesos] }))
    const partes = [nDoses && `${nDoses} ${nDoses === 1 ? 'dose' : 'doses'}`, nPesos && `${nPesos} ${nPesos === 1 ? 'peso' : 'pesos'}`].filter(Boolean).join(' e ')
    toast(`${partes} ${escolhidos.length === 1 ? 'salvo' : 'salvos'} no seu histórico`, 'ok', {
      rotulo: 'Desfazer',
      fn: () => set((x) => ({ ...x, aplicacoes: x.aplicacoes.filter((a) => !idsD.has(a.id)), pesos: x.pesos.filter((p) => !idsP.has(p.id)) })),
    })
    setConfirmar(false)
    nav('/app/jornada')
  }

  const ABAS: { id: Aba; nome: string }[] = [
    { id: 'sequencia', nome: 'Sequência' },
    { id: 'uma', nome: 'Uma a uma' },
    { id: 'pesos', nome: 'Pesos' },
    { id: 'colar', nome: 'Colar' },
  ]

  return (
    <div className="tela">
      <div className="topo">
        <button className="btn-icone" onClick={() => nav(-1)} aria-label="Voltar"><Icon name="back" /></button>
        <h1 className="titulo-tela" style={{ fontSize: 24 }}>Doses anteriores</h1>
      </div>
      <p className="sub-tela" style={{ marginTop: 0 }}>Traga as doses e os pesos que você anotou antes do app. Nada é salvo sem você conferir.</p>

      <div className="abas-app" role="tablist" style={{ marginTop: 14 }}>
        {ABAS.map((a) => (
          <button key={a.id} role="tab" aria-selected={aba === a.id} className={aba === a.id ? 'is-on' : ''} onClick={() => setAba(a.id)}>{a.nome}</button>
        ))}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        {aba === 'uma' && (
          <>
            <CamposDose v={uma} set={setUma} />
            <button
              className="btn btn--lilas btn--bloco"
              style={{ marginTop: 14 }}
              disabled={!uma.data || uma.data > hoje()}
              onClick={() => {
                adicionar([{ tipo: 'dose', em: juntar(uma.data, uma.hora), dose: formatarDose(uma.dose) || undefined, local: uma.local || undefined, obs: uma.obs.trim() || undefined }])
                setUma({ ...uma, data: '', obs: '', local: '' })
              }}
            >
              <Icon name="plus" size={18} /> Adicionar à lista
            </button>
          </>
        )}

        {aba === 'sequencia' && (
          <>
            <p className="legenda">Ex.: toda segunda desde 5 de agosto. O Dose cria uma dose a cada intervalo, você confere e salva.</p>
            <div className="duas-col">
              <div>
                <label className="rotulo" htmlFor="sq-ini">Primeira dose</label>
                <input id="sq-ini" className="campo" type="date" max={hoje()} value={seq.inicio} onChange={(e) => setSeq({ ...seq, inicio: e.target.value })} />
              </div>
              <div>
                <label className="rotulo" htmlFor="sq-fim">Até</label>
                <input id="sq-fim" className="campo" type="date" max={hoje()} min={seq.inicio} value={seq.fim} onChange={(e) => setSeq({ ...seq, fim: e.target.value })} />
              </div>
            </div>
            {seq.inicio && <p className="legenda" style={{ marginTop: 6 }}>A primeira foi numa {DIAS_LONGOS[new Date(`${seq.inicio}T12:00:00`).getDay()]}.</p>}
            <span className="rotulo">Frequência</span>
            <div className="chips">
              {[7, 14, 10].map((n) => (
                <button key={n} type="button" className={`chip ${seq.intervalo === n ? 'is-on' : ''}`} onClick={() => setSeq({ ...seq, intervalo: n })}>
                  {n === 7 ? 'Toda semana' : n === 14 ? 'A cada 2 semanas' : 'A cada 10 dias'}
                </button>
              ))}
            </div>
            <div className="duas-col">
              <div>
                <label className="rotulo" htmlFor="sq-dose">Dose</label>
                <CampoDose id="sq-dose" value={seq.dose} onChange={(x) => setSeq({ ...seq, dose: x })} />
              </div>
              <div>
                <label className="rotulo" htmlFor="sq-hora">Horário</label>
                <input id="sq-hora" className="campo" type="time" value={seq.hora} onChange={(e) => setSeq({ ...seq, hora: e.target.value })} />
              </div>
            </div>
            <label className="rotulo" htmlFor="sq-local">Local</label>
            <select id="sq-local" className="campo" value={seq.local} onChange={(e) => setSeq({ ...seq, local: e.target.value as Local | 'rodizio' | '' })}>
              <option value="rodizio">Rodízio (abdômen, coxa, braço…)</option>
              <option value="">Não sei / não anotei</option>
              {LOCAIS.map((l) => <option key={l} value={l}>Sempre {LOCAL_LONGO[l].toLowerCase()}</option>)}
            </select>
            <p className="legenda" style={{ marginTop: 6 }}>Mudou de dose no meio do caminho? Gere uma sequência para cada dose.</p>
            <button className="btn btn--lilas btn--bloco" style={{ marginTop: 14 }} disabled={!seq.inicio || !seq.fim || seq.fim < seq.inicio} onClick={gerarSequencia}>
              <Icon name="calendar" size={18} /> Criar a sequência
            </button>
          </>
        )}

        {aba === 'pesos' && (
          <>
            <p className="legenda">Pesos de antes ou do começo do tratamento: o gráfico passa a começar no início real.</p>
            <div className="duas-col">
              <div>
                <label className="rotulo" htmlFor="ps-data">Data da pesagem</label>
                <input id="ps-data" className="campo" type="date" max={hoje()} value={peso.data} onChange={(e) => setPeso({ ...peso, data: e.target.value })} />
              </div>
              <div>
                <label className="rotulo" htmlFor="ps-kg">Peso (kg)</label>
                <input id="ps-kg" className="campo" inputMode="decimal" placeholder="Ex.: 96,4" value={peso.kg} onChange={(e) => setPeso({ ...peso, kg: e.target.value.replace(/[^\d,.]/g, '') })} />
              </div>
            </div>
            <button
              className="btn btn--lilas btn--bloco"
              style={{ marginTop: 14 }}
              disabled={!peso.data || peso.data > hoje() || !(kgPeso >= 30 && kgPeso <= 400)}
              onClick={() => {
                adicionar([{ tipo: 'peso', em: juntar(peso.data, '08:00'), kg: Math.round(kgPeso * 10) / 10 }])
                setPeso({ data: '', kg: '' })
              }}
            >
              <Icon name="plus" size={18} /> Adicionar à lista
            </button>
          </>
        )}

        {aba === 'colar' && (
          <>
            <p className="legenda">Cole aqui o que você anotou no bloco de notas ou no caderno, do jeito que está. Uma dose por linha ajuda.</p>
            <textarea
              className="campo campo--texto"
              rows={7}
              maxLength={6000}
              placeholder={'05/08 2,5mg barriga esq\n12/08 2,5 mg barriga dir 96,4kg\n19/08 5mg coxa esquerda'}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              style={{ marginTop: 8 }}
            />
            {avisoLeitura && <div className="aviso" style={{ marginTop: 10 }}><Icon name="info" size={18} /><span>{avisoLeitura}</span></div>}
            <button className="btn btn--lilas btn--bloco" style={{ marginTop: 12 }} disabled={texto.trim().length < 5 || lendo} onClick={lerTexto}>
              <Icon name="sparkle" size={18} /> {lendo ? 'Organizando…' : 'Organizar anotações'}
            </button>
            {s.config.ia && <p className="legenda" style={{ marginTop: 6 }}>O texto vai para a IA só para separar datas, doses, locais e pesos. Nada é salvo sem você conferir.</p>}
          </>
        )}
      </div>

      <h2 className="secao-titulo">Para conferir {lista.length > 0 && `(${escolhidos.length} de ${lista.length})`}</h2>
      {lista.length === 0 ? (
        <div className="vazio">
          <Mascot expressao="pensativo" size={64} />
          <p>As doses aparecem aqui antes de irem para o seu histórico.</p>
        </div>
      ) : (
        <div className="card lista">
          {lista.map((r) => (
            <label key={r.chave} className={`dose-linha ${r.incluir ? '' : 'is-fora'}`}>
              <input type="checkbox" checked={r.incluir} onChange={(e) => setLista((l) => l.map((x) => (x.chave === r.chave ? { ...x, incluir: e.target.checked } : x)))} aria-label="Incluir" />
              <div className="dose-linha__txt">
                <b>{r.tipo === 'dose' ? 'Dose' : 'Peso'} · {DIAS_CURTOS[new Date(r.em).getDay()]}, {dataBR(r.em)}</b>
                <span className="legenda">
                  {r.tipo === 'dose' ? [r.dose ? formatarDose(r.dose) : 'dose não informada', nomeLocal(r.local)].join(' · ') : `${num(r.kg ?? 0)} kg`}
                  {r.repetida && ' · já existe um registro neste dia'}
                </span>
                {r.trecho && <small className="dose-linha__trecho">“{r.trecho}”</small>}
              </div>
              <button type="button" className="btn-icone btn-icone--peq" aria-label="Tirar da lista" onClick={(e) => { e.preventDefault(); setLista((l) => l.filter((x) => x.chave !== r.chave)) }}><Icon name="close" size={16} /></button>
            </label>
          ))}
        </div>
      )}

      <div className="rodape-acao">
        <button className="btn btn--primario btn--bloco" disabled={!escolhidos.length} onClick={() => setConfirmar(true)}>
          Conferir e salvar {escolhidos.length ? `(${escolhidos.length})` : ''}
        </button>
      </div>

      <Modal aberto={confirmar} onFechar={() => setConfirmar(false)}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><Mascot expressao="feliz" size={70} /></div>
        <h3 style={{ textAlign: 'center' }}>Salvar no seu histórico?</h3>
        <p className="legenda" style={{ textAlign: 'center', fontSize: 15 }}>
          {[nDoses && `${nDoses} ${nDoses === 1 ? 'dose' : 'doses'}`, nPesos && `${nPesos} ${nPesos === 1 ? 'peso' : 'pesos'}`].filter(Boolean).join(' e ')}
          {escolhidos.length > 0 && `, de ${dataBR(escolhidos[0].em)} a ${dataBR(escolhidos[escolhidos.length - 1].em)}`}.
          Elas ficam marcadas como registradas depois, e você pode editar ou excluir quando quiser.
        </p>
        <div className="duas-col" style={{ marginTop: 16 }}>
          <button className="btn btn--contorno" onClick={() => setConfirmar(false)}>Voltar</button>
          <button className="btn btn--primario" onClick={salvar}>Salvar</button>
        </div>
      </Modal>
    </div>
  )
}
