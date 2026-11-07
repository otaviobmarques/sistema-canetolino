// Canetolino · gestão de usuários pelo painel Admin
// Ações: criar (com senha), senha (trocar), bloquear (ou desbloquear) e excluir.
// Só aceita quem é administrador da plataforma (eh_admin na sessão de quem chama).
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const URL_SB = Deno.env.get('SUPABASE_URL')!
const db = createClient(URL_SB, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const TIPOS = ['paciente', 'profissional', 'clinica', 'admin'] as const
const DOMINIO_ADMIN = 'canetolino.com.br'
const texto = (v: unknown, max = 120) => String(v ?? '').trim().slice(0, max)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ erro: 'metodo' }, 405)
  const autorizacao = req.headers.get('Authorization') ?? ''
  try {
    const cliente = createClient(URL_SB, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false }, global: { headers: { Authorization: autorizacao } } })
    const [{ data: admin }, { data: eu }] = await Promise.all([cliente.rpc('eh_admin'), db.auth.getUser(autorizacao.replace(/^Bearer /, ''))])
    if (admin !== true || !eu?.user) return json({ erro: 'sem_acesso' }, 403)

    const b = await req.json().catch(() => ({}))
    const acao = b.acao as string
    const id = texto(b.id, 40)

    if (acao === 'criar') {
      const tipo = b.tipo as (typeof TIPOS)[number]
      if (!TIPOS.includes(tipo)) return json({ erro: 'tipo' }, 400)
      const nome = texto(b.nome)
      if (!nome) return json({ erro: 'nome' }, 400)
      let email = texto(b.email, 200).toLowerCase()
      if (tipo === 'admin' && email && !email.includes('@')) email = `${email}@${DOMINIO_ADMIN}` // login por nome de usuário
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ erro: 'email' }, 400)
      const senha = String(b.senha ?? '')
      if (senha.length < 8) return json({ erro: 'senha_curta' }, 400)
      const meta: Record<string, string> =
        tipo === 'profissional' ? { tipo, nome, profissao: texto(b.profissao) || 'Profissional', registro: texto(b.registro, 40), uf: texto(b.uf, 2) }
        : tipo === 'clinica' ? { tipo, nome, clinica: texto(b.clinica) || nome, cnpj: texto(b.cnpj, 20) }
        : tipo === 'admin' ? { tipo, nome }
        : { nome }
      const { data, error } = await db.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: meta })
      if (error) return json({ erro: /already|registered|exists/i.test(error.message) ? 'ja_existe' : /password/i.test(error.message) ? 'senha_fraca' : 'falha', detalhe: error.message }, 400)
      if (tipo === 'admin') {
        const { error: e2 } = await db.from('platform_admins').insert({ user_id: data.user.id, nome })
        if (e2) {
          await db.auth.admin.deleteUser(data.user.id)
          throw e2
        }
      }
      return json({ ok: true, id: data.user.id, email })
    }

    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ erro: 'usuario' }, 400)

    if (acao === 'senha') {
      const senha = String(b.senha ?? '')
      if (senha.length < 8) return json({ erro: 'senha_curta' }, 400)
      const { error } = await db.auth.admin.updateUserById(id, { password: senha })
      if (error) return json({ erro: /password/i.test(error.message) ? 'senha_fraca' : 'falha', detalhe: error.message }, 400)
      return json({ ok: true })
    }

    if (id === eu.user.id) return json({ erro: 'proprio' }, 400)

    if (acao === 'bloquear') {
      const bloquear = b.bloquear !== false
      const { error } = await db.auth.admin.updateUserById(id, { ban_duration: bloquear ? '876000h' : 'none' })
      if (error) throw error
      if (bloquear) await db.rpc('encerrar_sessoes', { p_user: id })
      return json({ ok: true })
    }

    if (acao === 'excluir') {
      const { count } = await db.from('platform_admins').select('user_id', { count: 'exact', head: true })
      const { data: alvoAdmin } = await db.from('platform_admins').select('user_id').eq('user_id', id).maybeSingle()
      if (alvoAdmin && (count ?? 0) <= 1) return json({ erro: 'ultimo_admin' }, 400)
      // cobranças primeiro: sem isso o gateway continuaria cobrando uma conta que não existe mais
      const r = await fetch(`${URL_SB}/functions/v1/pagamentos/admin-cancelar`, { method: 'POST', headers: { Authorization: autorizacao, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: id }) })
      if (!r.ok) return json({ erro: 'assinatura' }, 502)
      const { data: fotos } = await db.storage.from('evolucao').list(id, { limit: 1000 })
      if (fotos?.length) await db.storage.from('evolucao').remove(fotos.map((f) => `${id}/${f.name}`))
      const { error } = await db.auth.admin.deleteUser(id)
      if (error) throw error
      await db.rpc('limpar_clinicas_vazias')
      return json({ ok: true })
    }

    return json({ erro: 'acao' }, 400)
  } catch (e) {
    console.error('admin-usuarios', String(e))
    return json({ erro: 'falha' }, 500)
  }
})
