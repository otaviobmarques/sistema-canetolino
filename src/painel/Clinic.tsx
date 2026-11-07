import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import Icon from '../components/Icon'
import Mascot from '../components/Mascot'
import { Contador, Modal, useToast } from '../components/ui'
import { DIA_MS, dataBR } from '../lib/datas'
import { Bloqueado, Cabecalho, LoginPainel, PainelLayout, usarSessao } from './Layout'

type Papel = 'admin' | 'profissional' | 'recepcao'
const PAPEL_NOME: Record<Papel, string> = { admin: 'Administrador', profissional: 'Profissional', recepcao: 'Recepção (só convites)' }
type Membro = { id: string; nome: string; especialidade: string; papel: Papel; pacientes: number | null; alertas: number | null }

const EQUIPE_INICIAL: Membro[] = [
  { id: '1', nome: 'Dr. Rafael Lima', especialidade: 'Endocrinologia', papel: 'admin', pacientes: 61, alertas: 1 },
  { id: '2', nome: 'Dra. Ana Souza', especialidade: 'Nutrição', papel: 'profissional', pacientes: 42, alertas: 2 },
  { id: '3', nome: 'Bruna Alves', especialidade: '—', papel: 'recepcao', pacientes: null, alertas: null },
]
const USUARIO_POR_PAPEL: Record<Papel, string> = { admin: 'Dr. Rafael Lima', profissional: 'Dra. Ana Souza', recepcao: 'Bruna Alves' }

export default function ClinicPainel() {
  const sessao = usarSessao('canetolino:clinic')
  const [papel, setPapel] = useState<Papel>('admin')
  const [equipe, setEquipe] = useState(EQUIPE_INICIAL)
  const [convites, setConvites] = useState([
    { id: 'c1', para: 'carlos.m@email.com', tipo: 'Paciente', criado: new Date(Date.now() - DIA_MS).toISOString() },
    { id: 'c2', para: 'luiza.f@email.com', tipo: 'Paciente', criado: new Date(Date.now() - 3 * DIA_MS).toISOString() },
    { id: 'c3', para: 'dr.pedro@clinica.com', tipo: 'Profissional', criado: new Date(Date.now() - 2 * DIA_MS).toISOString() },
  ])
  const [modal, setModal] = useState<'prof' | 'pac' | null>(null)

  if (!sessao.ok)
    return <LoginPainel sufixo="Clinic" emailPadrao="rafael.lima@clinicavida.com.br" onEntrar={sessao.entrar} descricao="Equipe, papéis, convites e a visão operacional dos pacientes vinculados à sua clínica." />

  const itens = [
    { to: '/clinic', nome: 'Visão geral', icone: 'grid' as const, end: true, bloqueado: papel === 'recepcao' },
    { to: '/clinic/pacientes', nome: 'Pacientes', icone: 'users' as const, bloqueado: papel === 'recepcao' },
    { to: '/clinic/equipe', nome: 'Equipe', icone: 'heart' as const, bloqueado: papel !== 'admin' },
    { to: '/clinic/convites', nome: 'Convites', icone: 'mail' as const },
    { to: '/clinic/plano', nome: 'Plano e cobrança', icone: 'card' as const, bloqueado: papel !== 'admin' },
  ]

  const seletor = (
    <div className="p-papel">
      <label htmlFor="papel">Ver painel como</label>
      <select id="papel" value={papel} onChange={(e) => setPapel(e.target.value as Papel)}>
        <option value="admin">Administrador</option>
        <option value="profissional">Profissional</option>
        <option value="recepcao">Recepção</option>
      </select>
    </div>
  )

  const acoes = (
    <>
      {papel === 'admin' && <button className="btn btn--contorno" onClick={() => setModal('prof')}>Convidar profissional</button>}
      <button className="btn btn--primario" onClick={() => setModal('pac')}>+ Convidar paciente</button>
    </>
  )

  return (
    <PainelLayout sufixo="Clinic" itens={itens} usuario={{ nome: USUARIO_POR_PAPEL[papel], papel: PAPEL_NOME[papel].split(' ')[0] }} onSair={sessao.sair} extraLateral={seletor}>
      <Routes>
        <Route index element={papel === 'recepcao' ? <Bloqueado texto="O papel Recepção cuida só dos convites. Dados e indicadores de pacientes não ficam visíveis para ele." /> : <Visao equipe={equipe} acoes={acoes} convitesPendentes={convites.length + 4} />} />
        <Route path="pacientes" element={papel === 'recepcao' ? <Bloqueado texto="O papel Recepção não abre ficha de paciente. Peça a um profissional da equipe." /> : <Pacientes papel={papel} />} />
        <Route path="equipe" element={papel !== 'admin' ? <Bloqueado texto="Só o administrador gerencia a equipe e os papéis." /> : <Equipe equipe={equipe} setEquipe={setEquipe} onConvidar={() => setModal('prof')} />} />
        <Route path="convites" element={<Convites lista={convites} acoes={acoes} onCancelar={(id) => setConvites((l) => l.filter((c) => c.id !== id))} />} />
        <Route path="plano" element={papel !== 'admin' ? <Bloqueado texto="Plano e cobrança são visíveis apenas para o administrador." /> : <Plano />} />
        <Route path="*" element={<Navigate to="/clinic" replace />} />
      </Routes>
      <ModalConvidar
        tipo={modal}
        onFechar={() => setModal(null)}
        onEnviar={(para, tipo, papelNovo) => {
          setConvites((l) => [{ id: String(Date.now()), para, tipo, criado: new Date().toISOString() }, ...l])
          if (tipo === 'Profissional' && papelNovo) setEquipe((e) => [...e, { id: String(Date.now()), nome: para.split('@')[0], especialidade: 'Convite pendente', papel: papelNovo, pacientes: null, alertas: null }])
        }}
      />
    </PainelLayout>
  )
}

function Visao({ equipe, acoes, convitesPendentes }: { equipe: Membro[]; acoes: React.ReactNode; convitesPendentes: number }) {
  const kpis = [
    { v: 128, r: 'Pacientes ativos', s: 'registraram algo na semana', suf: '' },
    { v: 91, r: 'Aplicações registradas', s: 'das previstas na semana', suf: '%' },
    { v: 3, r: 'Alertas abertos', s: 'visíveis ao profissional responsável', suf: '', alerta: true },
    { v: convitesPendentes, r: 'Convites pendentes', s: 'aguardando o paciente aceitar', suf: '' },
  ]
  const semanas = [72, 78, 81, 85, 84, 88, 91]
  return (
    <>
      <Cabecalho titulo="Clínica Vida Plena" sub="Visão geral da semana · números agregados, sem dados individuais">{acoes}</Cabecalho>
      <div className="p-kpis">
        {kpis.map((k, i) => (
          <motion.div key={k.r} className="p-kpi" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} whileHover={{ y: -4 }}>
            <span className="p-cinza">{k.r}</span>
            <b className={k.alerta ? 'texto-alerta' : ''}><Contador valor={k.v} sufixo={k.suf} duracao={1.1} /></b>
            <small>{k.s}</small>
          </motion.div>
        ))}
      </div>
      <div className="p-grade-2" style={{ marginTop: 18, gridTemplateColumns: '1.6fr 1fr' }}>
        <div className="p-card" style={{ padding: 0 }}>
          <div className="p-card__cab" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Equipe</h3>
            <Link to="/clinic/equipe" className="link-violeta" style={{ textDecoration: 'none' }}>Gerenciar equipe</Link>
          </div>
          <table className="p-tabela p-tabela--sem-borda">
            <thead><tr><th>Nome</th><th>Especialidade</th><th>Papel</th><th>Pacientes</th><th>Alertas abertos</th></tr></thead>
            <tbody>
              {equipe.map((m) => (
                <tr key={m.id}><td><b>{m.nome}</b></td><td>{m.especialidade}</td><td>{PAPEL_NOME[m.papel]}</td><td>{m.pacientes ?? '—'}</td><td>{m.alertas ?? '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-card">
          <h3>Adesão às aplicações</h3>
          <p className="p-cinza" style={{ fontSize: 13.5 }}>% das aplicações previstas que foram registradas, últimas 7 semanas</p>
          <div className="p-barras">
            {semanas.map((v, i) => (
              <div key={i} className="p-barras__col">
                <motion.i initial={{ height: 0 }} animate={{ height: `${v}%` }} transition={{ delay: 0.2 + i * 0.07, duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className={i === semanas.length - 1 ? 'is-ult' : ''}>
                  <span>{v}%</span>
                </motion.i>
                <small>S{i + 1}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="p-aviso">
        <Mascot expressao="neutro" size={40} flutuar={false} />
        A clínica vê dados individuais apenas dos pacientes que autorizaram a clínica, e cada acesso fica registrado no histórico do paciente. Números do painel são exemplos.
      </div>
    </>
  )
}

function Pacientes({ papel }: { papel: Papel }) {
  const lista = [
    { nome: 'Jessica B.', prof: 'Dra. Ana Souza', status: 'Em dia', mods: 'peso, alimentação' },
    { nome: 'Marcos L.', prof: 'Dr. Rafael Lima', status: 'Alerta aberto', mods: 'todos' },
    { nome: 'Paulo R.', prof: 'Dra. Ana Souza', status: 'Em dia', mods: 'todos' },
    { nome: 'Carla M.', prof: 'Dr. Rafael Lima', status: 'Poucos registros', mods: 'peso, aplicações' },
  ]
  return (
    <>
      <Cabecalho titulo="Pacientes vinculados" sub={papel === 'admin' ? 'Pacientes que autorizaram a clínica' : 'Seus pacientes que autorizaram a clínica'} />
      <div className="p-tabela-wrap">
        <table className="p-tabela">
          <thead><tr><th>Paciente</th><th>Profissional responsável</th><th>Módulos autorizados</th><th>Situação</th></tr></thead>
          <tbody>
            {lista.filter((p) => papel === 'admin' || p.prof === 'Dra. Ana Souza').map((p, i) => (
              <motion.tr key={p.nome} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <td><b>{p.nome}</b></td>
                <td>{p.prof}</td>
                <td className="p-cinza">{p.mods}</td>
                <td><span className={`selo ${p.status === 'Em dia' ? 'selo--sucesso' : p.status === 'Alerta aberto' ? 'selo--alerta' : 'selo--lilas'}`}>{p.status}</span></td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Equipe({ equipe, setEquipe, onConvidar }: { equipe: Membro[]; setEquipe: (fn: (e: Membro[]) => Membro[]) => void; onConvidar: () => void }) {
  const toast = useToast()
  return (
    <>
      <Cabecalho titulo="Equipe" sub="Papéis definem o que cada pessoa pode ver">
        <button className="btn btn--primario" onClick={onConvidar}>+ Convidar profissional</button>
      </Cabecalho>
      <div className="p-tabela-wrap">
        <table className="p-tabela">
          <thead><tr><th>Nome</th><th>Especialidade</th><th>Papel</th><th>Pacientes</th></tr></thead>
          <tbody>
            <AnimatePresence initial={false}>
              {equipe.map((m) => (
                <motion.tr key={m.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <td><b>{m.nome}</b></td>
                  <td>{m.especialidade}</td>
                  <td>
                    <select
                      className="p-select"
                      value={m.papel}
                      disabled={m.id === '1'}
                      onChange={(e) => {
                        const papel = e.target.value as Papel
                        setEquipe((l) => l.map((x) => (x.id === m.id ? { ...x, papel } : x)))
                        toast(`${m.nome}: papel alterado para ${PAPEL_NOME[papel]}`)
                      }}
                      aria-label={`Papel de ${m.nome}`}
                    >
                      {(Object.keys(PAPEL_NOME) as Papel[]).map((p) => (
                        <option key={p} value={p}>{PAPEL_NOME[p]}</option>
                      ))}
                    </select>
                  </td>
                  <td>{m.pacientes ?? '—'}</td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      <div className="p-grade-3" style={{ marginTop: 18 }}>
        {[
          ['Administrador', 'Gerencia equipe, papéis e plano. Vê indicadores agregados e seus pacientes.'],
          ['Profissional', 'Vê apenas os pacientes que o autorizaram, nos módulos e prazo escolhidos.'],
          ['Recepção', 'Envia e acompanha convites. Não abre ficha de paciente.'],
        ].map(([t, d]) => (
          <div key={t} className="p-card"><b style={{ color: 'var(--roxo)' }}>{t}</b><p className="p-cinza" style={{ marginTop: 6, fontSize: 14 }}>{d}</p></div>
        ))}
      </div>
    </>
  )
}

function Convites({ lista, acoes, onCancelar }: { lista: { id: string; para: string; tipo: string; criado: string }[]; acoes: React.ReactNode; onCancelar: (id: string) => void }) {
  return (
    <>
      <Cabecalho titulo="Convites" sub="Convites expiram em 7 dias">{acoes}</Cabecalho>
      {lista.length === 0 ? (
        <div className="p-vazio"><Mascot expressao="dormindo" size={100} /><h2>Nenhum convite pendente</h2></div>
      ) : (
        <div className="p-tabela-wrap">
          <table className="p-tabela">
            <thead><tr><th>Para</th><th>Tipo</th><th>Enviado em</th><th>Expira em</th><th></th></tr></thead>
            <tbody>
              <AnimatePresence initial={false}>
                {lista.map((c) => (
                  <motion.tr key={c.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}>
                    <td><b>{c.para}</b></td>
                    <td><span className="selo selo--lilas">{c.tipo}</span></td>
                    <td className="p-cinza">{dataBR(c.criado)}</td>
                    <td className="p-cinza">{dataBR(new Date(new Date(c.criado).getTime() + 7 * DIA_MS))}</td>
                    <td style={{ textAlign: 'right' }}><button className="btn btn--perigo btn--pequeno" onClick={() => onCancelar(c.id)}>Cancelar</button></td>
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
          <span className="p-sobre" style={{ color: '#5fe3d6' }}>Plano atual</span>
          <h2 style={{ color: '#fff', marginTop: 6 }}>Clinic Equipe</h2>
          <p style={{ color: '#d8cbf7', marginTop: 6 }}>Até 5 profissionais e 300 pacientes vinculados</p>
          <div className="p-uso">
            <div><span>Profissionais</span><b>3 de 5</b><i><motion.span initial={{ width: 0 }} animate={{ width: '60%' }} transition={{ duration: 1 }} /></i></div>
            <div><span>Pacientes</span><b>128 de 300</b><i><motion.span initial={{ width: 0 }} animate={{ width: '43%' }} transition={{ duration: 1, delay: 0.1 }} /></i></div>
          </div>
        </div>
        <div className="p-card">
          <span className="p-sobre">Forma de pagamento</span>
          <p style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="wallet" /> Boleto bancário mensal</p>
          <span className="p-sobre" style={{ display: 'block', marginTop: 20 }}>Faturas</span>
          {['nov/2026', 'out/2026', 'set/2026'].map((m, i) => (
            <div key={m} className="p-fatura"><span>{m}</span><span className={`selo ${i === 0 ? 'selo--lilas' : 'selo--sucesso'}`}>{i === 0 ? 'em aberto' : 'paga'}</span></div>
          ))}
        </div>
      </div>
    </>
  )
}

function ModalConvidar({ tipo, onFechar, onEnviar }: { tipo: 'prof' | 'pac' | null; onFechar: () => void; onEnviar: (para: string, tipo: string, papel?: Papel) => void }) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState<Papel>('profissional')
  return (
    <Modal aberto={!!tipo} onFechar={onFechar}>
      <h3>{tipo === 'prof' ? 'Convidar profissional' : 'Convidar paciente'}</h3>
      <p className="legenda">{tipo === 'prof' ? 'A pessoa recebe um e-mail para criar acesso com verificação em duas etapas.' : 'O paciente recebe o convite e decide, no app, se autoriza a clínica e quais módulos.'}</p>
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
      <div className="duas-col" style={{ marginTop: 20 }}>
        <button className="btn btn--contorno" onClick={onFechar}>Cancelar</button>
        <button
          className="btn btn--primario"
          disabled={!email.includes('@')}
          onClick={() => {
            onEnviar(email, tipo === 'prof' ? 'Profissional' : 'Paciente', tipo === 'prof' ? papel : undefined)
            toast(`Convite enviado para ${email}`)
            setEmail('')
            onFechar()
          }}
        >
          Enviar convite
        </button>
      </div>
    </Modal>
  )
}
