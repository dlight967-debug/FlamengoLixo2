import * as THREE from 'three'

export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  draw(ctx, w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight = '600', family = 'Inter, system-ui, sans-serif'): number {
  let s = size
  do {
    ctx.font = `${weight} ${s}px ${family}`
    if (ctx.measureText(text).width <= maxW) break
    s -= 2
  } while (s > 10)
  return s
}

const labelCache = new Map<string, THREE.CanvasTexture>()

/** Etiqueta branca da lombada: CDD e Cutter em duas linhas (texto girado, lê-se de baixo para cima). */
export function labelTexture(cdd: string, cutter: string): THREE.CanvasTexture {
  const key = cdd + '\n' + cutter
  const hit = labelCache.get(key)
  if (hit) return hit
  const t = canvasTexture(96, 288, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#c8c8c8'
    ctx.lineWidth = 3
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3)
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillStyle = '#111'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const s1 = fitText(ctx, cdd || '—', h - 24, 40, '700')
    ctx.fillText(cdd || '—', 0, -22)
    if (cutter) {
      fitText(ctx, cutter, h - 24, Math.min(s1, 36), '600')
      ctx.fillText(cutter, 0, 22)
    }
    ctx.restore()
  })
  labelCache.set(key, t)
  return t
}

let wingTex: THREE.CanvasTexture | null = null
/** Asa translúcida de fada (gota alongada com degradê ciano). */
export function wingTexture(): THREE.CanvasTexture {
  if (wingTex) return wingTex
  wingTex = canvasTexture(128, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h * 0.7, 4, w / 2, h * 0.55, h * 0.5)
    g.addColorStop(0, 'rgba(255,255,255,0.95)')
    g.addColorStop(0.5, 'rgba(160,245,255,0.55)')
    g.addColorStop(1, 'rgba(100,220,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(w / 2, h * 0.55, w * 0.34, h * 0.42, 0, 0, Math.PI * 2)
    ctx.fill()
  })
  return wingTex
}

let glowTex: THREE.CanvasTexture | null = null
export function glowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex
  glowTex = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.25, 'rgba(125,249,255,0.7)')
    g.addColorStop(1, 'rgba(125,249,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
  return glowTex
}
