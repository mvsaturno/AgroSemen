## Refinar botão "Aplicar" nos cards de touros

Aplicar o estilo **soft azure full-width** escolhido ao botão "Aplicar" dentro de cada card de touro na página `/products` (Estoque).

### Mudanças visuais
- Botão passa a ocupar **toda a largura do card** (`w-full`), substituindo o atual chip azul pequeno e centralizado.
- Cor de fundo suave: **azul muito claro** (`bg-sky-50`) com borda fina (`border border-sky-100`) — harmoniza com o verde da tarja da raça sem competir.
- Estado pressionado: `active:bg-sky-100`.
- Texto "APLICAR" em **azul forte** (`text-sky-700`), bold, uppercase e levemente espaçado.
- Ícone de seringa em `text-sky-600` com o badge "+" em círculo `bg-sky-600` branco, com `ring-2 ring-white`.
- Cantos arredondados consistentes com o card (`rounded-xl`), altura confortável para toque (`py-3`).

### Arquivo afetado
- `src/routes/products.tsx` — apenas o bloco do botão (linhas ~318–331). O wrapper `<div className="mt-2 flex justify-center">` vira `<div className="mt-3">` para deixar o botão ocupar 100% da largura.

Nenhuma lógica é alterada — somente classes Tailwind do botão.
