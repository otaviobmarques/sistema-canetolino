import { motion } from 'framer-motion'
import Mascot from '../components/Mascot'
import Icon from '../components/Icon'

/** Telas em miniatura, animadas, para o celular da landing. Não leem dados reais. */

const surge = (d = 0) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay: d, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } })

export function MiniInicio() {
  return (
    <div className="mini">
      <div className="mini__topo">
        <div>
          <small>Sexta, 6 de novembro</small>
          <b className="mini__h">Oi, Jessica!</b>
        </div>
        <Mascot expressao="feliz" size={34} />
      </div>
      <motion.div className="mini__destaque" {...surge(0.1)}>
        <small>PRÓXIMA APLICAÇÃO</small>
        <b>Domingo, 8 de nov · 8h</b>
        <span className="mini__btn">Ver minha jornada</span>
      </motion.div>
      <div className="mini__g2">
        <motion.div className="mini__card" {...surge(0.2)}>
          <small>Proteína</small>
          <svg viewBox="0 0 60 60" width="64" style={{ margin: '4px auto 0', transform: 'rotate(-90deg)' }}>
            <circle cx="30" cy="30" r="24" stroke="#ece6fa" strokeWidth="7" fill="none" />
            <motion.circle cx="30" cy="30" r="24" stroke="#6C3FC4" strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray="150.8" initial={{ strokeDashoffset: 150.8 }} animate={{ strokeDashoffset: 150.8 * 0.32 }} transition={{ duration: 1.3, delay: 0.3 }} />
          </svg>
          <b className="mini__centro">68 g</b>
        </motion.div>
        <motion.div className="mini__card" {...surge(0.3)}>
          <small>Água</small>
          <b className="mini__grande">1,2 L</b>
          <div className="mini__barra"><motion.i initial={{ width: 0 }} animate={{ width: '60%' }} transition={{ duration: 1, delay: 0.5 }} /></div>
          <span className="mini__chip">+ 1 copo</span>
        </motion.div>
      </div>
      <motion.div className="mini__lilas" {...surge(0.4)}>
        <small style={{ color: '#6C3FC4', fontWeight: 700 }}>Dica do Dose</small>
        <p>Faltam 32 g de proteína pra sua meta. Que tal um iogurte no lanche?</p>
      </motion.div>
    </div>
  )
}

export function MiniFoto() {
  const itens = [
    ['Peito de frango grelhado', '38 g'],
    ['Feijão carioca', '4 g'],
    ['Arroz branco', '2 g'],
    ['Salada de folhas', '1 g'],
  ]
  return (
    <div className="mini">
      <b className="mini__h">Almoço · 12:40</b>
      <div className="mini__foto">
        <span className="mini__selo">Estimativa da IA</span>
        <svg viewBox="0 0 220 150" width="150">
          <ellipse cx="110" cy="78" rx="98" ry="64" fill="#fff" />
          <ellipse cx="80" cy="60" rx="27" ry="17" fill="#f3ecdc" />
          <path d="M118 48 q28 -10 40 10 q4 18 -18 22 q-26 2 -22 -32z" fill="#dba26a" />
          <ellipse cx="84" cy="96" rx="25" ry="15" fill="#5b3a2c" />
          <circle cx="128" cy="100" r="11" fill="#6fbf6a" />
          <circle cx="146" cy="96" r="12" fill="#4fa84f" />
          <circle cx="158" cy="86" r="6" fill="#e5584a" />
        </svg>
        <motion.span className="mini__scan" animate={{ top: ['10%', '85%', '10%'] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />
      </div>
      <div className="mini__dica">
        <Mascot expressao="pensativo" size={22} flutuar={false} />
        Encontrei 4 itens. Confira as porções.
      </div>
      {itens.map(([n, p], i) => (
        <motion.div key={n} className="mini__item" {...surge(0.5 + i * 0.25)}>
          <span>{n}</span>
          <b>{p} prot.</b>
          <i>×</i>
        </motion.div>
      ))}
      <motion.div className="mini__total" {...surge(1.6)}>
        <span>Total</span>
        <b>45 g de proteína</b>
      </motion.div>
    </div>
  )
}

export function MiniJornada() {
  const locais = ['Abdômen esq.', 'Abdômen dir.', 'Coxa esq.', 'Coxa dir.', 'Braço esq.', 'Braço dir.']
  return (
    <div className="mini">
      <b className="mini__h">Minha jornada</b>
      <div className="mini__card" style={{ padding: 10 }}>
        <b style={{ fontSize: 11.5, color: '#3B1A6E' }}>Próxima: domingo, 8 de nov</b>
        <p style={{ fontSize: 10, color: '#5E5873', margin: '4px 0 8px' }}>Sugestão do Dose para o rodízio: coxa esquerda.</p>
        <div className="mini__g3">
          {locais.map((l, i) => (
            <motion.span key={l} className={`mini__loc ${i === 2 ? 'is-on' : ''}`} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 + i * 0.06 }}>
              {l}
            </motion.span>
          ))}
        </div>
        <motion.span className="mini__btn mini__btn--roxo" animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 1.6, repeat: Infinity, delay: 1 }}>
          Registrar aplicação
        </motion.span>
      </div>
      <small style={{ fontWeight: 800, color: '#3B1A6E', fontSize: 11.5 }}>Últimas aplicações</small>
      <div className="mini__card" style={{ padding: '4px 10px' }}>
        {[['Dom, 1 de nov', 'Abdômen direito'], ['Dom, 25 de out', 'Abdômen esquerdo'], ['Dom, 18 de out', 'Coxa direita']].map(([d, l], i) => (
          <motion.div key={d} className="mini__linha" {...surge(0.6 + i * 0.12)}>
            <span>{d}</span>
            <span style={{ color: '#5E5873' }}>{l}</span>
          </motion.div>
        ))}
      </div>
      <div className="mini__g2">
        <div className="mini__card"><small>Minhas canetas</small><b className="mini__grande" style={{ fontSize: 15 }}>2 em casa</b></div>
        <div className="mini__card"><small>Validade</small><b className="mini__grande" style={{ fontSize: 15 }}>mar/2027</b></div>
      </div>
    </div>
  )
}

export function MiniRadar() {
  const pts = [88.5, 87.6, 86.9, 86, 85.2, 84.5, 83.6, 82.4]
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${8 + i * 26} ${10 + (88.5 - v) * 12}`).join(' ')
  return (
    <div className="mini">
      <b className="mini__h">Radar da semana</b>
      <motion.div className="mini__destaque" style={{ display: 'flex', gap: 8 }} {...surge(0.1)}>
        <Mascot expressao="feliz" size={28} flutuar={false} />
        <p style={{ fontSize: 10.5, lineHeight: 1.45, color: '#fff' }}>Semana boa! Você bateu a meta de proteína em 5 dias e treinou força 2 vezes.</p>
      </motion.div>
      <div className="mini__card">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <b style={{ color: '#3B1A6E' }}>Peso · 8 semanas</b>
          <b style={{ color: '#1E7A5F' }}>−6,1 kg</b>
        </div>
        <svg viewBox="0 0 200 90" width="100%">
          <motion.path d={d} stroke="#6C3FC4" strokeWidth="3" fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: 'easeOut' }} />
          <motion.circle cx={8 + 7 * 26} cy={10 + (88.5 - 82.4) * 12} r="4.5" fill="#3B1A6E" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.5 }} />
        </svg>
      </div>
      <div className="mini__g2">
        {[['Proteína média', '94 g/dia'], ['Água na meta', '4 de 7'], ['Treino de força', '2 sessões'], ['Sintomas', '1 dia, leve']].map(([a, b], i) => (
          <motion.div key={a} className="mini__card" {...surge(0.3 + i * 0.1)}>
            <small>{a}</small>
            <b className="mini__grande" style={{ fontSize: 13.5 }}>{b}</b>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export function MiniCompartilhar() {
  const mods = ['Peso e medidas', 'Alimentação e proteína', 'Aplicações', 'Sintomas', 'Bem-estar e sono']
  return (
    <div className="mini">
      <b className="mini__h">Compartilhar dados</b>
      <div className="mini__card" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="mini__av">AS</span>
        <div style={{ fontSize: 10.5 }}>
          <b style={{ color: '#1E0F3D' }}>Dra. Ana Souza</b>
          <div style={{ color: '#5E5873' }}>Nutricionista · verificada</div>
        </div>
      </div>
      <small style={{ fontWeight: 800, color: '#3B1A6E', fontSize: 11.5 }}>O que ela poderá ver</small>
      {mods.map((m, i) => (
        <div key={m} className="mini__check">
          <motion.span initial={{ background: '#fff', borderColor: '#b9add6' }} animate={i < 2 ? { background: '#6C3FC4', borderColor: '#6C3FC4' } : {}} transition={{ delay: 0.5 + i * 0.4 }}>
            {i < 2 && <Icon name="check" size={10} strokeWidth={4} />}
          </motion.span>
          {m}
        </div>
      ))}
      <div className="mini__g3" style={{ marginTop: 4 }}>
        {['30 dias', '90 dias', 'Até revogar'].map((p, i) => (
          <span key={p} className={`mini__loc ${i === 1 ? 'is-roxo' : ''}`}>{p}</span>
        ))}
      </div>
      <motion.span className="mini__btn mini__btn--roxo" {...surge(1.4)}>
        Autorizar acesso
      </motion.span>
    </div>
  )
}
