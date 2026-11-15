# ☀🦅 Radar Águia Solar

**O olhar da Águia Primordial sobre a tecnologia e o mundo.** App web (PWA) em português que reúne:

1. **IA Gratuita da NVIDIA** — modelos abertos (Hugging Face), APIs do catálogo NIM (build.nvidia.com), código aberto (GitHub), lançamentos, cursos e notícias, explicados em linguagem simples.
2. **Cenário Mundial** — "TV" com canais oficiais ao vivo no YouTube, manchetes de várias fontes, termômetro de humor das notícias e tendência dos mercados.
3. **Simulador da Águia (dinheiro fictício)** — análise com indicadores transparentes, carteira sugerida *simulada*, backtest, Monte Carlo, carteira fictícia e registro de acertos.
4. **Curto prazo e prazos**, **O que os ricos usam** (calculadoras), **Inteligência emocional**, **Detector de golpes**, **Onde investir com segurança** (status lido da CVM), **Segurança** e **Avisos e Riscos**.

> ⚠ **Aviso:** conteúdo educativo. O simulador usa dinheiro fictício e **não é recomendação de investimento**. Não há garantia de retorno. **Qualquer decisão de investimento é de total responsabilidade e por conta e risco de cada pessoa. O aplicativo e seus criadores não se responsabilizam por perdas.** O app não recebe nem movimenta dinheiro.

## Como os dados se atualizam
- **No navegador (ao vivo):** Hugging Face API, CoinGecko, AwesomeAPI (câmbio) e Banco Central (SGS).
- **Robô do GitHub Actions (a cada 3 horas):** `scripts/fetch-data.mjs` grava `data/*.json` (feeds RSS da NVIDIA e de notícias, GitHub, catálogo NIM, cotações Yahoo/Stooq, CDI/Selic/IPCA do BCB, cadastro de intermediários da CVM) e publica o site no GitHub Pages.
- **Offline:** service worker + cache local mostram os últimos dados salvos.

## Segurança
CSP rígida (só scripts do próprio site), bibliotecas hospedadas localmente com hash SHA-384 verificado no CI e `modulepreload` com `integrity`, textos externos higienizados (DOMPurify + inserção como texto), links só https com `noopener`, Dependabot e CodeQL.

## Bibliotecas
- [DOMPurify](https://github.com/cure53/DOMPurify) 3.4.18 (Apache-2.0/MPL-2.0)
- [Fuse.js](https://github.com/krisk/Fuse) 7.5.0 (Apache-2.0)
- [Lightweight Charts™ by TradingView](https://github.com/tradingview/lightweight-charts) 5.3.0 (Apache-2.0)
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) (coletor, Node)

App independente, sem ligação com a NVIDIA, CVM ou qualquer instituição citada.
