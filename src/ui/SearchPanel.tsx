import type { Hit, SearchField } from '../lib/search'
import { FIELD_LABELS } from '../lib/search'
import type { Layout } from '../lib/layout'
import { FILAS } from '../lib/sections'

interface Props {
  query: string
  setQuery: (q: string) => void
  field: SearchField
  setField: (f: SearchField) => void
  hits: Hit[]
  layout: Layout
  selectedId: string | null
  onSelect: (id: string) => void
  onLocate: (id: string) => void
}

export function SearchBox({ query, setQuery, field, setField }: Pick<Props, 'query' | 'setQuery' | 'field' | 'setField'>) {
  return (
    <div className="flex w-full max-w-xl items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 focus-within:border-navi/60">
      <span className="text-white/40">⌕</span>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por título, autor, assunto, CDD ou Cutter…"
        className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-white/35"
        aria-label="Buscar no acervo"
      />
      <select value={field} onChange={(e) => setField(e.target.value as SearchField)} className="rounded-md bg-ink-800 px-2 py-1 text-xs text-white/80 outline-none" aria-label="Campo de busca">
        {(Object.keys(FIELD_LABELS) as SearchField[]).map((k) => (
          <option key={k} value={k}>
            {FIELD_LABELS[k]}
          </option>
        ))}
      </select>
    </div>
  )
}

export function ResultsList({ hits, layout, selectedId, onSelect, onLocate, query }: Pick<Props, 'hits' | 'layout' | 'selectedId' | 'onSelect' | 'onLocate' | 'query'>) {
  if (!query.trim()) return null
  return (
    <section className="glass pointer-events-auto absolute bottom-4 left-4 top-[132px] z-20 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl shadow-2xl">
      <div className="border-b border-white/10 px-4 py-2.5 text-xs text-white/55">
        {hits.length ? `${hits.length}${hits.length === 50 ? '+' : ''} resultado(s)` : 'Nenhum resultado'}
      </div>
      <ul className="flex-1 divide-y divide-white/5 overflow-y-auto">
        {hits.map(({ book }) => {
          const s = layout.byBookId.get(book.id)
          const f = s ? FILAS[s.fila - 1] : undefined
          return (
            <li key={book.id} className={`px-4 py-2.5 ${selectedId === book.id ? 'bg-white/8' : 'hover:bg-white/5'}`}>
              <button onClick={() => onSelect(book.id)} className="block w-full text-left">
                <div className="line-clamp-2 text-[13px] font-medium text-white/95">{book.title}</div>
                <div className="truncate text-xs text-white/50">{book.author || 'Autor não informado'}</div>
              </button>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] text-white/60">
                  {f && <span className="h-2 w-2 rounded-full" style={{ background: f.color }} />}
                  {s ? `Fila ${s.fila} · Est. ${s.estante} · Prat. ${s.shelf}` : '—'}
                  <span className="text-[#d6b25e]">
                    {book.cdd} {book.cutter}
                  </span>
                </span>
                <button onClick={() => onLocate(book.id)} className="rounded-md border border-navi/40 px-2 py-0.5 text-[11px] font-medium text-navi hover:bg-navi/15">
                  ✦ Localizar na Estante
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
