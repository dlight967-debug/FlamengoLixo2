# Estante Virtual

Biblioteca 3D (low‑poly) para localizar obras de um acervo **Biblivre / MARC21**: 12 estantes de aço dupla face, 4 filas, parser ISO 2709 nativo, ordenação CDD + Cutter e a fada **Navi** guiando até a lombada.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # parser, roteamento, alocação e geometria (sem WebGL)
```

## Carregar o acervo

| Origem | Como |
|---|---|
| Amostra embutida (206 obras reais + *O perdão da leitura*) | abre por padrão (`public/amostra.mrc`) |
| Exportação ISO 2709 do Biblivre (`.mrc` / `.iso` / `.txt`) | botão **Importar Arquivo Biblivre** |
| Backup completo do Biblivre (`.b5bz`) | mesmo botão — o app abre o ZIP, lê `single.data.b5b` e usa só `biblio_records` (base *main*) e `biblio_holdings` |

Para regenerar a amostra / exportar `.mrc` de um backup: `npm run sample -- Biblivre_Backup.b5bz acervo-completo.mrc`.

## Estrutura

```
src/lib/marc.ts      parser ISO 2709 (offsets em bytes, UTF‑8 → fallback Latin‑1)
src/lib/backup.ts    leitor .b5bz (ZIP + dump PostgreSQL COPY)
src/lib/cdd.ts       ordenação decimal de CDD, Cutter, chave de coleção
src/lib/sections.ts  4 filas e ~70 seções na ordem física (a sua tabela)
src/lib/routing.ts   classify(): livro → seção/fila
src/lib/layout.ts    alocação: filas → estantes → face A/B → 5 prateleiras
src/three/*          cena R3F: sala, estantes, placas, livros instanciados, Navi, câmera
src/ui/*             busca, ficha catalográfica, capa (OpenLibrary → Google Books → procedural)
```

## Decisões de interpretação (ajustáveis em `routing.ts` / `sections.ts`)

* **Ordem física** de cada fila = ordem das seções da tabela; dentro da seção, CDD (decimal) e depois Cutter (decimal) e título.
* **Leitura**: estante 1→2→3; em cada estante, face A (frente) prateleiras 1→5 (de cima p/ baixo), depois face B (verso).
* **Coleções** (490/830 $a, ≥ 2 obras): ficam lado a lado, na posição do menor CDD/Cutter do grupo, e não são quebradas entre prateleiras quando cabem em uma. Se os membros caem em filas diferentes, a coleção vai inteira para a fila do âncora.
* **869**: Cutter A–R → Fila 3; S–Z → Fila 4. `869.8991` → Coleção Amazônia‑Pará; `869.01–869.93` → Crítica/Antologias (Fila 4).
* **Amazônia/Pará/Belém** em 650/651/245/490 desviam para a Coleção Amazônia‑Pará, exceto quando a CDD já é de Trânsito. Biografia regional = 920–929; demais 900–981 = História.
* **Trânsito** em CDD compartilhada: assunto 650 iniciado por “Trânsito” leva à Fila 1. `343.0946` inclui variantes por jurisdição (`343.810946`).
* **CDD alfanumérica** (`Cart.36`, `Folder. 13`) → Fila 1, seção 388. `036.x` → Enciclopédia. `0.50` é lido como `050`.
* **Periódico** (líder tipo `s` ou assunto “Periódico”): 388/Trânsito → Fila 4 “388 Periódico”; demais → “Outros Periódicos”; regionais → Periódico Amazônia‑Pará.
* **Faixas fora da tabela** (ex.: 350–369, 600–649) caem na seção vizinha mais próxima da mesma fila.
* **Espessura**: `0,4 cm + 0,075 cm × páginas` (0,5–5 cm); sem páginas: 1,6 cm (0,3 cm para cartilha/folder, 0,5 cm para periódico). Prateleira útil de 1,20 m.
