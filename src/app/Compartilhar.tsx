import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import Mascot from '../components/Mascot'
import { soltarConfete, useToast } from '../components/ui'
import { MODULOS, useStore, type Modulo, type ProfissionalCodigo } from '../data/store'
import { DIA_MS, dataBR } from '../lib/datas'
import { erroPt, sb } from '../lib/supabase'

/* ======================= 10. Compartilhar com profissional ======================= */
export default function Compartilhar() {
  const nav = useNavigate()
  const { s, buscarCodigo, autorizar } = useStore()
  const toast = useToast()
  const [codigo, setCodigo] = useState('')
  const [prof, setProf] = useState<ProfissionalCodigo | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [mods, setMods] = useState<Modulo[]>(['peso', 'nutricao'])
  const [prazo, setPrazo] = useState<30 | 90 | 0>(90)
  const [senha, setSenha] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  // identifica o código assim que tem formato completo (ABC-1234)
  useEffect(() => {
    setProf(null)
    const cod = codigo.trim().toUpperCase()
    if (!/^[A-Z]{3}-\d{4}$/.test(cod)) return
    let vivo = true
    setBuscando(true)
    buscarCodigo(cod)
      .then((p) => vivo && setProf(p))
      .catch((e) => vivo && setErro(erroPt(e)))
      .finally(() => vivo && setBuscando(false))
    return () => {
      vivo = false
    }
  }, [codigo, buscarCodigo])

  const nomesMods = mods.map((m) => MODULOS.find((x) => x.id === m)!.nome.toLowerCase())
  const listaTxt = nomesMods.length > 1 ? nomesMods.slice(0, -1).join(', ') + ' e ' + nomesMods[nomesMods.length - 1] : nomesMods[0]
  const expira = prazo ? new Date(Date.now() + prazo * DIA_MS) : null
  const primeiroNome = prof ? prof.nome.split(' ').slice(0, 2).join(' ') : ''
  const limiteBasico = s.perfil.plano === 'basico' && s.compartilhamentos.some((c) => !c.revogado_em && (!c.expira_em || new Date(c.expira_em) > new Date()) && c.profissionalId !== prof?.id)

  const confirmar = async (e: React.MouseEvent) => {
    if (!prof) return
    setEnviando(true)
    setErro('')
    try {
      // nova autenticação antes de autorizar (seção 8)
      const { error } = await sb('app').auth.signInWithPassword({ email: s.perfil.email, password: senha })
      if (error) throw error
      await autorizar(codigo, mods, prazo)
      soltarConfete({ x: e.clientX, y: e.clientY })
      toast(`Acesso autorizado para ${prof.nome}`)
      nav('/app/perfil')
    } catch (er) {
      setErro(erroPt(er))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="tela">
      <div className="topo">
        <button className="btn-icone" onClick={() => nav(-1)} aria-label="Voltar">
          <Icon name="back" />
        </button>
        <h1 className="titulo-tela" style={{ fontSize: 26 }}>Compartilhar dados</h1>
      </div>
      <label className="rotulo" htmlFor="cod" style={{ marginTop: 4 }}>Código do profissional</label>
      <input id="cod" className="campo campo--codigo" value={codigo} maxLength={8} onChange={(e) => { setErro(''); setCodigo(e.target.value.toUpperCase()) }} placeholder="Ex.: ANA-4821" autoComplete="off" />
      <AnimatePresence mode="wait">
        {prof ? (
          <motion.div key={prof.id} className="card prof-id" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <span className="avatar avatar--lilas">{prof.iniciais}</span>
            <div>
              <b>{prof.nome}</b>
              <p className="legenda">
                {prof.profissao}
                {prof.registro && ` · ${prof.registro}`} ·{' '}
                {prof.verificado ? <span style={{ color: 'var(--sucesso)', fontWeight: 600 }}>verificado</span> : <span style={{ color: '#9a6a00', fontWeight: 600 }}>registro em verificação</span>}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.p key="nada" className="legenda" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: 8 }}>
            {buscando ? 'Procurando…' : /^[A-Z]{3}-\d{4}$/.test(codigo.trim()) ? 'Código não encontrado ou expirado. Confira com seu profissional.' : 'Peça o código de convite ao seu profissional ou à sua clínica.'}
          </motion.p>
        )}
      </AnimatePresence>

      <span className="rotulo">O que {prof?.pronome ?? 'ele(a)'} poderá ver</span>
      <div>
        {MODULOS.map((m) => (
          <label key={m.id} className="check">
            <input type="checkbox" checked={mods.includes(m.id)} onChange={() => setMods((l) => (l.includes(m.id) ? l.filter((x) => x !== m.id) : [...l, m.id]))} />
            {m.nome}
          </label>
        ))}
      </div>

      <span className="rotulo">Por quanto tempo</span>
      <div className="chips" style={{ flexWrap: 'nowrap' }}>
        {([30, 90, 0] as const).map((p) => (
          <button key={p} className={`chip chip--quadrado ${prazo === p ? 'is-on' : ''}`} onClick={() => setPrazo(p)} style={{ minHeight: 46 }}>
            {p ? `${p} dias` : 'Até eu revogar'}
          </button>
        ))}
      </div>

      {prof && mods.length > 0 && (
        <motion.div className="aviso" style={{ marginTop: 16 }} layout>
          <span>
            {primeiroNome} poderá ver {listaTxt}, {expira ? `até ${dataBR(expira)}` : 'até você revogar'}. Você pode revogar quando quiser no Perfil, e cada acesso fica registrado no seu histórico.
          </span>
        </motion.div>
      )}
      {prof && limiteBasico && (
        <div className="aviso" style={{ marginTop: 10, background: '#fff6e0' }}>
          <span>No plano Básico você compartilha com 1 profissional por vez. O acesso atual será mantido; para incluir mais, assine o Premium no Perfil.</span>
        </div>
      )}

      <AnimatePresence>
        {confirmando && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <div className="dica-dose" style={{ marginTop: 14 }}>
              <Mascot expressao="neutro" size={36} flutuar={false} />
              <p>Por segurança, confirme sua senha para autorizar.</p>
            </div>
            <input className="campo" type="password" style={{ marginTop: 10 }} placeholder="Sua senha" value={senha} onChange={(e) => setSenha(e.target.value)} aria-label="Senha" autoFocus autoComplete="current-password" />
          </motion.div>
        )}
      </AnimatePresence>
      {erro && <p className="erro-campo" role="alert">{erro}</p>}

      <div className="rodape-acao">
        {!confirmando ? (
          <button className="btn btn--primario btn--bloco" disabled={!prof || !mods.length || limiteBasico} onClick={() => setConfirmando(true)}>
            Autorizar acesso
          </button>
        ) : (
          <button className="btn btn--turquesa btn--bloco" disabled={senha.length < 6 || enviando} onClick={confirmar}>
            <Icon name="shield" size={20} /> {enviando ? 'Autorizando…' : 'Confirmar e autorizar'}
          </button>
        )}
      </div>
    </div>
  )
}
