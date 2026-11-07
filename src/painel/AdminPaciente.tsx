import type { SupabaseClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import GraficoPeso from '../components/GraficoPeso'
import Icon from '../components/Icon'
import Mascot from '../components/Mascot'
import FichaImpressa, { imprimirFicha } from './FichaImpressa'
import { baixarFicha } from './relatorio'
import { lerSaude } from '../data/nuvem'
import { calcularImc, LOCAL_LONGO, numerarAplicacoes, TIPOS_MEDIDA, vazio, type Estado } from '../data/store'
import { dataBR, dataHoraBR, DIAS_LONGOS, num } from '../lib/datas'
import { formatarDose, ordinal } from '../lib/dose'
import { erroPt } from '../lib/supabase'
import { Cabecalho } from './Layout'

/* Admin · tudo o que o paciente registrou, só leitura.
   Cada abertura fica no histórico de acessos que o próprio paciente vê no app. */

type Perfil = Record<string, unknown>
type Foto = { id: string; url: string; angulo: string; em: string }
type Linha = Record<string, unknown>
/** a tela pode montar duas vezes ao abrir: um registro por paciente por minuto basta */
const ultimoRegistro = new Map<string, number>()

function Secao({ titulo, children, vazio: semDados }: { titulo: string; children: ReactNode; vazio?: boolean }) {
  return (
    <motion.section className="p-card ficha__secao" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 16 }}>
      <h3>{titulo}</h3>
      {semDados ? <p className="p-cinza">Nada registrado.</p> : children}
    </motion.section>
  )
}

export default function AdminPaciente({ c }: { c: SupabaseClient }) {
  const { id = '' } = useParams()
  const [s, setS] = useState<Estado | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [fotos, setFotos] = useState<Foto[]>([])
  const [extra, setExtra] = useState<{ consent: Linha[]; acessos: Linha[]; assinaturas: Linha[]; rotulos: Linha[] }>({ consent: [], acessos: [], assinaturas: [], rotulos: [] })
  const [erro, setErro] = useState('')
  const registrado = useRef('')
  const [imprimindo, setImprimindo] = useState(false)
  const [baixando, setBaixando] = useState(false)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        // registra antes de ler (uma vez por abertura): o paciente vê este acesso no histórico dele
        if (registrado.current !== id && Date.now() - (ultimoRegistro.get(id) ?? 0) > 60000) {
          registrado.current = id
          ultimoRegistro.set(id, Date.now())
          const { error: ea } = await c.rpc('admin_registrar_acesso', { p_paciente: id, p_acao: 'Visualizou seus registros (painel administrativo)' })
          if (ea) throw ea
        }
        const [saude, { data: pr }, { data: ph }, { data: consent }, { data: acessos }, { data: assinaturas }, { data: rotulos }] = await Promise.all([
          lerSaude(c, id, vazio()),
          c.from('profiles').select('*').eq('user_id', id).maybeSingle(),
          c.from('progress_photos').select('*').eq('user_id', id).order('registrado_em'),
          c.from('consent_records').select('*').eq('user_id', id).order('aceito_em'),
          c.from('audit_logs').select('*').eq('paciente_id', id).order('em', { ascending: false }).limit(30),
          c.from('assinaturas').select('*').eq('user_id', id).order('criado_em', { ascending: false }),
          c.from('user_foods').select('*').eq('user_id', id),
        ])
        let lista: Foto[] = []
        if (ph?.length) {
          const { data: urls } = await c.storage.from('evolucao').createSignedUrls(ph.map((f) => f.caminho as string), 900)
          lista = ph.map((f, i) => ({ id: f.id, url: urls?.[i]?.signedUrl ?? '', angulo: f.angulo, em: f.registrado_em }))
        }
        if (!vivo) return
        setS(saude)
        setPerfil(pr ?? {})
        setFotos(lista)
        setExtra({ consent: consent ?? [], acessos: acessos ?? [], assinaturas: assinaturas ?? [], rotulos: rotulos ?? [] })
      } catch (e) {
        if (vivo) setErro(erroPt(e))
      }
    })()
    return () => {
      vivo = false
    }
  }, [c, id])

  const imprimir = async () => {
    setImprimindo(true)
    await c.rpc('admin_registrar_acesso', { p_paciente: id, p_acao: 'Imprimiu a ficha (painel administrativo)' })
    setImprimindo(false)
    await imprimirFicha(String(perfil?.nome ?? 'paciente'))
  }

  if (erro) return <><Link to="/admin/usuarios" className="p-voltar">← Usuários</Link><div className="p-aviso">{erro}</div></>
  if (!s || !perfil) return <div className="p-carregando"><Mascot expressao="pensativo" size={100} /></div>

  const pesos = [...s.pesos].sort((a, b) => +new Date(a.em) - +new Date(b.em))
  const apl = [...s.aplicacoes].sort((a, b) => +new Date(b.em) - +new Date(a.em))
  const numeros = numerarAplicacoes(s.aplicacoes)
  const refeicoes = [...s.refeicoes].sort((a, b) => +new Date(b.em) - +new Date(a.em))
  const aguaDia = new Map<string, number>()
  for (const a of s.agua) aguaDia.set(dataBR(a.em), (aguaDia.get(dataBR(a.em)) ?? 0) + a.ml)
  const cfg = (perfil.config ?? {}) as { fotosLocal?: boolean }
  const p = (k: string) => (perfil[k] == null || perfil[k] === '' ? '—' : String(perfil[k]))

  return (
    <>
      <Link to="/admin/usuarios" className="p-voltar">← Usuários</Link>
      <Cabecalho titulo={p('nome')} sub={`${p('email')} · plano ${perfil.plano === 'premium' ? 'Premium' : 'Básico'} · este acesso aparece no histórico do paciente`}>
        <button className="btn btn--contorno btn--pequeno" disabled={baixando} onClick={async () => { setBaixando(true); try { await baixarFicha(c, id, String(perfil?.nome ?? 'paciente')) } catch (e) { setErro(erroPt(e)) } finally { setBaixando(false) } }}>
          <Icon name="download" size={16} /> {baixando ? 'Gerando PDF…' : 'Baixar PDF'}
        </button>
        <button className="btn btn--primario btn--pequeno" disabled={imprimindo} onClick={imprimir}>
          <Icon name="file" size={16} /> {imprimindo ? 'Preparando…' : 'Imprimir ficha'}
        </button>
      </Cabecalho>
      <FichaImpressa s={s} perfil={perfil} fotos={fotos} extra={extra} />

      <div className="p-kpis admin-kpis5">
        {[
          { r: 'Aplicações', v: String(apl.length), s: apl[0] ? `última em ${dataBR(apl[0].em)}` : 'nenhuma' },
          { r: 'Peso', v: pesos.length ? `${num(pesos[pesos.length - 1].kg)} kg` : '—', s: pesos.length > 1 ? `${pesos[pesos.length - 1].kg - pesos[0].kg < 0 ? '−' : '+'}${num(Math.abs(pesos[pesos.length - 1].kg - pesos[0].kg))} kg desde ${dataBR(pesos[0].em)}` : `${pesos.length} pesagem` },
          (() => {
            const atual = calcularImc(pesos[pesos.length - 1]?.kg, Number(perfil.altura_cm))
            const inicial = calcularImc(pesos[0]?.kg ?? Number(perfil.peso_inicial_kg), Number(perfil.altura_cm))
            return { r: 'IMC', v: atual ? num(atual.valor) : '—', s: atual ? `${atual.faixa}${inicial ? ` · início ${num(inicial.valor)}` : ''}` : 'sem altura ou peso' }
          })(),
          { r: 'Refeições', v: String(refeicoes.length), s: `${refeicoes.filter((r) => r.origem === 'ia_estimativa').length} pela IA` },
          { r: 'Sintomas', v: String(s.sintomas.length), s: `${s.sintomas.filter((x) => x.alerta).length} com alerta` },
        ].map((k) => (
          <div key={k.r} className="p-kpi"><span className="p-cinza">{k.r}</span><b>{k.v}</b><small>{k.s}</small></div>
        ))}
      </div>

      <Secao titulo="Cadastro">
        <table className="p-tabela p-tabela--simples"><tbody>
          <tr><td>Nascimento</td><td>{perfil.data_nascimento ? dataBR(`${perfil.data_nascimento}T12:00:00`) : '—'}</td><td>Altura</td><td>{p('altura_cm')} cm</td></tr>
          <tr><td>Peso inicial</td><td>{p('peso_inicial_kg')} kg</td><td>Meta de peso</td><td>{p('meta_peso_kg')} kg</td></tr>
          <tr><td>Meta de proteína</td><td>{p('meta_proteina_g')} g</td><td>Meta de água</td><td>{perfil.meta_agua_ml ? `${num(Number(perfil.meta_agua_ml) / 1000)} L` : '—'}</td></tr>
          <tr><td>Jornada</td><td>{perfil.jornada === 'em_tratamento' ? 'Já em tratamento' : perfil.jornada === 'comecando' ? 'Começando' : '—'}</td><td>Início do tratamento</td><td>{perfil.inicio_tratamento ? dataBR(`${perfil.inicio_tratamento}T12:00:00`) : '—'}</td></tr>
          <tr><td>Preferências</td><td colSpan={3}>{((perfil.preferencias as string[]) ?? []).join(', ') || '—'}</td></tr>
          <tr><td>Cadastro</td><td>{perfil.created_at ? dataBR(String(perfil.created_at)) : '—'}</td><td>Fuso</td><td>{p('fuso')}</td></tr>
        </tbody></table>
      </Secao>

      <Secao titulo="Medicamento e aplicações" vazio={!s.medicamento && !apl.length}>
        {s.medicamento && (
          <p className="p-cinza">
            {s.medicamento.principio}{s.medicamento.nome_comercial ? ` (${s.medicamento.nome_comercial})` : ''} · dose da receita: {formatarDose(s.medicamento.dose_texto)} · {DIAS_LONGOS[s.medicamento.dia_semana]}, {s.medicamento.horario}
          </p>
        )}
        <table className="p-tabela p-tabela--simples"><tbody>
          {apl.map((a) => (
            <tr key={a.id}><td><b>{ordinal(numeros.get(a.id) ?? 0)}</b> · {dataHoraBR(a.em)}</td><td>{a.dose ? formatarDose(a.dose) : '—'}</td><td>{a.local ? LOCAL_LONGO[a.local] : 'local não informado'}</td><td className="p-cinza">{[a.obs, a.retroativo && 'registrada depois'].filter(Boolean).join(' · ')}</td></tr>
          ))}
        </tbody></table>
      </Secao>

      <Secao titulo="Peso e medidas" vazio={!pesos.length && !s.medidas.length}>
        {pesos.length > 1 && <div className="admin-grafico"><GraficoPeso pontos={pesos.map((x) => x.kg)} altura={140} /></div>}
        <table className="p-tabela p-tabela--simples"><tbody>
          {[...pesos].reverse().map((x) => <tr key={x.id}><td>{dataBR(x.em)}</td><td>{num(x.kg)} kg</td><td className="p-cinza">{x.retroativo ? 'registrado depois' : ''}</td></tr>)}
          {[...s.medidas].sort((a, b) => +new Date(b.em) - +new Date(a.em)).map((m) => <tr key={m.id}><td>{dataBR(m.em)}</td><td>{TIPOS_MEDIDA.find((t) => t.id === m.tipo)?.nome}: {num(m.cm)} cm</td><td /></tr>)}
        </tbody></table>
      </Secao>

      <Secao titulo="Alimentação e água" vazio={!refeicoes.length && !aguaDia.size}>
        <table className="p-tabela p-tabela--simples"><tbody>
          {refeicoes.map((r) => (
            <tr key={r.id}><td>{dataHoraBR(r.em)}</td><td><b>{r.tipo}</b>: {r.itens.map((i) => `${i.nome} (${i.porcao_texto})`).join(', ')}</td><td>{Math.round(r.itens.reduce((t, i) => t + i.proteina_g, 0))} g prot.</td><td className="p-cinza">{r.origem === 'ia_estimativa' ? 'IA, conferido' : 'manual'}</td></tr>
          ))}
          {[...aguaDia].map(([d, ml]) => <tr key={d}><td>{d}</td><td>Água: {num(ml / 1000)} L</td><td /><td /></tr>)}
        </tbody></table>
        {extra.rotulos.length > 0 && <p className="p-cinza" style={{ marginTop: 8 }}>Alimentos de rótulo cadastrados: {extra.rotulos.map((r) => r.nome as string).join(', ')}</p>}
      </Secao>

      <Secao titulo="Sintomas" vazio={!s.sintomas.length}>
        <table className="p-tabela p-tabela--simples"><tbody>
          {[...s.sintomas].reverse().map((x) => <tr key={x.id}><td>{dataHoraBR(x.em)}</td><td>{x.sintomas.join(', ')}</td><td>intensidade {x.intensidade}/5</td><td className="p-cinza">{[x.alerta && 'alerta mostrado', x.obs].filter(Boolean).join(' · ')}</td></tr>)}
        </tbody></table>
      </Secao>

      <Secao titulo="Bem-estar, sono e treinos" vazio={!s.bemestar.length && !s.treinos.length}>
        <table className="p-tabela p-tabela--simples"><tbody>
          {[...s.bemestar].reverse().map((b) => <tr key={b.id}><td>{dataBR(b.em)}</td><td>Sono {b.sono_horas ?? '—'} h · qualidade {b.sono_qualidade ?? '—'}/5 · humor {b.humor ?? '—'}/5 · energia {b.energia ?? '—'}/5 · fome {b.fome ?? '—'}/5</td><td className="p-cinza">{b.obs ?? ''}</td></tr>)}
          {[...s.treinos].reverse().map((t) => <tr key={t.id}><td>{dataBR(t.em)}</td><td>Treino: {t.tipo} · {t.duracao_min} min{t.forca ? ' · força' : ''}</td><td /></tr>)}
        </tbody></table>
      </Secao>

      <Secao titulo="Canetas e gastos" vazio={!s.canetas.length && !s.compras.length}>
        <table className="p-tabela p-tabela--simples"><tbody>
          {s.canetas.map((k) => <tr key={k.id}><td>Estoque</td><td>{k.quantidade} · validade {k.validade || '—'}</td><td /></tr>)}
          {s.compras.map((k) => <tr key={k.id}><td>{dataBR(k.em)}</td><td>Compra de {k.quantidade}</td><td>{(k.valor_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>)}
        </tbody></table>
      </Secao>

      <Secao titulo="Fotos de evolução">
        {fotos.length ? (
          <div className="admin-fotos">
            {fotos.map((f) => (
              <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="admin-foto">
                <img src={f.url} alt={`Foto de ${f.angulo} em ${dataBR(f.em)}`} />
                <span>{f.angulo} · {dataBR(f.em)}</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="p-cinza">Nenhuma foto na nuvem.</p>
        )}
        {cfg.fotosLocal !== false && <p className="p-cinza" style={{ marginTop: 8 }}>Este paciente tinha fotos guardadas só no aparelho (opção antiga). Elas sobem para a nuvem e aparecem aqui na próxima vez que ele abrir o app.</p>}
      </Secao>

      <Secao titulo="Assinatura, consentimentos e acessos">
        <table className="p-tabela p-tabela--simples"><tbody>
          {extra.assinaturas.map((a) => <tr key={a.id as string}><td>{dataBR(a.criado_em as string)}</td><td>Assinatura {a.plano as string} {a.periodo as string} · {a.gateway as string} ({a.modo as string})</td><td>{a.status as string}</td></tr>)}
          {extra.consent.map((x) => <tr key={x.id as string}><td>{dataBR(x.aceito_em as string)}</td><td>Consentimento: {x.tipo as string} ({x.versao_texto as string})</td><td /></tr>)}
          {extra.acessos.map((x) => <tr key={String(x.id)}><td>{dataHoraBR(x.em as string)}</td><td>{x.ator_nome as string}: {x.acao as string}</td><td /></tr>)}
        </tbody></table>
      </Secao>
    </>
  )
}
