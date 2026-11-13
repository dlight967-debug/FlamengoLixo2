import type { Book } from './types'
import { parseCdd, cddValue, cutterInitial, type CddKey } from './cdd'
import { SECTION_BY_ID, type Section } from './sections'

const ac = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const RE_REGIONAL = /(Amaz[ôo]ni|Pará(?!\p{L})|Bel[ée]m|paraense|Maraj[óo]|Tapaj[óo]s)/u
const RE_TRANSIT = /(tr[âa]nsito|detran|tr[âa]fego)/i
const RE_PERIODIC = /peri[óo]dico/i

/** forma canônica "363.12565" com 3 dígitos na parte inteira, para testes de prefixo */
const canon = (k: CddKey) => (k.num ? String(k.int).padStart(3, '0') + (k.frac ? '.' + k.frac : '') : '')

function amazoniaSection(k: CddKey, v: number, c: string, regionalLit: boolean): string {
  if (c.startsWith('050')) return 'f4-am-per'
  if (c.startsWith('352.13')) return 'f4-am-rel'
  if (c.startsWith('869') || regionalLit) return 'f4-am-lit'
  if (c.startsWith('981.15')) return 'f4-am-hist'
  if (k.int >= 920 && k.int < 930) return 'f4-am-bio'
  if (k.int >= 900 && k.int < 1000) return 'f4-am-hist'
  if (k.int >= 800) return 'f4-am-lit'
  if (k.int >= 500) return 'f4-am-cien'
  if (k.int >= 400) return 'f4-am-ling'
  return 'f4-am-ger'
}

/** Seções de Trânsito definidas por prefixo de CDD (têm precedência sobre palavras-chave). */
function transitByCdd(c: string): string | null {
  if (c.startsWith('341.376')) return 'f1-res'
  if (/^343\.(\d\d)?0946/.test(c)) return 'f1-ctb' // 343.0946 e variantes por jurisdição (343.810946)
  if (c.startsWith('363.115')) return 'f1-hist'
  if (c.startsWith('363.125')) return c.startsWith('363.1257') ? 'f1-form' : 'f1-acid'
  if (c.startsWith('363.1') || c.startsWith('363.2')) return 'f1-fisc'
  if (c.startsWith('372.83')) return 'f1-edu'
  if (c.startsWith('388.41019') || c.startsWith('388.4')) return c.startsWith('388.41019') ? 'f1-psi' : 'f1-gest'
  if (c.startsWith('388.1') || c.startsWith('388.2')) return 'f1-transp'
  if (c.startsWith('388.3')) return 'f1-gest'
  if (c.startsWith('629.2027')) return 'f1-vist'
  if (c.startsWith('629.04')) return 'f1-eng'
  return null
}

/** Para obras cuja CDD é compartilhada mas o assunto 650 é Trânsito. */
function transitBySubject(subj: string): string {
  const s = ac(subj)
  if (/legisla|resolu|lei\b|leis\b|norma/.test(s)) return 'f1-res'
  if (/educa|ensino|escola/.test(s)) return 'f1-edu'
  if (/psicolog|comportament/.test(s)) return 'f1-psi'
  if (/acidente|estatistic/.test(s)) return 'f1-acid'
  if (/habilita|condutor|motorista|formacao/.test(s)) return 'f1-form'
  if (/fiscaliza|seguranca|policia/.test(s)) return 'f1-fisc'
  if (/engenharia|sinaliza|via(s)? /.test(s)) return 'f1-eng'
  if (/transporte|onibus/.test(s)) return 'f1-transp'
  if (/mobilidade|gestao|planejamento/.test(s)) return 'f1-gest'
  if (/historia/.test(s)) return 'f1-hist'
  return 'f1-388'
}

export interface Placement {
  section: Section
  reason: string
}

const sec = (id: string, reason: string): Placement => ({ section: SECTION_BY_ID.get(id)!, reason })

export function classify(b: Book): Placement {
  const k = parseCdd(b.cdd)
  const v = cddValue(k)
  const c = canon(k)
  const subj = b.subjects.join(' | ')
  const textRegional = `${subj} | ${b.title} | ${b.series ?? ''}`
  const regional = RE_REGIONAL.test(textRegional) || c.startsWith('981.15') || c.startsWith('869.8991')
  const isTransitSubj = RE_TRANSIT.test(subj)
  const periodic = b.recordType === 's' || RE_PERIODIC.test(subj)
  const serieKey = ac(b.series ?? '').replace(/[^a-z]/g, '')

  if (!b.cdd) return sec('f4-sem', 'sem 090 $a')

  // 1) CDD alfanumérica (Cart.36, Folder. 13): material de Trânsito (cartilhas/folders) → 388
  if (!k.num) return regional && !isTransitSubj ? sec('f4-am-ger', 'material efêmero regional') : sec('f1-388', 'cartilha/folder')

  // 2) Coleção Primeiros Passos (086.9) — mesma coleção, mesma prateleira
  if (serieKey.includes('primeirospassos') || c.startsWith('086.9')) return sec('f1-pp', 'Coleção Primeiros Passos')

  // 3) Periódicos
  if (periodic) {
    if (c.startsWith('050') && regional) return sec('f4-am-per', 'periódico regional')
    if (regional && !isTransitSubj && !c.startsWith('388')) return sec('f4-am-per', 'periódico regional')
    if (c.startsWith('388') || isTransitSubj) return sec('f4-per388', 'periódico de trânsito')
    return sec('f4-per', 'periódico')
  }

  // 4) Trânsito por CDD (precede regional)
  const t = transitByCdd(c)
  if (t) return sec(t, 'CDD de Trânsito')

  // 5) Fixos de Fila 1
  if (v >= 30 && v < 40) return sec('f1-enc', 'Enciclopédia (03x)')
  if (c.startsWith('469.3')) return sec('f1-dic', 'Dicionário')
  if (c.startsWith('388')) return sec('f1-388', '388 genérico (Trânsito)')

  // 6) Outros de Fila 4 com CDD própria
  if (c.startsWith('370.16')) return sec('f4-enem', 'ENEM / Concurso')
  if (c.startsWith('352.13')) return sec('f4-am-rel', 'Relatórios')
  if (k.int === 50) return sec('f4-per', 'Outros Periódicos')

  // 7) Literatura brasileira 869: Cutter decide A–R (Fila 3) × S–Z (Fila 4); regionais → Amazônia
  if (c.startsWith('869')) {
    if (c.startsWith('869.8991')) return sec('f4-am-lit', 'CDD 869.8991 (Amazônia-Pará)')
    if (regional && v !== 869) return sec('f4-am-lit', 'literatura regional')
    if (v >= 869.01 && v <= 869.93) return sec('f4-crit', 'História/Crítica/Antologias')
    const ini = cutterInitial(b.cutter, b.author)
    return ini && ini > 'R' ? sec('f4-br', 'Cutter S–Z') : sec('f3-br', 'Cutter A–R')
  }

  // 8) Tema regional (Amazônia / Pará / Belém) com CDD compartilhada
  if (regional) return sec(amazoniaSection(k, v, c, false), 'assunto regional')

  // 9) Assunto Trânsito em CDD compartilhada
  if (isTransitSubj && b.subjects.some((s) => /^\s*tr[âa]nsito/i.test(s))) return sec(transitBySubject(subj), 'assunto Trânsito')

  // 10) Faixas de CDD por fila (tabela de roteamento)
  const n = k.int
  if (v >= 1 && v < 4) return sec('f2-met', 'Metodologia')
  if (n >= 4 && n < 7) return sec('f2-comp', 'Computação')
  if (n >= 7 && n < 20) return sec('f2-comp', 'Computação (faixa vizinha)')
  if (c.startsWith('028.5')) return sec('f2-inf', 'Infanto-juvenil')
  if (n >= 20 && n < 29) return sec('f2-bib', 'Biblioteconomia')
  if (n >= 29 && n < 100) return sec('f2-bib', 'Generalidades (faixa vizinha)')
  if (n >= 100 && n < 130) return sec('f2-fil', 'Filosofia')
  if (c.startsWith('133.93')) return sec('f2-rom', 'Romance psicografado')
  if (n >= 130 && n < 150) return sec('f2-par', 'Parapsicologia')
  if (n >= 150 && n < 200) return sec('f2-psi', 'Psicologia (158 = autoajuda/pais e filhos)')
  if (n >= 200 && n < 300) return sec('f2-rel', 'Religião')
  if (n >= 300 && n < 320) return sec('f2-soc', 'Ciências Sociais')
  if (n >= 320 && n < 330) return sec('f2-pol', 'Ciências Políticas')
  if (n >= 330 && n < 340) return sec('f2-eco', 'Ciências Econômicas')
  if (n === 340) return v === 340 ? sec('f2-dir', 'Direito Geral') : sec('f2-dirt', 'Direito - Teoria')
  if (n === 341 || (n === 342 && v < 342.0282)) return sec('f2-dirc', 'Direito Int./Constitucional')
  if (n === 342) return sec('f2-dira', 'Direito Administrativo')
  if (n === 343) return sec('f2-dirx', 'Direito Tributário (343 não-Trânsito)')
  if (n === 344) return sec('f2-dirw', 'Direito do Trabalho')
  if (n === 345) return sec('f2-dirp', 'Direito Penal')
  if (n === 346) return sec('f2-dirx', 'Direito Comercial')
  if (n === 347) return sec('f2-dirv', 'Direito Civil')
  if (n >= 348 && n < 350) return sec('f2-dire', 'Estatutos/Normas')
  if (n >= 350 && n < 370) return sec('f2-soc', 'Ciências Sociais (faixa vizinha)')
  if (n === 370) return sec('f3-e370', 'Educação')
  if (n === 371) return sec('f3-e371', 'Educação')
  if (n >= 372 && n < 380) return sec('f3-e372', 'Educação')
  if (n >= 380 && n < 400) return sec('f2-soc', 'Ciências Sociais (faixa vizinha)')
  if (n >= 400 && n < 420) return sec('f3-gram', 'Linguística')
  if (n >= 420 && n < 469) return sec('f3-ing', 'Idiomas')
  if (n === 469) return v < 469.08 ? sec('f3-lp', 'Língua Portuguesa') : sec('f3-gram', 'Gramática/Linguística')
  if (n >= 470 && n < 500) return sec('f3-ing', 'Idiomas')
  if (n >= 500 && n < 530) return sec('f3-mat', 'Matemática/Estatística')
  if (n >= 530 && n < 540) return sec('f3-fis', 'Física')
  if (n >= 540 && n < 570) return sec('f3-qui', 'Química')
  if (n >= 570 && n < 600) return sec('f3-bio', 'Biologia/Meio Ambiente')
  if (n >= 600 && n < 650) return sec('f3-med', 'Medicina/Saúde')
  if (n >= 650 && n < 658) return sec(n === 657 ? 'f3-cont' : 'f3-adm', 'Contabilidade/Administração')
  if (n >= 658 && n < 700) return sec('f3-adm', 'Administração')
  if (n >= 700 && n < 800) return sec('f3-art', 'Artes')
  if (v >= 808 && v < 809) return sec('f3-lest', 'Literatura - Estudo e Ensino')
  if (n === 807) return sec('f3-lest', 'Literatura - Estudo e Ensino')
  if (n >= 810 && n < 820) return sec('f3-usa', 'Literatura Americana')
  if (n >= 800 && n < 900) return sec('f3-lit', 'Literatura Geral')
  if (n >= 907 && n < 910) return sec('f4-hist', 'História Geral')
  if (n === 910) return sec('f4-geo', 'Geografia Geral')
  if (n >= 920 && n < 930) return sec('f4-bio', 'Biografia')
  if (n >= 900 && n < 1000) return sec('f4-hist', 'História (faixa vizinha)')
  return sec('f4-sem', 'CDD fora das faixas')
}
