/** Catálogo físico: 4 filas (corredores) e suas seções de acervo, na ordem física das prateleiras. */

export interface FilaDef {
  n: 1 | 2 | 3 | 4
  name: string
  /** texto da placa de cabeceira, conforme a sinalização real */
  sign: string
  /** estantes físicas (1-based) */
  estantes: [number, number, number]
  color: string
}

export const FILAS: FilaDef[] = [
  { n: 1, name: 'Especial Trânsito', sign: 'PRATELEIRA 1 e 2', estantes: [1, 2, 3], color: '#e8a317' },
  { n: 2, name: 'Acervo Geral I', sign: 'PRATELEIRA 3 e 4', estantes: [4, 5, 6], color: '#2f80ed' },
  { n: 3, name: 'Acervo Geral II', sign: 'PRATELEIRA 5 e 6', estantes: [7, 8, 9], color: '#27ae60' },
  { n: 4, name: 'Amazônia & Outros', sign: 'AMAZÔNIA & OUTROS', estantes: [10, 11, 12], color: '#c0392b' },
]

export interface Section {
  id: string
  fila: 1 | 2 | 3 | 4
  /** ordem física global (menor = mais perto do início da fila) */
  order: number
  label: string
  /** faixa de CDD exibida nas placas */
  range: string
}

let n = 0
const S = (id: string, fila: 1 | 2 | 3 | 4, range: string, label: string): Section => ({ id, fila, order: n++, range, label })

export const SECTIONS: Section[] = [
  // ───── FILA 1 — Especial Trânsito ─────
  S('f1-enc', 1, '030', 'Enciclopédia'),
  S('f1-pp', 1, '086.9', 'Coleção Primeiros Passos'),
  S('f1-dic', 1, '469.3', 'Dicionário'),
  S('f1-res', 1, '341.376', 'Trânsito - Resoluções/Leis'),
  S('f1-ctb', 1, '343.0946', 'Código de Trânsito Brasileiro'),
  S('f1-hist', 1, '363.1150981', 'Trânsito - História'),
  S('f1-acid', 1, '363.12565', 'Trânsito - Acidente/Estatística'),
  S('f1-form', 1, '363.1257', 'Trânsito - Formação de Condutores'),
  S('f1-fisc', 1, '363.2', 'Trânsito - Fiscalização/Segurança'),
  S('f1-edu', 1, '372.83', 'Trânsito - Educação'),
  S('f1-transp', 1, '388.1', 'Trânsito - Transporte'),
  S('f1-gest', 1, '388.3', 'Trânsito - Gestão/Mobilidade'),
  S('f1-psi', 1, '388.41019', 'Trânsito - Aspectos Psicológicos'),
  S('f1-eng', 1, '629.04', 'Trânsito - Engenharia'),
  S('f1-vist', 1, '629.2027', 'Trânsito - Vistoria'),
  S('f1-388', 1, '388', 'Trânsito - Revista / Cartilha / Trabalhos Acadêmicos / Legislação e Relatório Detran-PA'),
  // ───── FILA 2 — Acervo Geral I ─────
  S('f2-met', 2, '001.4-001.42', 'Metodologia'),
  S('f2-comp', 2, '004-006', 'Ciência da Computação'),
  S('f2-bib', 2, '020-028', 'Biblioteca/Ciência da Informação'),
  S('f2-inf', 2, '028.5', 'Literatura Infanto-Juvenil'),
  S('f2-fil', 2, '100-129', 'Filosofia'),
  S('f2-par', 2, '130-149', 'Parapsicologia'),
  S('f2-rom', 2, '133.93', 'Romance Psicografado'),
  S('f2-psi', 2, '150-157', 'Psicologia - Pais e Filhos'),
  S('f2-rel', 2, '200', 'Religião'),
  S('f2-soc', 2, '300-319', 'Ciências Sociais'),
  S('f2-pol', 2, '320-329', 'Ciências Políticas'),
  S('f2-eco', 2, '330-339', 'Ciências Econômicas'),
  S('f2-dir', 2, '340', 'Direito Geral'),
  S('f2-dirt', 2, '340.01-340.9', 'Direito - Teoria/Dicionário/Vade Mecum'),
  S('f2-dirc', 2, '341-342.0281', 'Direito Internacional/Constitucional'),
  S('f2-dira', 2, '342.088', 'Direito Administrativo'),
  S('f2-dirw', 2, '344-344.09', 'Direito do Trabalho/Previdenciário'),
  S('f2-dirp', 2, '345', 'Direito Penal/Processual Penal'),
  S('f2-dirx', 2, '346-346.9', 'Direito Tributário/Comercial'),
  S('f2-dirv', 2, '347', 'Direito Civil/Processual Civil'),
  S('f2-dire', 2, '348-348.2', 'Direito - Estatutos/Normas'),
  // ───── FILA 3 — Acervo Geral II ─────
  S('f3-e370', 3, '370', 'Educação'),
  S('f3-e371', 3, '371', 'Educação'),
  S('f3-e372', 3, '372-372.9', 'Educação'),
  S('f3-ing', 3, '420-450', 'Inglês/Espanhol'),
  S('f3-lp', 3, '469-469.07', 'Língua Portuguesa'),
  S('f3-gram', 3, '469.5-469.9', 'Gramática/Linguística'),
  S('f3-mat', 3, '500', 'Matemática / Estatística'),
  S('f3-fis', 3, '530', 'Física'),
  S('f3-qui', 3, '540', 'Química'),
  S('f3-bio', 3, '570-590', 'Biologia / Meio Ambiente'),
  S('f3-med', 3, '610-619', 'Medicina / Saúde'),
  S('f3-cont', 3, '657', 'Contabilidade'),
  S('f3-adm', 3, '658', 'Administração'),
  S('f3-art', 3, '700', 'Artes'),
  S('f3-lit', 3, '800', 'Literatura Geral'),
  S('f3-lest', 3, '808.07', 'Literatura - Estudo e Ensino'),
  S('f3-usa', 3, '813', 'Literatura Americana'),
  S('f3-br', 3, '869 (Cutter A–R)', 'Literatura Brasileira'),
  // ───── FILA 4 — Amazônia & Outros ─────
  S('f4-br', 4, '869 (Cutter S–Z)', 'Literatura Brasileira'),
  S('f4-crit', 4, '869.01-869.93', 'Literatura Brasileira (História/Crítica/Antologias)'),
  S('f4-hist', 4, '907-909', 'História Geral'),
  S('f4-geo', 4, '910', 'Geografia Geral'),
  S('f4-bio', 4, '920-929', 'Biografia'),
  S('f4-enem', 4, '370.16', 'ENEM / Concurso'),
  S('f4-per388', 4, '388', 'Periódico / Trânsito'),
  S('f4-per', 4, '050', 'Outros Periódicos'),
  S('f4-am-ger', 4, '001-399', 'Amazônia-Pará (Geral)'),
  S('f4-am-ling', 4, '400-479', 'Amazônia-Pará (Linguística/Idiomas)'),
  S('f4-am-cien', 4, '500-799', 'Amazônia-Pará (Ciências/Artes)'),
  S('f4-am-lit', 4, '869.8991', 'Amazônia-Pará / Literatura'),
  S('f4-am-bio', 4, '900-970', 'Amazônia-Pará / Biografia'),
  S('f4-am-hist', 4, '900-981.15', 'Amazônia-Pará - História'),
  S('f4-am-rel', 4, '352.13', 'Amazônia-Pará - Relatórios'),
  S('f4-am-per', 4, '050', 'Periódico Amazônia-Pará'),
  S('f4-sem', 4, '—', 'Sem CDD (a classificar)'),
]

export const SECTION_BY_ID = new Map(SECTIONS.map((s) => [s.id, s]))
