import { motion } from 'framer-motion'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import Mascot from '../components/Mascot'
import { Interruptor, Logo, soltarConfete, useToast } from '../components/ui'
import { PRINCIPIOS, useStore } from '../data/store'
import { DIAS_CURTOS, uid } from '../lib/datas'

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
}
const sobe = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } } }

/* ======================= 1. Boas-vindas ======================= */
export function Boasvindas() {
  const { s } = useStore()
  if (s.sessao && s.onboardingFeito) return <Navigate to="/app/home" replace />
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
          <Link to="/app/onboarding/1" className="btn btn--turquesa btn--bloco">
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
  const { entrarDemo } = useStore()
  const nav = useNavigate()
  const toast = useToast()
  const [email, setEmail] = useState('jessica@exemplo.com')
  const [senha, setSenha] = useState('demo1234')
  const [carregando, setCarregando] = useState(false)
  return (
    <div className="tela">
      <div className="topo">
        <button className="btn-icone" onClick={() => nav(-1)} aria-label="Voltar">
          <Icon name="back" />
        </button>
      </div>
      <motion.div variants={stagger} initial="hidden" animate="show">
        <motion.div variants={sobe} style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 4px' }}>
          <Mascot expressao="feliz" size={96} />
        </motion.div>
        <motion.h1 variants={sobe} className="titulo-tela" style={{ textAlign: 'center' }}>
          Que bom te ver de novo!
        </motion.h1>
        <motion.form
          variants={sobe}
          onSubmit={(e) => {
            e.preventDefault()
            setCarregando(true)
            setTimeout(() => {
              entrarDemo()
              toast('Bem-vinda de volta, Jessica!')
              nav('/app/home')
            }, 700)
          }}
        >
          <label className="rotulo" htmlFor="email">E-mail</label>
          <input id="email" className="campo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <label className="rotulo" htmlFor="senha">Senha</label>
          <input id="senha" className="campo" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" />
          <p className="legenda" style={{ marginTop: 8 }}>Protótipo: qualquer e-mail entra na conta de demonstração.</p>
          <button className="btn btn--primario btn--bloco" style={{ marginTop: 22 }} disabled={carregando || !email || !senha}>
            {carregando ? 'Entrando…' : 'Entrar'}
          </button>
          <button type="button" className="btn btn--contorno btn--bloco" style={{ marginTop: 10 }} onClick={() => toast('Link de recuperação enviado (simulação)', 'info')}>
            Esqueci minha senha
          </button>
        </motion.form>
      </motion.div>
    </div>
  )
}

/* ======================= Onboarding (5 passos) ======================= */
const TOTAL = 5

export function Onboarding() {
  const { passo = '1' } = useParams()
  const p = Math.min(TOTAL, Math.max(1, Number(passo) || 1))
  const nav = useNavigate()
  const { s, set } = useStore()
  const toast = useToast()

  // rascunho local, gravado ao concluir
  const [d, setD] = useState(() => ({
    nome: s.perfil.nome,
    nascimento: s.perfil.nascimento,
    altura: s.perfil.altura_cm ? String(s.perfil.altura_cm) : '',
    peso: s.perfil.peso_inicial_kg ? String(s.perfil.peso_inicial_kg) : '',
    principio: s.medicamento?.principio ?? '',
    nome_comercial: s.medicamento?.nome_comercial ?? '',
    dia: s.medicamento?.dia_semana ?? -1,
    horario: s.medicamento?.horario ?? '08:00',
    dose: s.medicamento?.dose_texto ?? '',
    meta_peso: s.perfil.meta_peso_kg ? String(s.perfil.meta_peso_kg) : '',
    meta_proteina: String(s.perfil.meta_proteina_g || 100),
    meta_agua: String((s.perfil.meta_agua_ml || 2000) / 1000),
    objetivos: [] as string[],
    preferencias: s.perfil.preferencias,
    discretas: true,
    lembreteAgua: true,
    termos: false,
  }))
  const up = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((x) => ({ ...x, [k]: v }))
  const alterna = (k: 'objetivos' | 'preferencias', v: string) => up(k, d[k].includes(v) ? d[k].filter((x) => x !== v) : [...d[k], v])

  const idade = d.nascimento ? Math.floor((Date.now() - new Date(d.nascimento).getTime()) / (365.25 * 86400000)) : 0
  const valido = [
    d.nome.trim().length > 1 && idade >= 18 && Number(d.altura) > 100 && Number(d.peso.replace(',', '.')) > 30,
    !!d.principio && d.dia >= 0,
    Number(d.meta_proteina) > 0 && Number(d.meta_agua.replace(',', '.')) > 0,
    true,
    d.termos,
  ][p - 1]

  const concluir = (e: React.MouseEvent) => {
    set((x) => ({
      ...x,
      sessao: true,
      onboardingFeito: true,
      perfil: {
        ...x.perfil,
        nome: d.nome.trim().split(' ')[0],
        nascimento: d.nascimento,
        altura_cm: Number(d.altura),
        peso_inicial_kg: Number(d.peso.replace(',', '.')),
        meta_peso_kg: Number(d.meta_peso.replace(',', '.')) || 0,
        meta_proteina_g: Number(d.meta_proteina),
        meta_agua_ml: Math.round(Number(d.meta_agua.replace(',', '.')) * 1000),
        preferencias: d.preferencias,
      },
      medicamento: { principio: d.principio, nome_comercial: d.nome_comercial, dia_semana: d.dia, horario: d.horario, dose_texto: d.dose || 'conforme sua prescrição' },
      pesos: [{ id: uid(), kg: Number(d.peso.replace(',', '.')), em: new Date().toISOString() }],
      config: { ...x.config, notificacoesDiscretas: d.discretas, lembretesAgua: d.lembreteAgua, lembreteHora: d.horario },
      consentimentos: [
        { id: uid(), tipo: 'termos', versao: 'termos-v1.0', em: new Date().toISOString() },
        { id: uid(), tipo: 'ia', versao: 'ia-v1.0', em: new Date().toISOString() },
      ],
    }))
    soltarConfete({ x: e.clientX, y: e.clientY })
    toast(`Tudo pronto, ${d.nome.trim().split(' ')[0]}!`)
    nav('/app/home')
  }

  return (
    <div className="tela onboarding">
      <div className="topo">
        <button className="btn-icone" onClick={() => (p === 1 ? nav('/app/boas-vindas') : nav(`/app/onboarding/${p - 1}`))} aria-label="Voltar">
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
              <label className="rotulo" htmlFor="peso">Peso atual (kg)</label>
              <input id="peso" className="campo" inputMode="decimal" placeholder="88,5" value={d.peso} onChange={(e) => up('peso', e.target.value.replace(/[^\d,.]/g, ''))} />
            </div>
          </div>
        </>
      )}

      {p === 2 && (
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
              <input id="dose" className="campo" placeholder="Conforme a receita" value={d.dose} onChange={(e) => up('dose', e.target.value)} />
            </div>
          </div>
          <div className="aviso" style={{ marginTop: 18 }}>
            <Icon name="info" size={20} />
            <span>O Canetolino registra a dose da sua receita, mas nunca sugere ou muda doses. Isso é sempre com seu médico.</span>
          </div>
        </>
      )}

      {p === 3 && (
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

      {p === 4 && (
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

      {p === 5 && (
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
          <label className="check" style={{ marginTop: 18 }}>
            <input type="checkbox" checked={d.termos} onChange={(e) => up('termos', e.target.checked)} />
            <span className="legenda" style={{ fontSize: 14 }}>
              Li e aceito os termos de uso e a política de privacidade. Consinto o uso dos meus dados de saúde para as funções do app (LGPD).
            </span>
          </label>
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
