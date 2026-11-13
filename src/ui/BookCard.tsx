import type { Book } from '../lib/types'
import { physicalPath, type Slot } from '../lib/layout'
import { FILAS } from '../lib/sections'
import { BookCover } from './BookCover'

const Row = ({ k, v }: { k: string; v?: string | number | null }) =>
  v ? (
    <div className="grid grid-cols-[92px_1fr] gap-2 border-b border-white/5 py-1.5 text-[13px]">
      <dt className="text-white/45">{k}</dt>
      <dd className="text-white/90">{v}</dd>
    </div>
  ) : null

export function BookCard({ book, slot, onLocate, onClose, guiding }: { book: Book; slot?: Slot; onLocate: () => void; onClose: () => void; guiding: boolean }) {
  const fila = slot ? FILAS[slot.fila - 1] : undefined
  const pub = [book.place, book.publisher, book.year].filter(Boolean).join(' · ')
  return (
    <aside className="glass pointer-events-auto absolute bottom-4 right-4 top-[132px] z-20 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="text-[11px] uppercase tracking-[0.16em] text-navi/80">Ficha catalográfica</div>
        <button onClick={onClose} className="rounded-md px-2 text-lg leading-none text-white/50 hover:bg-white/10 hover:text-white" aria-label="Fechar">
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="mx-auto mt-4 w-[170px]">
          <BookCover book={book} className="w-full" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold leading-snug text-paper">{book.title}</h2>
        {book.subtitle && <p className="text-sm text-white/60">{book.subtitle}</p>}
        <p className="mt-1 text-sm text-white/80">{book.author || 'Autor não informado'}</p>

        {slot && fila && (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-white/45">Caminho físico</div>
            <ol className="flex flex-wrap items-center gap-1.5 text-[12px] font-medium">
              {[
                [`Fila ${slot.fila}`, fila.color],
                [`Estante ${slot.estante}`, '#7d8896'],
                [slot.face === 'A' ? 'Frente (A)' : 'Verso (B)', '#7d8896'],
                [`Prateleira ${slot.shelf}`, '#7d8896'],
                [`CDD ${book.cdd || '—'}`, '#d6b25e'],
                [`Cutter ${book.cutter || '—'}`, '#d6b25e'],
              ].map(([t, c], i, a) => (
                <li key={t} className="flex items-center gap-1.5">
                  <span className="rounded-md px-2 py-0.5 text-black" style={{ background: c }}>
                    {t}
                  </span>
                  {i < a.length - 1 && <span className="text-white/30">›</span>}
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[12px] text-white/55">
              {fila.sign} · {slot.section.label}
              {slot.groupedBy && <span className="block text-navi/80">Coleção inseparável: “{slot.groupedBy}”</span>}
            </p>
            <p className="sr-only">{physicalPath(slot)}</p>
          </div>
        )}

        <button
          onClick={onLocate}
          disabled={!slot}
          className="mt-3 w-full rounded-xl bg-navi px-4 py-2.5 text-sm font-semibold text-ink-950 shadow-[0_0_24px_rgba(125,249,255,0.35)] transition hover:brightness-110 disabled:opacity-40"
        >
          {guiding ? '✦ A fada está guiando…' : '✦ Localizar na Estante'}
        </button>

        <dl className="mt-4">
          <Row k="Publicação" v={pub} />
          <Row k="Descrição" v={book.pagesRaw} />
          <Row k="Série" v={book.series ? `${book.series}${book.seriesVol ? ' ; ' + book.seriesVol : ''}` : undefined} />
          <Row k="ISBN" v={book.isbn} />
          <Row k="Controle (001)" v={book.control} />
          <Row k="Exemplares" v={book.copies ? `${book.copies.total} (${book.copies.available} disponível)` : undefined} />
          <Row k="Tombo" v={book.copies?.tombos.slice(0, 3).join(', ')} />
          <Row k="Notas" v={book.notes} />
        </dl>
        {book.subjects.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {book.subjects.slice(0, 10).map((s) => (
              <span key={s} className="rounded-full bg-white/8 px-2 py-0.5 text-[11px] text-white/70">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
