## Objetivo

Conectar `Planejamento Mensal` (metas) ao `Dashboard GA4` (dados reais) — cruzando meta, realizado, projeção e diagnóstico automático — e ainda alimentar automaticamente a aba REALIZADO do Planejamento com os dados que já existem no sistema.

## Arquitetura resumida

```text
┌──────────────────────────────────────────────────────────────────────┐
│  useRealizadoMes(ano, mes)  ← novo hook central                       │
│    - GA4:      windsor_canais (sessions, orgânico vs mídia)          │
│    - Meta Ads: windsor_meta_ads (spend, cpc, roas, receita)          │
│    - Vendas:   movimentacoes_financeiras (receita, pedidos, aprov.)  │
│    - Meta:     planejamento_mensal tipo=planejado                    │
│  → retorna { meta, realizado, projecao, statusPorPilar, ritmoMes }   │
└──────────────────────────────────────────────────────────────────────┘
        │                                             │
        ▼                                             ▼
┌────────────────────────────┐          ┌──────────────────────────────┐
│  Marketing (Dashboard GA4) │          │  PlanejamentoMensal          │
│  + <AcompanhamentoMeta />  │          │  aba REALIZADO:              │
│  + <DiagnosticoMes />      │          │  + botão "Atualizar com      │
│                            │          │     dados reais"             │
│                            │          │  + auto-fill ao abrir mês    │
│                            │          │  + flag manual_override      │
└────────────────────────────┘          └──────────────────────────────┘
```

## 1. Hook central `useRealizadoMes(ano, mes)`

Novo arquivo `src/hooks/useRealizadoMes.ts`. Consolida em um único ponto o cálculo do "realizado até hoje" para o mês, para ser reutilizado pelo Dashboard e pelo Planejamento.

Fontes:
- **Sessões totais / mídia / orgânicas** → `windsor_canais` no intervalo `[YYYY-MM-01, hoje]`. Paid = grupos contendo "Paid", "Cross-network", "Display", "Video"; resto = orgânico/direto.
- **Investimento, CPC médio, ROAS, receita atribuída, cliques** → `windsor_meta_ads` no intervalo.
- **Pedidos captados, receita captada, receita faturada, taxa de aprovação, taxa de aquisição** → `movimentacoes_financeiras` (tipo=entrada, origem vendas) no mesmo período. **Necessária confirmação da fonte** (ver Perguntas abertas).
- **Meta do mês** → `planejamento_mensal` `.eq('ano', ano).eq('mes', mes).eq('tipo', 'planejado')`.

Retorna:
```ts
{
  meta, realizado, projecao,            // objetos com os 10 pilares
  ritmoMes: { pctDecorrido, pctReceita, pctSessoes },
  statusPorPilar: Record<Pilar, 'verde'|'amarelo'|'vermelho'>,
  isLoading, refetch
}
```

Projeção = `realizado × (diasTotaisMes / diasDecorridos)` para métricas de volume; métricas de taxa (%) usam o valor realizado direto.

## 2. Dashboard GA4 — novos blocos

Editar `src/pages/Marketing.tsx`:

- **Filtro**: adicionar seletor de "Mês de referência" (default = mês corrente); os blocos novos usam esse mês independente do `periodo` das tabs existentes.
- **Novo componente** `src/components/marketing/AcompanhamentoMeta.tsx` renderizado acima das tabs. Tabela de 10 linhas × 4 colunas (Pilar | Meta | Realizado | Projeção) com badge de status colorido (verde/amarelo/vermelho) reutilizando `StatusBadge`. Regras de status idênticas ao `NovePilaresCard` já existente.
- **Cards de ritmo do mês**: 3 mini-cards mostrando `% do mês decorrido`, `% da meta de receita atingida`, `% da meta de sessões atingida`. Cor: verde se `% atingida ≥ % decorrido`, vermelho caso contrário.
- **Novo componente** `src/components/marketing/DiagnosticoMes.tsx` — logo abaixo. Regras determinísticas (sem IA):
  - Se `sessoes.realizado/meta < mesDecorrido`: comparar participação atual de cada `session_custom_channel_group` vs média histórica (últimos 3 meses de `windsor_canais`); apontar canal com maior queda absoluta e sugerir ação ("Escalar campanha X", "CPC subiu Y%, revisar criativos").
  - Se `taxa_conversao` < meta: sinalizar produtos com maior drop no funil (`ga4_funil_compra`).
  - Se `roas < ROAS_EQUILIBRIO`: listar top 3 campanhas com pior ROAS de `windsor_meta_ads` e sugerir pausa.
  - Se `cac_novos > meta × 1.2`: sugerir revisão de mix de canais.
  Cada diagnóstico vira um card com título, métrica evidência, e ação sugerida.

## 3. Planejamento Mensal — auto-fill do REALIZADO

Editar `src/pages/PlanejamentoMensal.tsx` e `src/hooks/usePlanejamentoMensal.ts`:

- Ao abrir a aba REALIZADO, chamar `useRealizadoMes(ano, mes)` e, para os `CAMPOS_MANUAIS_REALIZADO` que **não** estejam marcados como `manual_override`, exibir o valor auto-calculado como sugestão (com badge "auto"). Nada é persistido automaticamente até o usuário clicar no botão.
- **Botão "Atualizar com dados reais"** (novo, mesmo estilo do "Recalcular com média histórica"): grava no `planejamento_mensal` os valores vindos do `useRealizadoMes`, respeitando campos com override manual (mostra confirmação antes de sobrescrever).
- **Override manual**: quando o usuário edita um `<NumInput>` manualmente, marcamos o campo em memória (`manualOverrides: Set<string>`) e mostramos ícone ✎ ao lado; próxima atualização automática pula esses campos.
- Persistência de override: adicionar coluna `campos_editados_manualmente text[]` em `planejamento_mensal` (migration). Sem essa coluna, o override é apenas em memória da sessão.

## 4. Migration

```sql
ALTER TABLE public.planejamento_mensal
  ADD COLUMN IF NOT EXISTS campos_editados_manualmente text[] DEFAULT '{}';
```

Nenhuma nova tabela, nenhuma mudança em RLS.

## 5. Arquivos a criar/editar

Criar:
- `src/hooks/useRealizadoMes.ts`
- `src/components/marketing/AcompanhamentoMeta.tsx`
- `src/components/marketing/DiagnosticoMes.tsx`

Editar:
- `src/pages/Marketing.tsx` — montar novos componentes + seletor de mês.
- `src/pages/PlanejamentoMensal.tsx` — botão "Atualizar com dados reais", badges auto/manual.
- `src/hooks/usePlanejamentoMensal.ts` — suportar `campos_editados_manualmente`, expor `salvarRealizadoAutomatico()`.

## Perguntas abertas — preciso confirmar antes de codar

1. **Fonte de receita/pedidos**: nem o Dashboard nem o Planejamento consultam hoje uma tabela de vendas. Confirmo usar `movimentacoes_financeiras` (filtro `tipo=entrada` + `origem` de vendas), ou existe outra tabela (ex.: `vindi_transacoes`, integração Bling) que devo priorizar para `receita_captada`, `pedidos_captados`, `taxa_aprovacao`, `taxa_aquisicao`?
2. **Classificação orgânico × mídia** em `windsor_canais.session_custom_channel_group`: uso a regra "qualquer grupo contendo Paid/Display/Video/Cross-network = mídia", ou você tem uma lista canônica dos grupos considerados pagos?
3. **CAC Novos** requer separar pedidos de clientes novos vs recorrentes. Existe esse flag na fonte de vendas escolhida, ou aproximo por `pedidos_captados × taxa_aquisicao/100`?

Se preferir, posso assumir defaults (1: `movimentacoes_financeiras`; 2: heurística por substring; 3: aproximação via taxa_aquisicao) e seguir — me diga se topa ou ajuste.
