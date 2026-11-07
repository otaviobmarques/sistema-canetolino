import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Mascot from '../components/Mascot'
import { Logo } from '../components/ui'
import { erroPt, sb, urlRetorno } from '../lib/supabase'

type Area = 'pro' | 'clinic' | 'admin'
export type EstadoSessao = 'carregando' | 'fora' | 'segundo-fator' | 'pronto'

/** Sessão do painel: só fica "pronto" com o segundo fator verificado (aal2). */
export function usePainel(area: Area) {
  const c = sb(area)
  const [estado, setEstado] = useState<EstadoSessao>('carregando')
  const [sessao, setSessao] = useState<Session | null>(null)

  const avaliar = useCallback(async () => {
    const { data } = await c.auth.getSession()
    setSessao(data.session)
    if (!data.session) return setEstado('fora')
    const { data: aal } = await c.auth.mfa.getAuthenticatorAssuranceLevel()
    setEstado(aal?.currentLevel === 'aal2' ? 'pronto' : 'segundo-fator')
  }, [c])

  useEffect(() => {
    avaliar()
    const { data } = c.auth.onAuthStateChange((ev) => {
      if (ev === 'SIGNED_OUT') {
        setSessao(null)
        setEstado('fora')
      }
      if (ev === 'MFA_CHALLENGE_VERIFIED' || ev === 'SIGNED_IN') setTimeout(avaliar, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [c, avaliar])

  const sair = useCallback(async () => {
    await c.auth.signOut()
  }, [c])

  return { c, estado, sessao, avaliar, sair }
}

type CampoCadastro = { id: string; rotulo: string; tipo?: string; placeholder?: string; opcoes?: string[]; obrigatorio?: boolean }

/** Login, cadastro e segundo fator (TOTP) dos painéis web. */
export function AuthPainel({
  area,
  c,
  estado,
  descricao,
  camposCadastro,
  metaCadastro,
  tituloCadastro,
  onPronto,
  extraCadastro,
  usuarioSemEmail,
}: {
  area: Area
  c: SupabaseClient
  estado: EstadoSessao
  descricao: string
  camposCadastro: CampoCadastro[]
  metaCadastro: (v: Record<string, string>) => Record<string, string>
  tituloCadastro: string
  onPronto: () => void
  extraCadastro?: ReactNode
  /** login por nome de usuário (ex.: "Admin"), que vira usuario@dominio; sem cadastro */
  usuarioSemEmail?: { dominio: string }
}) {
  const [aba, setAba] = useState<'entrar' | 'cadastro' | 'confirmar'>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const sufixo = area === 'pro' ? 'Pro' : area === 'clinic' ? 'Clinic' : 'Admin'
  const emailReal = () => (usuarioSemEmail && !email.includes('@') ? `${email.trim().toLowerCase()}@${usuarioSemEmail.dominio}` : email.trim())

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault()
    setOcupado(true)
    setErro('')
    try {
      const { error } = await c.auth.signInWithPassword({ email: emailReal(), password: senha })
      if (error) throw error
      onPronto()
    } catch (er) {
      setErro(erroPt(er))
    } finally {
      setOcupado(false)
    }
  }

  const cadastrar = async (e: React.FormEvent) => {
    e.preventDefault()
    setOcupado(true)
    setErro('')
    try {
      const { data, error } = await c.auth.signUp({ email: email.trim(), password: senha, options: { data: metaCadastro(campos), emailRedirectTo: urlRetorno(area) } })
      if (error) throw error
      if (data.session) onPronto()
      else setAba('confirmar')
    } catch (er) {
      setErro(erroPt(er))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="p-login">
      <div className="p-login__arte">
        <div className="p-login__bolha" />
        <Mascot expressao={estado === 'segundo-fator' ? 'piscando' : erro ? 'alerta' : 'acenando'} size={200} seguirCursor />
        <Logo claro sufixo={sufixo} tamanho={34} />
        <p>{descricao}</p>
        <Link to="/" className="p-login__site">← Voltar ao site</Link>
      </div>
      <div className="p-login__form">
        {estado === 'carregando' ? (
          <Mascot expressao="pensativo" size={90} />
        ) : estado === 'segundo-fator' ? (
          <SegundoFator c={c} onPronto={onPronto} />
        ) : (
          <AnimatePresence mode="wait">
            {aba === 'confirmar' ? (
              <motion.div key="c" className="p-login__caixa" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <h2>Confira seu e-mail</h2>
                <p className="legenda">Enviamos um link de confirmação para <b>{email}</b>. Depois de confirmar, entre com sua senha e ative a verificação em duas etapas.</p>
                <button className="btn btn--primario btn--bloco" style={{ marginTop: 20 }} onClick={() => setAba('entrar')}>Já confirmei, entrar</button>
              </motion.div>
            ) : (
              <motion.form key={aba} className="p-login__caixa" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={aba === 'entrar' ? entrar : cadastrar}>
                {usuarioSemEmail ? <h2>Entrar</h2> : <div className="p-abas" role="tablist">
                  <button type="button" role="tab" aria-selected={aba === 'entrar'} className={aba === 'entrar' ? 'is-on' : ''} onClick={() => setAba('entrar')}>Entrar</button>
                  <button type="button" role="tab" aria-selected={aba === 'cadastro'} className={aba === 'cadastro' ? 'is-on' : ''} onClick={() => setAba('cadastro')}>{tituloCadastro}</button>
                </div>}
                {aba === 'cadastro' && extraCadastro}
                {aba === 'cadastro' &&
                  camposCadastro.map((f) => (
                    <div key={f.id}>
                      <label className="rotulo" htmlFor={`f-${f.id}`}>{f.rotulo}</label>
                      {f.opcoes ? (
                        <select id={`f-${f.id}`} className="campo" value={campos[f.id] ?? ''} onChange={(e) => setCampos((x) => ({ ...x, [f.id]: e.target.value }))} required={f.obrigatorio !== false}>
                          <option value="" disabled>Escolha</option>
                          {f.opcoes.map((o) => <option key={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input id={`f-${f.id}`} className="campo" type={f.tipo ?? 'text'} placeholder={f.placeholder} value={campos[f.id] ?? ''} onChange={(e) => setCampos((x) => ({ ...x, [f.id]: e.target.value }))} required={f.obrigatorio !== false} />
                      )}
                    </div>
                  ))}
                <label className="rotulo" htmlFor="pe">{usuarioSemEmail ? 'Usuário' : 'E-mail'}</label>
                <input id="pe" className="campo" type={usuarioSemEmail ? 'text' : 'email'} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoCapitalize="none" required />
                <label className="rotulo" htmlFor="ps">Senha</label>
                <input id="ps" className="campo" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete={aba === 'entrar' ? 'current-password' : 'new-password'} required minLength={aba === 'cadastro' ? 8 : undefined} />
                {erro && <p className="erro-campo" role="alert">{erro}</p>}
                <button className="btn btn--primario btn--bloco" style={{ marginTop: 22 }} disabled={ocupado}>
                  {ocupado ? 'Aguarde…' : aba === 'entrar' ? 'Continuar' : 'Criar conta'}
                </button>
                {aba === 'entrar' && !usuarioSemEmail && (
                  <button
                    type="button"
                    className="btn btn--contorno btn--bloco"
                    style={{ marginTop: 10 }}
                    onClick={async () => {
                      if (!email.includes('@')) return setErro('Digite seu e-mail acima.')
                      const { error } = await c.auth.resetPasswordForEmail(email.trim(), { redirectTo: urlRetorno(area, 'recuperar') })
                      setErro(error ? erroPt(error) : 'Se o e-mail estiver cadastrado, você vai receber um link para criar nova senha.')
                    }}
                  >
                    Esqueci minha senha
                  </button>
                )}
              </motion.form>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

/** Verificação em duas etapas: cadastra o app autenticador na primeira vez, depois só pede o código. */
function SegundoFator({ c, onPronto }: { c: SupabaseClient; onPronto: () => void }) {
  const [fator, setFator] = useState<{ id: string; qr?: string; segredo?: string } | null>(null)
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const { data, error } = await c.auth.mfa.listFactors()
        if (error) throw error
        const ok = data.totp.find((f) => f.status === 'verified')
        if (ok) return vivo && setFator({ id: ok.id })
        for (const f of data.all.filter((x) => x.status !== 'verified')) await c.auth.mfa.unenroll({ factorId: f.id })
        const en = await c.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Canetolino ${new Date().toLocaleDateString('pt-BR')}` })
        if (en.error) throw en.error
        if (vivo) setFator({ id: en.data.id, qr: en.data.totp.qr_code, segredo: en.data.totp.secret })
      } catch (e) {
        if (vivo) setErro(erroPt(e))
      }
    })()
    return () => {
      vivo = false
    }
  }, [c])

  const verificar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fator) return
    setOcupado(true)
    setErro('')
    const { error } = await c.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo })
    setOcupado(false)
    if (error) return setErro(erroPt(error))
    onPronto()
  }

  return (
    <form className="p-login__caixa" onSubmit={verificar}>
      <h2>Verificação em duas etapas</h2>
      {fator?.qr ? (
        <>
          <p className="legenda">Os painéis exigem segundo fator. Escaneie o QR code com um app autenticador (Google Authenticator, Microsoft Authenticator, 1Password…) e digite o código de 6 dígitos.</p>
          <div className="p-qr">
            <img src={fator.qr} alt="QR code para o app autenticador" width={180} height={180} />
            <small>Ou digite a chave: <code>{fator.segredo}</code></small>
          </div>
        </>
      ) : (
        <p className="legenda">Digite o código de 6 dígitos do seu app autenticador.</p>
      )}
      <div className="p-otp">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={codigo.length === i ? 'is-ativo' : ''}>{codigo[i] ?? ''}</span>
        ))}
        <input className="p-otp__input" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} aria-label="Código de verificação" />
      </div>
      {erro && <p className="erro-campo" role="alert">{erro}</p>}
      <button className="btn btn--primario btn--bloco" style={{ marginTop: 22 }} disabled={codigo.length < 6 || ocupado || !fator}>{ocupado ? 'Verificando…' : 'Entrar no painel'}</button>
      <button type="button" className="btn btn--contorno btn--bloco" style={{ marginTop: 10 }} onClick={() => c.auth.signOut()}>Usar outra conta</button>
    </form>
  )
}
