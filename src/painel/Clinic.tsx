import type { SupabaseClient } from '@supabase/supabase-js'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import Icon from '../components/Icon'
import Mascot from '../components/Mascot'
import { Contador, Modal, useToast } from '../components/ui'
import { MODULOS, type Modulo } from '../data/store'
import { DIA_MS, dataBR, relativo } from '../lib/datas'
import { erroPt } from '../lib/supabase'
import { AuthPainel, usePainel } from './Auth'
import { Bloqueado, Cabecalho, PainelLayout } from './Layout'

type Papel = 'admin' | 'profissional' | 'recepcao'
const PAPEL_NOME: Record<Papel, string> = { admin: 'Administrador', profissional: 'Profissional', recepcao: 'Recepção (só convites)' }
type Vinculo = { clinic_id: string; papel: Papel; nome: string; clinics: { id: string; nome: string; cnpj: string | null; codigo_convite: string } }
type Membro = { user_id: string; nome: string; especialidade: string | null; papel: Papel; pacientes: number | null; alertas: number | null }
type Convite = { id: string; email: string; tipo: 'profissional' | 'paciente'; papel: Papel | null; criado_em: string; aceito_em: string | null }

export default function ClinicPainel() {
  const { c, estado, avaliar, sair, sessao } = usePainel('clinic')
  const [vinculos, setVinculos] = useState<Vinculo[] | undefined>(undefined)
  const [atual, setAtual] = useState(0)
  const [modal, setModal] = useState<'prof' | 'pac' | null>(null)
  const [versao, setVersao] = useState(0)

  const carregar = useCallback(async () => {
    await c.rpc('aceitar_convites_clinica') // entra nas clínicas que convidaram este e-mail
    const { data, error } = await c.from('clinic_members').select('clinic_id, papel, nome, clinics(id, nome, cnpj, codigo_convite)').eq('user_id', (await c.auth.getUser()).data.user!.id)
    if (error) throw error
    setVinculos((data ?? []) as unknown as Vinculo[])
  }, [c])

  useEffect(() => {
    if (estado === 'pronto') carregar().catch(() => setVinculos([]))
    else setVinculos(undefined)
  }, [estado, carregar])

  if (estado !== 'pronto')
    return (
      <AuthPainel
        area="clinic"
        c={c}
        estado={estado}
        onPronto={avaliar}
        descricao="Equipe, papéis, convites e a visão operacional dos pacientes vinculados à sua clínica."
        tituloCadastro="Cadastrar clínica"
        extraCadastro={<p className="legenda" style={{ margin: '6px 0 0' }}>Foi convidado por uma clínica? Crie sua conta com o mesmo e-mail do convite; o nome da clínica pode ficar em branco.</p>}
        camposCadastro={[
          { id: 'nome', rotulo: 'Seu nome', placeholder: 'Dr. Rafael Lima' },
          { id: 'clinica', rotulo: 'Nome da clínica', placeholder: 'Clínica Vida Plena', obrigatorio: false },
          { id: 'cnpj', rotulo: 'CNPJ (opcional)', placeholder: '00.000.000/0001-00', obrigatorio: false },
        ]}
        metaCadastro={(v): Record<string, string> => (v.clinica?.trim() ? { tipo: 'clinica', nome: v.nome ?? '', clinica: v.clinica.trim(), cnpj: v.cnpj ?? '' } : { tipo: 'membro', nome: v.nome ?? '' })}
      />
    )

  if (vinculos === undefined) return <div className="p-carregando"><Mascot expressao="pensativo" size={100} /></div>
  if (vinculos.length === 0) return <SemClinica c={c} onPronto={carregar} onSair={sair} email={sessao?.user.email ?? ''} />

  const v = vinculos[Math.min(atual, vinculos.length - 1)]
  const papel = v.papel
  const clinica = v.clinics

  const itens = [
    { to: '/clinic', nome: 'Visão geral', icone: 'grid' as const, end: true, bloqueado: papel === 'recepcao' },
    { to: '/clinic/pacientes', nome: 'Pacientes', icone: 'users' as const, bloqueado: papel === 'recepcao' },
    { to: '/clinic/equipe', nome: 'Equipe', icone: 'heart' as const, bloqueado: papel !== 'admin' },
    { to: '/clinic/convites', nome: 'Convites', icone: 'mail' as const },
    { to: '/clinic/plano', nome: 'Plano e cobrança', icone: 'card' as const, bloqueado: papel !== 'admin' },
  ]

  const seletor =
    vinculos.length > 1 ? (
      <div className="p-papel">
        <label htmlFor="cl">Clínica</label>
        <select id="cl" value={atual} onChange={(e) => setAtual(Number(e.target.value))}>
          {vinculos.map((x, i) => <option key={x.clinic_id} value={i}>{x.clinics.nome}</option>)}
        </select>
      </div>
    ) : null

  const acoes = (
    <>
      {papel === 'admin' && <button className="btn btn--contorno" onClick={() => setModal('prof')}>Convidar profissional</button>}
      <button className="btn btn--primario" onClick={() => setModal('pac')}>+ Convidar paciente</button>
    </>
  )

  return (
    <PainelLayout sufixo="Clinic" itens={itens} usuario={{ nome: v.nome || sessao?.user.email || '', papel: PAPEL_NOME[papel].split(' ')[0] }} onSair={sair} extraLateral={seletor}>
      <Routes>
        <Route index element={papel === 'recepcao' ? <Bloqueado texto="O papel Recepção cuida só dos convites. Dados e indicadores de pacientes não ficam visíveis para ele." /> : <Visao key={versao} c={c} clinica={clinica} acoes={acoes} />} />
        <Route path="pacientes" element={papel === 'recepcao' ? <Bloqueado texto="O papel Recepção não abre ficha de paciente. Peça a um profissional da equipe." /> : <Pacientes c={c} clinicId={clinica.id} />} />
        <Route path="equipe" element={papel !== 'admin' ? <Bloqueado texto="Só o administrador gerencia a equipe e os papéis." /> : <Equipe key={versao} c={c} clinicId={clinica.id} onConvidar={() => setModal('prof')} />} />
        <Route path="convites" element={<Convites key={versao} c={c} clinica={clinica} acoes={acoes} />} />
        <Route path="plano" element={papel !== 'admin' ? <Bloqueado texto="Plano e cobrança são visíveis apenas para o administrador." /> : <Plano />} />
        <Route path="*" element={<Navigate to="/clinic" replace />} />
      </Routes>
      <ModalConvidar c={c} clinica={clinica} tipo={modal} onFechar={() => setModal(null)} onEnviado={() => setVersao((x) => x + 1)} />
    </PainelLayout>
  )
}

function SemClinica({ c, onPronto, onSair, email }: { c: SupabaseClient; onPronto: () => void; onSair: () => void; email: string }) {
  const [v, setV] = useState({ nome: '', cnpj: '', meu: '' })
  const [erro, setErro] = useState('')
  return (
    <div className="p-carregando">
      <form
        className="p-card p-form-card"
        onSubmit={async (e) => {
          e.preventDefault()
          const { error } = await c.rpc('criar_clinica', { p_nome: v.nome, p_cnpj: v.cnpj, p_meu_nome: v.meu })
          if (error) return setErro(erroPt(error))
          onPronto()
        }}
      >
        <Mascot expressao="pensativo" size={80} />
        <h2 style={{ marginTop: 8 }}>Sua conta ainda não está em uma clínica</h2>
        <p className="p-cinza">Se você foi convidado, peça ao administrador para convidar <b>{email}</b> e entre de novo. Ou cadastre sua clínica:</p>
        <label className="rotulo" htmlFor="sn">Nome da clínica</label>
        <input id="sn" className="campo" value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} required />
        <div className="duas-col">
          <div>
            <label className="rotulo" htmlFor="sc">CNPJ (opcional)</label>
            <input id="sc" className="campo" value={v.cnpj} onChange={(e) => setV({ ...v, cnpj: e.target.value })} />
          </div>
          <div>
            <label className="rotulo" htmlFor="sm">Seu nome</label>
            <input id="sm" className="campo" value={v.meu} onChange={(e) => setV({ ...v, meu: e.target.value })} required />
          </div>
        </div>
        {erro && <p className="erro-campo">{erro}</p>}
        <div className="duas-col" style={{ marginTop: 18 }}>
          <button type="button" className="btn btn--contorno" onClick={onSair}>Sair</button>
          <button className="btn btn--primario">Cadastrar clínica</button>
        </div>
      </form>
    </div>
  )
}

function Visao({ c, clinica, acoes }: { c: SupabaseClient; clinica: Vinculo['clinics']; acoes: React.ReactNode }) {
  const [k, setK] = useState<Record<string, number> | null>(null)
  const [equipe, setEquipe] = useState<Membro[]>([])
  const [erro, setErro] = useState('')
  useEffect(() => {
    Promise.all([c.rpc('clinica_visao', { p_clinic: clinica.id }), c.rpc('clinica_equipe', { p_clinic: clinica.id })]).then(([a, b]) => {
      if (a.error) setErro(erroPt(a.error))
      else setK(a.data as Record<string, number>)
      setEquipe((b.data ?? []) as Membro[])
    })
  }, [c, clinica.id])

  const pct = k && k.aplicacoes_previstas ? Math.round((k.aplicacoes_registradas / k.aplicacoes_previstas) * 100) : 0
  const kpis = k
    ? [
        { v: k.pacientes_ativos, r: 'Pacientes ativos', s: `registraram algo na semana · ${k.pacientes_vinculados} vinculados`, suf: '' },
        { v: pct, r: 'Aplicações registradas', s: k.aplicacoes_previstas ? 'das previstas na semana' : 'nenhuma aplicação prevista ainda', suf: '%' },
        { v: k.alertas_abertos, r: 'Alertas abertos', s: 'visíveis ao profissional responsável', suf: '', alerta: true },
        { v: k.convites_pendentes, r: 'Convites pendentes', s: 'aguardando aceite', suf: '' },
      ]
    : []
  return (
    <>
      <Cabecalho titulo={clinica.nome} sub="Visão geral da semana · números agregados, sem dados individuais">{acoes}</Cabecalho>
      {erro && <div className="p-aviso">{erro}</div>}
      <div className="p-kpis">
        {k === null
          ? [0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 118, borderRadius: 20 }} />)
          : kpis.map((x, i) => (
              <motion.div key={x.r} className="p-kpi" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} whileHover={{ y: -4 }}>
                <span className="p-cinza">{x.r}</span>
                <b className={x.alerta && x.v ? 'texto-alerta' : ''}><Contador valor={x.v} sufixo={x.suf} duracao={1.1} /></b>
                <small>{x.s}</small>
              </motion.div>
            ))}
      </div>
      <div className="p-card" style={{ padding: 0, marginTop: 18 }}>
        <div className="p-card__cab" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Equipe</h3>
          <Link to="/clinic/equipe" className="link-violeta" style={{ textDecoration: 'none' }}>Gerenciar equipe</Link>
        </div>
        <table className="p-tabela p-tabela--sem-borda">
          <thead><tr><th>Nome</th><th>Especialidade</th><th>Papel</th><th>Pacientes</th><th>Alertas abertos</th></tr></thead>
          <tbody>
            {equipe.map((m) => (
              <tr key={m.user_id}><td><b>{m.nome || '—'}</b></td><td>{m.especialidade ?? '—'}</td><td>{PAPEL_NOME[m.papel]}</td><td>{m.pacientes ?? '—'}</td><td>{m.alertas ?? '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-aviso">
        <Mascot expressao="neutro" size={40} flutuar={false} />
        A clínica vê dados individuais apenas dos pacientes que autorizaram a clínica, e cada acesso fica registrado no histórico do paciente.
      </div>
    </>
  )
}

function Pacientes({ c, clinicId }: { c: SupabaseClient; clinicId: string }) {
  const [lista, setLista] = useState<{ paciente_id: string; nome: string; modulos: Modulo[]; expira_em: string | null; ultimo_registro: string | null; alerta: boolean }[] | null>(null)
  useEffect(() => {
    c.rpc('clinica_pacientes', { p_clinic: clinicId }).then(({ data }) => setLista(data ?? []))
  }, [c, clinicId])
  return (
    <>
      <Cabecalho titulo="Pacientes vinculados" sub="Pacientes que autorizaram a clínica" />
      {lista === null ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : lista.length === 0 ? (
        <div className="p-vazio">
          <Mascot expressao="piscando" size={100} />
          <h2>Nenhum paciente vinculado</h2>
          <p>Envie o código da clínica em Convites. O paciente autoriza a clínica no app, em Perfil → Compartilhar.</p>
        </div>
      ) : (
        <div className="p-tabela-wrap">
          <table className="p-tabela">
            <thead><tr><th>Paciente</th><th>Módulos autorizados</th><th>Último registro</th><th>Acesso até</th><th>Situação</th></tr></thead>
            <tbody>
              {lista.map((p, i) => (
                <motion.tr key={p.paciente_id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <td><b>{p.nome || 'Paciente'}</b></td>
                  <td className="p-cinza">{p.modulos.map((m) => MODULOS.find((x) => x.id === m)!.nome.split(' ')[0].toLowerCase()).join(', ')}</td>
                  <td className="p-cinza">{p.ultimo_registro ? relativo(p.ultimo_registro) : '—'}</td>
                  <td className="p-cinza">{p.expira_em ? dataBR(p.expira_em) : 'até revogar'}</td>
                  <td>{p.alerta ? <span className="selo selo--alerta">Alerta aberto</span> : p.ultimo_registro && Date.now() - +new Date(p.ultimo_registro) < 7 * DIA_MS ? <span className="selo selo--sucesso">Em dia</span> : <span className="selo selo--lilas">Poucos registros</span>}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function Equipe({ c, clinicId, onConvidar }: { c: SupabaseClient; clinicId: string; onConvidar: () => void }) {
  const toast = useToast()
  const [equipe, setEquipe] = useState<Membro[]>([])
  const [eu, setEu] = useState('')
  const carregar = useCallback(async () => {
    const [{ data }, u] = await Promise.all([c.rpc('clinica_equipe', { p_clinic: clinicId }), c.auth.getUser()])
    setEquipe((data ?? []) as Membro[])
    setEu(u.data.user?.id ?? '')
  }, [c, clinicId])
  useEffect(() => {
    carregar()
  }, [carregar])

  return (
    <>
      <Cabecalho titulo="Equipe" sub="Papéis definem o que cada pessoa pode ver">
        <button className="btn btn--primario" onClick={onConvidar}>+ Convidar profissional</button>
      </Cabecalho>
      <div className="p-tabela-wrap">
        <table className="p-tabela">
          <thead><tr><th>Nome</th><th>Especialidade</th><th>Papel</th><th>Pacientes</th><th></th></tr></thead>
          <tbody>
            <AnimatePresence initial={false}>
              {equipe.map((m) => (
                <motion.tr key={m.user_id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: 30 }}>
                  <td><b>{m.nome || '—'}</b>{m.user_id === eu && <span className="p-cinza"> (você)</span>}</td>
                  <td>{m.especialidade ?? '—'}</td>
                  <td>
                    <select
                      className="p-select"
                      value={m.papel}
                      disabled={m.user_id === eu}
                      onChange={async (e) => {
                        const papel = e.target.value as Papel
                        const { error } = await c.from('clinic_members').update({ papel }).eq('clinic_id', clinicId).eq('user_id', m.user_id)
                        if (error) return toast(erroPt(error), 'info')
                        toast(`${m.nome}: papel alterado para ${PAPEL_NOME[papel]}`)
                        carregar()
                      }}
                      aria-label={`Papel de ${m.nome}`}
                    >
                      {(Object.keys(PAPEL_NOME) as Papel[]).map((p) => <option key={p} value={p}>{PAPEL_NOME[p]}</option>)}
                    </select>
                  </td>
                  <td>{m.pacientes ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {m.user_id !== eu && (
                      <button
                        className="btn btn--perigo btn--pequeno"
                        onClick={async () => {
                          if (!confirm(`Remover ${m.nome} da equipe?`)) return
                          const { error } = await c.from('clinic_members').delete().eq('clinic_id', clinicId).eq('user_id', m.user_id)
                          if (error) return toast(erroPt(error), 'info')
                          toast('Removido da equipe')
                          carregar()
                        }}
                      >
                        Remover
                      </button>
                    )}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      <div className="p-grade-3" style={{ marginTop: 18 }}>
        {[
          ['Administrador', 'Gerencia equipe, papéis e plano. Vê indicadores agregados e os pacientes que autorizaram a clínica.'],
          ['Profissional', 'Vê os pacientes que autorizaram a clínica ou a ele, nos módulos e prazo escolhidos.'],
          ['Recepção', 'Envia e acompanha convites. Não abre ficha de paciente.'],
        ].map(([t, d]) => (
          <div key={t} className="p-card"><b style={{ color: 'var(--roxo)' }}>{t}</b><p className="p-cinza" style={{ marginTop: 6, fontSize: 14 }}>{d}</p></div>
        ))}
      </div>
    </>
  )
}

function Convites({ c, clinica, acoes }: { c: SupabaseClient; clinica: Vinculo['clinics']; acoes: React.ReactNode }) {
  const toast = useToast()
  const [lista, setLista] = useState<Convite[]>([])
  const carregar = useCallback(async () => {
    const { data } = await c.from('clinic_invites').select('*').eq('clinic_id', clinica.id).order('criado_em', { ascending: false })
    setLista((data ?? []) as Convite[])
  }, [c, clinica.id])
  useEffect(() => {
    carregar()
  }, [carregar])
  return (
    <>
      <Cabecalho titulo="Convites" sub="Profissionais entram na equipe ao criar a conta com o e-mail convidado">{acoes}</Cabecalho>
      <div className="p-card">
        <div className="p-destaque-codigo">
          <div>
            <span className="p-sobre">Código da clínica para pacientes</span>
            <div className="p-codigo-grande">{clinica.codigo_convite}</div>
            <p className="p-cinza">O paciente usa no app, em Perfil → Compartilhar, e escolhe o que a clínica pode ver.</p>
          </div>
          <button className="btn btn--lilas" onClick={() => { navigator.clipboard?.writeText(clinica.codigo_convite); toast('Código copiado') }}>
            <Icon name="copy" size={16} /> Copiar
          </button>
        </div>
      </div>
      {lista.length === 0 ? (
        <div className="p-vazio" style={{ paddingTop: 40 }}><Mascot expressao="dormindo" size={90} /><h2>Nenhum convite enviado</h2></div>
      ) : (
        <div className="p-tabela-wrap" style={{ marginTop: 18 }}>
          <table className="p-tabela">
            <thead><tr><th>Para</th><th>Tipo</th><th>Enviado em</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              <AnimatePresence initial={false}>
                {lista.map((x) => (
                  <motion.tr key={x.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}>
                    <td><b>{x.email}</b></td>
                    <td><span className="selo selo--lilas">{x.tipo === 'profissional' ? `Profissional · ${PAPEL_NOME[x.papel ?? 'profissional'].split(' ')[0]}` : 'Paciente'}</span></td>
                    <td className="p-cinza">{dataBR(x.criado_em)}</td>
                    <td>{x.aceito_em ? <span className="selo selo--sucesso">aceito</span> : <span className="p-cinza">pendente</span>}</td>
                    <td style={{ textAlign: 'right' }}>
                      {!x.aceito_em && (
                        <button
                          className="btn btn--perigo btn--pequeno"
                          onClick={async () => {
                            const { error } = await c.from('clinic_invites').delete().eq('id', x.id)
                            if (error) return toast(erroPt(error), 'info')
                            carregar()
                          }}
                        >
                          Cancelar
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function Plano() {
  return (
    <>
      <Cabecalho titulo="Plano e cobrança" sub="Cobrança B2B por boleto ou cartão" />
      <div className="p-grade-2">
        <div className="p-card p-card--roxo">
          <span className="p-sobre" style={{ color: '#5fe3d6' }}>Plano</span>
          <h2 style={{ color: '#fff', marginTop: 6 }}>Clinic</h2>
          <p style={{ color: '#d8cbf7', marginTop: 6 }}>A cobrança da clínica ainda não está ativa. Enquanto isso, o uso do painel não tem custo.</p>
        </div>
        <div className="p-card">
          <span className="p-sobre">Próximos passos</span>
          <p style={{ marginTop: 10 }}>A emissão de boleto e a cobrança por cartão serão ligadas a um provedor de pagamentos. As faturas aparecem aqui.</p>
        </div>
      </div>
    </>
  )
}

function ModalConvidar({ c, clinica, tipo, onFechar, onEnviado }: { c: SupabaseClient; clinica: Vinculo['clinics']; tipo: 'prof' | 'pac' | null; onFechar: () => void; onEnviado: () => void }) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState<Papel>('profissional')
  const [erro, setErro] = useState('')
  const link = `${window.location.origin}${window.location.pathname}#/${tipo === 'prof' ? 'clinic' : 'app'}`
  const texto =
    tipo === 'prof'
      ? `Você foi convidado(a) para a equipe da ${clinica.nome} no Canetolino Clinic. Crie sua conta com este e-mail (${email}): ${link}`
      : `A ${clinica.nome} acompanha seu tratamento pelo Canetolino. No app, vá em Perfil → Compartilhar e use o código ${clinica.codigo_convite}. ${link}`
  return (
    <Modal aberto={!!tipo} onFechar={onFechar}>
      <h3>{tipo === 'prof' ? 'Convidar profissional' : 'Convidar paciente'}</h3>
      <p className="legenda">{tipo === 'prof' ? 'A pessoa entra na equipe ao criar a conta (ou entrar) com este e-mail.' : 'O paciente decide, no app, se autoriza a clínica e quais módulos.'}</p>
      <label className="rotulo" htmlFor="ce2">E-mail</label>
      <input id="ce2" className="campo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@email.com" />
      {tipo === 'prof' && (
        <>
          <span className="rotulo">Papel</span>
          <div className="chips">
            {(['profissional', 'recepcao', 'admin'] as Papel[]).map((p) => (
              <button key={p} className={`chip ${papel === p ? 'is-on' : ''}`} onClick={() => setPapel(p)}>{PAPEL_NOME[p]}</button>
            ))}
          </div>
        </>
      )}
      {erro && <p className="erro-campo">{erro}</p>}
      <div className="duas-col" style={{ marginTop: 20 }}>
        <button className="btn btn--contorno" onClick={onFechar}>Cancelar</button>
        <button
          className="btn btn--primario"
          disabled={!email.includes('@')}
          onClick={async () => {
            setErro('')
            const { error } = await c.from('clinic_invites').insert({ clinic_id: clinica.id, email: email.trim().toLowerCase(), tipo: tipo === 'prof' ? 'profissional' : 'paciente', papel: tipo === 'prof' ? papel : null })
            if (error) return setErro(erroPt(error))
            window.open(`mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent('Convite Canetolino')}&body=${encodeURIComponent(texto)}`)
            toast(`Convite registrado para ${email}`)
            setEmail('')
            onEnviado()
            onFechar()
          }}
        >
          Registrar e enviar
        </button>
      </div>
    </Modal>
  )
}
