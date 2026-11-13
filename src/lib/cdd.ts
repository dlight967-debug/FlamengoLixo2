/** Ordenação biblioteconômica: CDD (decimal) + Cutter. */

export interface CddKey {
  num: boolean
  int: number
  frac: string
  text: string
  seq: number
}

const strip = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/** "869" -> {int:869}; "363.12565" -> {int:363, frac:"12565"}; "Cart.36" -> alpha("cart", 36) */
export function parseCdd(raw: string): CddKey {
  const s = raw.trim().replace(/^[\[(]+/, '').replace(/^0\.(\d\d)$/, '0$1') // "0.50" digitado no lugar de "050"
  const m = s.match(/^(\d{1,3})(?:[.,]\s?(\d+))?/)
  if (m) return { num: true, int: +m[1], frac: m[2] ?? '', text: '', seq: 0 }
  const a = strip(s).match(/^([a-z]+)[.\s]*(\d+)?/)
  return { num: false, int: 9999, frac: '', text: a?.[1] ?? strip(s), seq: a?.[2] ? +a[2] : 0 }
}

/** Valor numérico decimal para testes de faixa (363.12565 -> 363.12565). */
export const cddValue = (k: CddKey) => (k.num ? parseFloat(`${k.int}.${k.frac || '0'}`) : NaN)

/** Compara decimais como texto: "1256" < "1257" < "126" (convenção CDD, não aritmética inteira). */
function cmpFrac(a: string, b: string) {
  const n = Math.max(a.length, b.length)
  const x = a.padEnd(n, '0')
  const y = b.padEnd(n, '0')
  return x < y ? -1 : x > y ? 1 : 0
}

export function compareCdd(a: CddKey, b: CddKey): number {
  if (a.num !== b.num) return a.num ? -1 : 1
  if (a.num) return a.int - b.int || cmpFrac(a.frac, b.frac)
  return a.text < b.text ? -1 : a.text > b.text ? 1 : a.seq - b.seq
}

export interface CutterKey { letters: string; digits: string; rest: string }

/** "B845p" -> {letters:"b", digits:"845", rest:"p"} */
export function parseCutter(raw: string): CutterKey {
  const m = strip(raw).replace(/\s+/g, '').match(/^([a-z]*)(\d*)(.*)$/)
  return { letters: m?.[1] ?? '', digits: m?.[2] ?? '', rest: m?.[3] ?? '' }
}

export function compareCutter(a: CutterKey, b: CutterKey): number {
  if (a.letters !== b.letters) return a.letters < b.letters ? -1 : 1
  const c = cmpFrac(a.digits, b.digits) // número do Cutter é decimal: .845 < .85
  if (c) return c
  return a.rest < b.rest ? -1 : a.rest > b.rest ? 1 : 0
}

export const cutterInitial = (cutter: string, author = ''): string => {
  const c = strip(cutter).match(/[a-z]/)?.[0] ?? strip(author).match(/[a-z]/)?.[0] ?? ''
  return c.toUpperCase()
}

export const titleKey = (s: string) => strip(s).replace(/[^a-z0-9 ]/g, '')

/** "Coleção Primeiros Passos" / "primeiros passos" / "Primeiros passos ;" => mesma chave */
export function collectionKey(series: string | undefined): string | undefined {
  if (!series) return undefined
  const k = strip(series)
    .replace(/^(colecao|serie|colec)\s+/, '')
    .replace(/[^a-z0-9]/g, '')
  return k.length >= 3 ? k : undefined
}
