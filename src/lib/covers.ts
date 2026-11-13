/** Capa real via OpenLibrary → Google Books; se falhar, a UI desenha a capa procedural. */
const cache = new Map<string, string | null>()

function probe(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth > 1) // OpenLibrary devolve GIF 1×1 quando não há capa
    img.onerror = () => resolve(false)
    img.src = url
  })
}

export async function findCover(isbn?: string): Promise<string | null> {
  if (!isbn) return null
  if (cache.has(isbn)) return cache.get(isbn)!
  let found: string | null = null
  try {
    const ol = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`
    if (await probe(ol)) found = ol
    else {
      const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`)
      if (r.ok) {
        const j = await r.json()
        const link: string | undefined = j?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail
        if (link) found = link.replace('http://', 'https://').replace('zoom=1', 'zoom=2')
      }
    }
  } catch {
    /* offline ou bloqueado: usa capa procedural */
  }
  cache.set(isbn, found)
  return found
}
