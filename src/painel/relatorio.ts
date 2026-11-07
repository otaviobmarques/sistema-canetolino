import type { SupabaseClient } from '@supabase/supabase-js'
import { FunctionsHttpError } from '@supabase/supabase-js'

/** Pede o PDF à função de servidor `relatorio` e baixa o arquivo. */
export async function baixarRelatorio(c: SupabaseClient, pacienteId: string | null, dias: number, nome: string) {
  const { data, error } = await c.functions.invoke('relatorio', { body: { paciente_id: pacienteId ?? undefined, dias } })
  if (error) {
    let codigo = ''
    if (error instanceof FunctionsHttpError) {
      try {
        codigo = (await error.context.json()).erro
      } catch {
        /* sem JSON */
      }
    }
    throw new Error(codigo === 'premium' ? 'O relatório em PDF faz parte do plano Premium.' : codigo === 'sem_acesso' ? 'Sem acesso a este paciente agora.' : 'Não consegui gerar o relatório. Tente de novo.')
  }
  const blob = data instanceof Blob ? data : new Blob([data as ArrayBuffer], { type: 'application/pdf' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `canetolino-${nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}-${dias}d.pdf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
