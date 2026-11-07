import type { SupabaseClient } from '@supabase/supabase-js'
import type { Compartilhamento, Estado, Local, Modulo, Refeicao, TipoMedida } from './store'

/* =====================================================================
   Ponte entre o estado do app (Estado) e as tabelas do Supabase.
   - carregar(): lê tudo do usuário e monta o Estado
   - sincronizar(): compara o último estado salvo com o atual e grava só a diferença
   Se a rede falhar, nada é perdido: o "último salvo" não avança e a próxima tentativa refaz a diferença.
   ===================================================================== */

type Linha = Record<string, unknown>
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : new Date().toISOString())

async function tudo<T = Linha>(q: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

/** Lê as tabelas de saúde de um paciente (o próprio, ou um paciente que autorizou o profissional). */
export async function lerSaude(c: SupabaseClient, uid: string, base: Estado): Promise<Estado> {
  const [apl, agua, pesos, sint, trein, canetas, compras, meals, itens, med, presc, sched, medidas, bemestar] = await Promise.all([
    tudo(c.from('applications').select('*').eq('user_id', uid).order('aplicado_em')),
    tudo(c.from('hydration_records').select('*').eq('user_id', uid).order('registrado_em')),
    tudo(c.from('weight_records').select('*').eq('user_id', uid).order('registrado_em')),
    tudo(c.from('symptoms').select('*').eq('user_id', uid).order('registrado_em')),
    tudo(c.from('workouts').select('*').eq('user_id', uid).order('registrado_em')),
    tudo(c.from('pen_inventory').select('*').eq('user_id', uid)),
    tudo(c.from('pen_purchases').select('*').eq('user_id', uid)),
    tudo(c.from('meals').select('*').eq('user_id', uid).order('horario')),
    tudo(c.from('meal_items').select('*').eq('user_id', uid).order('id')),
    tudo(c.from('medications').select('*').eq('user_id', uid).eq('status', 'ativo').order('created_at', { ascending: false }).limit(1)),
    tudo(c.from('prescriptions').select('*').eq('user_id', uid)),
    tudo(c.from('application_schedules').select('*').eq('user_id', uid)),
    tudo(c.from('measurements').select('*').eq('user_id', uid).order('registrado_em')),
    tudo(c.from('wellbeing_records').select('*').eq('user_id', uid).order('registrado_em')),
  ])
  const m = med[0]
  const p = m && presc.find((x) => x.medication_id === m.id)
  const h = m && sched.find((x) => x.medication_id === m.id)
  return {
    ...base,
    medicamento: m
      ? { id: m.id as string, principio: m.principio_ativo as string, nome_comercial: (m.nome_comercial as string) ?? '', dose_texto: (p?.dose_texto as string) ?? 'conforme sua prescrição', dia_semana: (h?.dia_semana as number) ?? 0, horario: ((h?.horario as string) ?? '08:00').slice(0, 5) }
      : base.medicamento,
    aplicacoes: apl.map((r) => ({ id: r.id as string, em: iso(r.aplicado_em), local: (r.local as Local) ?? undefined, obs: (r.observacao as string) ?? undefined, dose: (r.dose_texto as string) ?? undefined, retroativo: r.retroativo ? (true as const) : undefined })),
    agua: agua.map((r) => ({ id: r.id as string, ml: r.ml as number, em: iso(r.registrado_em) })),
    pesos: pesos.map((r) => ({ id: r.id as string, kg: Number(r.peso_kg), em: iso(r.registrado_em), retroativo: r.retroativo ? (true as const) : undefined })),
    bemestar: bemestar.map((r) => ({ id: r.id as string, em: iso(r.registrado_em), sono_horas: r.sono_horas == null ? undefined : Number(r.sono_horas), sono_qualidade: (r.sono_qualidade as number) ?? undefined, humor: (r.humor as number) ?? undefined, energia: (r.energia as number) ?? undefined, fome: (r.fome as number) ?? undefined, obs: (r.observacao as string) ?? undefined })),
    medidas: medidas.map((r) => ({ id: r.id as string, tipo: r.tipo as TipoMedida, cm: Number(r.medida_cm), em: iso(r.registrado_em) })),
    sintomas: sint.map((r) => ({ id: r.id as string, em: iso(r.registrado_em), sintomas: r.sintomas as string[], intensidade: r.intensidade as number, obs: (r.observacao as string) ?? undefined, alerta: !!r.alerta_disparado })),
    treinos: trein.map((r) => ({ id: r.id as string, em: iso(r.registrado_em), tipo: r.tipo as string, duracao_min: r.duracao_min as number, forca: !!r.forca })),
    canetas: canetas.map((r) => ({ id: r.id as string, nome: (r.nome as string) ?? '', lote: (r.lote as string) ?? '', validade: (r.validade as string) ?? '', quantidade: r.quantidade as number })),
    compras: compras.map((r) => ({ id: r.id as string, em: iso(r.data), valor_centavos: r.valor_centavos as number, quantidade: r.quantidade as number })),
    refeicoes: meals.map((r) => ({
      id: r.id as string,
      tipo: (r.tipo as string) ?? 'Refeição',
      em: iso(r.horario),
      origem: r.origem as Refeicao['origem'],
      versao_tabela: (r.versao_tabela as string) ?? '',
      itens: itens.filter((i) => i.meal_id === r.id).map((i) => ({ foodId: (i.food_id as string) ?? '', nome: i.nome as string, porcao_g: Number(i.porcao_g), porcao_texto: (i.porcao_texto as string) ?? `${i.porcao_g} g`, proteina_g: Number(i.proteina_g), energia_kcal: Number(i.energia_kcal ?? 0), origem: i.origem as Refeicao['origem'] })),
    })),
  }
}

/** Carrega a conta inteira do paciente logado. */
export async function carregar(c: SupabaseClient, uid: string, base: Estado): Promise<Estado> {
  const [{ data: perfil, error }, saude, shares, consent, audit, rotulo] = await Promise.all([
    c.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
    lerSaude(c, uid, base),
    c.rpc('meus_compartilhamentos'),
    tudo(c.from('consent_records').select('*').eq('user_id', uid).order('aceito_em')),
    tudo(c.from('audit_logs').select('*').eq('paciente_id', uid).order('em', { ascending: false }).limit(50)),
    tudo(c.from('user_foods').select('*').eq('user_id', uid).order('created_at')),
  ])
  if (error) throw error
  const pr = (perfil ?? {}) as Linha
  return {
    ...saude,
    onboardingFeito: !!pr.onboarding_feito,
    perfil: {
      ...base.perfil,
      nome: (pr.nome as string) ?? '',
      email: (pr.email as string) ?? base.perfil.email,
      nascimento: (pr.data_nascimento as string) ?? '',
      altura_cm: (pr.altura_cm as number) ?? 0,
      peso_inicial_kg: Number(pr.peso_inicial_kg ?? 0),
      meta_peso_kg: Number(pr.meta_peso_kg ?? 0),
      meta_proteina_g: (pr.meta_proteina_g as number) ?? 100,
      meta_agua_ml: (pr.meta_agua_ml as number) ?? 2000,
      preferencias: (pr.preferencias as string[]) ?? [],
      plano: (pr.plano as 'basico' | 'premium') ?? 'basico',
      jornada: ((pr.jornada as string) ?? '') as Estado['perfil']['jornada'],
      inicio_tratamento: (pr.inicio_tratamento as string) ?? '',
    },
    config: { ...base.config, ...((pr.config as object) ?? {}) },
    alimentosRotulo: rotulo.map((r) => ({ id: r.id as string, nome: r.nome as string, porcao_g: Number(r.porcao_g), porcao_texto: (r.porcao_texto as string) ?? undefined, proteina_g: Number(r.proteina_g), energia_kcal: r.energia_kcal == null ? undefined : Number(r.energia_kcal) })),
    compartilhamentos: mapearShares((shares.data as Linha[]) ?? []),
    consentimentos: consent.map((r) => ({ id: r.id as string, tipo: r.tipo as 'termos', versao: r.versao_texto as string, em: iso(r.aceito_em), detalhe: (r.detalhe as string) ?? undefined })),
    auditoria: audit.reverse().map((r) => ({ id: String(r.id), ator: r.ator_nome as string, acao: r.acao as string, em: iso(r.em) })),
  }
}

export function mapearShares(rows: Linha[]): Compartilhamento[] {
  return rows.map((r) => ({
    id: r.id as string,
    profissionalId: r.alvo_id as string,
    nome: r.nome as string,
    profissao: r.profissao as string,
    registro: (r.registro as string) ?? '',
    modulos: r.modulos as Modulo[],
    expira_em: (r.expira_em as string) ?? null,
    criado_em: iso(r.criado_em),
    revogado_em: (r.revogado_em as string) ?? null,
    finalidade: (r.finalidade as string) ?? '',
  }))
}

/* ============================ Gravação por diferença ============================ */
type Mapa<T> = { tabela: string; linha: (x: T, uid: string) => Linha }
const COLECOES: Partial<Record<keyof Estado, Mapa<never>>> = {
  aplicacoes: { tabela: 'applications', linha: (x: Estado['aplicacoes'][number], uid) => ({ id: x.id, user_id: uid, aplicado_em: x.em, local: x.local ?? null, observacao: x.obs ?? null, dose_texto: x.dose ?? null, retroativo: !!x.retroativo }) } as Mapa<never>,
  agua: { tabela: 'hydration_records', linha: (x: Estado['agua'][number], uid) => ({ id: x.id, user_id: uid, ml: x.ml, registrado_em: x.em }) } as Mapa<never>,
  pesos: { tabela: 'weight_records', linha: (x: Estado['pesos'][number], uid) => ({ id: x.id, user_id: uid, peso_kg: x.kg, registrado_em: x.em, retroativo: !!x.retroativo }) } as Mapa<never>,
  sintomas: { tabela: 'symptoms', linha: (x: Estado['sintomas'][number], uid) => ({ id: x.id, user_id: uid, sintomas: x.sintomas, intensidade: x.intensidade, observacao: x.obs ?? null, alerta_disparado: x.alerta, registrado_em: x.em }) } as Mapa<never>,
  treinos: { tabela: 'workouts', linha: (x: Estado['treinos'][number], uid) => ({ id: x.id, user_id: uid, tipo: x.tipo, duracao_min: x.duracao_min, forca: x.forca, registrado_em: x.em }) } as Mapa<never>,
  canetas: { tabela: 'pen_inventory', linha: (x: Estado['canetas'][number], uid) => ({ id: x.id, user_id: uid, nome: x.nome, lote: x.lote, validade: x.validade, quantidade: x.quantidade }) } as Mapa<never>,
  bemestar: { tabela: 'wellbeing_records', linha: (x: Estado['bemestar'][number], uid) => ({ id: x.id, user_id: uid, sono_horas: x.sono_horas ?? null, sono_qualidade: x.sono_qualidade ?? null, humor: x.humor ?? null, energia: x.energia ?? null, fome: x.fome ?? null, observacao: x.obs ?? null, registrado_em: x.em }) } as Mapa<never>,
  medidas: { tabela: 'measurements', linha: (x: Estado['medidas'][number], uid) => ({ id: x.id, user_id: uid, tipo: x.tipo, medida_cm: x.cm, registrado_em: x.em }) } as Mapa<never>,
  alimentosRotulo: { tabela: 'user_foods', linha: (x: Estado['alimentosRotulo'][number], uid) => ({ id: x.id, user_id: uid, nome: x.nome, porcao_g: x.porcao_g, porcao_texto: x.porcao_texto ?? null, proteina_g: x.proteina_g, energia_kcal: x.energia_kcal ?? null }) } as Mapa<never>,
  compras: { tabela: 'pen_purchases', linha: (x: Estado['compras'][number], uid) => ({ id: x.id, user_id: uid, data: x.em, valor_centavos: x.valor_centavos, quantidade: x.quantidade }) } as Mapa<never>,
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function diff<T extends { id: string }>(antes: T[], agora: T[]) {
  const mapaAntes = new Map(antes.map((x) => [x.id, x]))
  const idsAgora = new Set(agora.map((x) => x.id))
  return {
    gravar: agora.filter((x) => !mapaAntes.has(x.id) || !igual(mapaAntes.get(x.id), x)),
    apagar: antes.filter((x) => !idsAgora.has(x.id)).map((x) => x.id),
  }
}

const ok = async (q: PromiseLike<{ error: unknown }>) => {
  const { error } = await q
  if (error) throw error
}

/** Grava a diferença entre `antes` (o que o servidor já tem) e `agora`. Retorna o novo "antes". */
export async function sincronizar(c: SupabaseClient, uid: string, antes: Estado, agora: Estado): Promise<Estado> {
  const salvo: Estado = { ...antes }

  // perfil + configurações
  if (!igual([antes.perfil, antes.config, antes.onboardingFeito], [agora.perfil, agora.config, agora.onboardingFeito])) {
    const p = agora.perfil
    await ok(c.from('profiles').upsert({
      user_id: uid, nome: p.nome, email: p.email || null, data_nascimento: p.nascimento || null, altura_cm: p.altura_cm || null,
      peso_inicial_kg: p.peso_inicial_kg || null, meta_peso_kg: p.meta_peso_kg || null, meta_proteina_g: p.meta_proteina_g,
      meta_agua_ml: p.meta_agua_ml, preferencias: p.preferencias, jornada: p.jornada || null, inicio_tratamento: p.inicio_tratamento || null, config: agora.config, onboarding_feito: agora.onboardingFeito,
      updated_at: new Date().toISOString(),
    }))
    salvo.perfil = agora.perfil
    salvo.config = agora.config
    salvo.onboardingFeito = agora.onboardingFeito
  }

  // medicamento (+ receita + agenda, mesmo id)
  if (agora.medicamento && !igual(antes.medicamento, agora.medicamento)) {
    const m = agora.medicamento
    await ok(c.from('medications').upsert({ id: m.id, user_id: uid, principio_ativo: m.principio, nome_comercial: m.nome_comercial || null, status: 'ativo', updated_at: new Date().toISOString() }))
    await ok(c.from('prescriptions').upsert({ id: m.id, medication_id: m.id, user_id: uid, dose_texto: m.dose_texto || 'conforme a receita' }))
    await ok(c.from('application_schedules').upsert({ id: m.id, medication_id: m.id, user_id: uid, dia_semana: m.dia_semana, horario: m.horario }))
    salvo.medicamento = m
  }

  // coleções simples
  for (const [chave, mapa] of Object.entries(COLECOES) as [keyof Estado, Mapa<{ id: string }>][]) {
    const a = antes[chave] as { id: string }[]
    const b = agora[chave] as { id: string }[]
    if (a === b) continue
    const d = diff(a, b)
    if (d.gravar.length) await ok(c.from(mapa.tabela).upsert(d.gravar.map((x) => mapa.linha(x, uid))))
    if (d.apagar.length) await ok(c.from(mapa.tabela).delete().in('id', d.apagar))
    ;(salvo as Record<string, unknown>)[chave] = b
  }

  // refeições: a refeição e seus itens
  if (antes.refeicoes !== agora.refeicoes) {
    const d = diff(antes.refeicoes, agora.refeicoes)
    for (const r of d.gravar) {
      await ok(c.from('meals').upsert({ id: r.id, user_id: uid, tipo: r.tipo, horario: r.em, origem: r.origem, versao_tabela: r.versao_tabela, updated_at: new Date().toISOString() }))
      await ok(c.from('meal_items').delete().eq('meal_id', r.id))
      if (r.itens.length)
        await ok(c.from('meal_items').insert(r.itens.map((i) => ({ meal_id: r.id, user_id: uid, food_id: i.foodId && !i.foodId.startsWith('rotulo:') ? i.foodId : null, nome: i.nome, porcao_g: i.porcao_g, porcao_texto: i.porcao_texto, proteina_g: i.proteina_g, energia_kcal: i.energia_kcal, origem: i.origem }))))
    }
    if (d.apagar.length) await ok(c.from('meals').delete().in('id', d.apagar))
    salvo.refeicoes = agora.refeicoes
  }

  // consentimentos: histórico imutável, só inserção
  if (antes.consentimentos !== agora.consentimentos) {
    const ids = new Set(antes.consentimentos.map((x) => x.id))
    const novos = agora.consentimentos.filter((x) => !ids.has(x.id))
    if (novos.length) await ok(c.from('consent_records').insert(novos.map((x) => ({ id: x.id, user_id: uid, tipo: x.tipo, versao_texto: x.versao, detalhe: x.detalhe ?? null, aceito_em: x.em }))))
    salvo.consentimentos = agora.consentimentos
  }

  // compartilhamentos e auditoria são geridos pelo servidor (RPCs); não são enviados daqui
  salvo.compartilhamentos = agora.compartilhamentos
  salvo.auditoria = agora.auditoria
  return salvo
}
