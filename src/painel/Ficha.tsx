import type { SupabaseClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import GraficoPeso from '../components/GraficoPeso'
import Icon from '../components/Icon'
import Mascot from '../components/Mascot'
import { useToast } from '../components/ui'
import { lerSaude } from '../data/nuvem'
import { LOCAL_LONGO, MODULOS, TIPOS_MEDIDA, vazio, type Estado, type Modulo } from '../data/store'
import { DIA_MS, dataBR, dataCurta, diasEntre, horaBR, inicioDoDia, mesmoDia, num } from '../lib/datas'
import { erroPt } from '../lib/supabase'
import { baixarRelatorio } from './relatorio'

type Linha = { paciente_id: string; nome: string; peso_inicial_kg: number | null; meta_proteina_g: number; meta_agua_ml: number; modulos: Modulo[]; expira_em: string | null }

/** Ficha completa do paciente: só os módulos autorizados (o banco não devolve o resto). */
export default function Ficha({ c }: { c: SupabaseClient }) {
  const { id } = useParams()
  const toast = useToast()
  const [info, setInfo] = useState<Linha | null | undefined>(undefined)
  const [s, setS] = useState<Estado | null>(null)
  const [dias, setDias] = useState(30)
  const [baixando, setBaixando] = useState(false)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data, error } = await c.rpc('pacientes_do_profissional')
      if (error) return vivo && setInfo(null)
      const l = ((data ?? []) as Linha[]).find((x) => x.paciente_id === id) ?? null
      if (!vivo) return
      setInfo(l)
      if (!l) return
      const base = vazio()
      const est = await lerSaude(c, l.paciente_id, { ...base, perfil: { ...base.perfil, nome: l.nome, peso_inicial_kg: Number(l.peso_inicial_kg ?? 0), meta_proteina_g: l.meta_proteina_g, meta_agua_ml: l.meta_agua_ml } })
      if (vivo) setS(est)
      await c.rpc('registrar_acesso', { p_paciente: l.paciente_id, p_acao: 'Abriu a ficha completa' })
    })()
    return () => {
      vivo = false
    }
  }, [c, id])

  const desde = useMemo(() => inicioDoDia(Date.now() - (dias - 1) * DIA_MS), [dias])
  const no = <T extends { em: string }>(l: T[]) => l.filter((x) => new Date(x.em) >= desde).sort((a, b) => +new Date(a.em) - +new Date(b.em))

  if (info === undefined || (info && !s)) return <div className="p-carregando"><Mascot expressao="pensativo" size={100} /></div>
  if (!info || !s)
    return (
      <div className="p-bloqueado">
        <Mascot expressao="alerta" size={110} />
        <h2>Sem acesso a este paciente</h2>
        <p>O acesso pode ter sido revogado ou expirado. Peça ao paciente para autorizar de novo no app.</p>
        <Link to="/pro" className="btn btn--primario">Voltar aos pacientes</Link>
      </div>
    )

  const m = info.modulos
  const pesos = no(s.pesos)
  const refeicoes = no(s.refeicoes)
  const aplicacoes = no(s.aplicacoes)
  const sintomas = no(s.sintomas)
  const bem = no(s.bemestar)
  const treinos = no(s.treinos)
  const diasLista = Array.from({ length: Math.min(dias, 30) }, (_, i) => new Date(inicioDoDia().getTime() - (Math.min(dias, 30) - 1 - i) * DIA_MS))
  const protDia = diasLista.map((d) => ({ d, g: s.refeicoes.filter((r) => mesmoDia(r.em, d)).reduce((t, r) => t + r.itens.reduce((a, i) => a + i.proteina_g, 0), 0) }))
  const comRegistro = protDia.filter((x) => x.g > 0)
  const mediaProt = comRegistro.length ? Math.round(comRegistro.reduce((t, x) => t + x.g, 0) / comRegistro.length) : 0
  const estimadas = refeicoes.filter((r) => r.origem === 'ia_estimativa').length
  const ultimaApl = (em: string) => [...s.aplicacoes].filter((a) => new Date(a.em) <= new Date(em)).sort((a, b) => +new Date(b.em) - +new Date(a.em))[0]
  const media = (xs: (number | undefined)[]) => {
    const v = xs.filter((x): x is number => typeof x === 'number')
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
  }

  return (
    <>
      <header className="p-cab">
        <div>
          <Link to="/pro" className="p-voltar"><Icon name="back" size={16} /> Pacientes</Link>
          <h1>{info.nome || 'Paciente'}</h1>
          <p>Autorizou: {m.map((x) => MODULOS.find((y) => y.id === x)!.nome.toLowerCase()).join(', ')} · acesso até {info.expira_em ? dataBR(info.expira_em) : 'o paciente revogar'}</p>
        </div>
        <div className="p-cab__acoes">
          <div className="p-periodo" role="radiogroup" aria-label="Período">
            {[30, 90, 365].map((d) => (
              <button key={d} role="radio" aria-checked={dias === d} className={dias === d ? 'is-on' : ''} onClick={() => setDias(d)}>{d === 365 ? '1 ano' : `${d} dias`}</button>
            ))}
          </div>
          <button
            className="btn btn--primario"
            disabled={baixando}
            onClick={async () => {
              setBaixando(true)
              try {
                await baixarRelatorio(c, info.paciente_id, dias, info.nome)
              } catch (e) {
                toast(erroPt(e), 'info')
              } finally {
                setBaixando(false)
              }
            }}
          >
            <Icon name="download" size={18} /> {baixando ? 'Gerando…' : 'Relatório em PDF'}
          </button>
        </div>
      </header>

      <div className="ficha">
        {m.includes('peso') && (
          <Secao titulo="Peso e medidas" i={0}>
            {pesos.length > 1 ? <GraficoPeso pontos={pesos.map((p) => p.kg)} altura={150} /> : <p className="p-cinza">{pesos.length === 1 ? `Um registro: ${num(pesos[0].kg)} kg em ${dataBR(pesos[0].em)}.` : 'Sem pesagens no período.'}</p>}
            {pesos.length > 1 && (
              <p className="p-cinza">{num(pesos[0].kg)} kg em {dataBR(pesos[0].em)} → {num(pesos[pesos.length - 1].kg)} kg em {dataBR(pesos[pesos.length - 1].em)} ({pesos[pesos.length - 1].kg <= pesos[0].kg ? '−' : '+'}{num(Math.abs(pesos[pesos.length - 1].kg - pesos[0].kg))} kg)</p>
            )}
            <table className="p-tabela p-tabela--simples">
              <tbody>
                {TIPOS_MEDIDA.map((t) => {
                  const l = s.medidas.filter((x) => x.tipo === t.id).sort((a, b) => +new Date(a.em) - +new Date(b.em))
                  if (!l.length) return null
                  const d = l[l.length - 1].cm - l[0].cm
                  return (
                    <tr key={t.id}>
                      <td>{t.nome}</td>
                      <td><b>{num(l[l.length - 1].cm)} cm</b> <span className="p-cinza">em {dataBR(l[l.length - 1].em)}</span></td>
                      <td className="p-cinza">{l.length > 1 ? `${d <= 0 ? '−' : '+'}${num(Math.abs(d))} cm desde ${dataBR(l[0].em)}` : 'um registro'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Secao>
        )}

        {m.includes('nutricao') && (
          <Secao titulo="Alimentação e proteína" i={1}>
            <div className="p-mini-kpis">
              <div><small>Proteína média</small><b>{mediaProt ? `${mediaProt} g/dia` : '—'}</b></div>
              <div><small>Dias na meta ({info.meta_proteina_g} g)</small><b>{comRegistro.filter((x) => x.g >= info.meta_proteina_g * 0.95).length} de {comRegistro.length}</b></div>
              <div><small>Refeições</small><b>{refeicoes.length}</b></div>
              <div><small>Estimadas pela IA</small><b>{estimadas}</b></div>
            </div>
            <Barras dados={protDia.map((x) => ({ rotulo: dataCurta(x.d).split(',')[0], valor: x.g }))} meta={info.meta_proteina_g} />
            <table className="p-tabela p-tabela--simples">
              <tbody>
                {[...refeicoes].reverse().slice(0, 12).map((r) => (
                  <tr key={r.id}>
                    <td>{dataCurta(r.em)} · {horaBR(r.em)}</td>
                    <td>{r.tipo}: {r.itens.map((i) => i.nome).join(', ')}</td>
                    <td><b>{Math.round(r.itens.reduce((a, i) => a + i.proteina_g, 0))} g</b> {r.origem === 'ia_estimativa' && <span className="selo selo--lilas">IA</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secao>
        )}

        {m.includes('aplicacoes') && (
          <Secao titulo="Aplicações" i={2}>
            {s.medicamento && <p className="p-cinza">{s.medicamento.principio}{s.medicamento.nome_comercial ? ` (${s.medicamento.nome_comercial})` : ''} · dose da receita: {s.medicamento.dose_texto} · dia de aplicação: {['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][s.medicamento.dia_semana]}, {s.medicamento.horario}</p>}
            <p className="p-cinza">{aplicacoes.length} registradas no período · cerca de {Math.max(1, Math.round(dias / 7))} previstas (semanal)</p>
            <table className="p-tabela p-tabela--simples">
              <tbody>
                {[...aplicacoes].reverse().map((a) => (
                  <tr key={a.id}><td>{dataCurta(a.em)} · {horaBR(a.em)}</td><td>{LOCAL_LONGO[a.local]}</td><td className="p-cinza">{a.obs ?? ''}</td></tr>
                ))}
              </tbody>
            </table>
          </Secao>
        )}

        {m.includes('sintomas') && (
          <Secao titulo="Sintomas" i={3}>
            {sintomas.length === 0 ? <p className="p-cinza">Nenhum sintoma registrado no período.</p> : (
              <table className="p-tabela p-tabela--simples">
                <tbody>
                  {[...sintomas].reverse().map((x) => {
                    const ap = ultimaApl(x.em)
                    return (
                      <tr key={x.id}>
                        <td>{dataCurta(x.em)}</td>
                        <td>{x.sintomas.join(', ')} {x.alerta && <span className="selo selo--alerta">alerta</span>}</td>
                        <td>intensidade {x.intensidade}/5</td>
                        <td className="p-cinza">{ap ? `${diasEntre(ap.em, x.em)} dia(s) após a aplicação` : ''}{x.obs ? ` · ${x.obs}` : ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Secao>
        )}

        {m.includes('bemestar') && (
          <Secao titulo="Bem-estar, sono e treinos" i={4}>
            <div className="p-mini-kpis">
              <div><small>Sono médio</small><b>{media(bem.map((b) => b.sono_horas)) != null ? `${num(media(bem.map((b) => b.sono_horas))!)} h` : '—'}</b></div>
              <div><small>Humor médio</small><b>{media(bem.map((b) => b.humor)) != null ? `${num(media(bem.map((b) => b.humor))!)} / 5` : '—'}</b></div>
              <div><small>Fome média</small><b>{media(bem.map((b) => b.fome)) != null ? `${num(media(bem.map((b) => b.fome))!)} / 5` : '—'}</b></div>
              <div><small>Treinos de força</small><b>{treinos.filter((t) => t.forca).length}</b></div>
            </div>
            <table className="p-tabela p-tabela--simples">
              <tbody>
                {[...treinos].reverse().slice(0, 10).map((t) => (
                  <tr key={t.id}><td>{dataCurta(t.em)}</td><td>{t.tipo}</td><td>{t.duracao_min} min{t.forca ? ' · força' : ''}</td></tr>
                ))}
              </tbody>
            </table>
          </Secao>
        )}
      </div>
      <p className="legenda" style={{ marginTop: 16 }}>Dados registrados pelo paciente. Refeições marcadas com IA foram estimadas e conferidas por ele; os nutrientes vêm das tabelas TACO, TBCA, POF/IBGE, USDA, CoFID, Ciqual, CNF, AFCD, Frida ou Fineli. Este acesso fica no histórico do paciente.</p>
    </>
  )
}

function Secao({ titulo, i, children }: { titulo: string; i: number; children: React.ReactNode }) {
  return (
    <motion.section className="p-card ficha__secao" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
      <h3>{titulo}</h3>
      {children}
    </motion.section>
  )
}

function Barras({ dados, meta }: { dados: { rotulo: string; valor: number }[]; meta: number }) {
  const max = Math.max(meta * 1.2, ...dados.map((d) => d.valor), 1)
  return (
    <div className="p-barras p-barras--dias" aria-label="Proteína por dia">
      <span className="p-barras__meta" style={{ bottom: `${(meta / max) * 100}%` }}>meta</span>
      {dados.map((d, i) => (
        <div key={i} className="p-barras__col" title={`${d.rotulo}: ${Math.round(d.valor)} g`}>
          <motion.i initial={{ height: 0 }} animate={{ height: `${(d.valor / max) * 100}%` }} transition={{ delay: i * 0.015, duration: 0.5 }} className={d.valor >= meta * 0.95 ? 'is-ult' : ''} />
        </div>
      ))}
    </div>
  )
}
