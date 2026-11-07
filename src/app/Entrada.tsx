import { motion } from 'framer-motion'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import Mascot from '../components/Mascot'
import { Interruptor, Logo, soltarConfete, useToast } from '../components/ui'
import { LOCAIS, PRINCIPIOS, useStore, type Aplicacao, type Local, type Peso } from '../data/store'
import { CampoDose, juntar, paraData } from './Doses'
import { formatarDose } from '../lib/dose'
import { DIAS_CURTOS, uid } from '../lib/datas'
import { erroPt } from '../lib/supabase'

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
}
const sobe = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } } }

/* ======================= 1. Boas-vindas ======================= */
export function Boasvindas() {
  const { s } = useStore()
  if (s.userId) return <Navigate to={s.onboardingFeito ? '/app/home' : '/app/onboarding/1'} replace />
  return (
    <div className="tela tela--roxa boas-vindas">
      <div className="bv-bolhas" aria-hidden>
        <span /> <span /> <span />
      </div>
      <motion.div className="bv-conteudo" variants={stagger} initial="hidden" animate="show">
        <motion.div variants={sobe} className="bv-logo">
          <Logo claro tamanho={26} />
        </motion.div>
        <motion.div variants={sobe} className="bv-mascote">
          <div className="bv-halo" />
          <Mascot expressao="acenando" size={150} seguirCursor />
        </motion.div>
        <motion.h1 variants={sobe}>Sua dose de felicidade, toda semana.</motion.h1>
        <motion.p variants={sobe} className="bv-sub">
          Eu sou o Dose. Vou te ajudar a acompanhar aplicações, proteína, água e evolução, sem complicação.
        </motion.p>
        <motion.div variants={sobe} className="bv-botoes">
          <Link to="/app/cadastro" className="btn btn--turquesa btn--bloco">
            Criar minha conta
          </Link>
          <Link to="/app/login" className="btn btn--fantasma btn--bloco">
            Já tenho conta
          </Link>
        </motion.div>
        <motion.p variants={sobe} className="bv-aviso">
          O Canetolino não substitui seu médico ou nutricionista e nunca indica dose.
        </motion.p>
      </motion.div>
    </div>
  )
}

/* ======================= Login ======================= */
export function Login() {
  const { entrar, recuperarSenha } = useStore()
  const nav = useNavigate()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  return (
    <div className="tela">
      <div className="topo">
        <button className="btn-icone" onClick={() => nav('/app/boas-vindas')} aria-label="Voltar">
          <Icon name="back" />
        </button>
      </div>
      <motion.div variants={stagger} initial="hidden" animate="show">
        <motion.div variants={sobe} style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 4px' }}>
          <Mascot expressao={erro ? 'alerta' : 'feliz'} size={96} />
        </motion.div>
        <motion.h1 variants={sobe} className="titulo-tela" style={{ textAlign: 'center' }}>
          Que bom te ver de novo!
        </motion.h1>
        <motion.form
          variants={sobe}
          onSubmit={async (e) => {
            e.preventDefault()
            setCarregando(true)
            setErro('')
            try {
              await entrar(email, senha)
              nav('/app')
            } catch (er) {
              setErro(erroPt(er))
            } finally {
              setCarregando(false)
            }
          }}
        >
          <label className="rotulo" htmlFor="email">E-mail</label>
          <input id="email" className="campo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <label className="rotulo" htmlFor="senha">Senha</label>
          <input id="senha" className="campo" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
          {erro && <p className="erro-campo" role="alert">{erro}</p>}
          <button className="btn btn--primario btn--bloco" style={{ marginTop: 22 }} disabled={carregando || !email || !senha}>
            {carregando ? 'Entrando…' : 'Entrar'}
          </button>
          <button
            type="button"
            className="btn btn--contorno btn--bloco"
            style={{ marginTop: 10 }}
            onClick={async () => {
              if (!email.includes('@')) return setErro('Digite seu e-mail acima para receber o link.')
              try {
                await recuperarSenha(email)
                toast('Enviamos um link para criar uma nova senha', 'info')
              } catch (er) {
                setErro(erroPt(er))
              }
            }}
          >
            Esqueci minha senha
          </button>
          <p className="legenda" style={{ textAlign: 'center', marginTop: 16 }}>
            Ainda não tem conta? <Link to="/app/cadastro" style={{ color: 'var(--violeta)', fontWeight: 700 }}>Criar conta</Link>
          </p>
        </motion.form>
      </motion.div>
    </div>
  )
}

/* ======================= Cadastro ======================= */
export function Cadastro() {
  const { criarConta } = useStore()
  const nav = useNavigate()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [termos, setTermos] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [confirmar, setConfirmar] = useState(false)

  if (confirmar)
    return (
      <div className="tela" style={{ justifyContent: 'center', textAlign: 'center', alignItems: 'center', gap: 10 }}>
        <Mascot expressao="piscando" size={120} />
        <h1 className="titulo-tela">Confira seu e-mail</h1>
        <p className="sub-tela">Enviamos um link de confirmação para <b>{email}</b>. Toque nele e depois entre com sua senha para continuar o cadastro.</p>
        <Link to="/app/login" className="btn btn--primario btn--bloco" style={{ marginTop: 20 }}>Já confirmei, entrar</Link>
      </div>
    )

  return (
    <div className="tela">
      <div className="topo">
        <button className="btn-icone" onClick={() => nav('/app/boas-vindas')} aria-label="Voltar">
          <Icon name="back" />
        </button>
        <h1 className="titulo-tela" style={{ fontSize: 26 }}>Criar minha conta</h1>
      </div>
      <p className="sub-tela" style={{ marginTop: 0 }}>Seus registros ficam guardados com segurança e você acessa de qualquer aparelho.</p>
      <form
        style={{ display: 'flex', flexDirection: 'column', flex: 1 }}
        onSubmit={async (e) => {
          e.preventDefault()
          setCarregando(true)
          setErro('')
          try {
            const r = await criarConta(email, senha, nome.trim())
            if (r === 'ok') nav('/app/onboarding/1')
            else setConfirmar(true)
          } catch (er) {
            setErro(erroPt(er))
          } finally {
            setCarregando(false)
          }
        }}
      >
        <label className="rotulo" htmlFor="cnome">Seu nome</label>
        <input id="cnome" className="campo" placeholder="Como quer ser chamada(o)" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="given-name" required />
        <label className="rotulo" htmlFor="cemail">E-mail</label>
        <input id="cemail" className="campo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <label className="rotulo" htmlFor="csenha">Senha</label>
        <input id="csenha" className="campo" type="password" placeholder="Pelo menos 8 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" required />
        <label className="check" style={{ marginTop: 18 }}>
          <input type="checkbox" checked={termos} onChange={(e) => setTermos(e.target.checked)} />
          <span className="legenda" style={{ fontSize: 14 }}>
            Li e aceito os termos de uso e a política de privacidade. Consinto o uso dos meus dados de saúde para as funções do app (LGPD).
          </span>
        </label>
        {erro && <p className="erro-campo" role="alert">{erro}</p>}
        <div className="rodape-acao">
          <button className="btn btn--turquesa btn--bloco" disabled={carregando || nome.trim().length < 2 || !email.includes('@') || senha.length < 8 || !termos}>
            {carregando ? 'Criando…' : 'Criar conta'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ======================= Nova senha (link do e-mail) ======================= */
export function NovaSenha() {
  const { novaSenha } = useStore()
  const nav = useNavigate()
  const toast = useToast()
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  return (
    <div className="tela">
      <h1 className="titulo-tela" style={{ marginTop: 20 }}>Crie uma nova senha</h1>
      <label className="rotulo" htmlFor="ns">Nova senha</label>
      <input id="ns" className="campo" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
      {erro && <p className="erro-campo">{erro}</p>}
      <div className="rodape-acao">
        <button
          className="btn btn--primario btn--bloco"
          disabled={senha.length < 8}
          onClick={async () => {
            try {
              await novaSenha(senha)
              toast('Senha atualizada')
              nav('/app')
            } catch (er) {
              setErro(erroPt(er))
            }
          }}
        >
          Salvar nova senha
        </button>
      </div>
    </div>
  )
}

/* ======================= Onboarding (5 passos) ======================= */
const TOTAL = 6

export function Onboarding() {
  const { passo = '1' } = useParams()
  const p = Math.min(TOTAL, Math.max(1, Number(passo) || 1))
  const nav = useNavigate()
  const { s, set } = useStore()
  const toast = useToast()

  // rascunho do onboarding, gravado na nuvem ao concluir
  const [d, setD] = useState(() => ({
    nome: s.perfil.nome,
    nascimento: s.perfil.nascimento,
    altura: s.perfil.altura_cm ? String(s.perfil.altura_cm) : '',
    peso: s.perfil.peso_inicial_kg ? String(s.perfil.peso_inicial_kg) : '',
    principio: s.medicamento?.principio ?? '',
    nome_comercial: s.medicamento?.nome_comercial ?? '',
    dia: s.medicamento?.dia_semana ?? -1,
    horario: s.medicamento?.horario ?? '08:00',
    dose: formatarDose(s.medicamento?.dose_texto && !/conforme/i.test(s.medicamento.dose_texto) ? s.medicamento.dose_texto : ''),
    meta_peso: s.perfil.meta_peso_kg ? String(s.perfil.meta_peso_kg) : '',
    meta_proteina: String(s.perfil.meta_proteina_g || 100),
    meta_agua: String((s.perfil.meta_agua_ml || 2000) / 1000),
    objetivos: [] as string[],
    preferencias: s.perfil.preferencias,
    discretas: true,
    lembreteAgua: true,
    termos: false,
    jornada: (s.perfil.jornada || '') as '' | 'comecando' | 'em_tratamento',
    inicio: s.perfil.inicio_tratamento,
    dose_atual: '',
    ultima: '',
    local_ultima: '' as Local | '',
    peso_antes: '',
  }))
  const up = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((x) => ({ ...x, [k]: v }))
  const alterna = (k: 'objetivos' | 'preferencias', v: string) => up(k, d[k].includes(v) ? d[k].filter((x) => x !== v) : [...d[k], v])

  const idade = d.nascimento ? Math.floor((Date.now() - new Date(d.nascimento).getTime()) / (365.25 * 86400000)) : 0
  const hojeStr = paraData(new Date())
  const pesoAntes = Number(d.peso_antes.replace(',', '.'))
  const valido = [
    d.nome.trim().length > 1 && idade >= 18 && Number(d.altura) > 100 && Number(d.peso.replace(',', '.')) > 30,
    d.jornada === 'comecando' ||
      (d.jornada === 'em_tratamento' && !!d.inicio && d.inicio <= hojeStr && (!d.ultima || (d.ultima >= d.inicio && d.ultima <= hojeStr)) && (!d.peso_antes || pesoAntes > 30)),
    !!d.principio && d.dia >= 0,
    Number(d.meta_proteina) > 0 && Number(d.meta_agua.replace(',', '.')) > 0,
    true,
    true,
  ][p - 1]

  const concluir = (e: React.MouseEvent) => {
    const emTratamento = d.jornada === 'em_tratamento'
    const pesoHoje = Number(d.peso.replace(',', '.'))
    const pesos = [{ id: uid(), kg: pesoHoje, em: new Date().toISOString() } as Peso]
    if (emTratamento && pesoAntes > 30) pesos.unshift({ id: uid(), kg: pesoAntes, em: juntar(d.inicio, '08:00'), retroativo: true })
    const ultimaDose: Aplicacao[] =
      emTratamento && d.ultima
        ? [{ id: uid(), em: juntar(d.ultima, d.horario), dose: formatarDose(d.dose_atual || d.dose) || undefined, local: d.local_ultima || undefined, retroativo: d.ultima < hojeStr ? true : undefined }]
        : []
    set((x) => ({
      ...x,
      onboardingFeito: true,
      perfil: {
        ...x.perfil,
        nome: d.nome.trim().split(' ')[0],
        nascimento: d.nascimento,
        altura_cm: Number(d.altura),
        peso_inicial_kg: emTratamento && pesoAntes > 30 ? pesoAntes : pesoHoje,
        jornada: d.jornada || 'comecando',
        inicio_tratamento: emTratamento ? d.inicio : '',
        meta_peso_kg: Number(d.meta_peso.replace(',', '.')) || 0,
        meta_proteina_g: Number(d.meta_proteina),
        meta_agua_ml: Math.round(Number(d.meta_agua.replace(',', '.')) * 1000),
        preferencias: d.preferencias,
      },
      medicamento: { id: x.medicamento?.id ?? uid(), principio: d.principio, nome_comercial: d.nome_comercial, dia_semana: d.dia, horario: d.horario, dose_texto: formatarDose(d.dose || d.dose_atual) || 'conforme sua prescrição' },
      pesos,
      aplicacoes: [...x.aplicacoes, ...ultimaDose],
      config: { ...x.config, notificacoesDiscretas: d.discretas, lembretesAgua: d.lembreteAgua, lembreteHora: d.horario },
      consentimentos: [
        { id: uid(), tipo: 'termos', versao: 'termos-v1.0', em: new Date().toISOString() },
        { id: uid(), tipo: 'ia', versao: 'ia-v1.0', em: new Date().toISOString() },
      ],
    }))
    soltarConfete({ x: e.clientX, y: e.clientY })
    toast(`Tudo pronto, ${d.nome.trim().split(' ')[0]}!`)
    nav(emTratamento ? '/app/jornada' : '/app/home')
  }

  if (!s.userId) return <Navigate to="/app/boas-vindas" replace />

  return (
    <div className="tela onboarding">
      <div className="topo">
        <button className="btn-icone" style={{ visibility: p === 1 ? 'hidden' : 'visible' }} onClick={() => nav(`/app/onboarding/${p - 1}`)} aria-label="Voltar">
          <Icon name="back" />
        </button>
        <div className="progresso" aria-label={`Passo ${p} de ${TOTAL}`}>
          {Array.from({ length: TOTAL }, (_, i) => (
            <span key={i}>
              <motion.i initial={false} animate={{ scaleX: i < p ? 1 : 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
            </span>
          ))}
        </div>
      </div>
      <motion.div key={p} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} style={{ display: 'flex', flexDirection: 'column' }}>
      <p className="passo-num">Passo {p} de {TOTAL}</p>

      {p === 1 && (
        <>
          <h1 className="titulo-tela">Vamos nos conhecer?</h1>
          <p className="sub-tela">Esses dados ficam só com você e servem para calcular suas metas.</p>
          <label className="rotulo" htmlFor="nome">Seu nome</label>
          <input id="nome" className="campo" placeholder="Como quer ser chamada(o)" value={d.nome} onChange={(e) => up('nome', e.target.value)} />
          <label className="rotulo" htmlFor="nasc">Data de nascimento</label>
          <input id="nasc" className="campo" type="date" value={d.nascimento} onChange={(e) => up('nascimento', e.target.value)} />
          {d.nascimento && idade < 18 && <p className="erro-campo">O Canetolino é para maiores de 18 anos.</p>}
          <div className="duas-col">
            <div>
              <label className="rotulo" htmlFor="alt">Altura (cm)</label>
              <input id="alt" className="campo" inputMode="numeric" placeholder="166" value={d.altura} onChange={(e) => up('altura', e.target.value.replace(/\D/g, ''))} />
            </div>
            <div>
              <label className="rotulo" htmlFor="peso">Peso de hoje (kg)</label>
              <input id="peso" className="campo" inputMode="decimal" placeholder="88,5" value={d.peso} onChange={(e) => up('peso', e.target.value.replace(/[^\d,.]/g, ''))} />
            </div>
          </div>
        </>
      )}

      {p === 2 && (
        <>
          <h1 className="titulo-tela">Em que momento da sua jornada você está?</h1>
          <p className="sub-tela">Assim o Dose começa a sua história do ponto certo.</p>
          <div className="jornada-escolha" role="radiogroup">
            <button role="radio" aria-checked={d.jornada === 'comecando'} className={d.jornada === 'comecando' ? 'is-on' : ''} onClick={() => up('jornada', 'comecando')}>
              <b>Vou começar</b>
              <span>Ainda não fiz a primeira aplicação, ou ela é hoje.</span>
            </button>
            <button role="radio" aria-checked={d.jornada === 'em_tratamento'} className={d.jornada === 'em_tratamento' ? 'is-on' : ''} onClick={() => up('jornada', 'em_tratamento')}>
              <b>Já estou em tratamento</b>
              <span>Já uso a caneta há algum tempo e quero trazer meu histórico.</span>
            </button>
          </div>
          {d.jornada === 'em_tratamento' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column' }}>
              <label className="rotulo" htmlFor="ini">Quando você começou?</label>
              <input id="ini" className="campo" type="date" max={hojeStr} value={d.inicio} onChange={(e) => up('inicio', e.target.value)} />
              <div className="duas-col">
                <div>
                  <label className="rotulo" htmlFor="dat">Dose atual</label>
                  <CampoDose id="dat" rotulo="Dose atual" value={d.dose_atual} onChange={(x) => up('dose_atual', x)} />
                </div>
                <div>
                  <label className="rotulo" htmlFor="pan">Peso antes de começar (kg)</label>
                  <input id="pan" className="campo" inputMode="decimal" placeholder="Ex.: 98,2" value={d.peso_antes} onChange={(e) => up('peso_antes', e.target.value.replace(/[^\d,.]/g, ''))} />
                </div>
              </div>
              <label className="rotulo" htmlFor="ult">Data da última aplicação</label>
              <input id="ult" className="campo" type="date" min={d.inicio || undefined} max={hojeStr} value={d.ultima} onChange={(e) => up('ultima', e.target.value)} />
              {d.ultima && d.inicio && d.ultima < d.inicio && <p className="erro-campo">A última aplicação não pode ser antes do início.</p>}
              {d.ultima && (
                <>
                  <span className="rotulo">Local da última aplicação (se lembrar)</span>
                  <div className="grade-locais" role="radiogroup">
                    {LOCAIS.map((l) => (
                      <button key={l} role="radio" aria-checked={d.local_ultima === l} className={`chip chip--quadrado chip--turquesa ${d.local_ultima === l ? 'is-on' : ''}`} onClick={() => up('local_ultima', d.local_ultima === l ? '' : l)}>
                        {l}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="dica-dose" style={{ marginTop: 18 }}>
                <Mascot expressao="piscando" size={44} flutuar={false} />
                <p>Depois do cadastro, você pode trazer as outras doses do bloco de notas ou do caderno, na tela Jornada.</p>
              </div>
            </motion.div>
          )}
        </>
      )}

      {p === 3 && (
        <>
          <h1 className="titulo-tela">Qual medicamento você usa?</h1>
          <p className="sub-tela">Use os dados da sua receita. Eles servem só para organizar seus lembretes.</p>
          <span className="rotulo">Princípio ativo</span>
          <div className="chips" role="radiogroup">
            {PRINCIPIOS.map((x) => (
              <button key={x} role="radio" aria-checked={d.principio === x} className={`chip ${d.principio === x ? 'is-on' : ''}`} onClick={() => up('principio', x)}>
                {x}
              </button>
            ))}
          </div>
          <label className="rotulo" htmlFor="nc">Nome comercial</label>
          <input id="nc" className="campo" placeholder="Como está escrito na caixa" value={d.nome_comercial} onChange={(e) => up('nome_comercial', e.target.value)} />
          <span className="rotulo">Dia da aplicação</span>
          <div className="chips chips--dias" role="radiogroup">
            {DIAS_CURTOS.map((x, i) => (
              <button key={x} role="radio" aria-checked={d.dia === i} className={`chip chip--quadrado ${d.dia === i ? 'is-on' : ''}`} onClick={() => up('dia', i)}>
                {x}
              </button>
            ))}
          </div>
          <div className="duas-col">
            <div>
              <label className="rotulo" htmlFor="hr">Horário</label>
              <input id="hr" className="campo" type="time" value={d.horario} onChange={(e) => up('horario', e.target.value)} />
            </div>
            <div>
              <label className="rotulo" htmlFor="dose">Dose prescrita</label>
              <CampoDose id="dose" rotulo="Dose prescrita" value={d.dose || d.dose_atual} onChange={(x) => up('dose', x)} />
            </div>
          </div>
          <div className="aviso" style={{ marginTop: 18 }}>
            <Icon name="info" size={20} />
            <span>O Canetolino registra a dose da sua receita, mas nunca sugere ou muda doses. Isso é sempre com seu médico.</span>
          </div>
        </>
      )}

      {p === 4 && (
        <>
          <h1 className="titulo-tela">Quais são seus objetivos?</h1>
          <p className="sub-tela">Metas combinadas com seu profissional. Dá para mudar depois.</p>
          <span className="rotulo">O que é importante pra você</span>
          <div className="chips">
            {['Perder peso com saúde', 'Manter massa muscular', 'Beber mais água', 'Criar rotina de treino', 'Lembrar das aplicações'].map((x) => (
              <button key={x} className={`chip chip--turquesa ${d.objetivos.includes(x) ? 'is-on' : ''}`} onClick={() => alterna('objetivos', x)}>
                {x}
              </button>
            ))}
          </div>
          <label className="rotulo" htmlFor="mp">Meta de peso (kg, opcional)</label>
          <input id="mp" className="campo" inputMode="decimal" placeholder="Ex.: 72" value={d.meta_peso} onChange={(e) => up('meta_peso', e.target.value.replace(/[^\d,.]/g, ''))} />
          <div className="duas-col">
            <div>
              <label className="rotulo" htmlFor="mprot">Proteína por dia (g)</label>
              <input id="mprot" className="campo" inputMode="numeric" value={d.meta_proteina} onChange={(e) => up('meta_proteina', e.target.value.replace(/\D/g, ''))} />
            </div>
            <div>
              <label className="rotulo" htmlFor="magua">Água por dia (L)</label>
              <input id="magua" className="campo" inputMode="decimal" value={d.meta_agua} onChange={(e) => up('meta_agua', e.target.value.replace(/[^\d,.]/g, ''))} />
            </div>
          </div>
          <div className="dica-dose" style={{ marginTop: 18 }}>
            <Mascot expressao="piscando" size={44} flutuar={false} />
            <p>Não sabe a meta de proteína? Pergunte ao seu nutricionista. Até lá, deixo 100 g como ponto de partida.</p>
          </div>
        </>
      )}

      {p === 5 && (
        <>
          <h1 className="titulo-tela">Como você gosta de comer?</h1>
          <p className="sub-tela">Assim o Dose dá dicas que combinam com você.</p>
          <span className="rotulo">Preferências e restrições</span>
          <div className="chips">
            {['Vegetariana(o)', 'Vegana(o)', 'Sem lactose', 'Sem glúten', 'Gosto de comida caseira', 'Como fora com frequência', 'Prefiro lanches práticos', 'Não como carne vermelha'].map((x) => (
              <button key={x} className={`chip ${d.preferencias.includes(x) ? 'is-on' : ''}`} onClick={() => alterna('preferencias', x)}>
                {x}
              </button>
            ))}
          </div>
        </>
      )}

      {p === 6 && (
        <>
          <h1 className="titulo-tela">Lembretes no seu tempo</h1>
          <p className="sub-tela">Notificações discretas: sem nome de remédio, peso ou sintoma na tela bloqueada.</p>
          <div className="card lista-config" style={{ marginTop: 18 }}>
            <div className="linha-config">
              <div>
                <b>Notificações discretas</b>
                <span>“Hora do seu momento Canetolino 💜”</span>
              </div>
              <Interruptor ligado={d.discretas} onChange={(v) => up('discretas', v)} rotulo="Notificações discretas" />
            </div>
            <div className="linha-config">
              <div>
                <b>Lembretes de água</b>
                <span>3 vezes ao dia</span>
              </div>
              <Interruptor ligado={d.lembreteAgua} onChange={(v) => up('lembreteAgua', v)} rotulo="Lembretes de água" />
            </div>
          </div>
          <div className="aviso" style={{ marginTop: 16 }}>
            <span>Você pode mudar isso quando quiser em Perfil → Privacidade.</span>
          </div>
        </>
      )}

      </motion.div>
      <div className="rodape-acao">
        {p < TOTAL ? (
          <button className="btn btn--primario btn--bloco" disabled={!valido} onClick={() => nav(`/app/onboarding/${p + 1}`)}>
            Continuar
          </button>
        ) : (
          <button className="btn btn--turquesa btn--bloco" disabled={!valido} onClick={concluir}>
            Começar minha jornada
          </button>
        )}
      </div>
    </div>
  )
}
