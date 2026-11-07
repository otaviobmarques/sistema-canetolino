import logo from '../assets/domma.png'

/** Assinatura de quem desenvolveu o app. */
export default function Domma({ className = '' }: { className?: string }) {
  return (
    <div className={`assinatura-domma ${className}`}>
      <span>App desenvolvido pela</span>
      <img src={logo} alt="Domma Tecnologia" width={130} height={26} loading="lazy" />
    </div>
  )
}
