import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireUser } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EXTERNAL_SUPABASE_URL = 'https://ezdtulcrqzmgocamjwwl.supabase.co'

function normalizeSecret(value: string) {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '')
  const jwt = trimmed.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)
  if (jwt?.[0]) return jwt[0]
  const sk = trimmed.match(/sb_secret_[A-Za-z0-9_-]+/)
  if (sk?.[0]) return sk[0]
  return trimmed
}

function ultimoDiaMes(ano: number, mes: number): string {
  return new Date(ano, mes, 0).toISOString().split('T')[0]
}

function datasSemanaN(semana: number, mes_referencia: string): string[] {
  const [ano, mes] = mes_referencia.split('-').map(Number)
  const ultimo = new Date(ano, mes, 0).getDate()
  const datas: string[] = []
  for (let d = 1; d <= ultimo; d++) {
    if (Math.ceil(d / 7) === semana) {
      datas.push(ano + '-' + String(mes).padStart(2,'0') + '-' + String(d).padStart(2,'0'))
    }
  }
  return datas
}

function nomeDia(dataStr: string): string {
  const nomes = ['domingo','segunda','terca','quarta','quinta','sexta','sabado']
  return nomes[new Date(dataStr + 'T12:00:00').getDay()]
}

const contadores_dia: Record<number, number> = {}

function anguloDodia(dataStr: string): string {
  const dow = new Date(dataStr + 'T12:00:00').getDay()
  contadores_dia[dow] = (contadores_dia[dow] ?? 0) + 1
  const idx = contadores_dia[dow] % 4

  const opcoes: Record<number, string[]> = {
    0: [
      'reflexao domingo: o que essa semana me ensinou sobre mim mesma. Sem produto.',
      'domingo de planejamento: ritual de preparar a semana com intencao. Sem produto.',
      'autocuidado real: como essa mulher cuida de si nos pequenos momentos. Sem produto.',
      'comunidade: historia de uma mulher que se reinventou. Inspiracao real. Sem produto.'
    ],
    1: [
      'manha de segunda: ritual de cafe organizacao e proposito antes do trabalho. Sem produto.',
      'segunda de intenção: como essa mulher define o tom da semana para si mesma. Sem produto.',
      'rotina matinal: os 30 minutos que fazem diferenca no dia de uma mulher ocupada. Sem produto.',
      'segunda produtiva: como equilibrar maternidade carreira e autocuidado. Sem produto.'
    ],
    2: [
      'terca de conquista: mulher em reuniao importante sentindo-se poderosa. Produto como coadjuvante.',
      'confianca que vem de dentro: como a aparencia afeta nossa performance profissional. Produto natural.',
      'dress code real: como mulheres executives escolhem o que vestem. Produto aparece.',
      'terca de networking: como se preparar para eventos e encontros importantes. Produto discreto.'
    ],
    3: [
      'quarta de resiliencia: ja passou por aquele dia em que tudo deu errado mas voce seguiu. Sem produto.',
      'meio de semana: dica real de styling para quem nao tem tempo. Produto como solucao pratica.',
      'versatilidade no dia a dia: como uma peca resolve 3 compromissos diferentes. Produto natural.',
      'quarta de reflexao: o que nos faz sentir bem vestidas mesmo nos dias dificeis. Sem produto.'
    ],
    4: [
      'quinta de bastidor: como nascem as pecas da marca — processo criativo atelie materiais. Sem produto direto.',
      'depoimento real: cliente conta situacao da vida onde sentir-se bem mudou tudo. Sem produto direto.',
      'quinta de educacao: o que e investimento em moda x gasto em moda. Conceito sem produto.',
      'por tras da marca: quem sao as pessoas que fazem a Mariana Cardoso. Humanizacao.'
    ],
    5: [
      'sexta de transicao: da reuniao ao jantar romantico em 10 minutos. Produto como solucao.',
      'sexta livre: como essa mulher celebra o fim de semana que conquistou. Produto coadjuvante.',
      'estilo de vida sexta: o que mulheres sofisticadas fazem no fim do dia. Produto natural.',
      'sexta de gratidao: celebrar conquistas da semana. Sem produto direto.'
    ],
    6: [
      'sabado de autocuidado: ritual de beleza e bem-estar da mulher real. Produto VIP exclusivo.',
      'sabado com amigas: programa que toda mulher merece. Produto aparece naturalmente.',
      'sabado de familia: mae que tambem e mulher. Produto como cuidado proprio.',
      'sabado de mercado parque rotina real: a vida bonita nos detalhes. Produto VIP.'
    ]
  }

  const opcoes_dia = opcoes[dow] ?? ['rotina lifestyle sem produto']
  return opcoes_dia[idx % opcoes_dia.length]
}

function canaisDoDia(dataStr: string): string[] {
  const dow = new Date(dataStr + 'T12:00:00').getDay()
  if (dow === 0) return ['whatsapp_vip']
  if (dow === 6) return ['whatsapp_vip', 'email']
  return ['instagram_reels', 'instagram_feed', 'instagram_story', 'email', 'whatsapp_vip']
}

async function gerarDia(apiKey: string, dia: string, data: string, angulo: string, tema: string, data_especial: string, produtos: string[], lancamentos: string[], contexto_ia: string): Promise<any> {
  const blocoContexto = contexto_ia && contexto_ia.trim()
    ? ' CONTEXTO ADICIONAL OBRIGATORIO DO MES (considerar SEMPRE ao criar o conteudo deste dia, este briefing tem prioridade sobre angulo padrao quando fizer sentido): ' + contexto_ia.trim()
    : ''

  const prompt = 'Use Mariana Cardoso marca premium moda feminina. Publico mulheres 30-45 anos profissionais maes empreendedoras. REGRA PRINCIPAL: o conteudo fala sobre a VIDA da mulher — suas rotinas, emocoes, conquistas, desafios, relacionamentos, autoestima — nao sobre produto. O produto aparece apenas quando e natural ao contexto, nunca como foco. Pense como uma amiga sofisticada que entende de moda e de vida, nao como marca vendendo. Variar temas: autoestima, produtividade, maternidade, relacionamentos, carreira, autocuidado, amizades, momentos cotidianos.' +
    blocoContexto +
    ' Dia: ' + dia + ' ' + data +
    ' Angulo: ' + angulo +
    ' Tema semana: ' + tema +
    ' Data especial: ' + (data_especial || 'nenhuma') +
    ' Produtos: ' + produtos.slice(0,3).join(', ') +
    ' Lancamentos: ' + (lancamentos.join(', ') || 'nenhum') +
    ' Responda EXATAMENTE neste formato sem mais nada:' +
    ' TITULO: [titulo rotina aspiracional]' +
    ' REELS: [legenda instagram 2 linhas]' +
    ' EMAIL: [assunto] | [corpo 2 linhas]' +
    ' WHATSAPP: [mensagem pessoal curta]'

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: 'Responda APENAS no formato solicitado. Cada campo em uma linha com nome em maiusculas e dois pontos.',
      messages: [{ role: 'user', content: prompt }]
    })
  })
  const d = await resp.json()
  if (d.error) throw new Error('Claude: ' + d.error.message)
  const t = d.content[0].text
  const get = (campo: string) => t.match(new RegExp(campo + ':\\s*(.+)', 'i'))?.[1]?.trim() ?? ''
  const email = get('EMAIL')
  return {
    data, dia,
    titulo: get('TITULO'),
    reels_copy: get('REELS'),
    email_assunto: email.split('|')[0]?.trim() ?? '',
    email_copy: email.split('|')[1]?.trim() ?? '',
    whatsapp: get('WHATSAPP')
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const auth = await requireUser(req, corsHeaders)
  if (!auth.ok) return auth.response
  try {
    const body = await req.json()
    const mes_referencia = body.mes_referencia ?? '2026-06'
    const contexto_ia: string = (body.contexto_ia ?? '').toString()
    const serviceKey = normalizeSecret(Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? '')
    if (!serviceKey) throw new Error('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY nao configurada')
    const supabase = createClient(EXTERNAL_SUPABASE_URL, serviceKey)
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!
    const [ano, mes] = mes_referencia.split('-').map(Number)
    const dataInicio = mes_referencia + '-01'
    const dataFim = ultimoDiaMes(ano, mes)

    const { data: meta_fin } = await supabase.from('metas_financeiras').select('meta_mensal, meta_ticket_medio, dias_uteis').gte('mes', dataInicio).lte('mes', dataInicio).maybeSingle()
    const meta_receita = body.meta_receita ?? meta_fin?.meta_mensal
    if (!meta_receita) throw new Error('meta_receita obrigatoria — cadastre em metas_financeiras ou informe no body')

    const { data: padrao } = await supabase.from('vw_padroes_pedidos').select('semana_do_mes, receita_total')
    const rs: any = {}
    for (const r of (padrao ?? [])) {
      if (!rs[r.semana_do_mes]) rs[r.semana_do_mes] = 0
      rs[r.semana_do_mes] += Number(r.receita_total)
    }
    const total = Object.values(rs).reduce((s: number, v: any) => s + v, 0) as number
    const distribuicao = Object.entries(rs).filter(([s]) => parseInt(s) <= 4).map(([s, v]: any) => ({
      semana: parseInt(s),
      percentual: Math.round(v / total * 100),
      meta_semana: Math.round(meta_receita * v / total)
    })).sort((a: any, b: any) => a.semana - b.semana)

    const { data: kpis } = await supabase.from('vw_kpis_trafego').select('ticket_medio').order('mes_referencia', { ascending: false }).limit(1)
    const ticket = meta_fin?.meta_ticket_medio ?? kpis?.[0]?.ticket_medio ?? 330
    const meta_pedidos = Math.ceil(meta_receita / ticket)

    const { data: lancamentos } = await supabase.from('lancamentos_pecas').select('nome_peca, data_lancamento').gte('data_lancamento', dataInicio).lte('data_lancamento', dataFim).neq('status', 'cancelado')
    const { data: datas_esp } = await supabase.from('datas_oportunidade').select('data, titulo').gte('data', dataInicio).lte('data', dataFim).eq('ativo', true).order('data')
    const { data: produtos } = await supabase.from('tray_products').select('name').eq('available', 1).gt('stock', 15).order('quantity_sold', { ascending: false }).limit(6)

    const produtos_nomes = produtos?.map((p: any) => p.name) ?? []

    const blocoContextoNarr = contexto_ia.trim()
      ? ' CONTEXTO ADICIONAL OBRIGATORIO informado pela equipe para este mes (use como diretriz central da narrativa e dos temas semanais, incorpore explicitamente nos temas quando aplicavel): ' + contexto_ia.trim() + ' .'
      : ''

    // Narrativa do mes
    const rn = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 800,
        system: 'Marketing moda premium. Responda apenas no formato solicitado.',
        messages: [{ role: 'user', content: 'Meta R$ ' + meta_receita + ' em ' + mes_referencia + ' Datas: ' + JSON.stringify(datas_esp?.map((d: any) => d.titulo)) + ' Lancamentos: ' + JSON.stringify(lancamentos?.map((l: any) => l.nome_peca)) + '.' + blocoContextoNarr + ' Responda: NARRATIVA: [3 linhas tema mes refletindo o contexto adicional quando houver] SEMANA1: [tema] SEMANA2: [tema] SEMANA3: [tema] SEMANA4: [tema]' }]
      })
    })
    const rnd = await rn.json()
    const rnt = rnd.content[0].text
    const getN = (campo: string) => rnt.match(new RegExp(campo + ':\\s*(.+)', 'i'))?.[1]?.trim() ?? ''

    const { data: plano, error: pe } = await supabase.from('planos_comerciais').upsert({
      mes_referencia, meta_receita, meta_pedidos, meta_ticket_medio: ticket,
      meta_sessoes: 0, meta_roas: 0, meta_cps_maximo: 0, meta_conversao: 0, investimento_previsto: 0,
      status: 'rascunho', resumo_ia: getN('NARRATIVA')
    }, { onConflict: 'mes_referencia' }).select().single()
    if (pe) throw new Error('Erro plano: ' + pe.message)

    // Busca dias ja gerados para nao duplicar
    const { data: acoes_existentes } = await supabase
      .from('acoes_comerciais')
      .select('kpis_trafego')
      .eq('mes_referencia', mes_referencia)
    const datas_existentes = new Set(acoes_existentes?.map((a: any) => a.kpis_trafego?.data).filter(Boolean) ?? [])
    console.log('dias ja existentes:', datas_existentes.size)
    console.log('contexto_ia recebido:', contexto_ia ? contexto_ia.substring(0,120) : '(vazio)')

    const acoes: string[] = []
    for (const sem of distribuicao) {
      console.log('semana', sem.semana)
      const tema = getN('SEMANA' + sem.semana)
      const datas = datasSemanaN(sem.semana, mes_referencia)
      const lanc_sem = lancamentos?.filter((l: any) => Math.ceil(new Date(l.data_lancamento + 'T12:00:00').getDate() / 7) === sem.semana).map((l: any) => l.nome_peca) ?? []

      for (const data of datas) {
        if (datas_existentes.has(data)) { console.log('pulando dia ja existente:', data); continue }
        const data_esp = datas_esp?.find((d: any) => d.data === data)?.titulo ?? ''
        try {
          const dia = nomeDia(data)
          const angulo = anguloDodia(data)
          const r = await gerarDia(apiKey, dia, data, angulo, tema, data_esp, produtos_nomes, lanc_sem, contexto_ia)
          const canais = canaisDoDia(data)
          const { data: a } = await supabase.from('acoes_comerciais').insert({
            plano_id: plano.id, mes_referencia, semana: sem.semana,
            tipo_acao: 'novos_clientes', titulo: r.titulo, descricao: r.reels_copy,
            publico_alvo: 'todos', produto_foco: produtos_nomes[0] ?? null,
            meta_receita_semana: sem.meta_semana, meta_pedidos_semana: Math.ceil(sem.meta_semana / ticket),
            canais, copy_instagram: r.reels_copy,
            copy_email: r.email_assunto + ' | ' + r.email_copy,
            copy_whatsapp: r.whatsapp,
            kpis_trafego: { data, dia, angulo, reels: r.reels_copy, email_assunto: r.email_assunto, email_copy: r.email_copy, whatsapp: r.whatsapp },
            status: 'rascunho'
          }).select().single()
          if (a) acoes.push(a.id)
          console.log('ok:', data, r.titulo?.substring(0,40))
        } catch(e: any) { console.log('erro dia:', data, e.message) }
      }
    }

    return new Response(JSON.stringify({
      sucesso: true, mes_referencia, plano_id: plano.id,
      meta_receita, meta_pedidos, total_dias_gerados: acoes.length,
      narrativa_mes: getN('NARRATIVA'),
      temas: { semana1: getN('SEMANA1'), semana2: getN('SEMANA2'), semana3: getN('SEMANA3'), semana4: getN('SEMANA4') },
      distribuicao,
      contexto_ia_aplicado: !!contexto_ia.trim()
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.log('ERRO:', error.message)
    return new Response(JSON.stringify({ erro: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
