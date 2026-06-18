
-- Adiciona colunas por tipo de sêmen na tabela bulls
ALTER TABLE public.bulls
  ADD COLUMN IF NOT EXISTS quantity_sexado_macho integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_sexado_femea integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_sexado_macho numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_sexado_femea numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS code_convencional text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS code_sexado_macho text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS code_sexado_femea text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS canister_convencional text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS canister_sexado_macho text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS canister_sexado_femea text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS botijao_convencional text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS botijao_sexado_macho text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS botijao_sexado_femea text NOT NULL DEFAULT '';

-- Migração segura: copia código/caneca globais para o slot Convencional
UPDATE public.bulls
SET code_convencional = COALESCE(NULLIF(code_convencional, ''), code, '')
WHERE code_convencional = '' AND COALESCE(code, '') <> '';

UPDATE public.bulls
SET canister_convencional = COALESCE(NULLIF(canister_convencional, ''), location, '')
WHERE canister_convencional = '' AND COALESCE(location, '') <> '';

-- Migra estoque sexado legado para o pool Sexado Macho (não perde dados)
UPDATE public.bulls
SET quantity_sexado_macho = quantity_sexado_macho + quantity_sexado,
    quantity_sexado = 0
WHERE quantity_sexado > 0;

UPDATE public.bulls
SET price_sexado_macho = price_sexado
WHERE price_sexado_macho = 0 AND price_sexado > 0;
