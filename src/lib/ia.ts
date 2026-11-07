import { FunctionsHttpError } from '@supabase/supabase-js'
import { sb } from './supabase'

/** Chamadas à função de servidor `ia` (o app nunca fala direto com o provedor de IA). */
export type ItemIA = {
  food_id: string
  nome: string
  nome_tabela: string
  fonte: string
  porcao_g: number
  porcao_texto: string
  proteina_g: number
  energia_kcal: number
  confianca: number
  nao_encontrado: boolean
  versao_tabela: string
}

export class ErroIA extends Error {
  codigo: string
  constructor(codigo: string, mensagem: string) {
    super(mensagem)
    this.codigo = codigo
  }
}

const MENSAGENS: Record<string, string> = {
  ia_indisponivel: 'O registro com IA está indisponível agora. Você pode buscar os alimentos manualmente.',
  ia_desligada: 'O registro com IA está desligado no seu Perfil.',
  cota: 'Você usou os 30 registros por IA do plano Básico neste mês. Continue pela busca manual ou conheça o Premium.',
  recusado: 'Não consegui analisar essa refeição. Tente de novo ou busque manualmente.',
  ocupado: 'A IA está ocupada agora. Tente de novo em instantes.',
  imagem_grande: 'A foto ficou grande demais. Tente outra.',
  nao_autenticado: 'Sua sessão expirou. Entre de novo.',
}

async function chamar<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb('app').functions.invoke('ia', { body: corpo })
  if (error) {
    let codigo = 'ia_falhou'
    if (error instanceof FunctionsHttpError) {
      try {
        codigo = (await error.context.json()).erro ?? codigo
      } catch {
        /* resposta sem JSON */
      }
    } else codigo = 'sem_rede'
    throw new ErroIA(codigo, MENSAGENS[codigo] ?? (codigo === 'sem_rede' ? 'Sem conexão. Registre manualmente ou tente de novo.' : 'Algo deu errado com a IA. Tente de novo.'))
  }
  return data as T
}

export const refeicaoPorTexto = (texto: string) => chamar<{ itens: ItemIA[] }>({ acao: 'refeicao_texto', texto })

export const refeicaoPorFoto = async (arquivo: Blob) => {
  const { base64, tipo } = await reduzirFoto(arquivo)
  return chamar<{ itens: ItemIA[] }>({ acao: 'refeicao_foto', imagem: base64, media_type: tipo })
}

export const resumoSemanal = (semana: string, indicadores: Record<string, unknown>) =>
  chamar<{ resumo?: string; bloqueado?: boolean }>({ acao: 'resumo_semanal', semana, indicadores })

/** Reduz a foto antes do envio (lado maior até 1024 px, JPEG): menos dados e menor custo. */
export async function reduzirFoto(arquivo: Blob, max = 1024): Promise<{ base64: string; tipo: 'image/jpeg' }> {
  const bmp = await createImageBitmap(arquivo)
  const escala = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * escala)
  c.height = Math.round(bmp.height * escala)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  const url = c.toDataURL('image/jpeg', 0.82)
  return { base64: url.slice(url.indexOf(',') + 1), tipo: 'image/jpeg' }
}
