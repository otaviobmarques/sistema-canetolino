import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import Mascot from '../components/Mascot'
import { soltarConfete, useToast } from '../components/ui'
import { MODULOS, PROFISSIONAIS, useStore, type Modulo } from '../data/store'
import { DIA_MS, dataBR, uid } from '../lib/datas'

/* ======================= 10. Compartilhar com profissional ======================= */
export default function Compartilhar() {
  const nav = useNavigate()
  const { set } = useStore()
  const toast = useToast()
  const [codigo, setCodigo] = useState('ANA-4821')
  const [mods, setMods] = useState<Modulo[]>(['peso', 'nutricao'])
  const [prazo, setPrazo] = useState<30 | 90 | 0>(90)
  const [senha, setSenha] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const prof = PROFISSIONAIS[codigo.trim().toUpperCase()]
  const nomesMods = mods.map((m) => MODULOS.find((x) => x.id === m)!.nome.toLowerCase())
  const listaTxt = nomesMods.length > 1 ? nomesMods.slice(0, -1).join(', ') + ' e ' + nomesMods[nomesMods.length - 1] : nomesMods[0]
  const expira = prazo ? new Date(Date.now() + prazo * DIA_MS) : null
  const primeiroNome = prof ? prof.nome.split(' ').slice(0, 2).join(' ') : ''

  const autorizar = (e: React.MouseEvent) => {
    if (!prof) return
    const agora = new Date().toISOString()
    set((x) => ({
      ...x,
      compartilhamentos: [
        ...x.compartilhamentos.map((c) => (c.profissionalId === prof.id && !c.revogado_em ? { ...c, revogado_em: agora } : c)),
        { id: uid(), profissionalId: prof.id, nome: prof.nome, profissao: prof.profissao, registro: prof.registro, modulos: mods, expira_em: expira?.toISOString() ?? null, criado_em: agora, revogado_em: null, finalidade: 'Acompanhamento do tratamento' },
      ],
      consentimentos: [...x.consentimentos, { id: uid(), tipo: 'compartilhamento', versao: 'share-v1.0', em: agora, detalhe: `${prof.nome} · ${mods.join(', ')}` }],
      auditoria: [...x.auditoria, { id: uid(), ator: 'Você', acao: `Autorizou ${prof.nome}`, em: agora }],
    }))
    soltarConfete({ x: e.clientX, y: e.clientY })
    toast(`Acesso autorizado para ${prof.nome}`)
    nav('/app/perfil')
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
      <input id="cod" className="campo campo--codigo" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Ex.: ANA-4821" />
      <AnimatePresence mode="wait">
        {prof ? (
          <motion.div key={prof.id} className="card prof-id" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <span className="avatar avatar--lilas">{prof.iniciais}</span>
            <div>
              <b>{prof.nome}</b>
              <p className="legenda">{prof.profissao} · {prof.registro} · <span style={{ color: 'var(--sucesso)', fontWeight: 600 }}>verificado</span></p>
            </div>
          </motion.div>
        ) : (
          <motion.p key="nada" className="legenda" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: 8 }}>
            {codigo.length >= 6 ? 'Código não encontrado. Confira com seu profissional. (Teste: ANA-4821 ou RAF-1020)' : 'Peça o código de convite ao seu profissional.'}
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

      <AnimatePresence>
        {confirmando && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <div className="dica-dose" style={{ marginTop: 14 }}>
              <Mascot expressao="neutro" size={36} flutuar={false} />
              <p>Por segurança, confirme sua senha para autorizar.</p>
            </div>
            <input className="campo" type="password" style={{ marginTop: 10 }} placeholder="Sua senha" value={senha} onChange={(e) => setSenha(e.target.value)} aria-label="Senha" autoFocus />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rodape-acao">
        {!confirmando ? (
          <button className="btn btn--primario btn--bloco" disabled={!prof || !mods.length} onClick={() => setConfirmando(true)}>
            Autorizar acesso
          </button>
        ) : (
          <button className="btn btn--turquesa btn--bloco" disabled={senha.length < 4} onClick={autorizar}>
            <Icon name="shield" size={20} /> Confirmar e autorizar
          </button>
        )}
      </div>
    </div>
  )
}
