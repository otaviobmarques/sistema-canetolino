import type { SupabaseClient } from '@supabase/supabase-js'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Icon from '../components/Icon'
import Mascot from '../components/Mascot'
import { Contador, useToast } from '../components/ui'
import { dataBR } from '../lib/datas'
import { erroPt } from '../lib/supabase'
import { AuthPainel, usePainel } from './Auth'
import { Bloqueado, Cabecalho, PainelLayout } from './Layout'

/* Painel da equipe Canetolino: verificação de profissionais e números gerais.
   Não mostra dados de saúde de pacientes (LGPD): só contagens. */

type Resumo = Record<string, number>
type Prof = { id: string; nome: string; profissao: string; registro: string; uf: string | null; email: string; codigo: string; verificado: boolean; pacientes: number; criado_em: string }
type Clinica = { id: string; nome: string; cnpj: string | null; codigo: string; membros: number; pacientes: number; criado_em: string }

const ITENS = [
  { to: '/admin', nome: 'Visão geral', icone: 'grid' as const, end: true },
  { to: '/admin/profissionais', nome: 'Profissionais', icone: 'shield' as const },
  { to: '/admin/clinicas', nome: 'Clínicas', icone: 'users' as const },
]

// preço do Claude Haiku 5.5 (US$ por milhão de tokens, prompts até 100 mil tokens)
const PRECO_ENTRADA = 0.1
const PRECO_SAIDA = 0.5

export default function AdminPainel() {
  const { c, estado, avaliar, sair } = usePainel('admin')
  const [admin, setAdmin] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    if (estado !== 'pronto') return setAdmin(undefined)
    c.rpc('eh_admin').then(({ data }) => setAdmin(!!data))
  }, [estado, c])

  if (estado !== 'pronto')
    return (
      <AuthPainel
        area="admin"
        c={c}
        estado={estado}
        onPronto={avaliar}
        descricao="Área da equipe Canetolino: verificação de profissionais e números gerais da plataforma."
        tituloCadastro=""
        camposCadastro={[]}
        metaCadastro={() => ({})}
        usuarioSemEmail={{ dominio: 'canetolino.com.br' }}
      />
    )
  if (admin === undefined) return <div className="p-carregando"><Mascot expressao="pensativo" size={100} /></div>
  if (!admin)
    return (
      <div className="p-carregando">
        <div style={{ textAlign: 'center' }}>
          <Bloqueado texto="Esta conta não é de administrador da plataforma." />
          <button className="btn btn--contorno" onClick={sair}>Sair</button>
        </div>
      </div>
    )

  return (
    <PainelLayout sufixo="Admin" itens={ITENS} usuario={{ nome: 'Admin', papel: 'Equipe Canetolino' }} onSair={sair}>
      <Routes>
        <Route index element={<Visao c={c} />} />
        <Route path="profissionais" element={<Profissionais c={c} />} />
        <Route path="clinicas" element={<Clinicas c={c} />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </PainelLayout>
  )
}

function Visao({ c }: { c: SupabaseClient }) {
  const [r, setR] = useState<Resumo | null>(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    c.rpc('admin_resumo').then(({ data, error }) => (error ? setErro(erroPt(error)) : setR(data as Resumo)))
  }, [c])
  const custo = r ? (r.ia_tokens_entrada_mes * PRECO_ENTRADA + r.ia_tokens_saida_mes * PRECO_SAIDA) / 1e6 : 0
  const kpis = r
    ? [
        { v: r.pacientes, r: 'Pacientes', s: `${r.pacientes_ativos_7d} ativos nos últimos 7 dias · ${r.premium} Premium` },
        { v: r.profissionais, r: 'Profissionais', s: `${r.profissionais_pendentes} aguardando verificação`, alerta: r.profissionais_pendentes > 0 },
        { v: r.clinicas, r: 'Clínicas', s: `${r.compartilhamentos_ativos} compartilhamentos ativos` },
        { v: r.ia_chamadas_mes, r: 'Chamadas à IA no mês', s: `custo estimado US$ ${custo.toFixed(4).replace('.', ',')}` },
      ]
    : []
  return (
    <>
      <Cabecalho titulo="Visão geral" sub="Números da plataforma · sem dados de saúde de pacientes" />
      {erro && <div className="p-aviso">{erro}</div>}
      <div className="p-kpis">
        {r === null
          ? [0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 118, borderRadius: 20 }} />)
          : kpis.map((k, i) => (
              <motion.div key={k.r} className="p-kpi" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <span className="p-cinza">{k.r}</span>
                <b className={k.alerta ? 'texto-alerta' : ''}><Contador valor={k.v} duracao={1} /></b>
                <small>{k.s}</small>
              </motion.div>
            ))}
      </div>
      {r && (
        <div className="p-grade-2" style={{ marginTop: 18 }}>
          <div className="p-card">
            <h3>Base de alimentos</h3>
            <p className="p-cinza" style={{ marginTop: 6 }}>{r.alimentos.toLocaleString('pt-BR')} alimentos (TACO, TBCA, POF, USDA e CoFID).</p>
          </div>
          <div className="p-card">
            <h3>Lembretes</h3>
            <p className="p-cinza" style={{ marginTop: 6 }}>{r.aparelhos_com_lembrete} aparelhos com notificações ligadas. Envio a cada 15 minutos.</p>
          </div>
        </div>
      )}
    </>
  )
}

function Profissionais({ c }: { c: SupabaseClient }) {
  const toast = useToast()
  const [lista, setLista] = useState<Prof[] | null>(null)
  const [filtro, setFiltro] = useState<'pendentes' | 'todos'>('pendentes')
  const carregar = useCallback(() => c.rpc('admin_profissionais').then(({ data }) => setLista((data ?? []) as Prof[])), [c])
  useEffect(() => {
    carregar()
  }, [carregar])
  const mostrar = (lista ?? []).filter((p) => filtro === 'todos' || !p.verificado)
  const marcar = async (p: Prof, v: boolean) => {
    const { error } = await c.rpc('admin_verificar_profissional', { p_id: p.id, p_verificado: v })
    if (error) return toast(erroPt(error), 'info')
    toast(v ? `${p.nome} verificado(a)` : `Verificação de ${p.nome} retirada`, v ? 'ok' : 'info')
    carregar()
  }
  return (
    <>
      <Cabecalho titulo="Profissionais" sub="Confira o registro no conselho (CRN, CRM…) antes de marcar como verificado">
        <div className="p-periodo">
          <button className={filtro === 'pendentes' ? 'is-on' : ''} onClick={() => setFiltro('pendentes')}>Pendentes</button>
          <button className={filtro === 'todos' ? 'is-on' : ''} onClick={() => setFiltro('todos')}>Todos</button>
        </div>
      </Cabecalho>
      {lista === null ? (
        <div className="skeleton" style={{ height: 160 }} />
      ) : mostrar.length === 0 ? (
        <div className="p-vazio"><Mascot expressao="comemorando" size={100} /><h2>{filtro === 'pendentes' ? 'Nenhuma verificação pendente' : 'Nenhum profissional cadastrado'}</h2></div>
      ) : (
        <div className="p-tabela-wrap">
          <table className="p-tabela">
            <thead><tr><th>Profissional</th><th>Registro</th><th>E-mail</th><th>Pacientes</th><th>Cadastro</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              <AnimatePresence initial={false}>
                {mostrar.map((p) => (
                  <motion.tr key={p.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: 30 }} style={{ cursor: 'default' }}>
                    <td><b>{p.nome}</b><div className="p-cinza" style={{ fontSize: 13 }}>{p.profissao} · {p.codigo}</div></td>
                    <td>{p.registro}{p.uf ? ` · ${p.uf}` : ''}</td>
                    <td className="p-cinza">{p.email}</td>
                    <td>{p.pacientes}</td>
                    <td className="p-cinza">{dataBR(p.criado_em)}</td>
                    <td>{p.verificado ? <span className="selo selo--sucesso"><Icon name="check" size={13} /> verificado</span> : <span className="selo selo--lilas">pendente</span>}</td>
                    <td style={{ textAlign: 'right' }}>
                      {p.verificado ? (
                        <button className="btn btn--perigo btn--pequeno" onClick={() => marcar(p, false)}>Retirar</button>
                      ) : (
                        <button className="btn btn--turquesa btn--pequeno" onClick={() => marcar(p, true)}>Verificar</button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
      <p className="legenda" style={{ marginTop: 14 }}>Consulta pública de registros: CFN (cfn.org.br) para nutricionistas e CFM (portal.cfm.org.br) para médicos. O selo “verificado” aparece para o paciente na hora de compartilhar.</p>
    </>
  )
}

function Clinicas({ c }: { c: SupabaseClient }) {
  const [lista, setLista] = useState<Clinica[] | null>(null)
  useEffect(() => {
    c.rpc('admin_clinicas').then(({ data }) => setLista((data ?? []) as Clinica[]))
  }, [c])
  return (
    <>
      <Cabecalho titulo="Clínicas" sub="Clínicas cadastradas na plataforma" />
      {lista === null ? (
        <div className="skeleton" style={{ height: 160 }} />
      ) : lista.length === 0 ? (
        <div className="p-vazio"><Mascot expressao="dormindo" size={100} /><h2>Nenhuma clínica cadastrada</h2></div>
      ) : (
        <div className="p-tabela-wrap">
          <table className="p-tabela">
            <thead><tr><th>Clínica</th><th>CNPJ</th><th>Código</th><th>Equipe</th><th>Pacientes</th><th>Cadastro</th></tr></thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.id} style={{ cursor: 'default' }}><td><b>{x.nome}</b></td><td className="p-cinza">{x.cnpj || '—'}</td><td className="p-mono">{x.codigo}</td><td>{x.membros}</td><td>{x.pacientes}</td><td className="p-cinza">{dataBR(x.criado_em)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
