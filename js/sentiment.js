// Sentimento de manchetes por léxico (transparente e auditável). Usado no site e no coletor.
// Retorna um número entre -1 (muito negativo) e +1 (muito positivo).
const POS = ['alta','sobe','subiu','subindo','dispara','disparou','avança','avanço','recorde','lucro','lucros','cresce','crescimento','cresceu','ganho','ganhos','otimismo','recupera','recuperação','valoriza','valorização','aprova','acordo','supera','forte','expansão','positivo','melhora','corte de juros','queda da inflação','estímulo',
 'rise','rises','rising','rose','surge','surges','soar','soars','rally','rallies','record','gain','gains','profit','profits','growth','grows','beat','beats','strong','optimism','recovery','rebound','upgrade','approve','approved','deal','boost','boom','bullish','cut rates','rate cut','eases','cooling inflation','breakthrough','launch','launches','open-source','free'];
const NEG = ['queda','cai','caiu','caindo','despenca','despencou','recua','recuo','perda','perdas','prejuízo','crise','recessão','inflação alta','guerra','ataque','conflito','tensão','tarifa','tarifas','sanção','sanções','risco','medo','pânico','calote','falência','demissões','rebaixa','rebaixamento','desacelera','desaceleração','fraco','negativo','piora','alta dos juros','golpe','fraude','hack','investigação','incerteza',
 'fall','falls','fell','falling','drop','drops','dropped','plunge','plunges','slump','slumps','tumble','tumbles','crash','loss','losses','crisis','recession','war','attack','conflict','tension','tariff','tariffs','sanction','sanctions','risk','fear','panic','default','bankruptcy','layoffs','downgrade','slowdown','weak','bearish','hike','hikes','fraud','hacked','probe','lawsuit','uncertainty','selloff','sell-off'];
const norm = s => (' ' + String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\- ]+/g, ' ') + ' ');
const N = w => ' ' + w.normalize('NFD').replace(/[\u0300-\u036f]/g, '') + ' ';
const POSN = POS.map(N), NEGN = NEG.map(N);
export function sentimento(texto) {
  const t = norm(texto);
  let p = 0, n = 0;
  for (const w of POSN) if (t.includes(w)) p++;
  for (const w of NEGN) if (t.includes(w)) n++;
  if (!p && !n) return 0;
  return Math.max(-1, Math.min(1, (p - n) / (p + n)));
}
export function sentimentoMedio(itens) {
  const v = itens.map(i => typeof i.s === 'number' ? i.s : sentimento(i.t)).filter(x => x !== 0);
  if (!v.length) return 0;
  return v.reduce((a, b) => a + b, 0) / v.length;
}
// palavras-chave que ligam manchetes a ativos (para o sentimento por ativo)
export const CHAVES_ATIVO = {
  BTC: ['bitcoin','btc','cripto','crypto'], ETH: ['ethereum','ether','eth '], SOL: ['solana'],
  IBOV: ['ibovespa','b3','bolsa brasileira','bolsa de valores'], BOVA11: ['ibovespa','b3'], IVVB11: ['s&p','sp500','wall street'],
  PETR4: ['petrobras','petroleo','petróleo','oil','opep','opec'], VALE3: ['vale ','minerio','minério','iron ore','china'],
  ITUB4: ['itau','itaú','bancos','banks'], WEGE3: ['weg'], SPX: ['s&p','wall street','stocks','fed '], NDX: ['nasdaq','tech stocks','big techs'],
  NVDA: ['nvidia'], OURO: ['ouro','gold'], USD: ['dolar','dólar','dollar','cambio','câmbio']
};
