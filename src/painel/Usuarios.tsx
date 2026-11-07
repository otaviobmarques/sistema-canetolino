import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import Icon from '../components/Icon'
import Mascot from '../components/Mascot'
import { Modal, useToast } from '../components/ui'
import { dataBR } from '../lib/datas'
import { erroPt } from '../lib/supabase'
import { Cabecalho } from './Layout'

/* Painel Admin · usuários: cadastrar com senha, trocar senha, bloquear e excluir.
   Mostra só dados de conta (nome, e-mail, tipo, datas), nunca dados de saúde. */

type Tipo = 'paciente' | 'profissional' | 'clinica' | 'admin'
type Usuario = { id: string; email: string; nome: string; tipo: Tipo; detalhe: string | null; criado_em: string; ultimo_acesso: string | null; email_confirmado: boolean; bloqueado: boolean; plano: string | null }

const TIPO_NOME: Record<Tipo, string> = { paciente: 'Paciente', profissional: 'Profissional', clinica: 'Clínica', admin: 'Administrador' }
const ERROS: Record<string, string> = {
  ja_existe: 'Já existe uma conta com este e-mail.',
  senha_curta: 'A senha precisa ter pelo menos 8 caracteres.',
  senha_fraca: 'Senha fraca ou já vazada em outros sites. Escolha outra.',
  email: 'Confira o e-mail.',
  nome: 'Informe o nome.',
  proprio: 'Você não pode bloquear ou excluir a própria conta.',
  ultimo_admin: 'Esta é a única conta de administrador. Crie outra antes de excluir.',
  assinatura: 'Não consegui cancelar a assinatura desta pessoa no gateway. Tente de novo.',
  sem_acesso: 'Sua sessão de administrador expirou. Entre de novo.',
}

async function acao(c: SupabaseClient, body: Record<string, unknown>) {
  const { data, error } = await c.functions.invoke('admin-usuarios', { body })
  if (error) {
    let codigo = ''
    if (error instanceof FunctionsHttpError) {
      try {
        codigo = (await error.context.json()).erro
      } catch {
        /* sem JSON */
      }
    }
    throw new Error(ERROS[codigo] ?? 'Não deu certo. Tente de novo.')
  }
  return data
}

const senhaAleatoria = () => {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const b = crypto.getRandomValues(new Uint8Array(12))
  return [...b].map((x) => letras[x % letras.length]).join('')
}

export default function Usuarios({ c }: { c: SupabaseClient }) {
  const toast = useToast()
  const [lista, setLista] = useState<Usuario[] | null>(null)
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState<Tipo | ''>('')
  const [novo, setNovo] = useState(false)
  const [senhaDe, setSenhaDe] = useState<Usuario | null>(null)
  const [excluir, setExcluir] = useState<Usuario | null>(null)
  const [ocupado, setOcupado] = useState('')

  const carregar = useCallback(async () => {
    const { data, error } = await c.rpc('admin_usuarios', { p_busca: busca.trim(), p_tipo: tipo })
    if (error) return toast(erroPt(error), 'info')
    setLista((data ?? []) as Usuario[])
  }, [c, busca, tipo, toast])

  useEffect(() => {
    const t = setTimeout(carregar, 250)
    return () => clearTimeout(t)
  }, [carregar])

  const bloquear = async (u: Usuario) => {
    setOcupado(u.id)
    try {
      await acao(c, { acao: 'bloquear', id: u.id, bloquear: !u.bloqueado })
      toast(u.bloqueado ? `${u.nome || u.email} desbloqueado(a)` : `${u.nome || u.email} bloqueado(a)`, u.bloqueado ? 'ok' : 'info')
      carregar()
    } catch (e) {
      toast((e as Error).message, 'info')
    }
    setOcupado('')
  }

  return (
    <>
      <Cabecalho titulo="Usuários" sub="Contas de pacientes, profissionais, clínicas e administradores">
        <button className="btn btn--turquesa btn--pequeno" onClick={() => setNovo(true)}><Icon name="plus" size={16} /> Novo usuário</button>
      </Cabecalho>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input className="campo" style={{ maxWidth: 320 }} placeholder="Buscar por nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
        <div className="p-periodo">
          {(['', 'paciente', 'profissional', 'clinica', 'admin'] as const).map((t) => (
            <button key={t || 'todos'} className={tipo === t ? 'is-on' : ''} onClick={() => setTipo(t)}>{t ? TIPO_NOME[t] : 'Todos'}</button>
          ))}
        </div>
      </div>

      {lista === null ? (
        <div className="skeleton" style={{ height: 180 }} />
      ) : lista.length === 0 ? (
        <div className="p-vazio"><Mascot expressao="pensativo" size={100} /><h2>Ninguém encontrado</h2></div>
      ) : (
        <div className="p-tabela-wrap">
          <table className="p-tabela">
            <thead><tr><th>Usuário</th><th>Tipo</th><th>Cadastro</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              <AnimatePresence initial={false}>
                {lista.map((u) => (
                  <motion.tr key={u.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: 30 }} style={{ cursor: 'default' }}>
                    <td><b>{u.nome || '—'}</b><div className="p-cinza" style={{ fontSize: 13 }}>{u.email}</div></td>
                    <td>{TIPO_NOME[u.tipo]}<div className="p-cinza" style={{ fontSize: 13 }}>{u.detalhe ?? (u.plano ? `plano ${u.plano === 'premium' ? 'Premium' : 'Básico'}` : '')}</div></td>
                    <td className="p-cinza">{dataBR(u.criado_em)}<div style={{ fontSize: 13 }}>último acesso: {u.ultimo_acesso ? dataBR(u.ultimo_acesso) : 'nunca'}</div></td>
                    <td>
                      {u.bloqueado ? <span className="selo selo--alerta">bloqueado</span>
                        : !u.email_confirmado ? <span className="selo selo--lilas">e-mail não confirmado</span>
                        : <span className="selo selo--sucesso">ativo</span>}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn--contorno btn--pequeno" onClick={() => setSenhaDe(u)}>Senha</button>{' '}
                      <button className="btn btn--contorno btn--pequeno" disabled={ocupado === u.id} onClick={() => bloquear(u)}>{u.bloqueado ? 'Desbloquear' : 'Bloquear'}</button>{' '}
                      <button className="btn btn--perigo btn--pequeno" onClick={() => setExcluir(u)}>Excluir</button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
      <p className="legenda" style={{ marginTop: 14 }}>Quem é bloqueado é desconectado na hora e não consegue mais entrar até ser desbloqueado. Os dados ficam guardados.</p>

      <NovoUsuario c={c} aberto={novo} onFechar={() => setNovo(false)} onCriado={carregar} />
      <TrocarSenha c={c} usuario={senhaDe} onFechar={() => setSenhaDe(null)} />
      <Excluir c={c} usuario={excluir} onFechar={() => setExcluir(null)} onExcluido={carregar} />
    </>
  )
}

function CampoSenha({ valor, onChange, id }: { valor: string; onChange: (v: string) => void; id: string }) {
  const toast = useToast()
  return (
    <div className="p-cred">
      <input id={id} className="campo" type="text" autoComplete="new-password" spellCheck={false} value={valor} onChange={(e) => onChange(e.target.value)} placeholder="mínimo 8 caracteres" />
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="btn btn--contorno btn--pequeno" onClick={() => onChange(senhaAleatoria())}>Gerar</button>
        <button type="button" className="btn btn--contorno btn--pequeno" disabled={!valor} aria-label="Copiar senha" onClick={() => navigator.clipboard?.writeText(valor).then(() => toast('Senha copiada', 'ok'))}><Icon name="copy" size={16} /></button>
      </div>
    </div>
  )
}

function NovoUsuario({ c, aberto, onFechar, onCriado }: { c: SupabaseClient; aberto: boolean; onFechar: () => void; onCriado: () => void }) {
  const toast = useToast()
  const vazio = { tipo: 'paciente' as Tipo, nome: '', email: '', senha: '', profissao: 'Nutricionista', registro: '', uf: '', clinica: '', cnpj: '' }
  const [v, setV] = useState(vazio)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const mudar = (k: keyof typeof vazio, x: string) => setV((a) => ({ ...a, [k]: x }))

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setOcupado(true)
    try {
      const r = await acao(c, { acao: 'criar', ...v })
      toast(`Conta criada: ${r.email}`, 'ok')
      setV(vazio)
      onFechar()
      onCriado()
    } catch (er) {
      setErro((er as Error).message)
    }
    setOcupado(false)
  }

  return (
    <Modal aberto={aberto} onFechar={onFechar} largura={520}>
      <form onSubmit={enviar}>
        <h3>Novo usuário</h3>
        <label className="rotulo" htmlFor="nu-tipo">Tipo de conta</label>
        <select id="nu-tipo" className="campo" value={v.tipo} onChange={(e) => mudar('tipo', e.target.value)}>
          {(Object.keys(TIPO_NOME) as Tipo[]).map((t) => <option key={t} value={t}>{TIPO_NOME[t]}</option>)}
        </select>
        <label className="rotulo" htmlFor="nu-nome">Nome</label>
        <input id="nu-nome" className="campo" value={v.nome} onChange={(e) => mudar('nome', e.target.value)} required />
        <label className="rotulo" htmlFor="nu-email">{v.tipo === 'admin' ? 'Usuário ou e-mail' : 'E-mail'}</label>
        <input id="nu-email" className="campo" type={v.tipo === 'admin' ? 'text' : 'email'} value={v.email} onChange={(e) => mudar('email', e.target.value)} required
          placeholder={v.tipo === 'admin' ? 'ex.: maria (entra como “maria”)' : ''} />
        {v.tipo === 'profissional' && (
          <div className="duas-col">
            <div>
              <label className="rotulo" htmlFor="nu-prof">Profissão</label>
              <select id="nu-prof" className="campo" value={v.profissao} onChange={(e) => mudar('profissao', e.target.value)}>
                {['Nutricionista', 'Médico(a)', 'Endocrinologista', 'Educador(a) físico(a)', 'Outro'].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="rotulo" htmlFor="nu-reg">Registro (CRN, CRM…) e UF</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input id="nu-reg" className="campo" value={v.registro} onChange={(e) => mudar('registro', e.target.value)} />
                <input className="campo" style={{ width: 64 }} maxLength={2} value={v.uf} onChange={(e) => mudar('uf', e.target.value.toUpperCase())} aria-label="UF" placeholder="UF" />
              </div>
            </div>
          </div>
        )}
        {v.tipo === 'clinica' && (
          <div className="duas-col">
            <div>
              <label className="rotulo" htmlFor="nu-cl">Nome da clínica</label>
              <input id="nu-cl" className="campo" value={v.clinica} onChange={(e) => mudar('clinica', e.target.value)} required />
            </div>
            <div>
              <label className="rotulo" htmlFor="nu-cnpj">CNPJ (opcional)</label>
              <input id="nu-cnpj" className="campo" value={v.cnpj} onChange={(e) => mudar('cnpj', e.target.value)} />
            </div>
          </div>
        )}
        <label className="rotulo" htmlFor="nu-senha">Senha</label>
        <CampoSenha id="nu-senha" valor={v.senha} onChange={(x) => mudar('senha', x)} />
        <p className="legenda">O e-mail já entra confirmado. Passe a senha para a pessoa por um canal seguro; ela pode trocar depois em “Esqueci minha senha”.</p>
        {erro && <p className="erro-campo">{erro}</p>}
        <button className="btn btn--primario btn--bloco" style={{ marginTop: 14 }} disabled={ocupado || v.senha.length < 8}>{ocupado ? 'Criando…' : 'Criar conta'}</button>
      </form>
    </Modal>
  )
}

function TrocarSenha({ c, usuario, onFechar }: { c: SupabaseClient; usuario: Usuario | null; onFechar: () => void }) {
  const toast = useToast()
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    setSenha('')
    setErro('')
  }, [usuario])
  const salvar = async () => {
    if (!usuario) return
    setOcupado(true)
    setErro('')
    try {
      await acao(c, { acao: 'senha', id: usuario.id, senha })
      toast('Senha trocada', 'ok')
      onFechar()
    } catch (e) {
      setErro((e as Error).message)
    }
    setOcupado(false)
  }
  return (
    <Modal aberto={!!usuario} onFechar={onFechar}>
      <h3>Nova senha</h3>
      <p className="legenda">{usuario?.nome} · {usuario?.email}</p>
      <label className="rotulo" htmlFor="ts-senha">Senha</label>
      <CampoSenha id="ts-senha" valor={senha} onChange={setSenha} />
      {erro && <p className="erro-campo">{erro}</p>}
      <button className="btn btn--primario btn--bloco" style={{ marginTop: 16 }} disabled={ocupado || senha.length < 8} onClick={salvar}>{ocupado ? 'Salvando…' : 'Salvar senha'}</button>
    </Modal>
  )
}

function Excluir({ c, usuario, onFechar, onExcluido }: { c: SupabaseClient; usuario: Usuario | null; onFechar: () => void; onExcluido: () => void }) {
  const toast = useToast()
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    setConfirma('')
    setErro('')
  }, [usuario])
  const ok = !!usuario && confirma.trim().toLowerCase() === usuario.email.toLowerCase()
  const excluir = async () => {
    if (!usuario) return
    setOcupado(true)
    try {
      await acao(c, { acao: 'excluir', id: usuario.id })
      toast('Conta excluída', 'info')
      onFechar()
      onExcluido()
    } catch (e) {
      setErro((e as Error).message)
    }
    setOcupado(false)
  }
  return (
    <Modal aberto={!!usuario} onFechar={onFechar}>
      <div style={{ display: 'flex', justifyContent: 'center' }}><Mascot expressao="alerta" size={80} /></div>
      <h3 style={{ textAlign: 'center' }}>Excluir a conta de {usuario?.nome || usuario?.email}?</h3>
      <p className="legenda" style={{ textAlign: 'center', fontSize: 14.5 }}>
        Apaga a conta e todos os dados dela, inclusive fotos. Assinaturas ativas são canceladas no gateway. Não dá para desfazer.
      </p>
      <label className="rotulo" htmlFor="ex-conf">Para confirmar, digite o e-mail: <b>{usuario?.email}</b></label>
      <input id="ex-conf" className="campo" autoComplete="off" value={confirma} onChange={(e) => setConfirma(e.target.value)} />
      {erro && <p className="erro-campo">{erro}</p>}
      <button className="btn btn--perigo-cheio btn--bloco" style={{ marginTop: 16 }} disabled={!ok || ocupado} onClick={excluir}>{ocupado ? 'Excluindo…' : 'Excluir definitivamente'}</button>
      <button className="btn btn--fantasma btn--bloco" style={{ marginTop: 8 }} onClick={onFechar}>Voltar</button>
    </Modal>
  )
}
