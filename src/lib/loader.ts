import { parseIso2709, encodeRecord } from './marc'
import { parseBiblivreBackup, isZip } from './backup'
import type { Book, ParseReport } from './types'

export interface Loaded { books: Book[]; report: ParseReport; source: string }

/** Registro real do acervo — usado como fallback caso /amostra.mrc não carregue. */
export const BRELAZ = () =>
  encodeRecord(
    [['001', '0004100']],
    [
      { tag: '020', sf: [['a', '9788578037215']] },
      { tag: '090', sf: [['a', '869'], ['b', 'B845p']] },
      { tag: '100', ind: '1 ', sf: [['a', 'Brelaz, Walmir Moura']] },
      { tag: '245', ind: '10', sf: [['a', 'O perdão da leitura']] },
      { tag: '260', sf: [['a', 'Belém'], ['b', 'Paka-Tatu'], ['c', '2026']] },
      { tag: '650', sf: [['a', 'Leitura']] },
    ],
  )

export async function loadFile(file: File): Promise<Loaded> {
  const u8 = new Uint8Array(await file.arrayBuffer())
  if (isZip(u8)) {
    const r = await parseBiblivreBackup(u8)
    return { books: r.books, report: r.report, source: r.library ? `${file.name} · ${r.library}` : file.name }
  }
  const r = parseIso2709(u8)
  return { ...r, source: file.name }
}

export async function loadDefault(): Promise<Loaded> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}amostra.mrc`)
    if (!res.ok) throw new Error(String(res.status))
    const r = parseIso2709(new Uint8Array(await res.arrayBuffer()))
    if (r.books.length) return { ...r, source: 'Amostra do acervo (embutida)' }
  } catch {
    /* cai no fallback */
  }
  const r = parseIso2709(BRELAZ())
  return { ...r, source: 'Registro de exemplo' }
}
