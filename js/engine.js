// Motor analítico do simulador (PAPER TRADING). Indicadores transparentes, sem "caixa-preta".
// NÃO é recomendação de investimento. Resultados passados não garantem resultados futuros.
import { CHAVES_ATIVO } from './sentiment.js';

export const INVESTIVEIS = ['BOVA11', 'IVVB11', 'PETR4', 'VALE3', 'ITUB4', 'WEGE3', 'NVDA', 'OURO', 'USD', 'BTC', 'ETH', 'SOL'];
export const CRIPTOS = new Set(['BTC', 'ETH', 'SOL']);
export const PERFIS = {
  conservador: { nome: 'Conservador', pisoCDI: 0.6, maxCripto: 0.05, maxAtivo: 0.12, alvoVol: 0.08 },
  moderado: { nome: 'Moderado', pisoCDI: 0.3, maxCripto: 0.12, maxAtivo: 0.18, alvoVol: 0.14 },
  arrojado: { nome: 'Arrojado', pisoCDI: 0.1, maxCripto: 0.25, maxAtivo: 0.25, alvoVol: 0.25 }
};
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const std = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const sma = (v, n) => v.length >= n ? mean(v.slice(-n)) : null;
export function rsi(v, n = 14) {
  if (v.length <= n) return null;
  let g = 0, p = 0;
  for (let i = v.length - n; i < v.length; i++) { const d = v[i] - v[i - 1]; if (d > 0) g += d; else p -= d; }
  if (p === 0) return 100;
  return 100 - 100 / (1 + (g / n) / (p / n));
}
export function maxDrawdown(v) { let pico = -Infinity, dd = 0; for (const x of v) { pico = Math.max(pico, x); dd = Math.min(dd, x / pico - 1); } return dd; }
const ret = (v, n) => v.length > n ? v.at(-1) / v.at(-1 - n) - 1 : null;

// CDI acumulado entre duas datas (série diária em % ao dia)
export function cdiAcumulado(cdi, de, ate) { let f = 1; for (const [d, x] of cdi) if (d > de && d <= ate) f *= 1 + x / 100; return f - 1; }
export function cdiAnual(cdi) { const u = cdi.slice(-252); return u.length ? Math.pow(u.reduce((f, [, x]) => f * (1 + x / 100), 1), 252 / u.length) - 1 : 0.1; }

// Analisa um ativo com os preços (em R$) disponíveis até a data de corte
export function analisar(id, serie, { cdiAno = 0.1, sentimento = 0, cripto = CRIPTOS.has(id) } = {}) {
  const v = serie.map(p => p[1]);
  if (v.length < 60) return null;
  const N = cripto ? 365 : 252;
  const janela = v.slice(-Math.min(v.length, N + 1));
  const rets = []; for (let i = 1; i < janela.length; i++) rets.push(Math.log(janela[i] / janela[i - 1]));
  const vol = std(rets) * Math.sqrt(N) || 1e-6;
  const k = cripto ? 365 / 252 : 1; // cripto negocia 7 dias por semana
  const r1 = ret(v, Math.round(21 * k)), r3 = ret(v, Math.round(63 * k)), r6 = ret(v, Math.round(126 * k)) ?? r3, r12 = ret(v, Math.round(252 * k)) ?? r6;
  const s50 = sma(v, Math.round(50 * k)), s200 = sma(v, Math.round(200 * k)) ?? sma(v, Math.min(v.length, Math.round(120 * k)));
  const preco = v.at(-1), R = rsi(v, 14), dd = maxDrawdown(janela);
  const anual = Math.pow(janela.at(-1) / janela[0], N / (janela.length - 1)) - 1;
  const sharpe = (anual - cdiAno) / vol;
  // componentes em [-1, 1]
  const momBruto = 0.2 * (r1 ?? 0) + 0.3 * (r3 ?? 0) + 0.5 * (r6 ?? 0);
  const cMom = Math.tanh(momBruto / (vol * 0.5));
  const cTend = (preco > s50 ? 0.5 : -0.5) + (s50 > s200 ? 0.5 : -0.5);
  const cSharpe = Math.tanh(sharpe / 1.5);
  const cRsi = R == null ? 0 : R > 75 ? -0.6 : R > 68 ? -0.25 : R < 25 ? -0.3 : R < 35 ? 0.15 : 0.1;
  const cDD = clamp(dd / 0.4, -1, 0); // quedas fortes penalizam
  const cSent = clamp(sentimento, -1, 1);
  const score = 0.35 * cMom + 0.25 * cTend + 0.2 * cSharpe + 0.07 * cRsi + 0.05 * cDD + 0.08 * cSent;
  const sinal = score > 0.25 ? 'COMPRA (simulada)' : score > 0.05 ? 'Acumular' : score > -0.15 ? 'Neutro' : 'Evitar';
  return { id, preco, r1, r3, r6, r12, s50, s200, rsi: R, vol, dd, anual, sharpe, sent: cSent, comp: { cMom, cTend, cSharpe, cRsi, cDD, cSent }, score, sinal };
}

export function motivos(a) {
  const pct = x => (x == null ? '—' : (x * 100).toFixed(1).replace('.', ',') + '%');
  const m = [];
  m.push(a.comp.cTend > 0.5 ? 'preço acima das médias de 50 e 200 dias (tendência de alta)' : a.comp.cTend < -0.5 ? 'preço abaixo das médias de 50 e 200 dias (tendência de baixa)' : 'tendência mista entre as médias móveis');
  m.push(`momento: ${pct(a.r1)} em 1 mês, ${pct(a.r3)} em 3 meses, ${pct(a.r6)} em 6 meses`);
  m.push(`volatilidade anual de ${pct(a.vol)} e pior queda de ${pct(a.dd)} no período`);
  if (a.rsi != null) m.push(a.rsi > 70 ? `RSI ${a.rsi.toFixed(0)}: esticado, risco de correção` : a.rsi < 30 ? `RSI ${a.rsi.toFixed(0)}: muito vendido` : `RSI ${a.rsi.toFixed(0)}: zona neutra`);
  m.push(`Sharpe ${a.sharpe.toFixed(2).replace('.', ',')} (retorno acima do CDI por unidade de risco)`);
  if (a.sent) m.push(`notícias recentes ${a.sent > 0 ? 'positivas' : 'negativas'} (${a.sent.toFixed(2).replace('.', ',')})`);
  return m;
}

// Alocação: pontuação positiva ÷ volatilidade, com limites por perfil; o resto fica no CDI.
export function alocar(analises, perfilId = 'moderado') {
  const P = PERFIS[perfilId] || PERFIS.moderado;
  const bons = analises.filter(a => a && a.score > 0.05 && INVESTIVEIS.includes(a.id));
  const bruto = bons.map(a => ({ id: a.id, w: a.score / Math.max(a.vol, 0.05) }));
  const soma = bruto.reduce((s, x) => s + x.w, 0);
  const disponivel = 1 - P.pisoCDI;
  let pesos = {};
  if (soma > 0) for (const x of bruto) pesos[x.id] = (x.w / soma) * disponivel;
  // limites por ativo e para cripto (iterativo)
  for (let it = 0; it < 6; it++) {
    for (const id in pesos) pesos[id] = Math.min(pesos[id], P.maxAtivo);
    const cr = Object.entries(pesos).filter(([id]) => CRIPTOS.has(id)).reduce((s, [, w]) => s + w, 0);
    if (cr > P.maxCripto) for (const id in pesos) if (CRIPTOS.has(id)) pesos[id] *= P.maxCripto / cr;
  }
  // limite de volatilidade da parte arriscada (aproximação sem correlação = conservadora)
  const volCarteira = Math.sqrt(Object.entries(pesos).reduce((s, [id, w]) => s + (w * (analises.find(a => a?.id === id)?.vol || 0)) ** 2, 0)) * 1.6;
  if (volCarteira > P.alvoVol) { const f = P.alvoVol / volCarteira; for (const id in pesos) pesos[id] *= f; }
  for (const id in pesos) if (pesos[id] < 0.01) delete pesos[id];
  const risco = Object.values(pesos).reduce((s, w) => s + w, 0);
  pesos.CDI = 1 - risco;
  return pesos;
}

// Sentimento por ativo a partir das manchetes
export function sentimentoPorAtivo(itens) {
  const norm = s => ' ' + String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9& ]+/g, ' ') + ' ';
  const out = {};
  for (const [id, chaves] of Object.entries(CHAVES_ATIVO)) {
    const ks = chaves.map(k => norm(k).trim());
    const v = itens.filter(i => i.s && ks.some(k => norm(i.t).includes(' ' + k))).map(i => i.s);
    out[id] = v.length >= 2 ? mean(v) * Math.min(1, v.length / 6) : 0;
  }
  return out;
}

// Série alinhada ao calendário de referência: último preço conhecido em cada data
export function alinhar(serie, datas) {
  const out = []; let j = 0, ult = null;
  for (const d of datas) { while (j < serie.length && serie[j][0] <= d) { ult = serie[j][1]; j++; } out.push(ult); }
  return out;
}

// Backtest walk-forward: a cada ~21 pregões recalcula a carteira usando SÓ dados até aquela data.
export function backtest(mercado, perfilId = 'moderado', { passo = 21, aquecimento = 130 } = {}) {
  const ref = mercado.ativos.BOVA11?.brl || mercado.ativos.IBOV.brl;
  const datas = ref.map(p => p[0]);
  const al = {}; for (const id of [...INVESTIVEIS, 'IBOV', 'SPX']) if (mercado.ativos[id]) al[id] = alinhar(mercado.ativos[id].brl, datas);
  const cdiMap = new Map(mercado.cdi);
  const cdiDia = datas.map(d => (cdiMap.get(d) ?? 0) / 100);
  let valor = 1, pesos = { CDI: 1 }, cotas = {}; const curva = [], rebal = [];
  const bench = { CDI: [1], IBOV: [1], BTC: [1] };
  for (let i = aquecimento; i < datas.length; i++) {
    if (i > aquecimento) {
      // evolução do dia
      let v = 0;
      for (const [id, w] of Object.entries(cotas)) v += id === 'CDI' ? w * (1 + cdiDia[i]) : w * (al[id][i] / al[id][i - 1]);
      for (const id in cotas) cotas[id] = id === 'CDI' ? cotas[id] * (1 + cdiDia[i]) : cotas[id] * (al[id][i] / al[id][i - 1]);
      valor = v;
      bench.CDI.push(bench.CDI.at(-1) * (1 + cdiDia[i]));
      bench.IBOV.push(al.IBOV ? bench.IBOV.at(-1) * (al.IBOV[i] / al.IBOV[i - 1]) : 1);
      bench.BTC.push(al.BTC && al.BTC[i - 1] ? bench.BTC.at(-1) * (al.BTC[i] / al.BTC[i - 1]) : bench.BTC.at(-1));
    }
    if ((i - aquecimento) % passo === 0) {
      const ate = datas[i];
      const cdiAno = cdiAnual(mercado.cdi.filter(([d]) => d <= ate));
      const an = INVESTIVEIS.filter(id => mercado.ativos[id]).map(id => analisar(id, mercado.ativos[id].brl.filter(p => p[0] <= ate), { cdiAno })).filter(Boolean);
      pesos = alocar(an, perfilId);
      cotas = Object.fromEntries(Object.entries(pesos).filter(([id]) => id === 'CDI' || (al[id] && al[id][i])).map(([id, w]) => [id, w * valor]));
      const somaC = Object.values(cotas).reduce((s, x) => s + x, 0); if (somaC < valor) cotas.CDI = (cotas.CDI || 0) + (valor - somaC);
      rebal.push({ d: ate, pesos });
    }
    curva.push([datas[i], valor]);
  }
  const n = curva.length;
  const datasC = curva.map(c => c[0]);
  const estat = v => { const r = []; for (let i = 1; i < v.length; i++) r.push(v[i] / v[i - 1] - 1); const anos = (v.length - 1) / 252; return { total: v.at(-1) / v[0] - 1, anual: Math.pow(v.at(-1) / v[0], 1 / Math.max(anos, 0.01)) - 1, vol: std(r) * Math.sqrt(252), dd: maxDrawdown(v) }; };
  const res = { datas: datasC, curva: curva.map(c => c[1]), bench, rebal, estat: { carteira: estat(curva.map(c => c[1])), CDI: estat(bench.CDI), IBOV: estat(bench.IBOV), BTC: estat(bench.BTC) }, dias: n };
  return res;
}

// Projeção Monte Carlo por bootstrap dos retornos diários do backtest (mostra o risco de perda)
export function monteCarlo(retornosDiarios, dias = 252, n = 2000, semente = 42) {
  let s = semente; const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const finais = []; const caminhos = Array.from({ length: dias + 1 }, () => []);
  for (let k = 0; k < n; k++) { let v = 1; caminhos[0].push(1); for (let d = 1; d <= dias; d++) { v *= 1 + retornosDiarios[Math.floor(rnd() * retornosDiarios.length)]; caminhos[d].push(v); } finais.push(v); }
  const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(p * (b.length - 1))]; };
  return { p5: caminhos.map(c => q(c, 0.05)), p50: caminhos.map(c => q(c, 0.5)), p95: caminhos.map(c => q(c, 0.95)), probPerda: finais.filter(v => v < 1).length / n, pior: Math.min(...finais), melhor: Math.max(...finais) };
}

// ---------- PRAZOS: quanto tempo o dinheiro precisaria ficar para atingir a meta (histórico) ----------
// Para cada dia de entrada possível no passado, mede quantos dias corridos levou até o preço subir "alvo".
export function tempoAteAlvo(serie, alvo = 0.1, janelaDias = 365) {
  const t = serie.map(p => Date.parse(p[0])), v = serie.map(p => p[1]);
  janelaDias = Math.min(janelaDias, Math.floor((t.at(-1) - t[0]) / 864e5 / 2));
  const dias = [], quedas = []; let entradas = 0, atingiu = 0;
  for (let i = 0; i < v.length; i++) {
    if ((t.at(-1) - t[i]) / 864e5 < janelaDias) break; // só entradas com janela completa no futuro
    entradas++;
    let pior = 0;
    for (let j = i + 1; j < v.length && (t[j] - t[i]) / 864e5 <= janelaDias; j++) {
      pior = Math.min(pior, v[j] / v[i] - 1);
      if (v[j] >= v[i] * (1 + alvo)) { atingiu++; dias.push((t[j] - t[i]) / 864e5); quedas.push(pior); break; }
    }
  }
  const ord = [...dias].sort((a, b) => a - b), q = p => ord.length ? ord[Math.floor(p * (ord.length - 1))] : null;
  const cdf = []; for (let d = 0; d <= janelaDias; d += 5) cdf.push([d, entradas ? ord.filter(x => x <= d).length / entradas : 0]);
  return { janelaDias, entradas, prob: entradas ? atingiu / entradas : 0, mediana: q(0.5), p25: q(0.25), p75: q(0.75), quedaMedia: quedas.length ? mean(quedas) : null, cdf };
}
export const diasCDI = (alvo, cdiAno) => Math.log(1 + alvo) / Math.log(1 + cdiAno) * 365;

// Regra simulada de entrada/saída (educativa): entra quando o preço cruza para cima da média de N dias;
// sai ao bater a meta (stop-gain), o limite de perda (stop-loss) ou se cruzar para baixo da média.
export function regraSaida(serie, { meta = 0.1, stop = 0.05, media = 50 } = {}) {
  const v = serie.map(p => p[1]), d = serie.map(p => p[0]);
  const ops = []; let pos = null;
  for (let i = media + 1; i < v.length; i++) {
    const m = mean(v.slice(i - media, i)), mAnt = mean(v.slice(i - media - 1, i - 1));
    if (!pos && v[i - 1] <= mAnt && v[i] > m) pos = { i, d: d[i], p: v[i] };
    else if (pos) {
      const r = v[i] / pos.p - 1; let motivo = null;
      if (r >= meta) motivo = 'meta'; else if (r <= -stop) motivo = 'stop'; else if (v[i] < m) motivo = 'média';
      if (motivo) { ops.push({ entrada: pos.d, pe: pos.p, saida: d[i], ps: v[i], ret: r, motivo, dias: (Date.parse(d[i]) - Date.parse(pos.d)) / 864e5 }); pos = null; }
    }
  }
  const aberta = pos ? { entrada: pos.d, pe: pos.p, ret: v.at(-1) / pos.p - 1 } : null;
  const total = ops.reduce((f, o) => f * (1 + o.ret), 1) - 1;
  return { ops, aberta, acerto: ops.length ? ops.filter(o => o.ret > 0).length / ops.length : null, medio: ops.length ? mean(ops.map(o => o.ret)) : null, diasMedio: ops.length ? mean(ops.map(o => o.dias)) : null, total, comprarEsegurar: v.at(-1) / v[media + 1] - 1 };
}
