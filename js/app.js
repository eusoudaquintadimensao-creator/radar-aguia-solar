// Radar Águia Solar — app principal (sem frameworks, sem scripts de terceiros por CDN)
import Fuse from '../vendor/fuse.min.mjs';
import { h, $, $$, limpar, limpo, num, inteiro, compacto, brl, pct, cls, relativo, diasDesde, dataHora, guarda, buscar, cartaoNum, sparkline } from './util.js';
import { familiaDe, FAMILIAS, RECURSOS, CANAIS_TV } from './catalogo.js';
import { sentimento } from './sentiment.js';
import { iniciarSimulador } from './sim.js';
import { iniciarExtras } from './extras.js';

export const estado = { nv: null, news: null, mk: null, status: null, reg: null, hist: null, vivo: {}, origem: {} };
const BLOQ = /\b(bets?|apostas?|apostador\w*|cassinos?|casinos?|tigrinho|bet365|betano|blaze|roleta|jackpot|gambling|sportsbook|loterias?)\b/i;

// ---------- dados ----------
async function dadosLocais(nome) {
  const r = await buscar(`data/${nome}?v=${Math.floor(Date.now() / 600000)}`, { chave: 'data:' + nome, timeout: 15000 });
  estado.origem[nome] = r.origem;
  return r.dados;
}
async function carregar() {
  const [nv, news, mk, status, reg, hist] = await Promise.all(['nvidia.json', 'news.json', 'markets.json', 'status.json', 'reguladas.json', 'history.json'].map(dadosLocais));
  Object.assign(estado, { nv, news, mk, status, reg, hist });
  addEventListener('online', () => carregar()); addEventListener('offline', () => { const v = $('#vivo'); v.className = 'vivo cache'; v.querySelector('span').textContent = 'offline · cache'; });
  if (news) for (const f of news.feeds) f.itens = f.itens.filter(i => !BLOQ.test(i.t + ' ' + i.d));
  const falhou = !navigator.onLine || Object.values(estado.origem).some(o => o !== 'rede');
  const v = $('#vivo');
  v.className = 'vivo ' + (falhou ? 'cache' : 'ok');
  v.querySelector('span').textContent = falhou ? 'offline · cache' : 'ao vivo';
  v.title = status ? 'Dados do robô: ' + dataHora(status.atualizado) : '';
  $('#rod-atual').textContent = status ? `Última coleta automática: ${dataHora(status.atualizado)}.` : '';
}
// Atualizações ao vivo direto do navegador (APIs públicas com CORS)
async function aoVivo() {
  const tarefas = [
    buscar('https://huggingface.co/api/models?author=nvidia&sort=lastModified&direction=-1&limit=40', { cacheMin: 10 }).then(r => { if (r.dados && estado.nv) mesclarHF(r.dados); estado.vivo.hf = r.origem; }),
    buscar('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=brl&include_24hr_change=true', { cacheMin: 2 }).then(r => { estado.vivo.cripto = r.dados; }),
    buscar('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL', { cacheMin: 2 }).then(r => { estado.vivo.fx = r.dados; }),
    buscar('https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json', { cacheMin: 360 }).then(r => { estado.vivo.selic = r.dados?.[0]?.valor ? +r.dados[0].valor : null; })
  ];
  await Promise.allSettled(tarefas);
  aplicarAoVivoMercado();
}
function mesclarHF(lista) {
  const mapa = new Map(estado.nv.hf.map(m => [m.id, m]));
  for (const m of lista) {
    if (!m?.id) continue;
    const ant = mapa.get(m.id) || {};
    mapa.set(m.id, { ...ant, id: m.id, dl: m.downloads ?? ant.dl ?? 0, lk: m.likes ?? ant.lk ?? 0, task: m.pipeline_tag ?? ant.task ?? '', mod: m.lastModified ?? ant.mod, cri: m.createdAt ?? ant.cri, tags: ant.tags || (m.tags || []).slice(0, 8), lic: ant.lic || (m.tags || []).find(t => t.startsWith('license:'))?.slice(8) || '' });
  }
  estado.nv.hf = [...mapa.values()];
}
function aplicarAoVivoMercado() {
  const mk = estado.mk; if (!mk) return;
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const add = (id, preco) => { const a = mk.ativos[id]; if (!a || !isFinite(preco)) return; const s = a.brl; if (s.at(-1)[0] === hoje) s[s.length - 1] = [hoje, preco]; else if (s.at(-1)[0] < hoje) s.push([hoje, preco]); a.aoVivo = true; };
  const c = estado.vivo.cripto; if (c) { add('BTC', c.bitcoin?.brl); add('ETH', c.ethereum?.brl); add('SOL', c.solana?.brl); }
  const fx = estado.vivo.fx; if (fx?.USDBRL) add('USD', +fx.USDBRL.bid);
}

// ---------- roteador ----------
const PAGINAS = ['inicio', 'nvidia', 'mundo', 'simulador', 'curto', 'riqueza', 'mente', 'fraude', 'plataformas', 'seguranca', 'riscos'];
const renderizada = new Set();
const RENDER = {};
export function registrar(p, fn) { RENDER[p] = fn; }
function rota() {
  let p = (location.hash || '#inicio').slice(1).split('?')[0];
  if (!PAGINAS.includes(p)) p = 'inicio';
  for (const s of $$('.pagina')) s.hidden = s.dataset.pagina !== p;
  for (const a of $$('.nav-topo a, .nav-baixo a, .menu-mais a')) { if (a.getAttribute('href') === '#' + p) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  const menu = $('#menu-mais'); if (menu?.open) menu.close();
  document.title = ({ inicio: 'Radar Águia Solar', nvidia: 'IA Gratuita da NVIDIA', mundo: 'Cenário Mundial', simulador: 'Simulador (dinheiro fictício)', curto: 'Curto prazo e prazos', riqueza: 'O que os ricos usam', mente: 'Inteligência emocional', fraude: 'Detector de golpes', plataformas: 'Onde investir com segurança', seguranca: 'Segurança', riscos: 'Avisos e Riscos' })[p] + ' · Radar Águia Solar';
  if (RENDER[p] && (!renderizada.has(p) || p === 'simulador' || p === 'curto')) { try { RENDER[p](); renderizada.add(p); } catch (e) { console.error('Erro ao montar', p, e); } }
  if (location.hash && location.hash !== '#inicio') window.scrollTo({ top: 0 });
}

// ---------- ticker ----------
function montarTicker() {
  const t = limpar($('#ticker')); const mk = estado.mk; if (!mk) return;
  const ids = ['IBOV', 'USD', 'BTC', 'ETH', 'SPX', 'NDX', 'NVDA', 'OURO', 'PETR4', 'VALE3', 'ITUB4', 'WEGE3', 'SOL', 'IVVB11'];
  const itens = ids.filter(id => mk.ativos[id]).map(id => { const s = mk.ativos[id].brl; const v = s.at(-1)[1], a = s.at(-2)?.[1]; const r = a ? v / a - 1 : 0; return h('span', {}, h('b', {}, id), id === 'IBOV' ? inteiro(v) : brl(v), ' ', h('em', { class: cls(r) }, pct(r, 2))); });
  if (mk.cdi?.length) itens.push(h('span', {}, h('b', {}, 'CDI'), num(((1 + mk.cdi.at(-1)[1] / 100) ** 252 - 1) * 100, 2) + '% a.a.'));
  if (estado.vivo.selic ?? mk.selic) itens.push(h('span', {}, h('b', {}, 'SELIC'), num(estado.vivo.selic ?? mk.selic, 2) + '%'));
  t.append(...itens, ...itens.map(n => n.cloneNode(true)));
}

// ---------- INÍCIO ----------
function contagemNV() {
  const nv = estado.nv || { hf: [], github: [], nim: [], releases: [], noticias: {} };
  const novos = nv.hf.filter(m => diasDesde(m.cri) <= 30).length;
  const rel30 = nv.releases.filter(r => diasDesde(r.dt) <= 30).length;
  const stars = nv.github.reduce((s, r) => s + (r.st || 0), 0);
  const dls = nv.hf.reduce((s, m) => s + (m.dl || 0), 0);
  return { modelos: nv.hf.length, novos, repos: nv.github.length, stars, nim: nv.nim.length, rel30, dls };
}
registrar('inicio', () => {
  const c = contagemNV(); const n = estado.news;
  const totalNot = n ? n.feeds.reduce((s, f) => s + f.itens.length, 0) : 0;
  limpar($('#contadores')).append(
    cartaoNum('Modelos abertos NVIDIA', c.modelos, { sub: `${c.novos} novos em 30 dias` }),
    cartaoNum('APIs no catálogo NIM', c.nim, { sub: 'build.nvidia.com' }),
    cartaoNum('Repositórios abertos', c.repos, { sub: compacto(c.stars) + ' estrelas' }),
    cartaoNum('Downloads/mês (HF)', c.dls, { fmt: compacto, sub: 'modelos monitorados' }),
    cartaoNum('Manchetes no radar', totalNot, { sub: n ? n.feeds.filter(f => f.ok).length + ' fontes' : '' }),
    cartaoNum('Ativos analisados', estado.mk ? Object.keys(estado.mk.ativos).length : 0, { sub: 'simulador educativo' })
  );
  const ult = [...(estado.nv?.hf || [])].sort((a, b) => (b.cri || '').localeCompare(a.cri || '')).slice(0, 4).map(m => ({ t: `Modelo ${m.id.replace('nvidia/', '')} — ${familiaDe(m.id, m.tags).nome}`, l: 'https://huggingface.co/' + m.id, dt: m.cri }));
  const rel = (estado.nv?.releases || []).slice(0, 3).map(r => ({ t: `${r.repo.split('/')[1]} ${r.tag}`, l: r.url, dt: r.dt }));
  const blog = [...(estado.nv?.noticias?.newsroom || []).slice(0, 2), ...(estado.nv?.noticias?.blog || []).slice(0, 2)];
  const todos = [...ult, ...rel, ...blog].sort((a, b) => (b.dt || '').localeCompare(a.dt || '')).slice(0, 9);
  limpar($('#ini-nv')).append(...(todos.length ? todos.map(i => h('li', {}, h('time', {}, relativo(i.dt)), h('a', { href: i.l }, limpo(i.t)))) : [h('li', { class: 'vazio' }, 'Sem dados no momento.')]));
  termometro($('#ini-term'));
  const mm = limpar($('#ini-mercado'));
  for (const id of ['IBOV', 'USD', 'BTC', 'SPX', 'NVDA']) {
    const a = estado.mk?.ativos[id]; if (!a) continue;
    const s = a.brl.slice(-60).map(p => p[1]); const r = s.at(-1) / s.at(-22) - 1;
    mm.append(h('div', { class: 'ativo-mini' }, h('span', {}, a.nome), h('b', {}, id === 'IBOV' ? inteiro(s.at(-1)) + ' pts' : brl(s.at(-1))), h('span', { class: cls(r) }, pct(r) + ' em 1 mês'), sparkline(s)));
  }
});
function termometro(el, grande = false) {
  limpar(el); const t = estado.news?.termometro; if (!t) { el.append(h('p', { class: 'vazio' }, 'Sem dados.')); return; }
  const nomes = { mundo: '🌍 Mundo', economia: '💰 Economia', mercados: '📈 Mercados', cripto: '🪙 Cripto', tecnologia: '🤖 Tecnologia' };
  for (const [k, v] of Object.entries(t)) {
    const i = h('i'); const pos = Math.round((v.media + 1) * 50);
    i.style.left = `calc(${pos}% - 2px)`;
    el.append(h('div', { class: 'termo', title: `${v.pos} positivas · ${v.neg} negativas de ${v.n}` }, h('span', {}, nomes[k] || k), h('div', { class: 'barra' }, i), h('b', { class: cls(v.media) }, (v.media > 0 ? '+' : '') + num(v.media, 2))));
  }
  if (grande) el.append(h('p', { class: 'nota' }, 'Escala de −1 (muito negativo) a +1 (muito positivo).'));
}

// ---------- NVIDIA ----------
const nvEstado = { aba: 'destaques', limite: 24 };
function itensNV() {
  const nv = estado.nv || { hf: [], github: [], nim: [], releases: [], noticias: {} };
  const aba = nvEstado.aba;
  if (aba === 'destaques') return [
    ...RECURSOS.map(r => ({ tipo: 'recurso', titulo: r.nome, fam: r.tipo, ic: r.ic, oque: r.oque, praque: r.praque, como: r.gratis, url: r.url, busca: [r.nome, r.tipo, r.oque, r.praque].join(' ') })),
    ...FAMILIAS.map(f => { const ms = nv.hf.filter(m => familiaDe(m.id, m.tags).id === f.id); return { tipo: 'familia', titulo: f.nome, fam: f.cat, ic: f.ic, oque: f.oque, praque: f.praque, como: f.como, url: 'https://huggingface.co/nvidia?search_models=' + encodeURIComponent(f.nome.split(' ')[0]), qtd: ms.length, dl: ms.reduce((s, m) => s + (m.dl || 0), 0), busca: [f.nome, f.cat, f.oque, f.praque].join(' '), famId: f.id }; })
  ];
  if (aba === 'modelos') return nv.hf.map(m => { const f = familiaDe(m.id, m.tags); return { tipo: 'modelo', titulo: m.id.replace(/^nvidia\//, ''), fam: f.nome, famId: f.id, ic: f.ic, oque: f.oque, praque: f.praque, como: f.como, url: 'https://huggingface.co/' + m.id, dl: m.dl, lk: m.lk, mod: m.mod, cri: m.cri, task: m.task, lic: m.lic, busca: [m.id, f.nome, f.cat, m.task, (m.tags || []).join(' '), f.praque].join(' ') }; });
  if (aba === 'nim') return nv.nim.map(m => { const f = familiaDe(m.id); return { tipo: 'nim', titulo: m.id, fam: 'API · ' + m.dono, famId: f.id, ic: '🚀', oque: (m.dono === 'nvidia' ? f.oque : 'Modelo de parceiro servido pela NVIDIA como API compatível com OpenAI.'), praque: f.id !== 'outros' ? f.praque : 'Usar IA em apps sem GPU própria.', como: 'Teste grátis no navegador em build.nvidia.com; para usar por API, gere uma chave na sua conta NVIDIA (nunca coloque a chave em sites públicos).', url: 'https://build.nvidia.com/' + m.id, busca: m.id + ' ' + m.dono + ' ' + f.nome }; });
  if (aba === 'codigo') return nv.github.map(r => ({ tipo: 'repo', titulo: r.id, fam: r.lang || 'Código', famId: familiaDe(r.id).id, ic: '🐙', oque: limpo(r.d) || 'Projeto de código aberto da NVIDIA.', praque: (r.top || []).join(' · '), como: `Código aberto${r.lic ? ' (' + r.lic + ')' : ''}: clone no GitHub e siga o README.`, url: r.url, lk: r.st, dl: r.fk, mod: r.push, cri: r.cri, busca: [r.id, r.d, r.lang, (r.top || []).join(' ')].join(' ') }));
  if (aba === 'lancamentos') return nv.releases.map(r => ({ tipo: 'release', titulo: `${r.repo} · ${r.tag}`, fam: r.pre ? 'Pré-lançamento' : 'Lançamento', famId: familiaDe(r.repo).id, ic: '🏷️', oque: limpo(r.nome), praque: 'Nova versão de um projeto aberto da NVIDIA.', como: 'Veja as notas da versão no GitHub.', url: r.url, mod: r.dt, cri: r.dt, busca: r.repo + ' ' + r.tag + ' ' + r.nome }));
  if (aba === 'noticias') { const n = nv.noticias || {}; return [...(n.newsroom || []).map(x => ({ ...x, f: 'Newsroom' })), ...(n.blog || []).map(x => ({ ...x, f: 'Blog NVIDIA' })), ...(n.developer || []).map(x => ({ ...x, f: 'Developer Blog' }))].map(x => ({ tipo: 'noticia', titulo: limpo(x.t), fam: x.f, ic: '📰', oque: limpo(x.d), url: x.l, mod: x.dt, cri: x.dt, busca: x.t + ' ' + x.d + ' ' + x.f })); }
  return [];
}
function cartaoNV(it) {
  const novo = diasDesde(it.cri) <= 14, atual = !novo && diasDesde(it.mod) <= 3;
  const met = [];
  if (it.qtd != null) met.push(h('span', {}, h('b', {}, inteiro(it.qtd)), ' modelos'));
  if (it.dl != null) met.push(h('span', {}, h('b', {}, compacto(it.dl)), it.tipo === 'repo' ? ' forks' : ' downloads'));
  if (it.lk != null) met.push(h('span', {}, h('b', {}, compacto(it.lk)), it.tipo === 'repo' ? ' ★' : ' curtidas'));
  if (it.task) met.push(h('span', {}, it.task));
  if (it.lic) met.push(h('span', {}, 'licença: ' + it.lic));
  if (it.mod) met.push(h('span', {}, 'atualizado ' + relativo(it.mod)));
  return h('article', { class: 'cartao' },
    novo ? h('span', { class: 'selo' }, 'NOVO') : atual ? h('span', { class: 'selo atual' }, 'ATUALIZADO') : null,
    h('span', { class: 'fam' }, `${it.ic || ''} ${it.fam || ''}`),
    h('h3', {}, it.titulo),
    it.oque ? h('p', { class: 'det' }, h('b', {}, 'O que é: '), it.oque) : null,
    it.praque ? h('p', { class: 'det' }, h('b', {}, 'Para que serve: '), it.praque) : null,
    it.como ? h('p', { class: 'det' }, h('b', {}, 'Como usar grátis: '), it.como) : null,
    met.length ? h('div', { class: 'met' }, met) : null,
    h('div', { class: 'acoes' }, h('a', { href: it.url }, 'Abrir ↗'))
  );
}
function renderNV() {
  const busca = $('#nv-busca').value.trim(), fam = $('#nv-familia').value, ordem = $('#nv-ordem').value, novos = $('#nv-novos').checked;
  let itens = itensNV();
  if (fam) itens = itens.filter(i => i.famId === fam);
  if (novos) itens = itens.filter(i => diasDesde(i.cri) <= 14 || diasDesde(i.mod) <= 3);
  if (busca) itens = new Fuse(itens, { keys: ['titulo', 'busca'], threshold: 0.38, ignoreLocation: true }).search(busca).map(r => r.item);
  else if (nvEstado.aba !== 'destaques') itens.sort((a, b) => ordem === 'dl' ? (b.dl || 0) - (a.dl || 0) : ordem === 'lk' ? (b.lk || 0) - (a.lk || 0) : (b.mod || '').localeCompare(a.mod || ''));
  const el = limpar($('#nv-lista'));
  el.append(...itens.slice(0, nvEstado.limite).map(cartaoNV));
  if (!itens.length) el.append(h('p', { class: 'vazio' }, estado.nv ? 'Nada encontrado com esses filtros.' : 'Dados indisponíveis (sem conexão e sem cache).'));
  $('#nv-mais').hidden = itens.length <= nvEstado.limite;
  $('#nv-mais').textContent = `Carregar mais (${itens.length - nvEstado.limite} restantes)`;
}
registrar('nvidia', () => {
  const c = contagemNV();
  limpar($('#nv-contadores')).append(cartaoNum('Modelos abertos', c.modelos), cartaoNum('Novos (30 dias)', c.novos), cartaoNum('APIs NIM', c.nim), cartaoNum('Repositórios', c.repos), cartaoNum('Lançamentos (30 d)', c.rel30), cartaoNum('Estrelas GitHub', c.stars, { fmt: compacto }));
  const sel = $('#nv-familia'); if (sel.options.length === 1) for (const f of FAMILIAS) sel.append(h('option', { value: f.id }, `${f.ic} ${f.nome}`));
  if (!$('#nv-abas').dataset.ok) {
    $('#nv-abas').dataset.ok = 1;
    $('#nv-abas').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('#nv-abas button').forEach(x => x.setAttribute('aria-selected', x === b)); nvEstado.aba = b.dataset.aba; nvEstado.limite = 24; renderNV(); });
    let tm; $('#nv-busca').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { nvEstado.limite = 24; renderNV(); }, 180); });
    for (const id of ['#nv-familia', '#nv-ordem', '#nv-novos']) $(id).addEventListener('change', () => { nvEstado.limite = 24; renderNV(); });
    $('#nv-mais').addEventListener('click', () => { nvEstado.limite += 24; renderNV(); });
  }
  renderNV();
});

// ---------- MUNDO ----------
const muEstado = { cat: '' };
function renderNoticias() {
  const n = estado.news; const el = limpar($('#mu-lista'));
  if (!n) { el.append(h('p', { class: 'vazio' }, 'Notícias indisponíveis (sem conexão e sem cache).')); return; }
  let itens = n.feeds.filter(f => !muEstado.cat || f.cat === muEstado.cat).flatMap(f => f.itens.map(i => ({ ...i, fonte: f.nome })));
  const vistos = new Set(); itens = itens.filter(i => { const k = i.t.toLowerCase().slice(0, 60); if (vistos.has(k)) return false; vistos.add(k); return true; });
  const q = $('#mu-busca').value.trim();
  if (q) itens = new Fuse(itens, { keys: ['t', 'd', 'fonte'], threshold: 0.35, ignoreLocation: true }).search(q).map(r => r.item);
  else itens.sort((a, b) => (b.dt || '').localeCompare(a.dt || ''));
  el.append(...itens.slice(0, 80).map(i => { const s = typeof i.s === 'number' ? i.s : sentimento(i.t); return h('a', { class: 'noticia ' + (s > 0 ? 'pos' : s < 0 ? 'neg' : ''), href: i.l }, h('div', { class: 'meta' }, `${limpo(i.fonte)} · ${relativo(i.dt)}${s ? (s > 0 ? ' · ▲ positiva' : ' · ▼ negativa') : ''}`), h('h3', {}, limpo(i.t)), i.d ? h('p', {}, limpo(i.d)) : null); }));
  if (!itens.length) el.append(h('p', { class: 'vazio' }, 'Nenhuma manchete encontrada.'));
}
function tabelaTendencia() {
  const t = limpar($('#mu-tend')); const mk = estado.mk; if (!mk) return;
  t.append(h('thead', {}, h('tr', {}, ['Ativo', 'Preço (R$)', 'Dia', '1 mês', '3 meses', 'Tendência', '60 dias'].map(x => h('th', {}, x)))));
  const tb = h('tbody');
  const linhas = Object.entries(mk.ativos).map(([id, a]) => { const v = a.brl.map(p => p[1]); const m50 = v.slice(-50).reduce((s, x) => s + x, 0) / Math.min(50, v.length); const m20 = v.slice(-20).reduce((s, x) => s + x, 0) / Math.min(20, v.length); const r1 = v.at(-1) / v.at(-22) - 1; const tend = v.at(-1) > m20 && m20 > m50 ? 1 : v.at(-1) < m20 && m20 < m50 ? -1 : 0; return { id, a, v, d: v.at(-1) / v.at(-2) - 1, r1, r3: v.at(-1) / v.at(-64) - 1, tend }; }).sort((x, y) => y.r1 - x.r1);
  for (const l of linhas) tb.append(h('tr', {}, h('td', { class: 'nome' }, l.a.nome), h('td', {}, l.id === 'IBOV' ? inteiro(l.v.at(-1)) : num(l.v.at(-1), 2)), h('td', { class: cls(l.d) }, pct(l.d, 2)), h('td', { class: cls(l.r1) }, pct(l.r1)), h('td', { class: cls(l.r3) }, pct(l.r3)), h('td', { class: l.tend > 0 ? 'sobe' : l.tend < 0 ? 'cai' : 'neutro' }, l.tend > 0 ? '▲ subindo' : l.tend < 0 ? '▼ caindo' : '◆ lateral'), h('td', {}, sparkline(l.v.slice(-60), { w: 80, hgt: 24 }))));
  t.append(tb);
}
function montarTV() {
  const box = limpar($('#tv-canais'));
  for (const c of CANAIS_TV) box.append(h('button', { type: 'button', 'aria-pressed': 'false', onclick: e => tocarCanal(c, e.currentTarget) }, c.nome, h('small', {}, c.tema)));
}
function tocarCanal(c, btn) {
  $$('#tv-canais button').forEach(b => b.setAttribute('aria-pressed', b === btn));
  const tela = limpar($('#tv-tela'));
  tela.append(h('iframe', { src: `https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(c.id)}&autoplay=1&mute=1&playsinline=1`, title: `${c.nome} ao vivo`, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', referrerpolicy: 'strict-origin-when-cross-origin', loading: 'lazy', sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups' }));
  const link = $('#tv-link') || h('a', { id: 'tv-link', class: 'tv-link' });
  link.textContent = `Se não carregar (o canal pode estar fora do ar ou bloquear incorporação), abra ${c.nome} no YouTube ↗`;
  link.setAttribute('href', `https://www.youtube.com/channel/${c.id}/live`); link.target = '_blank'; link.rel = 'noopener noreferrer';
  $('#tv').after(link);
}
registrar('mundo', () => {
  termometro($('#mu-term'), true); tabelaTendencia(); montarTV();
  if (!$('#mu-abas').dataset.ok) {
    $('#mu-abas').dataset.ok = 1;
    $('#mu-abas').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('#mu-abas button').forEach(x => x.setAttribute('aria-selected', x === b)); muEstado.cat = b.dataset.cat; renderNoticias(); });
    let tm; $('#mu-busca').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(renderNoticias, 180); });
  }
  renderNoticias();
});

// ---------- aviso de risco (obrigatório para áreas de investimento) ----------
const CHAVE_AVISO = 'aviso.v2';
export const avisoAceito = () => !!guarda.ler(CHAVE_AVISO);
let recusouNaSessao = false;
export function abrirAviso(depois, automatico = false) {
  if (automatico && recusouNaSessao) return;
  const d = $('#aviso'); const ok = $('#aviso-ok'); const ent = $('#aviso-aceito');
  ok.checked = false; ent.disabled = true;
  ok.onchange = () => { ent.disabled = !ok.checked; };
  d.returnValue = '';
  d.onclose = () => { if (d.returnValue === 'aceito' && ok.checked) { guarda.gravar(CHAVE_AVISO, { em: new Date().toISOString() }); recusouNaSessao = false; } else recusouNaSessao = true; depois?.(); };
  if (!d.open) d.showModal();
}
$$('[data-abrir-aviso]').forEach(b => b.addEventListener('click', () => abrirAviso(rota)));
$('#aviso-sair')?.addEventListener('click', () => { if (!avisoAceito()) setTimeout(() => { if (!avisoAceito()) location.hash = '#riscos'; }, 0); });
$('#rever-aviso')?.addEventListener('click', () => { guarda.apagar(CHAVE_AVISO); abrirAviso(); });
$('#btn-mais')?.addEventListener('click', () => $('#menu-mais').showModal());
$('#fechar-mais')?.addEventListener('click', () => $('#menu-mais').close());
$('#menu-mais')?.addEventListener('click', e => { if (e.target.id === 'menu-mais') e.target.close(); });

// ---------- fundo animado (radar solar) ----------
function fundo() {
  const c = $('#fundo'); const g = c.getContext('2d'); const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, dpr; const pts = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), v: 0.0002 + Math.random() * 0.0006, r: Math.random() * 1.6 + 0.3 }));
  const tam = () => { dpr = Math.min(2, devicePixelRatio || 1); W = c.width = innerWidth * dpr; H = c.height = innerHeight * dpr; };
  tam(); addEventListener('resize', tam);
  let ang = 0, vis = true; document.addEventListener('visibilitychange', () => { vis = !document.hidden; if (vis && !reduz) requestAnimationFrame(passo); });
  function passo() {
    g.clearRect(0, 0, W, H);
    const cx = W * 0.82, cy = H * 0.12, R = Math.max(W, H) * 0.6;
    for (let i = 1; i <= 6; i++) { g.beginPath(); g.arc(cx, cy, (R / 6) * i, 0, Math.PI * 2); g.strokeStyle = `rgba(241,199,91,${0.07 - i * 0.008})`; g.lineWidth = dpr; g.stroke(); }
    const grd = g.createConicGradient ? g.createConicGradient(ang, cx, cy) : null;
    if (grd) { grd.addColorStop(0, 'rgba(241,199,91,.13)'); grd.addColorStop(0.08, 'rgba(241,199,91,0)'); grd.addColorStop(1, 'rgba(241,199,91,0)'); g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill(); }
    for (const p of pts) { p.y -= p.v; if (p.y < 0) { p.y = 1; p.x = Math.random(); } g.beginPath(); g.arc(p.x * W, p.y * H, p.r * dpr, 0, Math.PI * 2); g.fillStyle = 'rgba(241,199,91,.55)'; g.fill(); }
    ang += 0.006;
    if (!reduz && vis) requestAnimationFrame(passo);
  }
  passo();
}

// ---------- início ----------
async function iniciar() {
  fundo();
  addEventListener('hashchange', rota);
  await carregar();
  aplicarAoVivoMercado();
  montarTicker();
  iniciarSimulador({ estado, registrar, avisoAceito, abrirAviso, rota });
  iniciarExtras({ estado, registrar, avisoAceito, abrirAviso, rota });
  rota();
  aoVivo().then(() => { montarTicker(); const p = (location.hash || '#inicio').slice(1); if (p === 'inicio' || p === 'nvidia') { renderizada.delete(p); rota(); } });
  setInterval(async () => { await carregar(); await aoVivo(); montarTicker(); }, 10 * 60 * 1000);
  if ('serviceWorker' in navigator && location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') navigator.serviceWorker?.register('sw.js').catch(e => console.warn('SW', e));
}
iniciar();
