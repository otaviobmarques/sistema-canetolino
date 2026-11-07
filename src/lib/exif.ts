/**
 * Data em que a foto foi tirada, lida do EXIF (DateTimeOriginal) sem enviar a foto a lugar nenhum.
 * Fotos recebidas por WhatsApp e capturas de tela costumam vir sem EXIF: aí tenta o nome do arquivo
 * (IMG_20240805_…, PXL_20240805_…) e, se nada servir, devolve null para a pessoa informar.
 */
export type DataFoto = { iso: string; origem: 'exif' | 'nome' } | null

export async function dataDaFoto(arquivo: File): Promise<DataFoto> {
  try {
    const exif = await lerExif(arquivo)
    if (exif) return { iso: exif, origem: 'exif' }
  } catch {
    /* arquivo sem EXIF legível */
  }
  const nome = dataPeloNome(arquivo.name)
  return nome ? { iso: nome, origem: 'nome' } : null
}

function valida(a: number, m: number, d: number, h = 12, mi = 0, s = 0): string | null {
  if (a < 2000 || m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(a, m - 1, d, h, mi, s)
  if (dt.getDate() !== d || dt.getTime() > Date.now() + 86400000) return null
  return dt.toISOString()
}

export function dataPeloNome(nome: string): string | null {
  // "WhatsApp Image 2024-08-05 at 10.12.33" é a data em que chegou, não a da foto: não usa
  if (/whatsapp/i.test(nome)) return null
  const m = nome.match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})[_\-\s]?(\d{2})?[-_.]?(\d{2})?[-_.]?(\d{2})?/)
  if (!m) return null
  return valida(+m[1], +m[2], +m[3], m[4] ? +m[4] : 12, m[5] ? +m[5] : 0, m[6] ? +m[6] : 0)
}

async function lerExif(arquivo: Blob): Promise<string | null> {
  const buf = await arquivo.slice(0, 256 * 1024).arrayBuffer()
  const v = new DataView(buf)
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null // só JPEG
  let o = 2
  while (o + 4 < v.byteLength) {
    if (v.getUint8(o) !== 0xff) return null
    const marca = v.getUint8(o + 1)
    const tam = v.getUint16(o + 2)
    if (marca === 0xe1 && v.getUint32(o + 4) === 0x45786966) return lerTiff(v, o + 10) // "Exif"
    if (marca === 0xda) return null // começo da imagem: não há EXIF
    o += 2 + tam
  }
  return null
}

function lerTiff(v: DataView, base: number): string | null {
  const le = v.getUint16(base) === 0x4949
  const u16 = (p: number) => v.getUint16(p, le)
  const u32 = (p: number) => v.getUint32(p, le)
  const texto = (p: number, n: number) => {
    let s = ''
    for (let i = 0; i < n && p + i < v.byteLength; i++) {
      const c = v.getUint8(p + i)
      if (!c) break
      s += String.fromCharCode(c)
    }
    return s
  }
  const lerIfd = (ifd: number) => {
    const tags = new Map<number, string | number>()
    const n = u16(base + ifd)
    for (let i = 0; i < n; i++) {
      const e = base + ifd + 2 + i * 12
      if (e + 12 > v.byteLength) break
      const tag = u16(e), tipo = u16(e + 2), qtd = u32(e + 4)
      if (tipo === 2) tags.set(tag, texto(qtd > 4 ? base + u32(e + 8) : e + 8, qtd))
      else if (tipo === 4) tags.set(tag, u32(e + 8))
    }
    return tags
  }
  const ifd0 = lerIfd(u32(base + 4))
  const exifPtr = ifd0.get(0x8769)
  const exif = typeof exifPtr === 'number' ? lerIfd(exifPtr) : new Map()
  const bruto = (exif.get(0x9003) ?? exif.get(0x9004) ?? ifd0.get(0x0132)) as string | undefined
  const m = bruto?.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  return m ? valida(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]) : null
}
