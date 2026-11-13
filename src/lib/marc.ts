import type { Book, ParseReport } from './types'

/**
 * Parser nativo de ISO 2709 / MARC21 (exportação do Biblivre: .mrc / .iso / .txt).
 * Estrutura: Líder (24) + Diretório (12 bytes por campo, termina em 0x1E) + Campos.
 * Os comprimentos/offsets do diretório são em BYTES, por isso decodificamos o UTF-8
 * somente depois de fatiar o buffer.
 */
export const FT = 0x1e // field terminator
export const SF = 0x1f // subfield delimiter
export const RT = 0x1d // record terminator

export interface Subfield { code: string; value: string }
export interface DataField { tag: string; ind1: string; ind2: string; subfields: Subfield[] }
export interface ControlField { tag: string; value: string }
export interface MarcRecord {
  leader: string
  controls: ControlField[]
  fields: DataField[]
}

function decode(bytes: Uint8Array, utf8: boolean): string {
  if (utf8) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      /* cai para latin1 */
    }
  }
  return new TextDecoder('iso-8859-1').decode(bytes)
}

/** Divide um buffer em registros (por RT; usa o comprimento do líder quando coerente). */
export function splitRecords(buf: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = []
  let pos = 0
  while (pos < buf.length) {
    // pula espaços/quebras entre registros
    while (pos < buf.length && (buf[pos] === 0x0a || buf[pos] === 0x0d || buf[pos] === 0x20)) pos++
    if (pos >= buf.length) break
    let end = -1
    const lenStr = String.fromCharCode(...buf.subarray(pos, pos + 5))
    const len = /^\d{5}$/.test(lenStr) ? parseInt(lenStr, 10) : 0
    if (len > 24 && pos + len <= buf.length && buf[pos + len - 1] === RT) end = pos + len
    else {
      const i = buf.indexOf(RT, pos)
      end = i === -1 ? buf.length : i + 1
    }
    out.push(buf.subarray(pos, end))
    pos = end
  }
  return out
}

export function parseRecord(rec: Uint8Array): MarcRecord {
  if (rec.length < 25) throw new Error('registro curto demais')
  const leader = String.fromCharCode(...rec.subarray(0, 24))
  const utf8 = leader[9] === 'a' || leader[9] === ' ' // 'a' = Unicode; ' ' tentamos UTF-8 e caímos p/ latin1
  const baseAddr = parseInt(leader.substring(12, 17), 10)
  if (!Number.isFinite(baseAddr) || baseAddr < 25) throw new Error('endereço-base inválido')
  const dirEnd = baseAddr - 1
  const controls: ControlField[] = []
  const fields: DataField[] = []
  for (let i = 24; i + 12 <= dirEnd; i += 12) {
    const tag = String.fromCharCode(...rec.subarray(i, i + 3))
    const len = parseInt(String.fromCharCode(...rec.subarray(i + 3, i + 7)), 10)
    const off = parseInt(String.fromCharCode(...rec.subarray(i + 7, i + 12)), 10)
    if (!/^\d{3}$/.test(tag) || !Number.isFinite(len) || !Number.isFinite(off)) continue
    let data = rec.subarray(baseAddr + off, baseAddr + off + len)
    if (data.length && data[data.length - 1] === FT) data = data.subarray(0, data.length - 1)
    if (tag < '010') {
      controls.push({ tag, value: decode(data, utf8) })
    } else {
      const ind1 = String.fromCharCode(data[0] ?? 32)
      const ind2 = String.fromCharCode(data[1] ?? 32)
      const subfields: Subfield[] = []
      let s = 2
      while (s < data.length) {
        if (data[s] === SF) {
          let e = s + 1
          while (e < data.length && data[e] !== SF) e++
          const code = String.fromCharCode(data[s + 1])
          subfields.push({ code, value: decode(data.subarray(s + 2, e), utf8).trim() })
          s = e
        } else s++
      }
      fields.push({ tag, ind1, ind2, subfields })
    }
  }
  return { leader, controls, fields }
}

const sf = (f: DataField | undefined, code: string): string =>
  f?.subfields.find((s) => s.code === code)?.value ?? ''
const all = (r: MarcRecord, tag: string) => r.fields.filter((f) => f.tag === tag)
const first = (r: MarcRecord, tag: string) => r.fields.find((f) => f.tag === tag)

const trimPunct = (s: string) =>
  s.replace(/\s*[\/:;,=.]+\s*$/u, '').replace(/^\s+/, '').trim()

/** Converte "244 p.", "xii, 320p." etc. no maior inteiro plausível. */
export function parsePages(raw: string): number | undefined {
  if (!raw) return undefined
  const cleaned = raw.replace(/\[|\]/g, '')
  const nums = [...cleaned.matchAll(/(\d{1,5})\s*(?:p\b|p\.|f\b|f\.|páginas|paginas|pág|pag)/gi)].map((m) => +m[1])
  const any = nums.length ? nums : [...cleaned.matchAll(/\d{1,5}/g)].map((m) => +m[0])
  if (!any.length) return undefined
  const n = Math.max(...any)
  return n > 0 && n < 5000 ? n : undefined
}

export function normalizeIsbn(raw: string): string | undefined {
  const d = raw.replace(/[^0-9Xx]/g, '')
  return d.length === 10 || d.length === 13 ? d.toUpperCase() : undefined
}

export function recordToBook(r: MarcRecord, fallbackId: string): Book {
  const control = r.controls.find((c) => c.tag === '001')?.value.trim() || fallbackId
  const call = first(r, '090') ?? first(r, '082')
  const f100 = first(r, '100') ?? first(r, '110') ?? first(r, '700')
  const f245 = first(r, '245')
  const f26x = first(r, '260') ?? first(r, '264')
  const series = first(r, '490') ?? first(r, '830') ?? first(r, '440')
  const f020 = first(r, '020')
  const pagesRaw = sf(first(r, '300'), 'a')
  const subjects = [
    ...all(r, '650'),
    ...all(r, '651'),
    ...all(r, '600'),
    ...all(r, '610'),
    ...all(r, '653'),
  ].flatMap((f) =>
    f.subfields
      .filter((s) => /[axyzv]/.test(s.code))
      .map((s) => s.value)
      .join(' - ')
      .split(/\s*;\s*/)
      .map((s) => s.trim())
      .filter(Boolean),
  )
  return {
    id: control,
    control,
    isbn: normalizeIsbn(sf(f020, 'a')),
    cdd: sf(call, 'a').trim(),
    cutter: sf(call, 'b').trim(),
    author: trimPunct(sf(f100, 'a')),
    title: trimPunct(sf(f245, 'a')),
    subtitle: trimPunct(sf(f245, 'b')) || undefined,
    place: trimPunct(sf(f26x, 'a')) || undefined,
    publisher: trimPunct(sf(f26x, 'b')) || undefined,
    year: sf(f26x, 'c').replace(/[^\d\-\[\]?]/g, '') || undefined,
    pagesRaw: pagesRaw || undefined,
    pages: parsePages(pagesRaw),
    series: trimPunct(sf(series, 'a')) || undefined,
    seriesVol: sf(series, 'v') || undefined,
    subjects,
    notes: sf(first(r, '504') ?? first(r, '500'), 'a') || undefined,
    recordType: r.leader[7] ?? 'm',
  }
}

/** Lê um arquivo ISO 2709 completo (.mrc/.iso/.txt) e devolve livros + relatório. */
export function parseIso2709(buf: Uint8Array): { books: Book[]; report: ParseReport } {
  const chunks = splitRecords(buf)
  const books: Book[] = []
  const errors: string[] = []
  chunks.forEach((c, i) => {
    try {
      books.push(recordToBook(parseRecord(c), String(i + 1)))
    } catch (e) {
      if (errors.length < 20) errors.push(`registro ${i + 1}: ${(e as Error).message}`)
    }
  })
  return {
    books,
    report: { total: chunks.length, parsed: books.length, skipped: chunks.length - books.length, errors },
  }
}

/** Codifica um registro simples em ISO 2709 (usado para gerar a amostra e nos testes). */
export function encodeRecord(controls: [string, string][], fields: { tag: string; ind?: string; sf: [string, string][] }[]): Uint8Array {
  const enc = new TextEncoder()
  const parts: { tag: string; data: Uint8Array }[] = []
  for (const [tag, value] of controls) parts.push({ tag, data: enc.encode(value + '\x1e') })
  for (const f of fields) {
    const body = (f.ind ?? '  ') + f.sf.map(([c, v]) => '\x1f' + c + v).join('') + '\x1e'
    parts.push({ tag: f.tag, data: enc.encode(body) })
  }
  let dir = ''
  let off = 0
  for (const p of parts) {
    dir += p.tag + String(p.data.length).padStart(4, '0') + String(off).padStart(5, '0')
    off += p.data.length
  }
  const base = 24 + dir.length + 1
  const total = base + off + 1
  const leader = String(total).padStart(5, '0') + 'nam a22' + String(base).padStart(5, '0') + ' a 4500'
  const out = new Uint8Array(total)
  const head = enc.encode(leader + dir + '\x1e')
  out.set(head, 0)
  let p = head.length
  for (const part of parts) { out.set(part.data, p); p += part.data.length }
  out[total - 1] = RT
  return out
}
