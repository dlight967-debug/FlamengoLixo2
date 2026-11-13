import type { Book } from './types'
import { parseCdd, compareCdd, parseCutter, compareCutter, titleKey, collectionKey, cutterInitial } from './cdd'
import { classify, type Placement } from './routing'
import { FILAS, SECTIONS, SECTION_BY_ID, type Section } from './sections'

export const SHELVES_PER_FACE = 5
export const FACES = ['A', 'B'] as const
export type Face = (typeof FACES)[number]
export const SHELVES_PER_ESTANTE = SHELVES_PER_FACE * FACES.length // 10
export const SHELVES_PER_FILA = SHELVES_PER_ESTANTE * 3 // 30

export interface LayoutConfig {
  /** comprimento útil de cada prateleira (m) */
  shelfLength: number
  /** folga entre livros (m) */
  gap: number
}
export const DEFAULT_CONFIG: LayoutConfig = { shelfLength: 1.2, gap: 0.002 }

export interface Slot {
  book: Book
  fila: 1 | 2 | 3 | 4
  /** estante física 1..12 */
  estante: number
  face: Face
  /** 1..5, de cima para baixo */
  shelf: number
  /** posição (m) a partir da extremidade ESQUERDA de quem olha a face de frente */
  x: number
  thickness: number
  height: number
  depth: number
  section: Section
  reason: string
  /** movido por Regra de Coleções */
  groupedBy?: string
}

export interface FaceInfo {
  estante: number
  face: Face
  first?: Slot
  last?: Slot
  sections: Section[]
  count: number
}

export interface Layout {
  slots: Slot[]
  byBookId: Map<string, Slot>
  faces: FaceInfo[]
  overflow: Slot[]
  stats: { fila: 1 | 2 | 3 | 4; books: number; meters: number; capacity: number; shelvesUsed: number }[]
}

// ───────── dimensões físicas do livro ─────────
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
export const hashString = hash

export function bookDims(b: Book) {
  let tcm: number
  if (b.pages) tcm = Math.min(5, Math.max(0.5, 0.4 + b.pages * 0.0075))
  else if (!parseCdd(b.cdd).num) tcm = 0.3 // cartilha / folder
  else if (b.recordType === 's') tcm = 0.5 // periódico
  else tcm = 1.6
  const h = hash(b.id + b.title)
  const height = 0.19 + ((h % 100) / 100) * 0.12 + (b.pages && b.pages > 600 ? 0.02 : 0)
  const depth = 0.15 + (((h >> 8) % 100) / 100) * 0.07
  return { thickness: tcm / 100, height: Math.min(height, 0.32), depth }
}

// ───────── ordenação ─────────
const AMAZON_LIT_ORDER = (b: Book) => {
  const c = cutterInitial(b.cutter, b.author)
  return c >= 'O' ? 2 : c >= 'J' ? 1 : 0 // A–H(+I), J–N, O–Z
}

interface Item { book: Book; p: Placement; cdd: ReturnType<typeof parseCdd>; cut: ReturnType<typeof parseCutter>; tkey: string }

function cmpItems(a: Item, b: Item): number {
  return (
    a.p.section.order - b.p.section.order ||
    (a.p.section.id === 'f4-am-lit' ? AMAZON_LIT_ORDER(a.book) - AMAZON_LIT_ORDER(b.book) : 0) ||
    compareCdd(a.cdd, b.cdd) ||
    compareCutter(a.cut, b.cut) ||
    (a.tkey < b.tkey ? -1 : a.tkey > b.tkey ? 1 : 0)
  )
}

const volNum = (b: Book) => {
  const m = b.seriesVol?.match(/\d+/)
  return m ? +m[0] : Infinity
}

interface Unit { items: Item[]; anchor: Item; group?: string }

function buildUnits(items: Item[]): Unit[] {
  const groups = new Map<string, Item[]>()
  for (const it of items) {
    const k = collectionKey(it.book.series)
    if (!k || it.p.section.id === 'f4-sem') continue
    ;(groups.get(k) ?? groups.set(k, []).get(k)!).push(it)
  }
  const grouped = new Set<Item>()
  const units: Unit[] = []
  for (const [k, members] of groups) {
    if (members.length < 2 || members.length > 80) continue
    members.sort(cmpItems)
    const anchor = members[0]
    // volume numérico (490 $v) tem prioridade dentro da coleção
    members.sort((a, b) => volNum(a.book) - volNum(b.book) || cmpItems(a, b))
    members.forEach((m) => grouped.add(m))
    units.push({ items: members, anchor, group: anchor.book.series })
    void k
  }
  for (const it of items) if (!grouped.has(it)) units.push({ items: [it], anchor: it })
  units.sort((a, b) => cmpItems(a.anchor, b.anchor))
  return units
}

// ───────── alocação ─────────
export function buildLayout(books: Book[], cfg: LayoutConfig = DEFAULT_CONFIG): Layout {
  const items: Item[] = books.map((book) => ({
    book,
    p: classify(book),
    cdd: parseCdd(book.cdd),
    cut: parseCutter(book.cutter),
    tkey: titleKey(book.title),
  }))

  // Regra de Coleções: a coleção inteira vai para a fila/seção do seu "âncora"
  const slots: Slot[] = []
  const overflow: Slot[] = []
  const stats: Layout['stats'] = []
  const byFila = new Map<number, Item[]>([[1, []], [2, []], [3, []], [4, []]])

  const units = buildUnits(items)
  const placedFila = new Map<Item, number>()
  for (const u of units) for (const it of u.items) placedFila.set(it, u.anchor.p.section.fila)
  for (const u of units) byFila.get(u.anchor.p.section.fila)!.push(...u.items) // mantém ordem das unidades

  const usable = cfg.shelfLength
  for (const fila of FILAS) {
    const list = byFila.get(fila.n)!
    const filaUnits = units.filter((u) => u.anchor.p.section.fila === fila.n)
    let shelfIdx = 0
    let cursor = 0
    let meters = 0
    const place = (it: Item, groupedBy?: string) => {
      const d = bookDims(it.book)
      const w = d.thickness + cfg.gap
      meters += w
      if (cursor + w > usable && cursor > 0) { shelfIdx++; cursor = 0 }
      const over = shelfIdx >= SHELVES_PER_FILA
      const idx = Math.min(shelfIdx, SHELVES_PER_FILA - 1)
      const estLocal = Math.floor(idx / SHELVES_PER_ESTANTE)
      const within = idx % SHELVES_PER_ESTANTE
      const slot: Slot = {
        book: it.book,
        fila: fila.n,
        estante: fila.estantes[estLocal],
        face: FACES[Math.floor(within / SHELVES_PER_FACE)],
        shelf: (within % SHELVES_PER_FACE) + 1,
        x: cursor,
        ...d,
        section: it.p.section.fila === fila.n ? it.p.section : filaUnitsSection(filaUnits, it),
        reason: it.p.reason,
        groupedBy,
      }
      if (over) overflow.push(slot)
      else slots.push(slot)
      cursor += w
    }
    for (const u of filaUnits) {
      const width = u.items.reduce((s, it) => s + bookDims(it.book).thickness + cfg.gap, 0)
      // Coleção inseparável: se cabe numa prateleira vazia mas não no espaço restante, pula para a próxima
      if (u.items.length > 1 && cursor + width > usable && width <= usable && cursor > 0) { shelfIdx++; cursor = 0 }
      for (const it of u.items) place(it, u.group)
    }
    stats.push({
      fila: fila.n,
      books: list.length,
      meters,
      capacity: SHELVES_PER_FILA * usable,
      shelvesUsed: Math.min(SHELVES_PER_FILA, shelfIdx + 1),
    })
  }

  // seção "efetiva" do livro agrupado: a do âncora
  function filaUnitsSection(_u: Unit[], it: Item): Section {
    const u = _u.find((x) => x.items.includes(it))
    return u ? u.anchor.p.section : it.p.section
  }

  // placas: faixa de cada face de estante
  const faces: FaceInfo[] = []
  for (const f of FILAS)
    for (const est of f.estantes)
      for (const face of FACES) {
        const here = slots.filter((s) => s.estante === est && s.face === face)
        faces.push({
          estante: est,
          face,
          first: here[0],
          last: here[here.length - 1],
          count: here.length,
          sections: [...new Set(here.map((s) => s.section))].sort((a, b) => a.order - b.order),
        })
      }

  return { slots, byBookId: new Map(slots.map((s) => [s.book.id, s])), faces, overflow, stats }
}

export const callLabel = (b: Book) => [b.cdd, b.cutter].filter(Boolean).join(' ')

export function physicalPath(s: Slot): string {
  const f = FACES.indexOf(s.face) === 0 ? 'Frente' : 'Verso'
  return `Fila ${s.fila} > Estante ${s.estante} > ${f} (${s.face}) > Prateleira ${s.shelf} > CDD ${s.book.cdd || '—'} | Cutter ${s.book.cutter || '—'}`
}

export { SECTIONS, SECTION_BY_ID, FILAS }
