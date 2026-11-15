import { readFile } from 'node:fs/promises';
import { analisar, alocar, backtest, monteCarlo, cdiAnual, INVESTIVEIS, motivos } from '../js/engine.js';
const m = JSON.parse(await readFile('data/markets.json', 'utf8'));
const cdiAno = cdiAnual(m.cdi); console.log('CDI anual', (cdiAno * 100).toFixed(2));
const an = INVESTIVEIS.filter(id => m.ativos[id]).map(id => analisar(id, m.ativos[id].brl, { cdiAno }));
for (const a of an) console.log(a.id.padEnd(7), a.score.toFixed(3), a.sinal.padEnd(18), 'vol', (a.vol*100).toFixed(0), 'r6', (a.r6*100).toFixed(1), 'rsi', a.rsi?.toFixed(0));
for (const p of ['conservador','moderado','arrojado']) console.log(p, JSON.stringify(Object.fromEntries(Object.entries(alocar(an,p)).map(([k,v])=>[k,+(v*100).toFixed(1)]))));
console.log(motivos(an[0]));
let ok = true;
for (const p of ['conservador','moderado','arrojado']) {
  const b = backtest(m, p); const e = b.estat;
  const f = x => (x*100).toFixed(1)+'%';
  console.log(p, 'dias', b.dias, 'cart', f(e.carteira.total), 'dd', f(e.carteira.dd), '| CDI', f(e.CDI.total), 'IBOV', f(e.IBOV.total), 'BTC', f(e.BTC.total));
  const r = []; for (let i=1;i<b.curva.length;i++) r.push(b.curva[i]/b.curva[i-1]-1);
  const mc = monteCarlo(r, 252, 500); console.log('  MC p5', mc.p5.at(-1).toFixed(3), 'p50', mc.p50.at(-1).toFixed(3), 'p95', mc.p95.at(-1).toFixed(3), 'perda', mc.probPerda);
  if (!b.curva.every(Number.isFinite)) { ok = false; console.log('NaN na curva!'); }
  const s = Object.values(alocar(an,p)).reduce((x,y)=>x+y,0); if (Math.abs(s-1)>1e-9) { ok=false; console.log('pesos não somam 1', s); }
}
process.exit(ok ? 0 : 1);
