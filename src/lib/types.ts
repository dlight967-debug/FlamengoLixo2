export interface Copies {
  total: number
  available: number
  tombos: string[]
}

export interface Book {
  /** id estável (001 ou id do banco) */
  id: string
  control: string
  isbn?: string
  /** CDD (090 $a / 082 $a) */
  cdd: string
  /** Cutter (090 $b) */
  cutter: string
  author: string
  title: string
  subtitle?: string
  place?: string
  publisher?: string
  year?: string
  pagesRaw?: string
  pages?: number
  series?: string
  seriesVol?: string
  subjects: string[]
  notes?: string
  /** tipo do registro (líder pos. 7: m = monografia, s = periódico) */
  recordType: string
  copies?: Copies
}

export interface ParseReport {
  total: number
  parsed: number
  skipped: number
  errors: string[]
}
