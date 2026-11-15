import DOMPurify from '../vendor/purify.es.mjs';
// Cria elementos com segurança: textos externos SEMPRE viram texto puro (nunca HTML).
export function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'href') { const u = linkSeguro(v); if (u) el.setAttribute('href', u); }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const f of filhos.flat(Infinity)) { if (f == null || f === false) continue; el.append(f instanceof Node ? f : document.createTextNode(String(f))); }
  if (el.tagName === 'A' && /^https?:/i.test(el.getAttribute('href') || '')) { el.target = '_blank'; el.rel = 'noopener noreferrer'; }
  return el;
}
// Remove qualquer marcação de textos vindos de fora (manchetes, descrições)
export const limpo = s => DOMPurify.sanitize(String(s ?? ''), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();
export function linkSeguro(u) {
  const s = String(u || '').trim();
  if (s.startsWith('#')) return s;
  try { const x = new URL(s, location.href); if (x.protocol === 'https:' || (x.protocol === 'http:' && x.origin === location.origin)) return x.href; if (x.protocol === 'http:') { x.protocol = 'https:'; return x.href; } } catch {}
  return null;
}
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const limpar = el => { while (el.firstChild) el.firstChild.remove(); return el; };
const nf = new Intl.NumberFormat('pt-BR');
export const num = (x, d = 0) => x == null || !isFinite(x) ? '—' : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(x);
export const inteiro = x => nf.format(Math.round(x || 0));
export const compacto = x => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(x || 0);
export const brl = (x, d = 2) => x == null || !isFinite(x) ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: d, maximumFractionDigits: d }).format(x);
export const pct = (x, d = 1, sinal = true) => x == null || !isFinite(x) ? '—' : (sinal && x > 0 ? '+' : '') + num(x * 100, d) + '%';
export const cls = x => x > 0.0005 ? 'sobe' : x < -0.0005 ? 'cai' : 'neutro';
export function relativo(iso) {
  if (!iso) return '';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (!isFinite(s)) return '';
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 30) return `há ${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}
export const diasDesde = iso => iso ? (Date.now() - Date.parse(iso)) / 864e5 : Infinity;
export function dataHora(iso) { return iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }) + ' (Brasília)' : '—'; }
// Armazenamento local seguro (sem quebrar em modo privado)
export const guarda = {
  ler(k, pad = null) { try { const v = localStorage.getItem('ras.' + k); return v ? JSON.parse(v) : pad; } catch { return pad; } },
  gravar(k, v) { try { localStorage.setItem('ras.' + k, JSON.stringify(v)); return true; } catch { return false; } },
  apagar(k) { try { localStorage.removeItem('ras.' + k); } catch {} }
};
// fetch com tempo limite + cache local de reserva (offline / API fora do ar)
export async function buscar(url, { cacheMin = 0, timeout = 12000, chave = url } = {}) {
  const c = guarda.ler('c:' + chave);
  if (c && cacheMin && Date.now() - c.t < cacheMin * 60000) return { dados: c.d, origem: 'cache-recente', t: c.t };
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeout), credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const ok = guarda.gravar('c:' + chave, { t: Date.now(), d });
    if (!ok) { guarda.apagar('c:' + chave); }
    return { dados: d, origem: 'rede', t: Date.now() };
  } catch (e) {
    if (c) return { dados: c.d, origem: 'cache', t: c.t, erro: e.message };
    return { dados: null, origem: 'erro', erro: e.message };
  }
}
export function contarAte(el, alvo, { dur = 1400, fmt = inteiro } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !isFinite(alvo)) { el.textContent = fmt(alvo); return; }
  const t0 = performance.now();
  const passo = t => { const p = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(alvo * e); if (p < 1) requestAnimationFrame(passo); };
  requestAnimationFrame(passo);
}
export function cartaoNum(rotulo, valor, { fmt = inteiro, sub = '' } = {}) {
  const b = h('b', {}, '0');
  const el = h('div', { class: 'num' }, b, h('span', {}, rotulo), sub ? h('small', {}, sub) : null);
  contarAte(b, valor, { fmt });
  return el;
}
export function sparkline(valores, { w = 120, hgt = 34 } = {}) {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = w * dpr; c.height = hgt * dpr;
  const v = valores.filter(x => x != null && isFinite(x));
  if (v.length < 2) return c;
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  const mn = Math.min(...v), mx = Math.max(...v), sobe = v.at(-1) >= v[0];
  const cor = sobe ? '#3ddc84' : '#ff5d6c';
  const X = i => (i / (v.length - 1)) * (w - 2) + 1, Y = x => hgt - 2 - ((x - mn) / ((mx - mn) || 1)) * (hgt - 4);
  const grad = g.createLinearGradient(0, 0, 0, hgt); grad.addColorStop(0, sobe ? 'rgba(61,220,132,.35)' : 'rgba(255,93,108,.35)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.beginPath(); v.forEach((x, i) => i ? g.lineTo(X(i), Y(x)) : g.moveTo(X(i), Y(x))); g.lineTo(X(v.length - 1), hgt); g.lineTo(X(0), hgt); g.fillStyle = grad; g.fill();
  g.beginPath(); v.forEach((x, i) => i ? g.lineTo(X(i), Y(x)) : g.moveTo(X(i), Y(x))); g.strokeStyle = cor; g.lineWidth = 1.6; g.shadowColor = cor; g.shadowBlur = 6; g.stroke();
  return c;
}
