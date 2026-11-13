import type { Book } from './types'
import { callLabel } from './layout'

export type SearchField = 'all' | 'title' | 'author' | 'subject' | 'cdd' | 'cutter'

export const FIELD_LABELS: Record<SearchField, string> = {
  all: 'Tudo',
  title: 'Título',
  author: 'Autor',
  subject: 'Assunto',
  cdd: 'CDD',
  cutter: 'Cutter',
}

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export interface Hit { book: Book; score: number }

export function searchBooks(books: Book[], query: string, field: SearchField, limit = 50): Hit[] {
  const q = norm(query.trim())
  if (!q) return []
  const terms = q.split(/\s+/).filter(Boolean)
  const hits: Hit[] = []
  for (const b of books) {
    const title = norm(`${b.title} ${b.subtitle ?? ''}`)
    const author = norm(b.author)
    const subj = norm(b.subjects.join(' '))
    const cdd = norm(b.cdd)
    const cutter = norm(b.cutter)
    const series = norm(b.series ?? '')
    const isbn = b.isbn ?? ''
    let score = 0
    const test = (hay: string, w: number, prefixOnly = false) => {
      if (terms.every((t) => (prefixOnly ? hay.startsWith(t) : hay.includes(t)))) score += hay.startsWith(terms[0]) ? w * 1.5 : w
    }
    if (field === 'all' || field === 'title') test(title, 10)
    if (field === 'all' || field === 'author') test(author, 6)
    if (field === 'all' || field === 'subject') { test(subj, 4); test(series, 3) }
    if (field === 'all' || field === 'cdd') test(cdd, 8, true)
    if (field === 'all' || field === 'cutter') test(cutter, 8, true)
    if (field === 'all' && isbn && isbn.includes(q.replace(/-/g, ''))) score += 12
    if (field === 'all' && terms.length > 1) test(norm(`${title} ${author} ${subj} ${series} ${cdd} ${cutter}`), 2) // termos espalhados em campos diferentes
    if (score > 0) hits.push({ book: b, score })
  }
  hits.sort((a, b) => b.score - a.score || a.book.title.localeCompare(b.book.title, 'pt'))
  return hits.slice(0, limit)
}

export const hitLabel = (b: Book) => `${b.title}${b.author ? ' — ' + b.author : ''} · ${callLabel(b)}`
