// どこにつなぐか
//   本番: 画面は GitHub Pages（https://9qu1.com/min-i/）、通信は Cloudflare（https://min-i-jinsei.nakamido.workers.dev）
//   手元: 画面も通信も wrangler dev（同じ場所）
const PROD_PAGE_HOSTS = ['9qu1.com', '9qu1.github.io'];
const IS_PROD_PAGE = PROD_PAGE_HOSTS.includes(location.hostname);
export const API_ORIGIN = IS_PROD_PAGE ? 'https://min-i-jinsei.nakamido.workers.dev' : '';
export const WS_URL = IS_PROD_PAGE
  ? 'wss://min-i-jinsei.nakamido.workers.dev/ws'
  : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
// このページの住所（共有のリンクに使う。/min-i/ の下でも、手元の / でも）
export const PAGE_URL = IS_PROD_PAGE ? 'https://9qu1.com/min-i/' : location.origin + location.pathname.replace(/[^/]*$/, '');
export const HASHTAG = '民意の人生';
