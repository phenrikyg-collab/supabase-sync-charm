## Módulo de Bonificação — Consultoras WhatsApp

Novo módulo dentro do ERP para calcular e acompanhar bônus mensais das consultoras de vendas via WhatsApp, com regras configuráveis e dashboard premium.

---

### 1. Backend (Supabase — instância externa `ezdtulcrqzmgocamjwwl`)

Novas tabelas:

- **`consultoras_whatsapp`** — cadastro das consultoras
  - `nome`, `apelido_canal` (identificador usado nas vendas para reconciliar pedidos), `telefone`, `ativa`, `meta_individual` (numeric, opcional)

- **`metas_whatsapp`** — meta mensal do canal
  - `mes_referencia` (text "YYYY-MM"), `meta_total` (numeric), `modo_distribuicao` ('individual' | 'proporcional'), `created_at`

- **`metas_whatsapp_consultoras`** — meta individual por consultora/mês (quando modo = individual)
  - `mes_referencia`, `consultora_id`, `meta_valor`

- **`config_bonificacao_whatsapp`** — regras configuráveis (uma linha "ativa" + histórico)
  - `faixas_meta` (jsonb): `[{min_pct, max_pct, bonus_base, label}]`
  - `regras_desconto` (jsonb): `[{max_pct, multiplicador}]`
  - `faixas_ticket` (jsonb): `[{min_valor, acelerador}]`
  - `ativo` (bool), `vigencia_inicio` (date)

- **`bonus_whatsapp_apurados`** — snapshot mensal calculado e congelado para histórico de pagamento
  - `mes_referencia`, `consultora_id`, `faturamento_liquido`, `meta`, `pct_atingimento`, `ticket_medio`, `desconto_medio_pct`, `qtd_pedidos`, `bonus_base`, `multiplicador_desconto`, `acelerador_ticket`, `bonus_final`, `status` ('projetado'|'aprovado'|'pago'), `data_pagamento`

Seed inicial em `config_bonificacao_whatsapp` com as faixas do briefing.

Reconciliação de pedidos → consultora: usa `tray_orders` filtrando canal WhatsApp (campo de canal/origem existente) + um identificador da consultora (provavelmente um campo de vendedor/observação). **Ponto a confirmar com o usuário** — ver perguntas abaixo.

---

### 2. Frontend

Nova rota **`/bonificacao-whatsapp`** com 4 abas:

1. **Dashboard** — cards (Faturamento canal, Meta, % Atingimento, Ticket médio, Desconto médio, Bônus projetado total), ranking de consultoras (tabela com barra de progresso colorida: vermelho <95%, amarelo 95-109%, verde 110-119%, roxo/dourado ≥120%), gráfico mensal de evolução, comparativo entre consultoras.
2. **Apuração mensal** — seletor de mês, tabela detalhada por consultora com todos os componentes do cálculo (meta, realizado, %, ticket, desconto, bônus base, multiplicador, acelerador, total), botões "Aprovar" / "Marcar como pago", export Excel/PDF.
3. **Histórico** — pagamentos anteriores (`bonus_whatsapp_apurados` com status pago).
4. **Configurações** — CRUD de consultoras, meta mensal (com toggle individual/proporcional), faixas de bônus, regras de desconto, faixas de ticket.

Componentes/arquivos novos:
- `src/pages/BonificacaoWhatsAppPage.tsx`
- `src/components/bonificacao-whatsapp/{Dashboard,Apuracao,Historico,Config}Tab.tsx`
- `src/lib/bonificacaoWhatsApp.ts` — função pura `calcularBonus(faturamento, meta, ticket, descontoMedio, config)` aplicando exatamente a fórmula: `(bonus_base × multiplicador_desconto) + acelerador_ticket`, considerando apenas a maior faixa de ticket.
- Hook `useBonificacaoWhatsApp(mes)` — busca pedidos faturados/pagos do canal WhatsApp do mês (excluindo cancelados/devolvidos/estornados), agrupa por consultora, calcula em tempo real.

Estilo: usa o design system existente (Cormorant Garamond + DM Sans, dourado/bronze), mesmos padrões visuais do `DashboardComercialPage`.

Menu lateral: adicionar item "Bonificação WhatsApp" próximo ao Dashboard Comercial.

---

### 3. Cálculo (resumo da lógica)

```
pedidos_validos = tray_orders WHERE canal = 'whatsapp'
                                AND status IN ('faturado','pago')
                                AND mes = mes_ref
                                AND consultora_id = X
faturamento_liquido = SUM(valor_liquido dos pedidos válidos)
qtd_pedidos        = COUNT(pedidos válidos)
ticket_medio       = faturamento_liquido / qtd_pedidos
desconto_medio_pct = SUM(desconto) / SUM(valor_bruto) × 100
pct_atingimento    = faturamento_liquido / meta × 100
bonus_base         = faixa correspondente em config.faixas_meta
multiplicador      = faixa correspondente em config.regras_desconto
acelerador         = MAIOR faixa de ticket atingida
bonus_final        = (bonus_base × multiplicador) + acelerador
```

---

### 4. Perguntas que preciso responder antes de codar

1. **Como identificar a consultora em cada pedido do canal WhatsApp?** Existe um campo em `tray_orders` (vendedor, observação, tag) que liga o pedido à consultora, ou precisamos criar uma tabela de mapeamento manual / regra por código de cupom?
2. **Qual é exatamente o filtro de canal "WhatsApp"** nos pedidos hoje (campo + valor)?
3. Quer que eu já crie o item de menu na sidebar e considere acesso liberado para todos os usuários autenticados, ou amarrado a `user_modules` específico?
