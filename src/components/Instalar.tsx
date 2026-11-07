import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useInstalar } from '../lib/instalar'
import Icon from './Icon'
import Mascot from './Mascot'
import { Modal } from './ui'

/** Botão "Instalar o app": instala direto onde o navegador permite e explica o passo a passo no iPhone. Some quando já está instalado. */
export default function BotaoInstalar({ className = 'btn btn--fantasma', texto = 'Instalar o app', style }: { className?: string; texto?: string; style?: React.CSSProperties }) {
  const { instalado, direto, ios, instalar } = useInstalar()
  const [ajuda, setAjuda] = useState(false)
  if (instalado || (!direto && !ios)) return null
  return (
    <>
      <button type="button" className={className} style={style} onClick={() => (direto ? instalar() : setAjuda(true))}>
        <Icon name="download" size={18} /> {texto}
      </button>
      {createPortal(
      <Modal aberto={ajuda} onFechar={() => setAjuda(false)}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><Mascot expressao="acenando" size={84} /></div>
        <h3 style={{ textAlign: 'center' }}>Coloque o Canetolino na tela de início</h3>
        <ol className="passos-instalar">
          <li>Abra este site no <b>Safari</b>.</li>
          <li>Toque em <b>Compartilhar</b> <span aria-hidden>(o quadrado com a seta para cima)</span>.</li>
          <li>Escolha <b>Adicionar à Tela de Início</b> e toque em <b>Adicionar</b>.</li>
        </ol>
        <p className="legenda" style={{ textAlign: 'center' }}>Pronto: o Dose aparece como um app, abre em tela cheia e pode te mandar lembretes.</p>
        <button className="btn btn--primario btn--bloco" style={{ marginTop: 14 }} onClick={() => setAjuda(false)}>Entendi</button>
      </Modal>,
      document.body,
      )}
    </>
  )
}
