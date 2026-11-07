import { useEffect, useState } from 'react'
import Icon from '../components/Icon'
import { useToast } from '../components/ui'
import { useStore } from '../data/store'
import { listarFotos } from '../lib/fotos'
import { erroPt, sb } from '../lib/supabase'
import FichaImpressa, { imprimirFicha } from '../painel/FichaImpressa'

/* "Imprimir minha ficha": a mesma ficha do painel, montada com os dados do próprio paciente.
   Na janela de impressão dá para salvar em PDF e enviar para quem quiser. */

type Dados = Parameters<typeof FichaImpressa>[0]

export default function BotaoMinhaFicha({ className = 'btn btn--contorno btn--bloco', style }: { className?: string; style?: React.CSSProperties }) {
  const { s } = useStore()
  const toast = useToast()
  const [dados, setDados] = useState<Dados | null>(null)
  const [ocupado, setOcupado] = useState(false)

  // depois que a ficha monta, abre a impressão
  useEffect(() => {
    if (!dados) return
    imprimirFicha(s.perfil.nome).finally(() => setOcupado(false))
  }, [dados]) // eslint-disable-line react-hooks/exhaustive-deps

  const preparar = async () => {
    if (!s.userId) return
    setOcupado(true)
    try {
      const [fotos, { data: assinaturas }] = await Promise.all([listarFotos(s.userId).catch(() => []), sb('app').from('assinaturas').select('*').order('criado_em', { ascending: false })])
      const p = s.perfil
      const consent = s.consentimentos.map((x) => ({ id: x.id, aceito_em: x.em, tipo: x.tipo, versao_texto: x.versao }))
      setDados({
        origem: 'paciente',
        s,
        perfil: {
          nome: p.nome, email: p.email, data_nascimento: p.nascimento || null, altura_cm: p.altura_cm || null, peso_inicial_kg: p.peso_inicial_kg || null,
          meta_peso_kg: p.meta_peso_kg || null, meta_proteina_g: p.meta_proteina_g, meta_agua_ml: p.meta_agua_ml, jornada: p.jornada || null,
          inicio_tratamento: p.inicio_tratamento || null, plano: p.plano, preferencias: p.preferencias, created_at: consent[0]?.aceito_em ?? null,
        },
        fotos: fotos.map((f) => ({ id: f.id, url: f.url, angulo: f.angulo, em: f.em })),
        extra: { consent, acessos: [], assinaturas: assinaturas ?? [], rotulos: s.alimentosRotulo.map((r) => ({ nome: r.nome })) },
      })
    } catch (e) {
      setOcupado(false)
      toast(erroPt(e), 'info')
    }
  }

  return (
    <>
      <button className={className} style={style} disabled={ocupado} onClick={() => (dados ? imprimirFicha(s.perfil.nome) : preparar())}>
        <Icon name="file" size={20} /> {ocupado ? 'Preparando a ficha…' : 'Imprimir minha ficha'}
      </button>
      {dados && <FichaImpressa {...dados} s={s} />}
    </>
  )
}
