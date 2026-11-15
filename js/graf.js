import { createChart, LineSeries, AreaSeries, createSeriesMarkers, ColorType } from '../vendor/lightweight-charts.mjs';
const charts = new Map();
export const CORES = { ouro: '#f1c75b', ciano: '#46e6ff', verde: '#3ddc84', verm: '#ff5d6c', roxo: '#b07cff', cinza: '#a99f86', laranja: '#ff9d2e' };
export function grafico(el, { tempoNumerico = false, sufixo = '', fmtPreco } = {}) {
  if (charts.has(el)) { charts.get(el).remove(); charts.delete(el); }
  while (el.firstChild) el.firstChild.remove();
  const opts = {
    autoSize: true,
    layout: { background: { type: ColorType.Solid, color: 'rgba(0,0,0,0)' }, textColor: '#a99f86', fontFamily: 'system-ui, sans-serif', attributionLogo: true },
    grid: { vertLines: { color: 'rgba(241,199,91,.06)' }, horzLines: { color: 'rgba(241,199,91,.07)' } },
    rightPriceScale: { borderColor: 'rgba(241,199,91,.2)' },
    timeScale: { borderColor: 'rgba(241,199,91,.2)', timeVisible: false },
    crosshair: { vertLine: { color: 'rgba(241,199,91,.4)' }, horzLine: { color: 'rgba(241,199,91,.4)' } },
    localization: { locale: 'pt-BR', priceFormatter: fmtPreco || (p => p.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + sufixo) },
    handleScroll: { vertTouchDrag: false }, handleScale: { axisPressedMouseMove: false }
  };
  if (tempoNumerico) { opts.localization.timeFormatter = t => `${t} dias`; opts.timeScale.tickMarkFormatter = t => `${t}d`; }
  const c = createChart(el, opts);
  charts.set(el, c);
  return {
    linha(dados, cor, titulo = '', largura = 2) { const s = c.addSeries(LineSeries, { color: cor, lineWidth: largura, title: titulo, priceLineVisible: false, lastValueVisible: true }); s.setData(dados); return s; },
    area(dados, cor, titulo = '') { const s = c.addSeries(AreaSeries, { lineColor: cor, topColor: cor + '55', bottomColor: cor + '00', lineWidth: 2, title: titulo, priceLineVisible: false }); s.setData(dados); return s; },
    marcas(serie, m) { return createSeriesMarkers(serie, m); },
    ajustar() { c.timeScale().fitContent(); },
    chart: c
  };
}
