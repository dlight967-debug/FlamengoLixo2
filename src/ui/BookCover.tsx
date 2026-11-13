import { useEffect, useState } from 'react'
import type { Book } from '../lib/types'
import { findCover } from '../lib/covers'
import { hashString } from '../lib/layout'

/** Capa real (OpenLibrary/Google Books) com fallback para capa procedural com título e autor. */
export function BookCover({ book, className = '' }: { book: Book; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setUrl(null)
    findCover(book.isbn).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [book.id, book.isbn])

  if (url) return <img src={url} alt={`Capa: ${book.title}`} className={`object-cover rounded-md shadow-xl ${className}`} onError={() => setUrl(null)} />

  const h = hashString(book.cdd + book.id)
  const hue = h % 360
  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-md p-4 shadow-xl ${className}`}
      style={{ background: `linear-gradient(155deg, hsl(${hue} 42% 30%), hsl(${(hue + 40) % 360} 48% 16%))`, aspectRatio: '2 / 3' }}
      role="img"
      aria-label={`Capa gerada: ${book.title}`}
    >
      <div className="absolute inset-y-0 left-0 w-2 bg-black/30" />
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20" style={{ background: `hsl(${(hue + 160) % 360} 70% 60%)` }} />
      <div className="pl-2 text-[11px] uppercase tracking-[0.18em] text-white/60">{book.publisher ?? 'Biblioteca'}</div>
      <div className="pl-2">
        <div className="font-display text-xl font-bold leading-tight text-paper" style={{ textWrap: 'balance' } as React.CSSProperties}>
          {book.title}
        </div>
        {book.subtitle && <div className="mt-1 text-xs text-white/60">{book.subtitle}</div>}
      </div>
      <div className="pl-2 text-sm text-white/80">{book.author || '—'}</div>
    </div>
  )
}
