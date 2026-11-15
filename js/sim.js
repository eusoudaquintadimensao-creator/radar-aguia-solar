// Simulador (PAPER TRADING): dinheiro fictício, nada é enviado a lugar nenhum.
import { h, $, limpar, num, brl, pct, cls, guarda, cartaoNum, dataHora } from './util.js';
import { analisar, alocar, backtest, monteCarlo, cdiAnual, cdiAcumulado, motivos, sentimentoPorAtivo, INVESTIVEIS, PERFIS } from './engine.js';
import { grafico, CORES } from './graf.js';

let ctx;
const nomeAtivo = id => id === 'CDI' ? 'Renda fixa pós (CDI)' : ctx.estado.mk?.ativos[id]?.nome || id;
const precoAtual = id => ctx.estado.mk?.ativos[id]?.brl.at(-1)?.[1];
const ultimaData = () => ctx.estado.mk?.ativos.BOVA11?.brl.at(-1)?.[0] || new Date().toISOString().slice(0, 10);

function analiseAtual(perfil) {
  const mk = ctx.estado.mk;
  const cdiAno = cdiAnual(mk.cdi);
  const itens = (ctx.estado.news?.feeds || []).flatMap(f => f.itens);
  const sent = sentimentoPorAtivo(itens);
  const an = INVESTIVEIS.filter(id => mk.ativos[id]).map(id => analisar(id, mk.ativos[id].brl, { cdiAno, sentimento: sent[id] || 0 })).filter(Boolean);
  return { cdiAno, an, pesos: alocar(an, perfil) };
}

function render() {
  const mk = ctx.estado.mk;
  const bloq = $('#sim-bloqueio'), corpo = $('#sim-corpo');
  if (!ctx.avisoAceito()) { bloq.hidden = false; corpo.hidden = true; ctx.abrirAviso(ctx.rota, true); return; }
  bloq.hidden = true; corpo.hidden = false;
  if (!mk) { limpar($('#sim-aloc')).append(h('p', { class: 'vazio' }, 'Dados de mercado indisponíveis agora (sem conexão e sem cache). Tente mais tarde.')); return; }
  const valor = Math.max(100, Math.min(1e8, +$('#sim-valor').value || 10000));
  const perfil = $('#sim-perfil').value, horiz = +$('#sim-horiz').value;
  const { cdiAno, an, pesos } = analiseAtual(perfil);
  ctx.ultima = { perfil, valor, pesos, an, cdiAno };

  limpar($('#sim-macro')).append(
    cartaoNum('CDI (12 meses)', cdiAno * 100, { fmt: x => num(x, 2) + '%' }),
    cartaoNum('Selic meta', ctx.estado.vivo.selic ?? mk.selic ?? 0, { fmt: x => num(x, 2) + '%' }),
    cartaoNum('IPCA 12 meses', mk.ipca12m ?? 0, { fmt: x => num(x, 2) + '%' }),
    cartaoNum('Dólar', precoAtual('USD') || 0, { fmt: x => brl(x) }),
    cartaoNum('Bitcoin', precoAtual('BTC') || 0, { fmt: x => brl(x, 0) }),
    cartaoNum('Ibovespa', mk.ativos.IBOV?.brl.at(-1)[1] || 0, { fmt: x => num(x, 0) + ' pts' })
  );

  const el = limpar($('#sim-aloc'));
  const ordem = Object.entries(pesos).sort((a, b) => b[1] - a[1]);
  for (const [id, w] of ordem) {
    const a = an.find(x => x.id === id);
    const bar = h('i'); bar.style.width = (w * 100).toFixed(1) + '%';
    el.append(h('div', { class: 'aloc-item' },
      h('span', {}, h('strong', {}, nomeAtivo(id)), ' ', h('span', { class: 'selo-sim' }, 'simulação')),
      h('b', {}, `${num(w * 100, 1)}% · ${brl(valor * w)}`),
      h('div', { class: 'bar' }, bar),
      h('details', {}, h('summary', {}, 'Por quê? (raciocínio da Águia)'),
        id === 'CDI' ? h('p', {}, `Parte protegida conforme o perfil ${PERFIS[perfil].nome} e tudo que não passou nos filtros. O CDI rendeu cerca de ${num(cdiAno * 100, 1)}% nos últimos 12 meses. Renda fixa também tem riscos (crédito, inflação, liquidez).`)
          : h('ul', {}, motivos(a).map(m => h('li', {}, m)), h('li', {}, `pontuação final ${num(a.score, 3)} (de −1 a +1)`)))
    ));
  }
  el.append(h('p', { class: 'nota' }, `Dados de mercado até ${dataHora(mk.atualizado)} (ações e índices com atraso; cripto e dólar podem estar ao vivo). Simulação educativa, não é recomendação de investimento.`));

  // raio-x
  const t = limpar($('#sim-tab'));
  t.append(h('thead', {}, h('tr', {}, ['Ativo', 'Sinal (simulado)', 'Pontos', '1 mês', '6 meses', 'Volat.', 'RSI', 'Sharpe', 'Pior queda', 'Notícias'].map(x => h('th', {}, x)))));
  const tb = h('tbody');
  for (const a of [...an].sort((x, y) => y.score - x.score)) tb.append(h('tr', {}, h('td', { class: 'nome' }, nomeAtivo(a.id)), h('td', {}, h('span', { class: 'sinal ' + cls(a.score - 0.05) }, a.sinal)), h('td', { class: cls(a.score) }, num(a.score, 2)), h('td', { class: cls(a.r1) }, pct(a.r1)), h('td', { class: cls(a.r6) }, pct(a.r6)), h('td', {}, pct(a.vol, 0, false)), h('td', {}, a.rsi == null ? '—' : num(a.rsi, 0)), h('td', { class: cls(a.sharpe) }, num(a.sharpe, 2)), h('td', { class: 'cai' }, pct(a.dd, 0)), h('td', { class: cls(a.sent) }, a.sent ? num(a.sent, 2) : '—')));
  t.append(tb);

  // backtest
  const bt = backtest(mk, perfil);
  const g = grafico($('#g-back'), { sufixo: '' });
  const ser = (arr) => bt.datas.map((d, i) => ({ time: d, value: +(arr[i] * valor).toFixed(2) }));
  g.area(ser(bt.curva), CORES.ouro, 'Águia (simulação)');
  g.linha(ser(bt.bench.CDI), CORES.verde, 'CDI', 2);
  g.linha(ser(bt.bench.IBOV), CORES.ciano, 'Ibovespa', 1);
  g.linha(ser(bt.bench.BTC), CORES.laranja, 'Bitcoin', 1);
  g.ajustar();
  limpar($('#leg-back')).append(...[['Águia (simulação)', CORES.ouro], ['CDI', CORES.verde], ['Ibovespa', CORES.ciano], ['Bitcoin', CORES.laranja]].map(([n, c]) => { const i = h('i'); i.style.background = c; return h('span', {}, i, n); }));
  const E = bt.estat;
  limpar($('#sim-back')).append(
    cartaoNum('Águia: resultado', E.carteira.total * 100, { fmt: x => pct(x / 100), sub: `de ${brl(valor, 0)} para ${brl(valor * (1 + E.carteira.total), 0)}` }),
    cartaoNum('CDI no período', E.CDI.total * 100, { fmt: x => pct(x / 100) }),
    cartaoNum('Ibovespa', E.IBOV.total * 100, { fmt: x => pct(x / 100) }),
    cartaoNum('Bitcoin', E.BTC.total * 100, { fmt: x => pct(x / 100) }),
    cartaoNum('Pior queda (Águia)', E.carteira.dd * 100, { fmt: x => pct(x / 100) }),
    cartaoNum('Dias testados', bt.dias, { sub: `${bt.rebal.length} rebalanceamentos` })
  );
  const ganhouCDI = E.carteira.total > E.CDI.total;
  $('#sim-back').append(h('p', { class: 'nota', style: null }, ganhouCDI ? 'No período testado, a simulação ficou acima do CDI. Isso não garante nada para o futuro.' : 'Honestidade da Águia: no período testado, a simulação NÃO superou o CDI. Isso mostra por que nenhum modelo garante ganhos e por que a renda fixa é uma régua importante.'));

  // monte carlo
  const r = []; for (let i = 1; i < bt.curva.length; i++) r.push(bt.curva[i] / bt.curva[i - 1] - 1);
  const mc = monteCarlo(r, horiz, 2000);
  const gm = grafico($('#g-mc'), { tempoNumerico: true });
  const S = arr => arr.map((v, i) => ({ time: i, value: +(v * valor).toFixed(2) }));
  gm.linha(S(mc.p95), CORES.verde, 'Bom (95%)', 1); gm.area(S(mc.p50), CORES.ouro, 'Mediano'); gm.linha(S(mc.p5), CORES.verm, 'Ruim (5%)', 1); gm.ajustar();
  limpar($('#sim-mc')).append(
    cartaoNum('Cenário ruim (5%)', valor * mc.p5.at(-1), { fmt: x => brl(x, 0) }),
    cartaoNum('Cenário mediano', valor * mc.p50.at(-1), { fmt: x => brl(x, 0) }),
    cartaoNum('Cenário bom (95%)', valor * mc.p95.at(-1), { fmt: x => brl(x, 0) }),
    cartaoNum('Chance de terminar no prejuízo', mc.probPerda * 100, { fmt: x => num(x, 1) + '%' })
  );
  renderCarteira(); renderAcertos();
}

// ---------- carteira fictícia ----------
function aplicar() {
  const u = ctx.ultima; if (!u) return;
  const data = ultimaData();
  const pos = Object.fromEntries(Object.entries(u.pesos).map(([id, w]) => [id, id === 'CDI' ? { valor: u.valor * w } : { unid: (u.valor * w) / precoAtual(id), preco: precoAtual(id) }]));
  guarda.gravar('carteira', { criada: new Date().toISOString(), data, inicial: u.valor, perfil: u.perfil, pos, fotos: [] });
  registrar(u);
  renderCarteira(); renderAcertos();
}
function valorCarteira(c) {
  const mk = ctx.estado.mk; let v = 0;
  for (const [id, p] of Object.entries(c.pos)) v += id === 'CDI' ? p.valor * (1 + cdiAcumulado(mk.cdi, c.data, '9999')) : p.unid * (precoAtual(id) ?? p.preco);
  return v;
}
function renderCarteira() {
  const el = limpar($('#sim-carteira')); const c = guarda.ler('carteira');
  if (!c) { el.append(h('p', { class: 'vazio' }, 'Você ainda não tem carteira fictícia. Toque em "Aplicar na carteira fictícia" para começar a acompanhar.')); limpar($('#g-cart')); return; }
  const v = valorCarteira(c); const r = v / c.inicial - 1;
  const hoje = new Date().toISOString().slice(0, 10);
  c.fotos = (c.fotos || []).filter(f => f[0] !== hoje).concat([[hoje, +v.toFixed(2)]]).slice(-730); guarda.gravar('carteira', c);
  el.append(h('div', { class: 'grade-num' }, cartaoNum('Valor fictício hoje', v, { fmt: x => brl(x) }), cartaoNum('Resultado', r * 100, { fmt: x => pct(x / 100) }), cartaoNum('Desde', 0, { fmt: () => new Date(c.criada).toLocaleDateString('pt-BR'), sub: 'perfil ' + (PERFIS[c.perfil]?.nome || '') })));
  const t = h('table', { class: 'tab' }, h('thead', {}, h('tr', {}, ['Ativo', 'Entrada', 'Agora', 'Resultado'].map(x => h('th', {}, x)))));
  const tb = h('tbody');
  for (const [id, p] of Object.entries(c.pos)) { const ag = id === 'CDI' ? cdiAcumulado(ctx.estado.mk.cdi, c.data, '9999') : (precoAtual(id) / p.preco - 1); tb.append(h('tr', {}, h('td', { class: 'nome' }, nomeAtivo(id)), h('td', {}, id === 'CDI' ? brl(p.valor) : brl(p.preco)), h('td', {}, id === 'CDI' ? brl(p.valor * (1 + ag)) : brl(precoAtual(id))), h('td', { class: cls(ag) }, pct(ag, 2)))); }
  t.append(tb); el.append(h('div', { class: 'tabela-rol' }, t));
  if (c.fotos.length > 1) { const g = grafico($('#g-cart')); g.area(c.fotos.map(([d, x]) => ({ time: d, value: x })), CORES.ouro, 'Carteira fictícia'); g.ajustar(); }
  else { limpar($('#g-cart')).append(h('p', { class: 'nota' }, 'O gráfico aparece a partir do segundo dia de acompanhamento.')); }
}
// ---------- registro de acertos ----------
function registrar(u) {
  const reg = guarda.ler('registro', []);
  const top = u.an.filter(a => a.score > 0.05).sort((a, b) => b.score - a.score).slice(0, 5).map(a => ({ id: a.id, score: +a.score.toFixed(3), preco: a.preco }));
  const evitar = u.an.filter(a => a.score < -0.15).map(a => ({ id: a.id, score: +a.score.toFixed(3), preco: a.preco }));
  reg.push({ em: new Date().toISOString(), data: ultimaData(), perfil: u.perfil, top, evitar });
  guarda.gravar('registro', reg.slice(-200));
}
function renderAcertos() {
  const el = limpar($('#sim-acertos')); const reg = guarda.ler('registro', []); const mk = ctx.estado.mk;
  if (!reg.length) { el.append(h('p', { class: 'vazio' }, 'Nenhuma análise registrada ainda. Cada vez que você aplica na carteira fictícia, a Águia grava as escolhas para conferir depois.')); return; }
  let acertos = 0, total = 0; const linhas = [];
  for (const r of [...reg].reverse().slice(0, 30)) {
    const cdi = cdiAcumulado(mk.cdi, r.data, '9999');
    const res = [...r.top.map(x => ({ ...x, lado: 'favorito' })), ...r.evitar.map(x => ({ ...x, lado: 'evitar' }))].map(x => { const p = precoAtual(x.id); const ret = p ? p / x.preco - 1 : null; const ok = ret == null ? null : x.lado === 'favorito' ? ret > cdi : ret < cdi; return { ...x, ret, ok }; });
    const conferiveis = res.filter(x => x.ok != null && r.data < ultimaData());
    acertos += conferiveis.filter(x => x.ok).length; total += conferiveis.length;
    linhas.push(h('tr', {}, h('td', {}, new Date(r.em).toLocaleDateString('pt-BR')), h('td', {}, PERFIS[r.perfil]?.nome || r.perfil), h('td', { class: 'nome' }, r.top.map(x => x.id).join(', ') || '— (só CDI)'), h('td', {}, pct(cdi, 2)), h('td', {}, conferiveis.length ? `${conferiveis.filter(x => x.ok).length}/${conferiveis.length}` : 'aguardando')));
  }
  el.append(h('div', { class: 'grade-num' }, cartaoNum('Análises registradas', reg.length), cartaoNum('Taxa de acerto', total ? (acertos / total) * 100 : 0, { fmt: x => total ? num(x, 0) + '%' : '—', sub: total ? `${acertos} de ${total} conferências` : 'precisa de dias passarem' })));
  const t = h('table', { class: 'tab' }, h('thead', {}, h('tr', {}, ['Data', 'Perfil', 'Favoritos da Águia', 'CDI desde então', 'Acertos'].map(x => h('th', {}, x)))), h('tbody', {}, linhas));
  el.append(h('div', { class: 'tabela-rol' }, t), h('p', { class: 'nota' }, 'Acerto = favorito rendeu mais que o CDI, ou ativo "evitar" rendeu menos que o CDI, desde a data da análise. Poucos dados não provam nada: são precisos meses de registro.'));
}

export function iniciarSimulador(c) {
  ctx = c;
  c.registrar('simulador', render);
  $('#sim-form').addEventListener('submit', e => { e.preventDefault(); render(); });
  $('#sim-perfil').addEventListener('change', render);
  $('#sim-horiz').addEventListener('change', render);
  $('#sim-aplicar').addEventListener('click', aplicar);
  $('#sim-limpar').addEventListener('click', () => { if (confirm('Apagar a carteira fictícia e o registro de acertos deste aparelho?')) { guarda.apagar('carteira'); guarda.apagar('registro'); renderCarteira(); renderAcertos(); } });
}
