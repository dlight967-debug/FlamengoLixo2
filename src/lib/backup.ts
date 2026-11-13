import { parseRecord, recordToBook } from './marc'
import type { Book, ParseReport } from './types'

/**
 * Leitor do backup completo do Biblivre (.b5bz = ZIP contendo um dump PostgreSQL).
 * Lê `single.data.b5b`, tabelas `biblio_records` (ISO 2709 por linha) e `biblio_holdings`.
 * Só usa DecompressionStream (nativo nos navegadores modernos e no Node 18+).
 */

interface ZipEntry { name: string; method: number; compSize: number; offset: number }

function readZipEntries(u8: Uint8Array): ZipEntry[] {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
  let eocd = -1
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('Arquivo ZIP inválido (EOCD não encontrado)')
  const count = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  const out: ZipEntry[] = []
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break
    const method = dv.getUint16(p + 10, true)
    const compSize = dv.getUint32(p + 20, true)
    const nameLen = dv.getUint16(p + 28, true)
    const extraLen = dv.getUint16(p + 30, true)
    const commentLen = dv.getUint16(p + 32, true)
    const offset = dv.getUint32(p + 42, true)
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nameLen))
    out.push({ name, method, compSize, offset })
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}

async function extract(u8: Uint8Array, e: ZipEntry): Promise<Uint8Array> {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
  const nameLen = dv.getUint16(e.offset + 26, true)
  const extraLen = dv.getUint16(e.offset + 28, true)
  const start = e.offset + 30 + nameLen + extraLen
  const raw = u8.subarray(start, start + e.compSize)
  if (e.method === 0) return raw
  if (e.method !== 8) throw new Error('Método de compressão ZIP não suportado: ' + e.method)
  const stream = new Blob([raw as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Desfaz o escape do formato COPY do PostgreSQL. `\N` => null. */
function unescapeCopy(v: string): string | null {
  if (v === '\\N') return null
  if (v.indexOf('\\') === -1) return v
  return v.replace(/\\(.)/gs, (_, c: string) => (c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '\r' : c))
}

function* copyRows(text: string, table: string): Generator<(string | null)[]> {
  const head = `COPY ${table} (`
  let i = text.indexOf('\n' + head)
  if (i < 0) return
  i = text.indexOf('\n', i + 1) + 1
  while (i < text.length) {
    let j = text.indexOf('\n', i)
    if (j < 0) j = text.length
    const line = text.substring(i, j)
    if (line === '\\.') return
    yield line.split('\t').map(unescapeCopy)
    i = j + 1
  }
}

export function isZip(u8: Uint8Array) {
  return u8.length > 4 && u8[0] === 0x50 && u8[1] === 0x4b
}

export async function parseBiblivreBackup(u8: Uint8Array): Promise<{ books: Book[]; report: ParseReport; library?: string }> {
  const entries = readZipEntries(u8)
  const data = entries.find((e) => /(^|\/)single\.data\.b5b$/.test(e.name))
  if (!data) throw new Error('single.data.b5b não encontrado no backup')
  const text = new TextDecoder('utf-8').decode(await extract(u8, data))
  let library: string | undefined
  const meta = entries.find((e) => /backup\.meta$/.test(e.name))
  if (meta) {
    try {
      const m = JSON.parse(new TextDecoder().decode(await extract(u8, meta)))
      library = [m?.schemas?.single?.left, m?.schemas?.single?.right].filter(Boolean).join(' — ')
    } catch { /* ignora */ }
  }

  // exemplares: record_id -> tombos / disponibilidade (somente base "main")
  const copies = new Map<string, { total: number; available: number; tombos: string[] }>()
  for (const r of copyRows(text, 'biblio_holdings')) {
    // id, record_id, iso2709, database, accession_number, location_d, ..., material(10), availability(11)
    if (r[3] !== 'main' || !r[1]) continue
    const c = copies.get(r[1]) ?? { total: 0, available: 0, tombos: [] }
    c.total++
    if (r[11] === 'available') c.available++
    if (r[4]) c.tombos.push(r[4])
    copies.set(r[1], c)
  }

  const enc = new TextEncoder()
  const books: Book[] = []
  const errors: string[] = []
  let total = 0
  for (const r of copyRows(text, 'biblio_records')) {
    // id, iso2709, material, database, ...
    if (r[3] !== 'main' || !r[1]) continue
    total++
    try {
      const b = recordToBook(parseRecord(enc.encode(r[1])), r[0] ?? String(total))
      b.id = r[0] ?? b.id
      b.copies = copies.get(r[0] ?? '')
      books.push(b)
    } catch (e) {
      if (errors.length < 20) errors.push(`registro ${r[0]}: ${(e as Error).message}`)
    }
  }
  return { books, report: { total, parsed: books.length, skipped: total - books.length, errors }, library }
}

/** Registros ISO 2709 brutos (base "main") — usado para gerar .mrc a partir do backup. */
export async function extractRawRecords(u8: Uint8Array): Promise<{ id: string; iso: Uint8Array }[]> {
  const entries = readZipEntries(u8)
  const data = entries.find((e) => /(^|\/)single\.data\.b5b$/.test(e.name))
  if (!data) throw new Error('single.data.b5b não encontrado no backup')
  const text = new TextDecoder('utf-8').decode(await extract(u8, data))
  const enc = new TextEncoder()
  const out: { id: string; iso: Uint8Array }[] = []
  for (const r of copyRows(text, 'biblio_records')) if (r[3] === 'main' && r[1]) out.push({ id: r[0] ?? '', iso: enc.encode(r[1]) })
  return out
}
