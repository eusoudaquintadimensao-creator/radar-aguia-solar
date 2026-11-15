// Curto prazo/prazos, Riqueza (calculadoras), Inteligência emocional, Detector de golpes, Onde investir.
import { h, $, $$, limpar, num, brl, pct, cls, guarda, cartaoNum, dataHora } from './util.js';
import { tempoAteAlvo, diasCDI, regraSaida, cdiAnual, INVESTIVEIS } from './engine.js';
import { grafico, CORES } from './graf.js';
let ctx;
const nome = id => ctx.estado.mk?.ativos[id]?.nome || id;

// ================= CURTO PRAZO =================
const OPCOES = [
  { n: 1, nome: 'Tesouro Selic', risco: 'Risco baixo', txt: 'Título público federal que acompanha a Selic. Pode resgatar em dias úteis (liquidez diária). Antes de 30 dias há IOF e o IR é maior em prazos curtos (22,5% até 180 dias). Pode ter pequena oscilação no curtíssimo prazo.', link: 'https://www.tesourodireto.com.br/' },
  { n: 1, nome: 'CDB com liquidez diária (coberto pelo FGC)', risco: 'Risco baixo', txt: 'Empréstimo a um banco que rende um percentual do CDI. O FGC cobre até R$ 250 mil por CPF por instituição (com limite global). Prefira bancos sólidos; o risco é o banco quebrar acima do limite do FGC.', link: 'https://www.fgc.org.br/' },
  { n: 1, nome: 'Fundos DI / renda fixa simples', risco: 'Risco baixo', txt: 'Fundos que aplicam em títulos atrelados ao CDI. Atenção à taxa de administração e ao "come-cotas". Regulados pela CVM.', link: 'https://www.investidor.gov.br/' },
  { n: 2, nome: 'LCI / LCA', risco: 'Risco baixo, mas sem liquidez imediata', txt: 'Isentas de IR para pessoa física e cobertas pelo FGC, mas têm prazo mínimo de carência de vários meses: não servem como dinheiro de uso rápido.', link: 'https://www.fgc.org.br/' },
  { n: 3, nome: 'Swing trade em ações e ETFs da B3 (dias a semanas)', risco: 'Risco alto', txt: 'Comprar e vender em dias ou semanas tentando aproveitar movimentos. Exige stop-loss, controle emocional e aceita perder. IR de 15% sobre lucro (há isenção para vendas de ações até R$ 20 mil/mês, não vale para ETFs).', link: 'https://www.b3.com.br/' },
  { n: 4, nome: 'Day trade (compra e venda no mesmo dia)', risco: 'Risco muito alto', txt: 'A maioria das pessoas perde dinheiro (veja o estudo abaixo). Custos, emoção e concorrência com profissionais e robôs pesam contra. IR de 20% sobre lucro.', link: 'https://www.investidor.gov.br/' },
  { n: 4, nome: 'ETFs de criptoativos listados na B3', risco: 'Risco muito alto', txt: 'Forma regulada (CVM/B3) de se expor a cripto sem guardar chaves. Mesmo assim, quedas de 50% a 80% já aconteceram.', link: 'https://www.b3.com.br/' },
  { n: 5, nome: 'Opções, derivativos e alavancagem', risco: 'Risco extremo', txt: 'Pequenos movimentos geram grandes perdas; em alguns casos é possível perder mais do que o valor investido. Não é para iniciantes.', link: 'https://www.investidor.gov.br/' }
];
function renderCurto() {
  const bloq = $('#curto-bloqueio'), corpo = $('#curto-corpo');
  if (!ctx.avisoAceito()) { bloq.hidden = false; corpo.hidden = true; ctx.abrirAviso(ctx.rota, true); return; }
  bloq.hidden = true; corpo.hidden = false;
  const op = limpar($('#curto-opcoes'));
  for (const o of OPCOES) op.append(h('div', { class: 'opcao' }, h('h3', {}, o.nome, h('span', { class: 'nivel n' + o.n }, o.risco)), h('p', {}, o.txt), h('a', { href: o.link }, 'Fonte oficial ↗')));
  op.append(h('p', { class: 'nota' }, 'Nenhuma opção é isenta de risco. Valores e regras de impostos/FGC podem mudar: confira nas fontes oficiais.'));
  if (!ctx.estado.mk) { limpar($('#pz-tab')).append(h('caption', {}, 'Dados de mercado indisponíveis.')); return; }
  renderPrazos(); renderSaidas();
}
function renderPrazos() {
  const mk = ctx.estado.mk; const meta = +$('#pz-meta').value;
  const cdiAno = cdiAnual(mk.cdi);
  const ids = INVESTIVEIS.filter(id => mk.ativos[id]);
  const res = ids.map(id => ({ id, ...tempoAteAlvo(mk.ativos[id].brl, meta, 365) }));
  const t = limpar($('#pz-tab'));
  t.append(h('thead', {}, h('tr', {}, ['Investimento', 'Chance em 1 ano*', 'Tempo típico', 'Faixa comum', 'Queda no caminho'].map(x => h('th', {}, x)))));
  const tb = h('tbody');
  const dCDI = diasCDI(meta, cdiAno);
  tb.append(h('tr', {}, h('td', { class: 'nome' }, 'Renda fixa (CDI atual)'), h('td', {}, dCDI <= 365 ? '≈100% se a taxa se mantiver' : 'não em 1 ano'), h('td', {}, `${num(dCDI, 0)} dias`), h('td', {}, '—'), h('td', { class: 'sobe' }, 'quase nenhuma')));
  for (const r of res.sort((a, b) => b.prob - a.prob)) tb.append(h('tr', {}, h('td', { class: 'nome' }, nome(r.id)), h('td', { class: r.prob > 0.6 ? 'sobe' : r.prob < 0.35 ? 'cai' : '' }, num(r.prob * 100, 0) + '%'), h('td', {}, r.mediana == null ? 'não atingiu' : `${num(r.mediana, 0)} dias`), h('td', {}, r.p25 == null ? '—' : `${num(r.p25, 0)}–${num(r.p75, 0)} dias`), h('td', { class: 'cai' }, r.quedaMedia == null ? '—' : pct(r.quedaMedia))));
  t.append(tb, h('caption', { class: 'nota' }, `* Com base nos últimos ~2 anos, janela de ${res[0]?.janelaDias || 365} dias. Período curto: um único ciclo de mercado pode distorcer tudo. Passado não garante futuro.`));
  const g = grafico($('#g-pz'), { tempoNumerico: true, fmtPreco: p => num(p, 0) + '%' });
  const cores = [CORES.ouro, CORES.ciano, CORES.laranja, CORES.roxo, CORES.verm];
  const escolhidos = ['BOVA11', 'IVVB11', 'BTC', 'OURO', 'PETR4'].filter(id => mk.ativos[id]);
  const cdiLinha = []; for (let d = 0; d <= 365; d += 5) cdiLinha.push({ time: d, value: d >= dCDI ? 100 : 0 });
  g.linha(cdiLinha, CORES.verde, 'CDI', 2);
  escolhidos.forEach((id, i) => { const r = res.find(x => x.id === id); g.linha(r.cdf.map(([d, p]) => ({ time: d, value: +(p * 100).toFixed(1) })), cores[i], id, 2); });
  g.ajustar();
  limpar($('#leg-pz')).append(...[['CDI', CORES.verde], ...escolhidos.map((id, i) => [id, cores[i]])].map(([n, c]) => { const i = h('i'); i.style.background = c; return h('span', {}, i, n); }));
}
function renderSaidas() {
  const mk = ctx.estado.mk; const sel = $('#es-ativo');
  if (!sel.options.length) for (const id of INVESTIVEIS.filter(id => mk.ativos[id])) sel.append(h('option', { value: id }, nome(id)));
  const id = sel.value || 'BOVA11'; const serie = mk.ativos[id].brl.slice(-500);
  const r = regraSaida(serie, { meta: +$('#es-meta').value, stop: +$('#es-stop').value });
  const g = grafico($('#g-es'), { fmtPreco: p => brl(p) });
  const s = g.area(serie.map(([d, v]) => ({ time: d, value: v })), CORES.ouro, nome(id));
  const marcas = [];
  for (const o of r.ops) { marcas.push({ time: o.entrada, position: 'belowBar', color: CORES.ciano, shape: 'arrowUp', text: 'E' }); marcas.push({ time: o.saida, position: 'aboveBar', color: o.motivo === 'meta' ? CORES.verde : CORES.verm, shape: 'circle', text: o.motivo === 'meta' ? '+' : '−' }); }
  if (r.aberta) marcas.push({ time: r.aberta.entrada, position: 'belowBar', color: CORES.ciano, shape: 'arrowUp', text: 'E (aberta)' });
  marcas.sort((a, b) => a.time.localeCompare(b.time));
  g.marcas(s, marcas); g.ajustar();
  limpar($('#es-num')).append(
    cartaoNum('Operações simuladas', r.ops.length), cartaoNum('Acertos', (r.acerto ?? 0) * 100, { fmt: x => r.acerto == null ? '—' : num(x, 0) + '%' }),
    cartaoNum('Resultado médio', (r.medio ?? 0) * 100, { fmt: x => r.medio == null ? '—' : pct(x / 100) }), cartaoNum('Dias por operação', r.diasMedio ?? 0, { fmt: x => r.diasMedio == null ? '—' : num(x, 0) }),
    cartaoNum('Total da regra', r.total * 100, { fmt: x => pct(x / 100) }), cartaoNum('Comprar e segurar', r.comprarEsegurar * 100, { fmt: x => pct(x / 100) })
  );
  const t = limpar($('#es-ops'));
  t.append(h('thead', {}, h('tr', {}, ['Entrada', 'Saída', 'Motivo', 'Dias', 'Resultado'].map(x => h('th', {}, x)))), h('tbody', {}, [...r.ops].reverse().slice(0, 12).map(o => h('tr', {}, h('td', {}, new Date(o.entrada + 'T12:00').toLocaleDateString('pt-BR')), h('td', {}, new Date(o.saida + 'T12:00').toLocaleDateString('pt-BR')), h('td', {}, o.motivo === 'meta' ? 'stop-gain (meta)' : o.motivo === 'stop' ? 'stop-loss' : 'perdeu a média'), h('td', {}, num(o.dias, 0)), h('td', { class: cls(o.ret) }, pct(o.ret, 1))))));
}

// ================= RIQUEZA =================
const FERRAMENTAS = [
  ['⏳', 'Juros compostos e tempo', 'Rendimento sobre rendimento. O fator mais poderoso é o tempo: começar cedo, mesmo com pouco, faz enorme diferença. Use a calculadora abaixo.'],
  ['🧺', 'Diversificação', 'Não depender de um único ativo, setor, país ou moeda. Reduz o risco de um único erro destruir o patrimônio.'],
  ['📊', 'ETFs e fundos de índice', 'Compram "o mercado inteiro" (ex.: Ibovespa, S&P 500) com custo baixo. Muitos grandes investidores usam índices como base da carteira.'],
  ['⚖️', 'Rebalanceamento', 'De tempos em tempos, voltar aos percentuais planejados: vender um pouco do que subiu muito e comprar do que ficou para trás. Disciplina contra a emoção.'],
  ['🛟', 'Reserva de emergência', 'Antes de arriscar, ter de 6 a 12 meses de gastos em aplicação segura e líquida. Evita vender investimentos na pior hora.'],
  ['🧾', 'Eficiência tributária', 'Pagar menos imposto de forma legal: LCI/LCA e debêntures incentivadas são isentas de IR para pessoa física; vendas de ações até R$ 20 mil/mês são isentas; prazos longos reduzem o IR da renda fixa.'],
  ['🏦', 'Previdência privada (PGBL/VGBL)', 'PGBL pode deduzir até 12% da renda tributável para quem faz a declaração completa; VGBL é útil para planejamento e sucessão. Compare taxas: muitas são caras.'],
  ['🏛', 'Holding e planejamento sucessório', 'Organizar bens numa empresa familiar e planejar a herança para reduzir custos e conflitos (inventário, ITCMD). Exige advogado e contador.'],
  ['🌱', 'Renda passiva: dividendos e FIIs', 'Ações que pagam dividendos e fundos imobiliários (FIIs) distribuem renda periódica. Rendimentos de FIIs costumam ser isentos de IR para pessoa física (com regras). Valores não são garantidos.'],
  ['🎓', 'Educação financeira contínua', 'Ler, estudar e entender antes de investir. Portal do Investidor (CVM) e cursos gratuitos da B3 e do Tesouro são ótimos começos.'],
  ['🤖', 'Tecnologia a favor', 'Planilhas e apps de orçamento, consolidadores de carteira, alertas de preço, extratos da B3 (Área do Investidor) e o Tesouro Direto no celular. Use só apps oficiais e com 2FA.']
];
function renderRiqueza() {
  const el = limpar($('#riq-cartoes'));
  for (const [ic, t, d] of FERRAMENTAS) el.append(h('article', { class: 'cartao' }, h('span', { class: 'fam' }, ic + ' ferramenta'), h('h3', {}, t), h('p', {}, d)));
  el.append(h('article', { class: 'cartao' }, h('span', { class: 'fam' }, '📚 aprender de graça'), h('h3', {}, 'Fontes oficiais'), h('p', {}, 'Comece pelos portais públicos e oficiais:'), h('div', { class: 'acoes' }, h('a', { href: 'https://www.investidor.gov.br/' }, 'Portal do Investidor (CVM) ↗'), h('a', { href: 'https://www.tesourodireto.com.br/' }, 'Tesouro Direto ↗'), h('a', { href: 'https://edu.b3.com.br/' }, 'B3 Educação ↗'))));
  calcJC(); calcRes(); calcMeta(); calcOrc();
}
const val = id => Math.max(0, +$(id).value || 0);
function calcJC() {
  const ini = val('#jc-ini'), mes = val('#jc-mes'), taxa = Math.min(100, val('#jc-taxa')) / 100, anos = Math.min(60, Math.max(1, Math.round(val('#jc-anos'))));
  const im = Math.pow(1 + taxa, 1 / 12) - 1; let v = ini, aportado = ini; const pts = [], apt = [];
  const base = new Date(); base.setDate(1);
  for (let m = 0; m <= anos * 12; m++) { if (m > 0) { v = v * (1 + im) + mes; aportado += mes; } if (m % 3 === 0) { const d = new Date(base); d.setMonth(d.getMonth() + m); const t = d.toISOString().slice(0, 10); pts.push({ time: t, value: +v.toFixed(2) }); apt.push({ time: t, value: +aportado.toFixed(2) }); } }
  limpar($('#jc-num')).append(cartaoNum('Valor final (simulado)', v, { fmt: x => brl(x, 0) }), cartaoNum('Total aportado', aportado, { fmt: x => brl(x, 0) }), cartaoNum('Ganho dos juros', v - aportado, { fmt: x => brl(x, 0) }));
  const g = grafico($('#g-jc'), { fmtPreco: p => brl(p, 0) }); g.area(pts, CORES.ouro, 'Patrimônio'); g.linha(apt, CORES.ciano, 'Aportado', 1); g.ajustar();
}
function calcRes() { const g = val('#res-gasto'), m = +$('#res-tipo').value; limpar($('#res-num')).append(cartaoNum('Reserva ideal', g * m, { fmt: x => brl(x, 0), sub: `${m} meses de gastos` }), cartaoNum('Juntando 10%/mês da renda (≈)', g > 0 ? m * 10 : 0, { fmt: x => num(x, 0) + ' meses', sub: 'se a renda ≈ gasto' })); }
function calcMeta() {
  const V = val('#mt-valor'), n = Math.max(1, Math.round(val('#mt-meses'))), i = Math.pow(1 + val('#mt-taxa') / 100, 1 / 12) - 1;
  const pmt = i > 0 ? V * i / (Math.pow(1 + i, n) - 1) : V / n;
  limpar($('#mt-num')).append(cartaoNum('Guardar por mês', pmt, { fmt: x => brl(x) }), cartaoNum('Você coloca', pmt * n, { fmt: x => brl(x, 0) }), cartaoNum('Juros ajudam com', V - pmt * n, { fmt: x => brl(x, 0) }));
}
function calcOrc() { const r = val('#orc-renda'); limpar($('#orc-num')).append(cartaoNum('Necessidades (50%)', r * 0.5, { fmt: x => brl(x, 0) }), cartaoNum('Desejos (30%)', r * 0.3, { fmt: x => brl(x, 0) }), cartaoNum('Futuro (20%)', r * 0.2, { fmt: x => brl(x, 0) })); }

// ================= MENTE =================
let respTimer = null;
function pausa() {
  const circ = $('#circulo'), txt = $('#resp-txt'), seg = $('#resp-seg'); $('#resp-fim').hidden = true;
  clearInterval(respTimer); let s = 60; seg.textContent = s;
  const fase = () => { const f = Math.floor((60 - s) / 4) % 2 === 0; circ.className = 'circulo ' + (f ? 'inspira' : 'expira'); txt.textContent = f ? 'Inspire…' : 'Solte o ar…'; };
  fase();
  respTimer = setInterval(() => { s--; seg.textContent = s; fase(); if (s <= 0) { clearInterval(respTimer); circ.className = 'circulo'; txt.textContent = 'Pronto'; $('#resp-fim').hidden = false; guarda.gravar('pausas', (guarda.ler('pausas', 0) || 0) + 1); } }, 1000);
}
const CHECK = ['Esta operação está no meu plano escrito (não é impulso)?', 'Sei exatamente onde é meu stop-loss e meu stop-gain?', 'Se der stop, a perda é pequena e não me abala (≤ 1–2% do capital)?', 'Não é dinheiro da reserva, das contas ou emprestado?', 'Não estou tentando recuperar uma perda de hoje?', 'Não estou entrando só porque "todo mundo está ganhando" (FOMO)?', 'Estou descansado e calmo (não com raiva, eufórico ou cansado)?', 'Ainda não bati meu limite de perda do dia?'];
const QUIZ = [
  ['Depois de uma perda, você sente vontade de operar de novo logo para recuperar?', ['Quase nunca', 0], ['Às vezes', 1], ['Quase sempre', 2]],
  ['Você define o stop-loss antes de entrar?', ['Sempre', 0], ['Às vezes', 1], ['Nunca', 2]],
  ['Quando algo sobe muito, você sente que precisa comprar antes que suba mais?', ['Não', 0], ['Às vezes', 1], ['Sim, muito', 2]],
  ['Você já usou dinheiro de contas, reserva ou empréstimo para investir em algo arriscado?', ['Nunca', 0], ['Uma vez', 1], ['Mais de uma vez', 2]],
  ['Você esconde de pessoas próximas quanto perdeu?', ['Não', 0], ['Às vezes', 1], ['Sim', 2]],
  ['Acompanhar o mercado atrapalha seu sono, trabalho ou família?', ['Não', 0], ['Um pouco', 1], ['Bastante', 2]],
  ['Você mantém um diário das suas decisões?', ['Sim', 0], ['De vez em quando', 1], ['Não', 2]]
];
function renderMente() {
  const ck = limpar($('#mente-check'));
  CHECK.forEach((q, i) => ck.append(h('label', {}, h('input', { type: 'checkbox', 'data-i': i }), h('span', {}, q))));
  ck.onchange = () => { const n = $$('#mente-check input:checked').length; limpar($('#mente-check-res')).append(n === CHECK.length ? h('div', { class: 'resultado verde' }, '✔ Checklist completo. Mesmo assim: é só simulação e o risco continua existindo.') : h('div', { class: 'resultado ' + (n >= 6 ? 'amarelo' : 'vermelho') }, `${n}/${CHECK.length} itens. Se algum item ficou sem marcar, a decisão mais inteligente é `, h('b', {}, 'não operar agora.'))); };
  const qz = limpar($('#quiz'));
  QUIZ.forEach(([p, ...ops], i) => qz.append(h('fieldset', {}, h('legend', {}, `${i + 1}. ${p}`), ops.map(([t, v]) => h('label', {}, h('input', { type: 'radio', name: 'q' + i, value: v, required: true }), t)))));
  qz.append(h('button', { class: 'btn ouro-btn', type: 'submit' }, 'Ver meu resultado'));
  qz.onsubmit = e => { e.preventDefault(); let s = 0, n = 0; QUIZ.forEach((_, i) => { const m = qz.querySelector(`input[name=q${i}]:checked`); if (m) { s += +m.value; n++; } }); if (n < QUIZ.length) { limpar($('#quiz-res')).append(h('div', { class: 'resultado amarelo' }, 'Responda todas as perguntas.')); return; }
    const r = s <= 3 ? ['verde', 'Boa base emocional. Continue com regras escritas e limites claros.'] : s <= 7 ? ['amarelo', 'Sinais de atenção. Use a pausa consciente antes de decidir, defina stop-loss sempre e um limite de perda diário.'] : ['vermelho', 'Sinais fortes de decisões emocionais. Considere parar por um tempo, conversar com alguém de confiança e buscar orientação profissional. Saber dizer "chega" é força.'];
    limpar($('#quiz-res')).append(h('div', { class: 'resultado ' + r[0] }, h('b', {}, `Pontuação ${s} de ${QUIZ.length * 2}. `), r[1], s > 7 ? h('p', {}, 'Se as decisões com dinheiro estão afetando sua vida, procure ajuda: o CVV atende 24h pelo 188 (gratuito).') : null)); };
  limite(); for (const id of ['#lim-cap', '#lim-pct', '#lim-hoje']) $(id).oninput = limite;
}
function limite() {
  const cap = val('#lim-cap'), p = +$('#lim-pct').value, hoje = val('#lim-hoje'); const max = cap * p;
  const el = limpar($('#lim-res'));
  el.append(h('div', { class: 'resultado ' + (hoje >= max ? 'vermelho' : hoje >= max * 0.7 ? 'amarelo' : 'verde') }, h('b', {}, `Limite de hoje: ${brl(max)}. `), hoje >= max ? 'Limite atingido: PARE por hoje. Amanhã é outro dia.' : hoje >= max * 0.7 ? `Atenção: faltam ${brl(max - hoje)} para o limite. Considere parar.` : `Ainda dentro do limite (faltam ${brl(max - hoje)}).`));
}

// ================= DETECTOR DE GOLPES =================
const SINAIS = [
  { id: 'retorno', peso: 30, t: 'Promete retorno alto, fixo ou garantido', re: /(\d+[,.]?\d*\s?%\s?(ao|por|a)\s?(dia|semana|m[eê]s))|garantid|sem risco|risco zero|lucro certo|renda fixa de \d{2}|dobr(a|ar) (seu|o) (dinheiro|capital)|retorno certo|rendimento di[aá]rio/i },
  { id: 'urgencia', peso: 15, t: 'Pressão e urgência', re: /s[oó] hoje|[uú]ltimas vagas|corra|n[aã]o perca|tempo limitado|agora ou nunca|vagas limitadas|urgente|imperd[ií]vel|exclusiv[oa] por/i },
  { id: 'indicacao', peso: 25, t: 'Ganho por indicação de outras pessoas', re: /indiqu|indica[cç][aã]o|convide|traga (amigos|pessoas)|b[oô]nus por|rede de|n[ií]veis|cadastre (amigos|pessoas)|ganhe por cada/i },
  { id: 'cripto', peso: 20, t: 'Plataforma/robô de cripto ou "trader" que opera por você', re: /rob[oô] (de |que )?(cripto|investimento|trade)|arbitragem|trader (que )?opera por|gestor de cripto|minera[cç][aã]o em nuvem|token exclusivo|nova moeda|airdrop|staking garantido/i },
  { id: 'dados', peso: 30, t: 'Pede senha, código, seed phrase ou Pix para pessoa física', re: /senha|c[oó]digo (de )?(verifica|sms|token)|seed|frase.?semente|chave privada|pix para|transfira para (minha|a) conta|deposite (na|em) (conta|minha)/i },
  { id: 'registro', peso: 15, t: 'Diz que não precisa de corretora/registro ou é "no exterior"', re: /sem (corretora|burocracia|registro)|n[aã]o precisa de corretora|empresa (do|no) exterior|regulad[ao] (em|no) (exterior|outro pa[ií]s)|offshore/i }
];
const PERGUNTAS = [['cvm', 'A empresa NÃO aparece como autorizada na CVM ou no Banco Central', 25], ['contato', 'O contato veio por WhatsApp/Telegram/Instagram de um desconhecido', 10], ['famoso', 'Usa foto de famoso, "depoimentos" de lucro ou prints de ganhos', 10]];
function renderFraude() {
  const p = limpar($('#fr-perg'));
  for (const [id, t] of PERGUNTAS) p.append(h('label', {}, h('input', { type: 'checkbox', 'data-id': id }), h('span', {}, t)));
  $('#fr-analisar').onclick = () => {
    const txt = $('#fr-texto').value.slice(0, 5000);
    const achados = SINAIS.filter(s => s.re.test(txt));
    const marcadas = PERGUNTAS.filter(([id]) => $(`#fr-perg input[data-id=${id}]`).checked);
    const score = Math.min(100, achados.reduce((s, x) => s + x.peso, 0) + marcadas.reduce((s, x) => s + x[2], 0));
    const nivel = score >= 50 ? ['vermelho', 'ALTO RISCO DE GOLPE. Não invista e não envie dinheiro.'] : score >= 20 ? ['amarelo', 'Sinais de alerta. Verifique na CVM e no Banco Central antes de qualquer coisa.'] : ['verde', 'Nenhum sinal clássico encontrado no texto. Isso NÃO garante que é seguro: confira sempre o registro.'];
    const i = h('i'); i.style.left = `calc(${score}% - 3px)`;
    limpar($('#fr-res')).append(h('div', { class: 'resultado ' + nivel[0] }, h('b', {}, `Risco: ${score}/100. ${nivel[1]}`), h('div', { class: 'medidor' }, i),
      (achados.length || marcadas.length) ? h('ul', {}, achados.map(a => h('li', {}, '🚩 ' + a.t)), marcadas.map(m => h('li', {}, '🚩 ' + m[1]))) : null,
      h('p', {}, 'Consulte: ', h('a', { href: 'https://www.gov.br/cvm/pt-br/assuntos/protecao/alertas' }, 'alertas da CVM'), ' · ', h('a', { href: 'https://www.gov.br/cvm/pt-br/assuntos/regulados/consultas-por-participante' }, 'quem é autorizado (CVM)'), ' · ', h('a', { href: 'https://www.bcb.gov.br/estabilidadefinanceira/encontreinstituicao' }, 'Banco Central'))));
  };
}

// ================= ONDE INVESTIR =================
const TIPOS = [
  ['🏛', 'Tesouro Direto', 'Títulos públicos federais comprados por corretoras ou bancos habilitados. Risco de crédito do governo federal (o menor do país).', 'https://www.tesourodireto.com.br/'],
  ['🛡', 'CDB, LCI e LCA com FGC', 'Emitidos por bancos autorizados pelo Banco Central; o FGC cobre até R$ 250 mil por CPF por instituição (com limite global).', 'https://www.fgc.org.br/'],
  ['📈', 'Ativos listados na B3', 'Ações, ETFs, FIIs e BDRs negociados na bolsa brasileira, fiscalizada pela CVM.', 'https://www.b3.com.br/'],
  ['🏦', 'Corretoras autorizadas', 'Só abra conta em corretora com registro ativo na CVM e participante da B3. Veja a lista abaixo e confira nos sites oficiais.', 'https://www.b3.com.br/pt_br/produtos-e-servicos/participantes/busca-de-participantes/busca-de-corretoras/'],
  ['🪙', 'Cripto pelo caminho regulado', 'ETFs de criptoativos listados na B3 (regulados pela CVM). Para corretoras de cripto, confira se estão autorizadas pelo Banco Central, que está implantando a regulamentação do setor.', 'https://www.bcb.gov.br/estabilidadefinanceira/encontreinstituicao']
];
function renderPlataformas() {
  const el = limpar($('#plat-tipos'));
  for (const [ic, t, d, l] of TIPOS) el.append(h('article', { class: 'cartao' }, h('span', { class: 'fam' }, ic + ' regulado'), h('h3', {}, t), h('p', {}, d), h('div', { class: 'acoes' }, h('a', { href: l }, 'Fonte oficial ↗'))));
  const reg = ctx.estado.reg; const t = limpar($('#plat-tab'));
  if (!reg) { t.append(h('caption', {}, 'Lista indisponível agora. Consulte direto na CVM.')); return; }
  $('#plat-atual').textContent = 'CVM · ' + dataHora(reg.atualizado);
  t.append(h('thead', {}, h('tr', {}, ['Instituição', 'Razão social (CVM)', 'CNPJ', 'Situação na CVM', 'Tipo de registro', 'Site oficial'].map(x => h('th', {}, x)))));
  t.append(h('tbody', {}, [...reg.itens].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(i => h('tr', {}, h('td', { class: 'nome' }, i.nome), h('td', {}, i.razao), h('td', {}, i.cnpj), h('td', { class: /NORMAL/.test(i.situacao) ? 'ok-cvm' : 'nok-cvm' }, /NORMAL/.test(i.situacao) ? '✔ ' + i.situacao.toLowerCase() : '✖ ' + i.situacao.toLowerCase()), h('td', {}, i.tipos.map(x => x.toLowerCase()).join(', ')), h('td', {}, h('a', { href: i.site }, new URL(i.site).hostname + ' ↗'))))));
}

export function iniciarExtras(c) {
  ctx = c;
  c.registrar('curto', renderCurto);
  c.registrar('riqueza', renderRiqueza);
  c.registrar('mente', renderMente);
  c.registrar('fraude', renderFraude);
  c.registrar('plataformas', renderPlataformas);
  $('#pz-meta').addEventListener('change', renderPrazos);
  for (const id of ['#es-ativo', '#es-meta', '#es-stop']) $(id).addEventListener('change', renderSaidas);
  $('#calc-jc').addEventListener('input', calcJC); $('#calc-res').addEventListener('input', calcRes); $('#calc-meta').addEventListener('input', calcMeta); $('#calc-orc').addEventListener('input', calcOrc);
  for (const f of ['#calc-jc', '#calc-res', '#calc-meta', '#calc-orc', '#calc-lim']) $(f).addEventListener('submit', e => e.preventDefault());
  $('#resp-ini').addEventListener('click', pausa);
  $('#resp-parar').addEventListener('click', () => { clearInterval(respTimer); $('#circulo').className = 'circulo'; $('#resp-txt').textContent = 'Pausado'; });
}
