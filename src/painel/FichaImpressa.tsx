import { createPortal } from 'react-dom'
import GraficoPeso from '../components/GraficoPeso'
import Mascot from '../components/Mascot'
import { calcularImc, evolucaoPeso, LOCAL_LONGO, numerarAplicacoes, textoTotalPeso, TIPOS_MEDIDA, type Estado } from '../data/store'
import { dataBR, dataHoraBR, DIAS_LONGOS, num } from '../lib/datas'
import { formatarDose, ordinal } from '../lib/dose'
import '../styles/ficha-impressa.css'

/* Ficha do paciente para imprimir (A4), com a cara do Canetolino.
   Fica escondida na tela; ao imprimir, só ela aparece (classe `imprimindo` no <body>).
   Linhas de tabela e blocos nunca quebram entre páginas. */

type Linha = Record<string, unknown>

/** Abre a impressão só da ficha: espera as fotos carregarem, dá nome ao arquivo e limpa tudo ao terminar. */
export async function imprimirFicha(nome: string) {
  await Promise.all([...document.querySelectorAll<HTMLImageElement>('.impressao img')].map((img) => (img.complete ? null : new Promise((ok) => { img.onload = img.onerror = ok }))))
  const original = document.title
  document.title = `Ficha ${nome || 'paciente'} - Canetolino`
  document.body.classList.add('imprimindo')
  const fim = () => {
    document.body.classList.remove('imprimindo')
    document.title = original
    window.removeEventListener('afterprint', fim)
  }
  window.addEventListener('afterprint', fim)
  await new Promise((ok) => setTimeout(ok, 50))
  window.print()
}
type Props = { origem?: 'admin' | 'paciente'; s: Estado; perfil: Linha; fotos: { id: string; url: string; angulo: string; em: string }[]; extra: { consent: Linha[]; acessos: Linha[]; assinaturas: Linha[]; rotulos: Linha[] } }

export default function FichaImpressa({ s, perfil, fotos, extra, origem = 'admin' }: Props) {
  const est: Estado = { ...s, perfil: { ...s.perfil, peso_inicial_kg: Number(perfil.peso_inicial_kg ?? 0), inicio_tratamento: (perfil.inicio_tratamento as string) ?? '', altura_cm: Number(perfil.altura_cm ?? 0) } }
  const evo = evolucaoPeso(est)
  const altura = Number(perfil.altura_cm ?? 0)
  const imcAtual = calcularImc(evo.atual?.kg, altura)
  const imcInicio = calcularImc(evo.inicial?.kg, altura)
  const apl = [...s.aplicacoes].sort((a, b) => +new Date(a.em) - +new Date(b.em))
  const numeros = numerarAplicacoes(s.aplicacoes)
  const pesos = [...s.pesos].sort((a, b) => +new Date(a.em) - +new Date(b.em))
  const refeicoes = [...s.refeicoes].sort((a, b) => +new Date(b.em) - +new Date(a.em))
  const aguaDia = new Map<string, number>()
  for (const a of s.agua) aguaDia.set(dataBR(a.em), (aguaDia.get(dataBR(a.em)) ?? 0) + a.ml)
  const nasc = perfil.data_nascimento ? new Date(`${perfil.data_nascimento}T12:00:00`) : null
  const idade = nasc ? Math.floor((Date.now() - +nasc) / (365.25 * 86400000)) : null
  const t = (k: string) => (perfil[k] == null || perfil[k] === '' ? '—' : String(perfil[k]))

  return createPortal(
    <div className="impressao" aria-hidden>

      <header className="imp-topo">
        <div>
          <div className="imp-logo">canetolino</div>
          <h1>Ficha do paciente</h1>
          <p>{t('nome')} · {t('email')}</p>
          <p className="imp-gerado">Gerada em {dataHoraBR(new Date())}{origem === 'paciente' ? ' pelo próprio paciente' : ''} · documento com dados de saúde, uso restrito (LGPD)</p>
        </div>
        <div className="imp-dose"><Mascot expressao="feliz" size={92} flutuar={false} /></div>
      </header>

      <section className="imp-dados bloco">
        {[
          ['Idade', idade !== null ? `${idade} anos` : '—'],
          ['Altura', altura ? `${num(altura / 100, 2)} m` : '—'],
          ['Jornada', perfil.jornada === 'em_tratamento' ? 'Já em tratamento' : perfil.jornada === 'comecando' ? 'Começando' : '—'],
          ['Início do tratamento', evo.inicial ? dataBR(evo.inicial.em) : '—'],
          ['Plano', perfil.plano === 'premium' ? 'Premium' : 'Básico'],
          ['Cadastro', perfil.created_at ? dataBR(String(perfil.created_at)) : '—'],
          ['Meta de peso', perfil.meta_peso_kg ? `${num(Number(perfil.meta_peso_kg))} kg` : '—'],
          ['Metas diárias', `${t('meta_proteina_g')} g de proteína · ${perfil.meta_agua_ml ? num(Number(perfil.meta_agua_ml) / 1000) : '—'} L de água`],
        ].map(([r, v]) => (
          <div key={r}><span>{r}</span><b>{v}</b></div>
        ))}
      </section>

      <section className="imp-kpis bloco">
        <div><span>Peso atual</span><b>{evo.atual ? `${num(evo.atual.kg)} kg` : '—'}</b><small>{evo.atual ? dataBR(evo.atual.em) : 'sem pesagem'}</small></div>
        <div className={evo.total !== null && evo.total < 0 ? 'is-bom' : ''}><span>Desde o início</span><b>{evo.total !== null ? textoTotalPeso(evo.total) : '—'}</b><small>{evo.inicial ? `${num(evo.inicial.kg)} kg em ${dataBR(evo.inicial.em)}` : ''}</small></div>
        <div><span>IMC</span><b>{imcAtual ? num(imcAtual.valor) : '—'}</b><small>{imcAtual ? `${imcAtual.faixa}${imcInicio ? ` · início ${num(imcInicio.valor)}` : ''}` : 'sem altura ou peso'}</small></div>
        <div><span>Aplicações</span><b>{apl.length}</b><small>{apl.length ? `última em ${dataBR(apl[apl.length - 1].em)}` : 'nenhuma'}</small></div>
      </section>

      <h2>Medicamento e aplicações</h2>
      {s.medicamento && (
        <p className="imp-nota bloco">
          {s.medicamento.principio}{s.medicamento.nome_comercial ? ` (${s.medicamento.nome_comercial})` : ''} · dose da receita: {formatarDose(s.medicamento.dose_texto)} · aplicação {DIAS_LONGOS[s.medicamento.dia_semana]}, às {s.medicamento.horario}
        </p>
      )}
      {apl.length ? (
        <table className="imp-tabela">
          <thead><tr><th>Nº</th><th>Data</th><th>Dose</th><th>Local</th><th>Observação</th></tr></thead>
          <tbody>
            {apl.map((a) => (
              <tr key={a.id}><td><b>{ordinal(numeros.get(a.id) ?? 0)}</b></td><td>{dataHoraBR(a.em)}</td><td>{a.dose ? formatarDose(a.dose) : '—'}</td><td>{a.local ? LOCAL_LONGO[a.local] : 'não informado'}</td><td>{[a.obs, a.retroativo && 'registrada depois'].filter(Boolean).join(' · ')}</td></tr>
            ))}
          </tbody>
        </table>
      ) : <p className="imp-vazio">Nenhuma aplicação registrada.</p>}

      <h2>Peso e medidas</h2>
      {evo.serie.length > 1 && <div className="imp-grafico bloco"><GraficoPeso pontos={evo.serie} ultimaSemana={evo.semanaFinal} altura={130} estatico /></div>}
      {pesos.length ? (
        <table className="imp-tabela imp-tabela--metade">
          <thead><tr><th>Data</th><th>Peso</th><th>IMC</th><th></th></tr></thead>
          <tbody>
            {pesos.map((p) => {
              const i = calcularImc(p.kg, altura)
              return <tr key={p.id}><td>{dataBR(p.em)}</td><td><b>{num(p.kg)} kg</b></td><td>{i ? num(i.valor) : '—'}</td><td>{p.retroativo ? 'registrado depois' : ''}</td></tr>
            })}
          </tbody>
        </table>
      ) : <p className="imp-vazio">Nenhuma pesagem.</p>}
      {s.medidas.length > 0 && (
        <table className="imp-tabela imp-tabela--metade">
          <thead><tr><th>Data</th><th>Medida</th><th>cm</th></tr></thead>
          <tbody>
            {[...s.medidas].sort((a, b) => +new Date(a.em) - +new Date(b.em)).map((m) => <tr key={m.id}><td>{dataBR(m.em)}</td><td>{TIPOS_MEDIDA.find((x) => x.id === m.tipo)?.nome}</td><td>{num(m.cm)}</td></tr>)}
          </tbody>
        </table>
      )}

      <h2>Alimentação e água</h2>
      {refeicoes.length ? (
        <table className="imp-tabela">
          <thead><tr><th>Quando</th><th>Refeição</th><th>Proteína</th><th>Origem</th></tr></thead>
          <tbody>
            {refeicoes.map((r) => (
              <tr key={r.id}><td>{dataHoraBR(r.em)}</td><td><b>{r.tipo}</b>: {r.itens.map((i) => `${i.nome} (${i.porcao_texto})`).join(', ')}</td><td>{Math.round(r.itens.reduce((a, i) => a + i.proteina_g, 0))} g</td><td>{r.origem === 'ia_estimativa' ? 'IA, conferido' : 'manual'}</td></tr>
            ))}
          </tbody>
        </table>
      ) : <p className="imp-vazio">Nenhuma refeição registrada.</p>}
      {aguaDia.size > 0 && <p className="imp-nota bloco">Água por dia: {[...aguaDia].map(([d, ml]) => `${d} ${num(ml / 1000)} L`).join(' · ')}</p>}
      {extra.rotulos.length > 0 && <p className="imp-nota bloco">Alimentos de rótulo: {extra.rotulos.map((r) => r.nome as string).join(', ')}</p>}

      <h2>Sintomas</h2>
      {s.sintomas.length ? (
        <table className="imp-tabela">
          <thead><tr><th>Quando</th><th>Sintomas</th><th>Intensidade</th><th>Observação</th></tr></thead>
          <tbody>
            {[...s.sintomas].sort((a, b) => +new Date(b.em) - +new Date(a.em)).map((x) => <tr key={x.id}><td>{dataHoraBR(x.em)}</td><td>{x.sintomas.join(', ')}</td><td>{x.intensidade}/5</td><td>{[x.alerta && 'alerta mostrado ao paciente', x.obs].filter(Boolean).join(' · ')}</td></tr>)}
          </tbody>
        </table>
      ) : <p className="imp-vazio">Nenhum sintoma registrado.</p>}

      {(s.bemestar.length > 0 || s.treinos.length > 0) && (
        <>
          <h2>Bem-estar, sono e treinos</h2>
          <table className="imp-tabela">
            <thead><tr><th>Data</th><th>Registro</th><th>Observação</th></tr></thead>
            <tbody>
              {[...s.bemestar].sort((a, b) => +new Date(b.em) - +new Date(a.em)).map((b) => <tr key={b.id}><td>{dataBR(b.em)}</td><td>Sono {b.sono_horas ?? '—'} h · qualidade {b.sono_qualidade ?? '—'}/5 · humor {b.humor ?? '—'}/5 · energia {b.energia ?? '—'}/5 · fome {b.fome ?? '—'}/5</td><td>{b.obs ?? ''}</td></tr>)}
              {[...s.treinos].sort((a, b) => +new Date(b.em) - +new Date(a.em)).map((x) => <tr key={x.id}><td>{dataBR(x.em)}</td><td>Treino: {x.tipo} · {x.duracao_min} min{x.forca ? ' · força' : ''}</td><td /></tr>)}
            </tbody>
          </table>
        </>
      )}

      {(s.canetas.length > 0 || s.compras.length > 0) && (
        <>
          <h2>Canetas e gastos</h2>
          <table className="imp-tabela imp-tabela--metade">
            <tbody>
              {s.canetas.map((k) => <tr key={k.id}><td>Estoque</td><td>{k.quantidade} caneta(s) · validade {k.validade || '—'}</td></tr>)}
              {s.compras.map((k) => <tr key={k.id}><td>{dataBR(k.em)}</td><td>Compra de {k.quantidade} · {(k.valor_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>)}
            </tbody>
          </table>
        </>
      )}

      {fotos.length > 0 && (
        <>
          <h2>Fotos de evolução</h2>
          <div className="imp-fotos">
            {fotos.map((f) => (
              <figure key={f.id} className="bloco"><img src={f.url} alt="" /><figcaption>{f.angulo} · {dataBR(f.em)}</figcaption></figure>
            ))}
          </div>
        </>
      )}

      {(extra.consent.length > 0 || extra.assinaturas.length > 0) && (
        <>
          <h2>Assinatura e consentimentos</h2>
          <table className="imp-tabela">
            <tbody>
              {extra.assinaturas.map((a) => <tr key={a.id as string}><td>{dataBR(a.criado_em as string)}</td><td>Assinatura {a.plano as string} {a.periodo as string} · {a.gateway as string}</td><td>{a.status as string}</td></tr>)}
              {extra.consent.map((x) => <tr key={x.id as string}><td>{dataBR(x.aceito_em as string)}</td><td>Consentimento: {x.tipo as string} ({x.versao_texto as string})</td><td /></tr>)}
            </tbody>
          </table>
        </>
      )}

      <div className="imp-fim bloco">
        <Mascot expressao="piscando" size={44} flutuar={false} />
        <p>Dados registrados pelo próprio paciente no Canetolino. Não é avaliação médica e não contém recomendação de dose. IMC é referência populacional, não diagnóstico.</p>
      </div>
    </div>,
    document.body,
  )
}
