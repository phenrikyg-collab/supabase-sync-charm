-- 1. Rename grupo_dre values to match new Faixa names
UPDATE categorias_financeiras SET grupo_dre = 'RECEITAS' WHERE grupo_dre = 'Receita Bruta';
UPDATE categorias_financeiras SET grupo_dre = 'DEDUÇÕES SOBRE VENDAS' WHERE grupo_dre = 'Deduções';
UPDATE categorias_financeiras SET grupo_dre = 'IMPOSTOS DIRETOS' WHERE grupo_dre = 'Impostos';
UPDATE categorias_financeiras SET grupo_dre = 'RESULTADO NÃO OPERACIONAL' WHERE grupo_dre = 'Resultado não Operacional';

-- 2. Move categories from Custos Variáveis to new Faixa
UPDATE categorias_financeiras SET grupo_dre = 'CUSTOS VARIÁVEIS' WHERE grupo_dre = 'Custos Variáveis';

-- 3. Split Despesas Operacionais
UPDATE categorias_financeiras SET grupo_dre = 'CUSTOS VARIÁVEIS' 
WHERE grupo_dre = 'Despesas Operacionais' AND nome_categoria IN (
  'Comissão de vendedores',
  'Despesas com brindes e presentes',
  'Gastos com manutenção - produção',
  'Gastos com Serviços de Terceiros',
  'Logística de vendas'
);

UPDATE categorias_financeiras SET grupo_dre = 'DESPESAS' 
WHERE grupo_dre = 'Despesas Operacionais';

-- 4. Insert plano de conta rows

-- RECEITAS > Receita com Vendas
INSERT INTO categorias_financeiras (grupo_dre, nome_categoria, descricao_categoria, tipo, categoria_pai_id)
SELECT 'RECEITAS', 'Receita com Vendas', unnest(ARRAY['Prestação de serviços', 'Venda de produtos']), 'receita', id
FROM categorias_financeiras WHERE grupo_dre = 'RECEITAS' AND nome_categoria = 'Receita com Vendas' LIMIT 1;

-- DEDUÇÕES > Estornos
INSERT INTO categorias_financeiras (grupo_dre, nome_categoria, descricao_categoria, tipo, categoria_pai_id)
SELECT 'DEDUÇÕES SOBRE VENDAS', 'Estornos', 'Devoluções de clientes', 'receita', id
FROM categorias_financeiras WHERE grupo_dre = 'DEDUÇÕES SOBRE VENDAS' AND nome_categoria = 'Estornos' LIMIT 1;

-- DEDUÇÕES > Impostos Sobre Vendas
INSERT INTO categorias_financeiras (grupo_dre, nome_categoria, descricao_categoria, tipo, categoria_pai_id)
SELECT 'DEDUÇÕES SOBRE VENDAS', 'Impostos Sobre Vendas', unnest(ARRAY['COFINS', 'DAS', 'ICMS', 'IPI', 'ISS', 'PIS']), 'despesa', id
FROM categorias_financeiras WHERE grupo_dre = 'DEDUÇÕES SOBRE VENDAS' AND nome_categoria = 'Impostos Sobre Vendas' LIMIT 1;

-- DEDUÇÕES > Taxas de Gateway
INSERT INTO categorias_financeiras (grupo_dre, nome_categoria, descricao_categoria, tipo, categoria_pai_id)
SELECT 'DEDUÇÕES SOBRE VENDAS', 'Taxas de Gateway', unnest(ARRAY['Taxa máquina cartão', 'Pagar.me', 'TrayPagamentos']), 'despesa', id
FROM categorias_financeiras WHERE grupo_dre = 'DEDUÇÕES SOBRE VENDAS' AND nome_categoria = 'Taxas de Gateway' LIMIT 1;

-- CUSTOS VARIÁVEIS > Comissão de vendedores
INSERT INTO categorias_financeiras (grupo_dre, nome_categoria, descricao_categoria, tipo, categoria_pai_id)
SELECT 'CUSTOS VARIÁVEIS', 'Comissão de vendedores', 'Comissões para vendedores', 'despesa', id
FROM categorias_financeiras WHERE grupo_dre = 'CUSTOS VARIÁVEIS' AND nome_categoria = 'Comissão de vendedores' LIMIT 1;

-- CUSTOS VARIÁVEIS > Custos Variáveis
INSERT INTO categorias_financeiras (grupo_dre, nome_categoria, descricao_categoria, tipo, categoria_pai_id)
SELECT 'CUSTOS VARIÁVEIS', 'Custos Variáveis', unnest(ARRAY['Aviamentos', 'Embalagem', 'Tecidos', 'Mão de obra', 'Etiquetas', 'Outros custos variáveis']), 'despesa', id
FROM categorias_financeiras WHERE grupo_dre = 'CUSTOS VARIÁVEIS' AND nome_categoria = 'Custos Variáveis' AND descricao_categoria IS NULL LIMIT 1;

-- CUSTOS VARIÁVEIS > Despesas com brindes e presentes
INSERT INTO categorias_financeiras (grupo_dre, nome_categoria, descricao_categoria, tipo, categoria_pai_id)
SELECT 'CUSTOS VARIÁVEIS', 'Despesas com brindes e presentes', 'Presentes para clientes', 'despesa', id
FROM categorias_financeiras WHERE grupo_dre = 'CUSTOS VARIÁVEIS' AND nome_categoria = 'Despesas com brindes e presentes' LIMIT 1;

-- CUSTOS VARIÁVEIS > Gastos com manutenção - produção
INSERT INTO categorias_financeiras (grupo_dre, nome_categoria, descricao_categoria, tipo, categoria_pai_id)
SELECT 'CUSTOS VARIÁVEIS', 'Gastos com manutenção - produção', 'Manutenção de máquinas', 'despesa', id
FROM categorias_financeiras WHERE grupo_dre = 'CUSTOS VARIÁVEIS' AND nome_categoria = 'Gastos com manutenção - produção' LIMIT 1;

-- CUSTOS VARIÁVEIS > Gastos com Serviços de Terceiros
INSERT INTO categorias_financeiras (grupo_dre, nome_categoria, descricao_categoria, tipo, categoria_pai_id)
SELECT 'CUSTOS VARIÁVEIS', 'Gastos com Serviços de Terceiros', unnest(ARRAY['Corte', 'Modelagem', 'Oficinas de costura', 'Outros serviços de terceiros']), 'despesa', id
FROM categorias_financeiras WHERE grupo_dre = 'CUSTOS VARIÁVEIS' AND nome_categoria = 'Gastos com Serviços de Terceiros' LIMIT 1;

-- CUSTOS VARIÁVEIS > Logística de vendas
INSERT INTO categorias_financeiras (grupo_dre, nome_categoria, descricao_categoria, tipo, categoria_pai_id)
SELECT 'CUSTOS VARIÁVEIS', 'Logística de vendas', unnest(ARRAY['Correios', 'Melhor Envio', 'J3 Flex', 'Total Express', 'Outros fretes']), 'despesa', id
FROM categorias_financeiras WHERE grupo_dre = 'CUSTOS VARIÁVEIS' AND nome_categoria = 'Logística de vendas' LIMIT 1;

-- DESPESAS > Despesas administrativas
INSERT INTO categorias_financeiras (grupo_dre, nome_categoria, descricao_categoria, tipo, categoria_pai_id)
SELECT 'DESPESAS', 'Despesas administrativas', unnest(ARRAY['Alarmes e segurança', 'Combustível', 'Contabilidade', 'Despesas jurídicas', 'Material de escritório', 'Outras despesas administrativas']), 'despesa', id
FROM categorias_financeiras WHERE grupo_dre = 'DESPESAS' AND nome_categoria = 'Despesas administrativas' LIMIT 1;

-- DESPESAS > Gastos com Marketing
INSERT INTO categorias_financeiras (grupo_dre, nome_categoria, descricao_categoria, tipo, categoria_pai_id)
SELECT 'DESPESAS', 'Gastos com Marketing', unnest(ARRAY['Google ADS', 'Meta ADS', 'Fotógrafo', 'Influencers', 'Design gráfico', 'Outros gastos com marketing']), 'despesa', id
FROM categorias_financeiras WHERE grupo_dre = 'DESPESAS' AND nome_categoria = 'Gastos com Marketing' LIMIT 1;

-- DESPESAS > Gastos com Ocupação
INSERT INTO categorias_financeiras (grupo_dre, nome_categoria, descricao_categoria, tipo, categoria_pai_id)
SELECT 'DESPESAS', 'Gastos com Ocupação', unnest(ARRAY['Água', 'Aluguel', 'Energia', 'Limpeza', 'Telefone e internet']), 'despesa', id
FROM categorias_financeiras WHERE grupo_dre = 'DESPESAS' AND nome_categoria = 'Gastos com Ocupação' LIMIT 1;

-- DESPESAS > Gastos com Pessoal
INSERT INTO categorias_financeiras (grupo_dre, nome_categoria, descricao_categoria, tipo, categoria_pai_id)
SELECT 'DESPESAS', 'Gastos com Pessoal', unnest(ARRAY['Salário', 'Pró-Labore', 'Encargos sociais', 'Férias e 13o', 'Vale transporte', 'Vale alimentação', 'Outros gastos com pessoal']), 'despesa', id
FROM categorias_financeiras WHERE grupo_dre = 'DESPESAS' AND nome_categoria = 'Gastos com Pessoal' LIMIT 1;

-- DESPESAS > Gastos com sistemas
INSERT INTO categorias_financeiras (grupo_dre, nome_categoria, descricao_categoria, tipo, categoria_pai_id)
SELECT 'DESPESAS', 'Gastos com sistemas, site e aplicativos', unnest(ARRAY['Bling', 'Tray', 'RDStation', 'Outros sistemas e aplicativos']), 'despesa', id
FROM categorias_financeiras WHERE grupo_dre = 'DESPESAS' AND nome_categoria = 'Gastos com sistemas, site e aplicativos' LIMIT 1;

-- DESPESAS > Logística operacional
INSERT INTO categorias_financeiras (grupo_dre, nome_categoria, descricao_categoria, tipo, categoria_pai_id)
SELECT 'DESPESAS', 'Logística operacional', unnest(ARRAY['Lalamove', 'Uber', 'Outras entregas operacionais']), 'despesa', id
FROM categorias_financeiras WHERE grupo_dre = 'DESPESAS' AND nome_categoria = 'Logística operacional' LIMIT 1;

-- RESULTADO NÃO OPERACIONAL > Gastos não Operacionais
INSERT INTO categorias_financeiras (grupo_dre, nome_categoria, descricao_categoria, tipo, categoria_pai_id)
SELECT 'RESULTADO NÃO OPERACIONAL', 'Gastos não Operacionais', unnest(ARRAY['Empréstimos', 'Juros e multas', 'Tarifas bancárias']), 'despesa', id
FROM categorias_financeiras WHERE grupo_dre = 'RESULTADO NÃO OPERACIONAL' AND nome_categoria = 'Gastos não Operacionais' LIMIT 1;

-- RESULTADO NÃO OPERACIONAL > Receitas não Operacionais
INSERT INTO categorias_financeiras (grupo_dre, nome_categoria, descricao_categoria, tipo, categoria_pai_id)
SELECT 'RESULTADO NÃO OPERACIONAL', 'Receitas não Operacionais', unnest(ARRAY['Juros de aplicação', 'Outras receitas não operacionais']), 'receita', id
FROM categorias_financeiras WHERE grupo_dre = 'RESULTADO NÃO OPERACIONAL' AND nome_categoria = 'Receitas não Operacionais' LIMIT 1;

-- IMPOSTOS DIRETOS > Imposto de Renda e CSLL
INSERT INTO categorias_financeiras (grupo_dre, nome_categoria, descricao_categoria, tipo, categoria_pai_id)
SELECT 'IMPOSTOS DIRETOS', 'Imposto de Renda e CSLL', unnest(ARRAY['CSLL', 'IRPJ']), 'despesa', id
FROM categorias_financeiras WHERE grupo_dre = 'IMPOSTOS DIRETOS' AND nome_categoria = 'Imposto de Renda e CSLL' LIMIT 1;