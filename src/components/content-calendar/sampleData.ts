import { EmailSequence, WhatsAppCampaign } from './types';

export const sampleEmailSequences: EmailSequence[] = [
  {
    id: 'seq-1',
    name: 'Abandono de Carrinho',
    steps: [
      { id: 'es-1-1', sequenceId: 'seq-1', stepNumber: 'D+1', subject: 'Ei, você esqueceu algo especial 💛', previewText: 'Suas peças favoritas ainda estão esperando por você...', body: '<h2>Oi, linda!</h2><p>Notamos que você deixou peças incríveis no seu carrinho. Elas foram feitas pra você — literalmente, com tecido exclusivo e caimento perfeito.</p><p>Volte e finalize sua compra antes que esgotem!</p>', status: 'ativo' },
      { id: 'es-1-2', sequenceId: 'seq-1', stepNumber: 'D+2', subject: 'Ainda dá tempo ✨', previewText: 'Seu carrinho ainda está salvo. Aproveite!', body: '<h2>Bom dia!</h2><p>Passando pra lembrar que aquelas peças lindas ainda estão no seu carrinho. Não deixe escapar!</p>', status: 'ativo' },
      { id: 'es-1-3', sequenceId: 'seq-1', stepNumber: 'D+3', subject: 'Última chance: suas peças podem esgotar', previewText: 'O estoque está acabando. Garanta as suas!', body: '<h2>Ei, não perde essa!</h2><p>O estoque dessas peças é limitado — manufatura própria, lembra? Corre pra garantir antes que acabe.</p>', status: 'ativo' },
      { id: 'es-1-4', sequenceId: 'seq-1', stepNumber: 'D+5', subject: 'Um presente pra te convencer 🎁', previewText: 'Cupom exclusivo esperando por você', body: '<h2>Tá difícil resistir, né?</h2><p>A gente entende! Pra facilitar, aqui vai um cupom de 10% OFF: <strong>VOLTE10</strong></p>', status: 'ativo' },
      { id: 'es-1-5', sequenceId: 'seq-1', stepNumber: 'D+7', subject: 'Sentimos sua falta 💛', previewText: 'Queremos te ver de volta. Olha essa condição!', body: '<h2>Faz tempo que não te vejo por aqui!</h2><p>Sua sacola ainda está salva. Finalize hoje com frete grátis usando <strong>FRETEGRATIS</strong>.</p>', status: 'ativo' },
    ],
  },
  {
    id: 'seq-2',
    name: 'Pós-compra Anna',
    steps: [
      { id: 'es-2-1', sequenceId: 'seq-2', stepNumber: 'D+0', subject: 'Parabéns pela escolha perfeita, linda!', previewText: 'Sua Calça Anna vai chegar em breve...', body: '<h2>Arrasou na escolha!</h2><p>A Calça Anna é uma das queridinhas da marca. Feita com tecido exclusivo que veste como uma luva.</p>', status: 'ativo' },
      { id: 'es-2-2', sequenceId: 'seq-2', stepNumber: 'D+3', subject: 'Como montar looks incríveis com sua Anna', previewText: '3 combinações que vão te surpreender', body: '<h2>Inspirações de look</h2><p>A Anna é versátil demais! Combina com blazer pra reunião, camiseta pra casual e body pra balada.</p>', status: 'ativo' },
      { id: 'es-2-3', sequenceId: 'seq-2', stepNumber: 'D+7', subject: 'Tá amando sua Anna? Conta pra gente!', previewText: 'Deixe sua avaliação e ganhe um mimo', body: '<h2>Queremos saber!</h2><p>Como está sendo a experiência com sua Calça Anna? Avalie e ganhe 5% OFF na próxima compra.</p>', status: 'ativo' },
      { id: 'es-2-4', sequenceId: 'seq-2', stepNumber: 'D+10', subject: 'Cashback exclusivo pra você! 💰', previewText: 'R$30 de cashback esperando na sua conta', body: '<h2>Surpresa!</h2><p>Você ganhou R$30 de cashback válido por 15 dias. Use no que quiser!</p>', status: 'ativo' },
      { id: 'es-2-5', sequenceId: 'seq-2', stepNumber: 'D+15', subject: 'Peças que combinam com sua Anna', previewText: 'Monte o look completo com sugestões especiais', body: '<h2>Complete o look!</h2><p>Que tal um body ou blazer pra acompanhar sua Anna? Selecionamos peças que ficam perfeitas juntas.</p>', status: 'ativo' },
      { id: 'es-2-6', sequenceId: 'seq-2', stepNumber: 'D+30', subject: 'Faz um mês! Hora de uma nova favorita?', previewText: 'Novidades esperando por você', body: '<h2>Já faz 1 mês!</h2><p>Temos novidades incríveis que combinam com o seu estilo. Vem ver!</p>', status: 'ativo' },
    ],
  },
  {
    id: 'seq-3',
    name: 'Primeira Compra',
    steps: [
      { id: 'es-3-1', sequenceId: 'seq-3', stepNumber: 'D+0', subject: 'Bem-vinda à família Use Mariana Cardoso! 💛', previewText: 'Você acabou de entrar num mundo de exclusividade', body: '<h2>Bem-vinda!</h2><p>Estamos tão felizes que você chegou! Use o cupom <strong>BEMVINDA</strong> pra 10% OFF na sua primeira compra.</p>', status: 'ativo' },
      { id: 'es-3-2', sequenceId: 'seq-3', stepNumber: 'D+3', subject: 'Conheça nossa história ✨', previewText: 'Tecidos próprios, manufatura própria, estilo único', body: '<h2>Prazer, Mariana!</h2><p>Cada peça é criada com tecido exclusivo e feita na nossa própria oficina. Zero fast-fashion, 100% qualidade.</p>', status: 'ativo' },
      { id: 'es-3-3', sequenceId: 'seq-3', stepNumber: 'D+7', subject: 'As mais amadas do mês 🏆', previewText: 'Veja o que as clientes estão comprando', body: '<h2>Ranking do mês!</h2><p>Calça Anna, Vestido Madri e Conjunto Sofia estão no top 3. Qual combina mais com você?</p>', status: 'ativo' },
      { id: 'es-3-4', sequenceId: 'seq-3', stepNumber: 'D+10', subject: 'Seu cupom ainda tá valendo!', previewText: 'BEMVINDA: 10% OFF esperando por você', body: '<h2>Não esquece!</h2><p>Seu cupom <strong>BEMVINDA</strong> ainda está ativo. Válido por mais 5 dias!</p>', status: 'ativo' },
      { id: 'es-3-5', sequenceId: 'seq-3', stepNumber: 'D+14', subject: 'Dicas de estilo pra arrasar', previewText: 'Looks do dia a dia ao especial', body: '<h2>Inspiração do dia!</h2><p>Monte looks versáteis com peças-chave que não saem de moda.</p>', status: 'ativo' },
      { id: 'es-3-6', sequenceId: 'seq-3', stepNumber: 'D+21', subject: 'Últimos dias do seu cupom! ⏰', previewText: 'BEMVINDA expira em 48h', body: '<h2>Corre!</h2><p>Seu cupom BEMVINDA de 10% OFF expira em 48h. Não deixe escapar essa oportunidade!</p>', status: 'ativo' },
      { id: 'es-3-7', sequenceId: 'seq-3', stepNumber: 'D+30', subject: 'Sentimos sua falta! 💛', previewText: 'Volte e descubra as novidades', body: '<h2>Oi, sumida!</h2><p>Tem muita coisa nova te esperando. Vem conferir as últimas novidades da coleção!</p>', status: 'ativo' },
    ],
  },
  {
    id: 'seq-4',
    name: 'Reengajamento',
    steps: [
      { id: 'es-4-1', sequenceId: 'seq-4', stepNumber: 'D+0', subject: 'Ei, sentimos sua falta! 💛', previewText: 'Faz tempo que você não aparece...', body: '<h2>Oi, linda!</h2><p>Faz tempo que não te vemos por aqui. Preparamos novidades especiais pra você!</p>', status: 'ativo' },
      { id: 'es-4-2', sequenceId: 'seq-4', stepNumber: 'D+3', subject: 'Olha o que chegou de novo ✨', previewText: 'Peças novas com a sua cara', body: '<h2>Novidades!</h2><p>Acabaram de chegar peças lindas que combinam com seu estilo. Vem ver!</p>', status: 'ativo' },
      { id: 'es-4-3', sequenceId: 'seq-4', stepNumber: 'D+7', subject: 'Um mimo pra te trazer de volta 🎁', previewText: 'Cupom exclusivo de reengajamento', body: '<h2>Presente pra você!</h2><p>Use o cupom <strong>VOLTEI15</strong> e ganhe 15% OFF em qualquer peça.</p>', status: 'ativo' },
      { id: 'es-4-4', sequenceId: 'seq-4', stepNumber: 'D+10', subject: 'As clientes estão amando isso', previewText: 'Veja os mais vendidos da semana', body: '<h2>Destaques da semana!</h2><p>Essas são as peças mais desejadas. Garanta a sua antes que acabe.</p>', status: 'ativo' },
      { id: 'es-4-5', sequenceId: 'seq-4', stepNumber: 'D+14', subject: 'Seu cupom está acabando! ⏰', previewText: 'VOLTEI15 expira em breve', body: '<h2>Corre!</h2><p>Seu cupom <strong>VOLTEI15</strong> expira em 3 dias. Aproveite!</p>', status: 'ativo' },
      { id: 'es-4-6', sequenceId: 'seq-4', stepNumber: 'D+21', subject: 'Última tentativa 💔', previewText: 'Não queremos te perder...', body: '<h2>Não vai embora!</h2><p>Preparamos uma condição especial só pra você. 20% OFF com <strong>FICACOMIGO</strong>.</p>', status: 'ativo' },
      { id: 'es-4-7', sequenceId: 'seq-4', stepNumber: 'D+28', subject: 'Tudo bem, respeitamos seu tempo 💛', previewText: 'Estaremos aqui quando você quiser voltar', body: '<h2>Sem pressão!</h2><p>Quando sentir vontade de se sentir incrível de novo, estaremos aqui. Com amor, Use Mariana Cardoso.</p>', status: 'ativo' },
    ],
  },
];

export const sampleWhatsAppCampaigns: WhatsAppCampaign[] = [
  {
    id: 'wpp-1',
    name: 'Coleção Madri — Leads Quiz',
    audienceSegment: 'Quiz leads',
    messageTemplate: 'Oi, linda! 💛 Lembra do quiz de estilo que você fez? A Coleção Madri tem peças perfeitas pro seu resultado! Use o cupom LOOK15 e garanta 15% OFF. Corre que é por tempo limitado! 🏃‍♀️✨\n\n👉 [link da coleção]',
    dispatchTime: '21:00',
    coupon: 'LOOK15',
    status: 'agendado',
  },
  {
    id: 'wpp-2',
    name: 'Calça Juliana — Inativos',
    audienceSegment: 'Inativos +20 dias',
    messageTemplate: 'Ei, sumida! 😍 A Calça Juliana tá fazendo o maior sucesso e eu precisava te contar! Tecido exclusivo, caimento perfeito. Pra te convencer, tem cupom: MALUCO40 = 40% OFF! Mas corre, válido só hoje!\n\n👉 [link do produto]',
    dispatchTime: '14:00',
    coupon: 'MALUCO40',
    status: 'agendado',
  },
  {
    id: 'wpp-3',
    name: 'Calça Anna — Novos Leads',
    audienceSegment: 'Leads frios',
    messageTemplate: 'Oi! Tudo bem? Sou da Use Mariana Cardoso 💛 A Calça Anna é nossa best-seller e acho que tem tudo a ver com você! Tecido próprio, veste como uma luva. Use ANNA e ganhe um desconto especial na primeira compra!\n\n👉 [link do produto]',
    dispatchTime: '21:00',
    coupon: 'ANNA',
    status: 'rascunho',
  },
  {
    id: 'wpp-4',
    name: 'Cross-sell Conjunto — Clientes Recentes',
    audienceSegment: 'Clientes recentes',
    messageTemplate: 'Oi, linda! Vi que você amou sua última compra 🥰 Que tal completar o look com nosso Conjunto Sofia? Peça exclusiva que combina com tudo! Cupom EXTRA3103 = frete grátis + 10% OFF!\n\n👉 [link do produto]',
    dispatchTime: '15:00',
    coupon: 'EXTRA3103',
    status: 'enviado',
  },
];
