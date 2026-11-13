import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Scene } from './three/Scene'
import { createNaviApi, type GuideRequest } from './three/Navi'
import type { CamRequest } from './three/CameraRig'
import { ROW_X0, rowZ, slotWorld } from './three/world'
import { buildLayout, callLabel } from './lib/layout'
import { FILAS } from './lib/sections'
import { searchBooks, type SearchField } from './lib/search'
import { loadDefault, loadFile, type Loaded } from './lib/loader'
import { BookCard } from './ui/BookCard'
import { ResultsList, SearchBox } from './ui/SearchPanel'

export default function App() {
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [field, setField] = useState<SearchField>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pulled, setPulled] = useState(false)
  const [guide, setGuide] = useState<GuideRequest | null>(null)
  const [cam, setCam] = useState<CamRequest | null>(null)
  const [guiding, setGuiding] = useState(false)
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null)
  const nav = useRef(createNaviApi())
  const counter = useRef(0)
  const guideBook = useRef<string | null>(null)
  const selectedRef = useRef<string | null>(null)
  selectedRef.current = selectedId
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadDefault().then(setData).catch((e) => setError(String(e)))
  }, [])

  const layout = useMemo(() => (data ? buildLayout(data.books) : null), [data])
  const hits = useMemo(() => (data ? searchBooks(data.books, query, field) : []), [data, query, field])
  const selected = useMemo(() => (selectedId && data ? data.books.find((b) => b.id === selectedId) : undefined), [selectedId, data])
  const selectedSlot = selectedId && layout ? layout.byBookId.get(selectedId) : undefined

  const select = useCallback((id: string | null) => {
    setSelectedId(id)
    setPulled(id !== null)
  }, [])

  const locate = useCallback(
    (id: string) => {
      const slot = layout?.byBookId.get(id)
      if (!slot) return
      const w = slotWorld(slot)
      const rid = ++counter.current
      nav.current.frameCam.copy(w.pos).addScaledVector(w.normal, 1.9)
      nav.current.frameCam.y = Math.max(w.pos.y, 0.9) + 0.05
      nav.current.frameLook.copy(w.pos)
      guideBook.current = id
      setSelectedId(id)
      setPulled(false)
      setGuiding(true)
      setGuide({ id: rid, target: w.pos.clone(), normal: w.normal.clone(), fila: slot.fila, face: slot.face })
      setCam({ id: rid, kind: 'guide' })
    },
    [layout],
  )

  const onArrive = useCallback(() => {
    setGuiding(false)
    if (selectedRef.current === guideBook.current) setPulled(true)
  }, [])

  const flyTo = (pos: [number, number, number], look: [number, number, number]) => {
    setGuiding(false)
    setCam({ id: ++counter.current, kind: 'pose', pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...look) })
  }

  const onImport = async (file?: File) => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const r = await loadFile(file)
      if (!r.books.length) throw new Error('Nenhum registro MARC encontrado no arquivo.')
      setData(r)
      select(null)
      setQuery('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && select(null)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [select])

  const hoverBook = hover && data ? data.books.find((b) => b.id === hover.id) : undefined

  return (
    <div className="relative h-full w-full overflow-hidden">
      {layout && (
        <Scene
          layout={layout}
          highlightId={selectedId}
          pulled={pulled}
          nav={nav}
          guide={guide}
          cam={cam}
          onArrive={onArrive}
          onPick={(id) => {
            setGuiding(false)
            select(id)
          }}
          onHover={(id, x, y) => setHover(id ? { id, x, y } : null)}
        />
      )}

      {/* barra superior */}
      <header className="glass pointer-events-auto absolute inset-x-4 top-4 z-30 rounded-2xl px-4 py-3 shadow-2xl">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="leading-tight">
            <h1 className="font-display text-xl font-bold text-paper">Estante Virtual</h1>
            <p className="max-w-[260px] truncate text-[11px] text-white/45">{data?.source ?? 'Carregando acervo…'}</p>
          </div>
          <SearchBox query={query} setQuery={setQuery} field={field} setField={setField} />
          <button
            onClick={() => fileInput.current?.click()}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium hover:bg-white/10"
            disabled={loading}
          >
            {loading ? 'Lendo arquivo…' : 'Importar Arquivo Biblivre (.mrc / .iso)'}
          </button>
          <input ref={fileInput} type="file" accept=".mrc,.iso,.txt,.b5bz,.zip" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
          {data && (
            <span className="ml-auto text-xs text-white/50">
              {data.report.parsed.toLocaleString('pt-BR')} obras
              {data.report.skipped > 0 && <span className="text-amber-300"> · {data.report.skipped} ignoradas</span>}
              {layout && layout.overflow.length > 0 && <span className="text-amber-300"> · {layout.overflow.length} excedentes</span>}
            </span>
          )}
        </div>
        <nav className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-white/40">Ir para:</span>
          <button className="rounded-full border border-white/15 px-3 py-1 hover:bg-white/10" onClick={() => flyTo([-9.5, 6.5, 11.5], [0, 1, 0])}>
            Visão geral
          </button>
          {FILAS.map((f) => {
            const st = layout?.stats.find((s) => s.fila === f.n)
            return (
              <button
                key={f.n}
                className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 hover:bg-white/10"
                onClick={() => flyTo([ROW_X0 - 3.4, 1.9, rowZ(f.n) + 1.5], [0, 1.1, rowZ(f.n)])}
                title={f.name}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: f.color }} />
                Fila {f.n} · {f.sign.startsWith('PRAT') ? f.sign.replace('PRATELEIRA', 'Prat.') : 'Amazônia'}
                {st && <span className="text-white/40">({st.books})</span>}
              </button>
            )
          })}
        </nav>
        {error && <p className="mt-2 rounded-md bg-red-500/15 px-3 py-1.5 text-xs text-red-200">⚠ {error}</p>}
        {data && data.report.errors.length > 0 && <p className="mt-2 text-[11px] text-amber-300/80">Avisos do parser: {data.report.errors.slice(0, 2).join(' · ')}</p>}
      </header>

      {layout && data && (
        <ResultsList
          query={query}
          hits={hits}
          layout={layout}
          selectedId={selectedId}
          onSelect={(id) => {
            setGuiding(false)
            select(id)
          }}
          onLocate={locate}
        />
      )}
      {selected && (
        <BookCard book={selected} slot={selectedSlot} guiding={guiding} onClose={() => select(null)} onLocate={() => locate(selected.id)} />
      )}

      {hoverBook && hover && (
        <div className="pointer-events-none fixed z-40 max-w-xs rounded-lg bg-black/85 px-3 py-1.5 text-xs shadow-xl" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <div className="font-medium text-white">{hoverBook.title}</div>
          <div className="text-white/60">
            {hoverBook.author || '—'} · <span className="text-[#d6b25e]">{callLabel(hoverBook)}</span>
          </div>
        </div>
      )}

      <p className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 text-[11px] text-white/35">
        Arraste para girar · roda do mouse para zoom · botão direito para mover · clique numa lombada para ver a ficha
      </p>
    </div>
  )
}
