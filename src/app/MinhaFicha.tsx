import { useState } from 'react'
import Icon from '../components/Icon'
import { useToast } from '../components/ui'
import { useStore } from '../data/store'
import { erroPt, sb } from '../lib/supabase'
import { baixarFicha } from '../painel/relatorio'

/* "Minha ficha": a ficha completa em PDF (A4, com o Dose), gerada no servidor.
   Funciona em qualquer celular: no iPhone e no Android abre o menu para salvar, imprimir ou enviar. */
export default function BotaoMinhaFicha({ className = 'btn btn--contorno btn--bloco', style }: { className?: string; style?: React.CSSProperties }) {
  const { s } = useStore()
  const toast = useToast()
  const [ocupado, setOcupado] = useState(false)
  return (
    <button
      className={className}
      style={style}
      disabled={ocupado}
      onClick={async () => {
        setOcupado(true)
        try {
          await baixarFicha(sb('app'), null, s.perfil.nome)
        } catch (e) {
          toast(erroPt(e), 'info')
        } finally {
          setOcupado(false)
        }
      }}
    >
      <Icon name="file" size={20} /> {ocupado ? 'Gerando a ficha…' : 'Minha ficha em PDF'}
    </button>
  )
}
