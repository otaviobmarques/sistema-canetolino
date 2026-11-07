import { reduzirFoto } from './ia'
import { sb } from './supabase'
import { uid } from './datas'

/**
 * Fotos de evolução: sempre no Storage privado `evolucao/<user_id>/`, com links temporários.
 * Fotos antigas que ficaram só no aparelho (opção que existia antes) são enviadas para a nuvem
 * na primeira vez que o app abre logado (`enviarFotosDoAparelho`).
 * Fotos de evolução nunca entram no compartilhamento com profissionais.
 */
export type Angulo = 'frente' | 'lado' | 'costas'
export type FotoEvolucao = { id: string; url: string; angulo: Angulo; em: string; onde: 'aparelho' | 'nuvem'; caminho?: string }

const BANCO = 'canetolino-fotos'
function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    const r = indexedDB.open(BANCO, 1)
    r.onupgradeneeded = () => r.result.createObjectStore('fotos', { keyPath: 'id' })
    r.onsuccess = () => ok(r.result)
    r.onerror = () => erro(r.error)
  })
}
async function tx<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir()
  return new Promise((ok, erro) => {
    const r = fn(db.transaction('fotos', modo).objectStore('fotos'))
    r.onsuccess = () => ok(r.result)
    r.onerror = () => erro(r.error)
  })
}

type Local = { id: string; userId: string; blob: Blob; angulo: Angulo; em: string }

export async function listarFotos(userId: string): Promise<FotoEvolucao[]> {
  const locais = ((await tx('readonly', (s) => s.getAll())) as Local[])
    .filter((f) => f.userId === userId)
    .map((f) => ({ id: f.id, url: URL.createObjectURL(f.blob), angulo: f.angulo, em: f.em, onde: 'aparelho' as const }))
  const c = sb('app')
  const { data } = await c.from('progress_photos').select('*').order('registrado_em')
  let nuvem: FotoEvolucao[] = []
  if (data?.length) {
    const { data: urls } = await c.storage.from('evolucao').createSignedUrls(data.map((d) => d.caminho), 3600)
    nuvem = data.map((d, i) => ({ id: d.id, url: urls?.[i]?.signedUrl ?? '', angulo: d.angulo, em: d.registrado_em, onde: 'nuvem' as const, caminho: d.caminho }))
  }
  return [...locais, ...nuvem].sort((a, b) => +new Date(a.em) - +new Date(b.em))
}

/** Salva a foto (reduzida, sem os metadados do arquivo original). `em` é a data em que a foto foi tirada. */
export async function salvarFoto(userId: string, arquivo: Blob, angulo: Angulo, soNoAparelho: boolean, em = new Date().toISOString()) {
  const { base64 } = await reduzirFoto(arquivo, 1280)
  const blob = await (await fetch(`data:image/jpeg;base64,${base64}`)).blob()
  const id = uid()
  if (soNoAparelho) {
    await tx('readwrite', (s) => s.put({ id, userId, blob, angulo, em } satisfies Local))
    return
  }
  const c = sb('app')
  const caminho = `${userId}/${id}.jpg`
  const up = await c.storage.from('evolucao').upload(caminho, blob, { contentType: 'image/jpeg' })
  if (up.error) throw up.error
  const { error } = await c.from('progress_photos').insert({ id, user_id: userId, caminho, angulo, registrado_em: em })
  if (error) throw error
}

/** Envia para a nuvem as fotos que ficaram só neste aparelho e apaga a cópia local de cada uma que subiu. */
export async function enviarFotosDoAparelho(userId: string): Promise<number> {
  let locais: Local[] = []
  try {
    locais = ((await tx('readonly', (s) => s.getAll())) as Local[]).filter((f) => f.userId === userId)
  } catch {
    return 0 // sem IndexedDB
  }
  const c = sb('app')
  let n = 0
  for (const f of locais) {
    const caminho = `${userId}/${f.id}.jpg`
    const up = await c.storage.from('evolucao').upload(caminho, f.blob, { contentType: 'image/jpeg' })
    if (up.error && !/exists|duplicate/i.test(up.error.message)) continue // já enviada numa tentativa anterior: segue
    const { error } = await c.from('progress_photos').upsert({ id: f.id, user_id: userId, caminho, angulo: f.angulo, registrado_em: f.em })
    if (error) continue
    await tx('readwrite', (s) => s.delete(f.id))
    n++
  }
  return n
}

/** Corrige a data (e o ângulo) de uma foto já salva. */
export async function atualizarFoto(f: FotoEvolucao, mudanca: { em: string; angulo: Angulo }) {
  if (f.onde === 'aparelho') {
    const atual = (await tx('readonly', (s) => s.get(f.id))) as Local | undefined
    if (atual) await tx('readwrite', (s) => s.put({ ...atual, ...mudanca }))
    return
  }
  const { error } = await sb('app').from('progress_photos').update({ registrado_em: mudanca.em, angulo: mudanca.angulo }).eq('id', f.id)
  if (error) throw error
}

export async function apagarFoto(f: FotoEvolucao) {
  if (f.onde === 'aparelho') {
    await tx('readwrite', (s) => s.delete(f.id))
    return
  }
  const c = sb('app')
  if (f.caminho) await c.storage.from('evolucao').remove([f.caminho])
  await c.from('progress_photos').delete().eq('id', f.id)
}

/** Apaga todas as fotos da pessoa (aparelho e nuvem). Usado ao excluir a conta. */
export async function apagarTodasAsFotos(userId: string) {
  const c = sb('app')
  const { data } = await c.storage.from('evolucao').list(userId, { limit: 1000 })
  if (data?.length) await c.storage.from('evolucao').remove(data.map((o) => `${userId}/${o.name}`))
  try {
    const locais = (await tx('readonly', (s) => s.getAll())) as Local[]
    for (const f of locais.filter((x) => x.userId === userId)) await tx('readwrite', (s) => s.delete(f.id))
  } catch {
    /* sem IndexedDB */
  }
}
