# Trabalho escrito da APS — o que revisar antes de entregar

Documento final: **`APS_CC_7o8o_2026_EcoRadar_Urbano.docx`** (Word, A4, Arial 12, espaçamento 1,5, margens de 2,5 cm).
A prévia em PDF (`APS_CC_7o8o_2026_EcoRadar_Urbano.pdf`) foi gerada pelo LibreOffice e serviu para conferir a
contagem de páginas de cada seção (`verificacao_paginas.md`).

## 1. Campos que o grupo precisa preencher (destacados em amarelo)

| Onde | Marcador | O que fazer |
|---|---|---|
| Capa | `[NOME COMPLETO 1] – RA [RA1]`, `[NOME COMPLETO 2] – RA [RA2]`, `[NOME COMPLETO 3] – RA [RA3]` | Nome completo e RA de cada integrante |
| Capa | `[CAMPUS]`, `[CIDADE]` | Campus da UNIP e cidade |
| 7.1 | `[REVISAR: se o grupo registrar os prints no celular real…]` | Opcional: tirar os prints no celular seguindo o `COMO_TESTAR.md`, salvar em `registros/manual/` e incluí-los na seção 7 |
| 8.2 Contribuição para a formação | `[REVISAR: personalizar com a experiência real do grupo]` | **Os dois parágrafos em amarelo são um rascunho.** Reescrevam com a experiência real do grupo |
| 10 Ficha | `[REVISAR]` (texto e coluna "Horas") | Preencher as horas reais de cada atividade e **anexar a ficha oficial da UNIP preenchida e assinada** |
| Propriedades do arquivo | Autor "Grupo APS [REVISAR]" | Arquivo → Informações → Propriedades |

Depois de preencher, remova o realce amarelo: selecione o texto → Página Inicial → Cor de Realce do Texto → **Sem Cor**.

## 2. Pontos a conferir (`[CONFERIR]`)

1. **Seção 3.6 (IQAr):** a Resolução CONAMA nº 491/2018, citada pela CETESB e pelo projeto, foi revogada em grande
   parte pela **Resolução CONAMA nº 506/2024** (DOU de 09/07/2024). Conferimos que o Anexo II da 506/2024 mantém a mesma
   equação de interpolação e a faixa N1 (0–40); as faixas N2 a N5 aparecem como imagem na publicação oficial e não
   puderam ser comparadas automaticamente. Comparem a Tabela 1 com o Anexo II:
   https://www.in.gov.br/web/dou/-/resolucao-n-506-de-5-de-julho-de-2024-570885907
2. **Bibliografia — Resolução CONAMA nº 491/2018:** o link oficial do DOU não abriu durante a verificação (o servidor
   recusou o acesso automatizado). Abram o link no navegador e, se possível, completem a página do DOU.

Todas as outras referências foram conferidas em 28/09/2026 (URLs respondendo, títulos das páginas, editoras, edições e
anos dos livros).

## 3. Índice (sumário)

O índice já vem preenchido com os números de página calculados na conversão pelo LibreOffice. Se, no Word, a
paginação ficar diferente (por exemplo, depois de editar o texto), atualize o campo:

- clique dentro do índice e pressione **F9**, ou
- botão direito → **Atualizar campo** → **Atualizar índice inteiro**.

A numeração das páginas aparece no canto superior direito **a partir da Introdução**, como pedido; capa, índice e
Objetivo contam páginas, mas não mostram o número (a Introdução começa numa nova seção do Word).

## 4. Como regenerar o documento

O `.docx` é gerado do zero pelo script; **editar o `.docx` no Word e depois rodar o script de novo sobrescreve as
edições**. Para mudanças de conteúdo, prefiram editar `conteudo_aps.py` (seções 1 a 4) e `secoes_aps.py` (seções 5 a 10)
e regenerar; para os ajustes finais (nomes, ficha, reflexão pessoal), editem direto no Word.

```powershell
cd documentacao
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python gerar_aps.py            # .docx + PDF + verificacao_paginas.md
.venv\Scripts\python gerar_aps.py --sem-pdf  # só o .docx
.venv\Scripts\python gerar_aps.py --diagramas  # força redesenhar os diagramas
```

Requisitos: Python 3.10+; LibreOffice (conversão para PDF e contagem de páginas); Node.js com as dependências de
`tests/` instaladas (os diagramas Mermaid de `figuras/*.mmd` são desenhados pelo Chromium do Playwright, carregando o
Mermaid da CDN jsDelivr — precisa de internet; sem isso, o script reaproveita os PNG existentes).

| Arquivo | Conteúdo |
|---|---|
| `gerar_aps.py` | Formatação (estilos, sumário, legendas, listagens, numeração), conversão e verificação |
| `conteudo_aps.py` / `secoes_aps.py` | Texto do trabalho; as listagens de código são lidas direto dos arquivos do projeto |
| `renderizar_diagramas.mjs` | Desenha `figuras/*.mmd` em PNG |
| `figuras/` | Diagramas (fonte Mermaid `.mmd` e imagem `.png`) |
| `verificacao_paginas.md` | Páginas por seção × limites oficiais, figuras citadas, auditoria de fonte/espaçamento/margens e marcadores pendentes |

Os prints da seção 7 vêm de `registros/` (execuções reais dos testes); os números (testes, cobertura, carga, linhas de
código, versões) foram copiados de `registros/RELATORIO_DE_TESTES.md`, `registros/metricas_codigo.txt` e
`registros/ambiente/versoes.txt`. Se os testes forem executados de novo, confiram se os números mudaram.
