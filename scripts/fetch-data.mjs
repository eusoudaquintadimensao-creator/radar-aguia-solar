// Coletor de dados do Radar Águia Solar. Roda no GitHub Actions (a cada 3h) e grava data/*.json.
// Fontes públicas e gratuitas. Nenhuma chave secreta é exposta no site.
import { XMLParser } from 'fast-xml-parser';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { sentimento } from '../js/sentiment.js';

const UA = 'Mozilla/5.0 (compatible; RadarAguiaSolar/1.0; +https://github.com/eusoudaquintadimensao-creator/radar-aguia-solar)';
const GH = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
const agora = new Date().toISOString();
const log = (...a) => console.log('[dados]', ...a);
const erros = [];

async function get(url, { tipo = 'json', headers = {}, tentativas = 2, timeout = 20000 } = {}) {
  for (let i = 0; i <= tentativas; i++) {
    try {
      const r = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': UA, Accept: tipo === 'json' ? 'application/json' : '*/*', ...headers }, redirect: 'follow', signal: AbortSignal.timeout(timeout) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return tipo === 'json' ? await r.json() : await r.text();
    } catch (e) {
      if (i === tentativas) { erros.push(`${url}: ${e.message}`); log('falhou', url, e.message); return null; }
      await new Promise(s => setTimeout(s, 1500 * (i + 1)));
    }
  }
}
const limpa = s => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => { const c = +n; return c > 31 && c < 0x10ffff ? String.fromCodePoint(c) : ' '; }).replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const corta = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const soHttp = u => (/^https?:\/\//i.test(String(u || '')) ? String(u).trim() : '');
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#t', processEntities: true, htmlEntities: true });
const txt = v => (v == null ? '' : typeof v === 'object' ? (v['#t'] ?? v['@href'] ?? '') : String(v));

// Política do app: nunca exibir conteúdo de jogos de azar/esquemas. Manchetes com esses termos são descartadas.
const BLOQ = /\b(bets?|apostas?|apostador\w*|cassinos?|casinos?|tigrinho|bet365|betano|blaze|roleta|jackpot|gambling|sportsbook|loterias?|pir[aâ]mide financeira)\b/i;
async function rss(url, max = 20) {
  const x = await get(url, { tipo: 'text' });
  if (!x) return null;
  try {
    const d = parser.parse(x);
    let itens = d?.rss?.channel?.item ?? d?.feed?.entry ?? d?.['rdf:RDF']?.item ?? [];
    if (!Array.isArray(itens)) itens = [itens];
    return itens.slice(0, max).map(it => {
      let link = it.link; if (Array.isArray(link)) link = link.find(l => l['@rel'] !== 'self') ?? link[0];
      const t = corta(limpa(txt(it.title)), 220);
      const dsc = corta(limpa(txt(it.description ?? it.summary ?? it['content:encoded'] ?? '')), 280);
      const dt = it.pubDate ?? it.published ?? it.updated ?? it['dc:date'] ?? '';
      const ts = Date.parse(txt(dt));
      return { t, d: dsc, l: soHttp(txt(link)), dt: isNaN(ts) ? null : new Date(ts).toISOString(), s: +sentimento(t + ' ' + dsc).toFixed(2) };
    }).filter(i => i.t && i.l && !BLOQ.test(i.t + ' ' + i.d));
  } catch (e) { erros.push(`${url}: XML ${e.message}`); return null; }
}

async function anterior(nome) { try { return JSON.parse(await readFile(`data/${nome}`, 'utf8')); } catch { return null; } }
async function grava(nome, obj) { await writeFile(`data/${nome}`, JSON.stringify(obj)); log('gravado', nome); }

// ---------------- NVIDIA ----------------
async function nvidia() {
  const ant = await anterior('nvidia.json');
  const [hfRec, hfPop, hfLikes] = await Promise.all([
    get('https://huggingface.co/api/models?author=nvidia&sort=lastModified&direction=-1&limit=120'),
    get('https://huggingface.co/api/models?author=nvidia&sort=downloads&direction=-1&limit=80'),
    get('https://huggingface.co/api/models?author=nvidia&sort=likes&direction=-1&limit=60')
  ]);
  const hfMap = new Map();
  for (const m of [...(hfRec || []), ...(hfPop || []), ...(hfLikes || [])]) {
    if (!m?.id || hfMap.has(m.id)) continue;
    hfMap.set(m.id, { id: m.id, dl: m.downloads ?? 0, lk: m.likes ?? 0, task: m.pipeline_tag ?? '', lib: m.library_name ?? '', mod: m.lastModified ?? null, cri: m.createdAt ?? null, tags: (m.tags || []).filter(t => /^(license:|language:|base_model:)/.test(t) === false).slice(0, 8), lic: (m.tags || []).find(t => t.startsWith('license:'))?.slice(8) ?? '' });
  }
  const hf = [...hfMap.values()];

  const orgs = ['NVIDIA', 'NVIDIA-NeMo', 'NVlabs', 'NVIDIA-AI-Blueprints', 'NVIDIA-Omniverse', 'isaac-sim'];
  const repos = [];
  for (const o of orgs) {
    const r = await get(`https://api.github.com/orgs/${o}/repos?sort=pushed&per_page=60`, { headers: { ...GH, Accept: 'application/vnd.github+json' } });
    for (const x of r || []) if (!x.archived && !x.fork) repos.push({ id: x.full_name, d: corta(limpa(x.description || ''), 200), st: x.stargazers_count, fk: x.forks_count, lang: x.language || '', push: x.pushed_at, cri: x.created_at, lic: x.license?.spdx_id || '', top: (x.topics || []).slice(0, 6), url: x.html_url });
  }
  const chave = ['NVIDIA/TensorRT-LLM', 'NVIDIA-NeMo/NeMo', 'NVIDIA/NeMo', 'NVIDIA/cuda-python', 'NVIDIA/Cosmos', 'nvidia-cosmos/cosmos-predict2', 'NVIDIA/physicsnemo', 'NVIDIA/garak', 'NVIDIA/NeMo-Guardrails', 'NVIDIA/Megatron-LM', 'NVIDIA/warp', 'NVIDIA/TensorRT', 'NVIDIA/nv-ingest', 'NVIDIA/Isaac-GR00T', 'NVIDIA/aistore', 'NVIDIA/cutlass', 'NVIDIA/DALI', 'NVIDIA-NeMo/Curator', 'NVIDIA-NeMo/RL', 'NVIDIA/k8s-device-plugin', 'NVIDIA/nvidia-container-toolkit', 'ai-dynamo/dynamo', 'NVIDIA/cuopt'];
  const rel = [];
  for (const c of chave) {
    const r = await get(`https://api.github.com/repos/${c}/releases?per_page=2`, { headers: { ...GH, Accept: 'application/vnd.github+json' }, tentativas: 0 });
    for (const x of r || []) if (!x.draft) rel.push({ repo: c, tag: x.tag_name, nome: corta(limpa(x.name || x.tag_name), 120), dt: x.published_at, url: x.html_url, pre: !!x.prerelease });
  }
  const nimRaw = await get('https://integrate.api.nvidia.com/v1/models');
  const nim = (nimRaw?.data || []).map(m => ({ id: m.id, dono: m.owned_by }));

  const [blog, news, dev] = await Promise.all([
    rss('https://blogs.nvidia.com/feed/', 25), rss('https://nvidianews.nvidia.com/releases.xml', 25), rss('https://developer.nvidia.com/blog/feed', 30)
  ]);
  const out = {
    atualizado: agora,
    hf: hf.length ? hf : ant?.hf ?? [],
    github: repos.length ? repos : ant?.github ?? [],
    releases: rel.length ? rel.sort((a, b) => (b.dt || '').localeCompare(a.dt || '')) : ant?.releases ?? [],
    nim: nim.length ? nim : ant?.nim ?? [],
    noticias: {
      blog: blog ?? ant?.noticias?.blog ?? [],
      newsroom: news ?? ant?.noticias?.newsroom ?? [],
      developer: dev ?? ant?.noticias?.developer ?? []
    }
  };
  await grava('nvidia.json', out);
  return out;
}

// ---------------- NOTÍCIAS ----------------
const GN = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
const FEEDS = [
  { id: 'gn-mundo', nome: 'Google Notícias · Mundo', cat: 'mundo', url: 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=pt-BR&gl=BR&ceid=BR:pt-419' },
  { id: 'bbc-br', nome: 'BBC News Brasil', cat: 'mundo', url: 'https://feeds.bbci.co.uk/portuguese/rss.xml' },
  { id: 'bbc-world', nome: 'BBC World', cat: 'mundo', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'aljazeera', nome: 'Al Jazeera', cat: 'mundo', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'gn-economia', nome: 'Google Notícias · Economia', cat: 'economia', url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=pt-BR&gl=BR&ceid=BR:pt-419' },
  { id: 'g1-economia', nome: 'g1 Economia', cat: 'economia', url: 'https://g1.globo.com/rss/g1/economia/' },
  { id: 'valor', nome: 'Valor Econômico', cat: 'economia', url: 'https://valor.globo.com/rss/valor' },
  { id: 'infomoney', nome: 'InfoMoney', cat: 'mercados', url: 'https://www.infomoney.com.br/feed/' },
  { id: 'cnbc', nome: 'CNBC Markets', cat: 'mercados', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { id: 'marketwatch', nome: 'MarketWatch', cat: 'mercados', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
  { id: 'gn-mercado', nome: 'Google Notícias · Ibovespa e dólar', cat: 'mercados', url: GN('Ibovespa OR dólar OR Selic when:2d') },
  { id: 'coindesk', nome: 'CoinDesk', cat: 'cripto', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { id: 'gn-cripto', nome: 'Google Notícias · Cripto', cat: 'cripto', url: GN('bitcoin OR criptomoedas when:2d') },
  { id: 'gn-tec', nome: 'Google Notícias · Tecnologia', cat: 'tecnologia', url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=pt-BR&gl=BR&ceid=BR:pt-419' },
  { id: 'gn-ia', nome: 'Google Notícias · Inteligência Artificial', cat: 'tecnologia', url: GN('inteligência artificial OR NVIDIA when:2d') }
];
async function noticias() {
  const ant = await anterior('news.json');
  const res = await Promise.all(FEEDS.map(f => rss(f.url, 20)));
  const feeds = FEEDS.map((f, i) => {
    const velho = ant?.feeds?.find(x => x.id === f.id);
    const itens = res[i] ?? velho?.itens ?? [];
    return { id: f.id, nome: f.nome, cat: f.cat, ok: !!res[i], itens };
  });
  const cats = {};
  for (const f of feeds) for (const it of f.itens) { (cats[f.cat] ??= []).push(it.s); }
  const termometro = Object.fromEntries(Object.entries(cats).map(([c, v]) => { const nz = v.filter(x => x); return [c, { media: nz.length ? +(nz.reduce((a, b) => a + b, 0) / nz.length).toFixed(3) : 0, n: v.length, pos: v.filter(x => x > 0).length, neg: v.filter(x => x < 0).length }]; }));
  const out = { atualizado: agora, feeds, termometro };
  await grava('news.json', out);
  return out;
}

// ---------------- MERCADOS ----------------
const ATIVOS = [
  { id: 'IBOV', nome: 'Ibovespa', cls: 'Índice BR', y: '^BVSP', st: '^bvp', moeda: 'BRL', bench: true },
  { id: 'BOVA11', nome: 'BOVA11 (ETF Ibovespa)', cls: 'ETF BR', y: 'BOVA11.SA', st: 'bova11.br', moeda: 'BRL' },
  { id: 'IVVB11', nome: 'IVVB11 (ETF S&P 500 em reais)', cls: 'ETF BR', y: 'IVVB11.SA', st: 'ivvb11.br', moeda: 'BRL' },
  { id: 'PETR4', nome: 'Petrobras PN', cls: 'Ação BR', y: 'PETR4.SA', st: 'petr4.br', moeda: 'BRL' },
  { id: 'VALE3', nome: 'Vale ON', cls: 'Ação BR', y: 'VALE3.SA', st: 'vale3.br', moeda: 'BRL' },
  { id: 'ITUB4', nome: 'Itaú Unibanco PN', cls: 'Ação BR', y: 'ITUB4.SA', st: 'itub4.br', moeda: 'BRL' },
  { id: 'WEGE3', nome: 'WEG ON', cls: 'Ação BR', y: 'WEGE3.SA', st: 'wege3.br', moeda: 'BRL' },
  { id: 'SPX', nome: 'S&P 500 (em reais)', cls: 'Índice EUA', y: '^GSPC', st: '^spx', moeda: 'USD', bench: true },
  { id: 'NDX', nome: 'Nasdaq 100 (em reais)', cls: 'Índice EUA', y: '^NDX', st: '^ndx', moeda: 'USD' },
  { id: 'NVDA', nome: 'NVIDIA (em reais)', cls: 'Ação EUA', y: 'NVDA', st: 'nvda.us', moeda: 'USD' },
  { id: 'OURO', nome: 'Ouro (em reais)', cls: 'Commodity', y: 'GC=F', st: 'xauusd', moeda: 'USD' },
  { id: 'USD', nome: 'Dólar (USD/BRL)', cls: 'Câmbio', y: 'BRL=X', st: 'usdbrl', moeda: 'BRL' }
];
const CRIPTO = [
  { id: 'BTC', nome: 'Bitcoin', cg: 'bitcoin', bench: true }, { id: 'ETH', nome: 'Ethereum', cg: 'ethereum' }, { id: 'SOL', nome: 'Solana', cg: 'solana' }
];
const dia = ts => new Date(ts).toISOString().slice(0, 10);
async function yahoo(sym) {
  const j = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=2y&interval=1d`, { tentativas: 1 });
  const r = j?.chart?.result?.[0]; if (!r?.timestamp) return null;
  const c = r.indicators?.quote?.[0]?.close || [];
  const s = []; r.timestamp.forEach((t, i) => { if (c[i] != null && isFinite(c[i])) s.push([dia(t * 1000), +c[i].toFixed(4)]); });
  return s.length > 50 ? s : null;
}
async function stooq(sym) {
  const t = await get(`https://stooq.com/q/d/l/?s=${encodeURIComponent(sym)}&i=d`, { tipo: 'text', tentativas: 0 });
  if (!t || !t.startsWith('Date')) return null;
  const s = t.trim().split('\n').slice(1).map(l => l.split(',')).filter(p => p[4] && isFinite(+p[4])).map(p => [p[0], +(+p[4]).toFixed(4)]);
  return s.length > 50 ? s.slice(-520) : null;
}
async function mercados() {
  const ant = await anterior('markets.json');
  const ativos = {};
  for (const a of ATIVOS) {
    let s = await yahoo(a.y), fonte = 'Yahoo Finance';
    if (!s) { s = await stooq(a.st); fonte = 'Stooq'; }
    if (!s) { s = ant?.ativos?.[a.id]?.nat ?? null; fonte = 'cache'; }
    if (s) ativos[a.id] = { nome: a.nome, cls: a.cls, moeda: a.moeda, bench: !!a.bench, fonte, nat: s };
  }
  // converte ativos em USD para BRL usando o câmbio diário
  const fx = new Map((ativos.USD?.nat || []).map(p => p));
  const fxDias = [...fx.keys()].sort();
  const fxEm = d => { let lo = 0, hi = fxDias.length - 1, r = null; while (lo <= hi) { const m = (lo + hi) >> 1; if (fxDias[m] <= d) { r = fxDias[m]; lo = m + 1; } else hi = m - 1; } return r ? fx.get(r) : null; };
  for (const [id, a] of Object.entries(ativos)) {
    a.brl = a.moeda === 'USD' ? a.nat.map(([d, v]) => { const f = fxEm(d); return f ? [d, +(v * f).toFixed(4)] : null; }).filter(Boolean) : a.nat;
  }
  for (const c of CRIPTO) {
    let s = await yahoo(`${c.id}-USD`), fonte = 'Yahoo Finance';
    if (s) s = s.map(([d, v]) => { const f = fxEm(d); return f ? [d, +(v * f).toFixed(2)] : null; }).filter(Boolean);
    if (s && s.length < 50) s = null;
    if (!s) {
      const j = await get(`https://api.coingecko.com/api/v3/coins/${c.cg}/market_chart?vs_currency=brl&days=365&interval=daily`, { tentativas: 2 });
      s = j?.prices?.map(([t, v]) => [dia(t), +v.toFixed(2)]);
      if (s) { const m = new Map(s); s = [...m.entries()]; }
      fonte = s ? 'CoinGecko' : 'cache';
    }
    if (!s) s = ant?.ativos?.[c.id]?.brl ?? null;
    if (s) ativos[c.id] = { nome: c.nome, cls: 'Cripto', moeda: 'BRL', bench: !!c.bench, fonte, nat: s, brl: s };
    if (fonte === 'CoinGecko') await new Promise(r => setTimeout(r, 2500));
  }
  // CDI diário (% ao dia) e Selic meta, IPCA (BCB/SGS)
  const fim = new Date(), ini = new Date(Date.now() - 760 * 864e5);
  const f = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const sgs = async (n, q) => get(q ? `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${n}/dados/ultimos/${q}?formato=json` : `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${n}/dados?formato=json&dataInicial=${f(ini)}&dataFinal=${f(fim)}`);
  const br = d => { const [dd, mm, aa] = d.split('/'); return `${aa}-${mm}-${dd}`; };
  const cdiRaw = await sgs(12), selic = await sgs(432, 1), ipcaMes = await sgs(433, 12);
  const ipca12 = ipcaMes?.length === 12 ? [{ valor: ((ipcaMes.reduce((f, x) => f * (1 + (+x.valor) / 100), 1) - 1) * 100).toFixed(2) }] : null;
  const cdi = cdiRaw?.map(x => [br(x.data), +x.valor]) ?? ant?.cdi ?? [];
  for (const a of Object.values(ativos)) delete a.nat;
  const out = { atualizado: agora, ativos, cdi, selic: selic?.[0] ? +selic[0].valor : ant?.selic ?? null, ipca12m: ipca12?.[0] ? +ipca12[0].valor : ant?.ipca12m ?? null };
  await grava('markets.json', out);
  return out;
}

// ---------------- INSTITUIÇÕES REGULADAS (Dados Abertos CVM) ----------------
const REGULADAS = [
  { cnpj: '02.332.886/0001-04', nome: 'XP Investimentos', site: 'https://www.xpi.com.br/' },
  { cnpj: '43.815.158/0001-22', nome: 'BTG Pactual (corretora)', site: 'https://www.btgpactual.com/' },
  { cnpj: '62.169.875/0001-79', nome: 'Nu Invest', site: 'https://www.nuinvest.com.br/' },
  { cnpj: '18.945.670/0001-46', nome: 'Inter DTVM (Inter Invest)', site: 'https://inter.co/' },
  { cnpj: '61.194.353/0001-64', nome: 'Itaú Corretora', site: 'https://www.itau.com.br/investimentos' },
  { cnpj: '74.014.747/0001-35', nome: 'Ágora Investimentos (Bradesco)', site: 'https://www.agorainvestimentos.com.br/' },
  { cnpj: '29.162.769/0001-98', nome: 'Santander Corretora / Toro', site: 'https://www.toroinvestimentos.com.br/' },
  { cnpj: '27.652.684/0001-62', nome: 'Genial Investimentos', site: 'https://www.genialinvestimentos.com.br/' },
  { cnpj: '32.345.784/0001-86', nome: 'C6 Corretora (C6 Bank)', site: 'https://www.c6bank.com.br/' },
  { cnpj: '92.875.780/0001-31', nome: 'Warren', site: 'https://warren.com.br/' },
  { cnpj: '12.392.983/0001-38', nome: 'Mirae Asset', site: 'https://www.mirae.com.br/' },
  { cnpj: '61.384.004/0001-05', nome: 'Avenue (banco de investimento no Brasil)', site: 'https://avenue.us/' }
];
// Lê um arquivo de dentro de um ZIP em memória (sem gravar arquivo temporário)
function lerZip(buf, nome) {
  let eocd = buf.length - 22; while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('ZIP inválido');
  let p = buf.readUInt32LE(eocd + 16); const n = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < n; i++) {
    const metodo = buf.readUInt16LE(p + 10), tam = buf.readUInt32LE(p + 20), ln = buf.readUInt16LE(p + 28), le = buf.readUInt16LE(p + 30), lc = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const nm = buf.toString('utf8', p + 46, p + 46 + ln);
    if (nm === nome) { const ini = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28); const dados = buf.subarray(ini, ini + tam); return metodo === 8 ? inflateRawSync(dados) : dados; }
    p += 46 + ln + le + lc;
  }
  throw new Error('arquivo não encontrado no ZIP');
}
async function reguladas() {
  const ant = await anterior('reguladas.json');
  const fonte = 'https://dados.cvm.gov.br/dados/INTERMED/CAD/DADOS/cad_intermed.zip';
  try {
    const r = await fetch(fonte, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const csv = new TextDecoder('latin1').decode(lerZip(Buffer.from(await r.arrayBuffer()), 'cad_intermed.csv'));
    const linhas = csv.split(/\r?\n/).map(l => l.split(';'));
    const cab = linhas[0]; const ix = n => cab.indexOf(n);
    const itens = REGULADAS.map(x => {
      const regs = linhas.filter(l => l[ix('CNPJ')] === x.cnpj);
      const ativos = regs.filter(l => !/CANCEL/i.test(l[ix('SIT')]));
      return { ...x, razao: regs[0]?.[ix('DENOM_SOCIAL')] ?? '', tipos: [...new Set(ativos.map(l => l[ix('TP_PARTIC')]))], situacao: ativos.length ? ativos[0][ix('SIT')] : (regs.length ? 'CANCELADA' : 'NÃO ENCONTRADA'), desde: regs.map(l => l[ix('DT_REG')]).sort()[0] ?? '' };
    });
    const out = { atualizado: agora, fonte, fontePagina: 'https://dados.cvm.gov.br/dataset/intermed-cad', itens };
    await grava('reguladas.json', out); return out;
  } catch (e) { erros.push('CVM cadastro: ' + e.message); return ant; }
}

await mkdir('data', { recursive: true });
const t0 = Date.now();
const [nv, nw, mk, rg] = await Promise.all([nvidia(), noticias(), mercados(), reguladas()]);
// histórico diário compacto (tendências ao longo do tempo)
const hist = (await anterior('history.json')) ?? { dias: [] };
const hoje = agora.slice(0, 10);
const reg = { d: hoje, hf: nv.hf.length, repos: nv.github.length, nim: nv.nim.length, term: Object.fromEntries(Object.entries(nw.termometro).map(([k, v]) => [k, v.media])) };
hist.dias = hist.dias.filter(x => x.d !== hoje).concat(reg).slice(-400);
await grava('history.json', hist);
await grava('status.json', { atualizado: agora, segundos: Math.round((Date.now() - t0) / 1000), erros: erros.slice(0, 40), contagem: { hf: nv.hf.length, github: nv.github.length, releases: nv.releases.length, nim: nv.nim.length, feeds: nw.feeds.filter(f => f.ok).length + '/' + nw.feeds.length, ativos: Object.keys(mk.ativos).length, cdi: mk.cdi.length, reguladas: rg?.itens?.filter(i => /NORMAL/.test(i.situacao)).length ?? 0 } });
log('ok em', Math.round((Date.now() - t0) / 1000), 's; erros:', erros.length);
