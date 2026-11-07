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
    throw new Error(codigo === 'sem_acesso' ? 'Sem acesso a este paciente agora.' : 'Não consegui gerar o relatório. Tente de novo.')
  }
  const blob = data instanceof Blob ? data : new Blob([data as ArrayBuffer], { type: 'application/pdf' })
  await entregarPdf(blob, `Relatório ${nome || 'paciente'} ${dias} dias - Canetolino.pdf`)
}

/** No celular abre o menu de compartilhar (salvar, imprimir, enviar); no computador, baixa o arquivo. */
export async function entregarPdf(blob: Blob, nomeArquivo: string) {
  const arquivo = nomeArquivo.replace(/[\\/:*?"<>|]/g, '')
  const file = new File([blob], arquivo, { type: 'application/pdf' })
  if (/iphone|ipad|ipod|android/i.test(navigator.userAgent) && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: arquivo.replace(/\.pdf$/, '') })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return // a pessoa fechou o menu
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = arquivo
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}

/**
 * Ficha completa em PDF, gerada no servidor (funciona em qualquer aparelho, inclusive no iPhone com o app na tela de início,
 * onde a impressão direta não existe). No celular, abre o menu de compartilhar para salvar, imprimir ou enviar.
 */
export async function baixarFicha(c: SupabaseClient, pacienteId: string | null, nome: string) {
  const { data, error } = await c.functions.invoke('ficha', { body: { paciente_id: pacienteId ?? undefined } })
  if (error) {
    let codigo = ''
    if (error instanceof FunctionsHttpError) {
      try {
        codigo = (await error.context.json()).erro
      } catch {
        /* sem JSON */
      }
    }
    throw new Error(codigo === 'sem_acesso' ? 'Sem acesso a este paciente agora.' : 'Não consegui gerar a ficha. Tente de novo.')
  }
  const blob = data instanceof Blob ? data : new Blob([data as ArrayBuffer], { type: 'application/pdf' })
  await entregarPdf(blob, `Ficha ${nome || 'paciente'} - Canetolino.pdf`)
}
