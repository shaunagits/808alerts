/* Cloudflare Pages middleware for 808alerts.com.
 *
 * Sends the feed pages, the road closures page and every /alert/<slug> page with
 * the current alerts already written into the HTML, so search engines and link
 * previews (texts, Facebook) see real content instead of "Loading alerts". The
 * browser script then takes over exactly as it would without this.
 *
 * It uses the same code the browser runs (functions/_lib/core.js is generated
 * from the page script by the build), so the two can never disagree about what
 * a card says. If anything here fails, the static page is sent unchanged.
 */
import * as C from './_lib/core.js';

const UA = '808alerts.com storm information (contact: shauna.coy@gmail.com)';
const FEEDS = { '/': 'ALL', '/oahu-alerts/': 'OAH', '/maui-alerts/': 'MAUCO', '/hawaii-island-alerts/': 'HAW', '/kauai-alerts/': 'KAU' };
const ROADS = '/big-island-road-closures/';
const FRESH_MS = 60e3;

let loadedAt = 0;
let loading = null;
function freshData(withHistory) {
  if (Date.now() - loadedAt < FRESH_MS && (!withHistory || C.S.nws.historyAt)) return Promise.resolve();
  if (!loading) {
    C.setFetchHeaders({ 'User-Agent': UA });
    loading = C.loadAll()
      .then(() => (withHistory ? C.loadNWSHistory().then(() => C.assemble()) : null))
      .then(() => { loadedAt = Date.now(); })
      .finally(() => { loading = null; });
  }
  return loading;
}

function attr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function setHead(html, m) {
  if (m.title) {
    html = html.replace(/<title>[\s\S]*?<\/title>/, '<title>' + attr(m.title) + '</title>')
      .replace(/(<meta property="og:title" content=")[^"]*/, '$1' + attr(m.title))
      .replace(/(<meta name="twitter:title" content=")[^"]*/, '$1' + attr(m.title));
  }
  if (m.desc) {
    html = html.replace(/(<meta name="description" content=")[^"]*/, '$1' + attr(m.desc))
      .replace(/(<meta property="og:description" content=")[^"]*/, '$1' + attr(m.desc))
      .replace(/(<meta name="twitter:description" content=")[^"]*/, '$1' + attr(m.desc));
  }
  if (m.url) {
    html = html.replace(/(<link rel="canonical" href=")[^"]*/, '$1' + attr(m.url))
      .replace(/(<meta property="og:url" content=")[^"]*/, '$1' + attr(m.url));
  }
  if (m.noindex) html = html.replace('</head>', '<meta name="robots" content="noindex">\n</head>');
  return html;
}
function between(html, name, content) {
  const a = '<!--SSR:' + name + '-->', b = '<!--/SSR:' + name + '-->';
  const i = html.indexOf(a), j = html.indexOf(b);
  if (i < 0 || j < 0) return html;
  return html.slice(0, i + a.length) + content + html.slice(j);
}
function stamp(html) {
  return html.replace('<span class="upd n" id="upd">CHECKING…</span>',
    '<span class="upd n" id="upd">UPDATED ' + C.tm(C.S.checkedAt || Date.now()) + ' HST</span>');
}
function send(html, status) {
  return new Response(html, {
    status: status || 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=60' }
  });
}

async function feedPage(res, island) {
  await freshData(false);
  let html = await res.text();
  html = html.replace('<main id="feed">', '<main id="feed" data-ssr="1">');
  html = between(html, 'BANNERS', C.bannerHTML(island));
  html = between(html, 'FEED', C.feedHTML(island, false));
  html = between(html, 'NOW', C.rightNowHTML(island));
  return send(stamp(html));
}

async function roadsPage(res) {
  await freshData(false);
  let html = await res.text();
  html = between(html, 'ROADS', C.roadsHTML());
  return send(stamp(html));
}

async function alertPage(ctx, url, key) {
  const shell = await ctx.env.ASSETS.fetch(new URL('/', url));
  let html = await shell.text();
  await freshData(false);
  let c = C.findCard(key);
  if (!c) { await freshData(true); c = C.findCard(key); }
  html = html.replace('<body>', '<body class="detail">')
    .replace('<div id="feedwrap">', '<div id="feedwrap" hidden>')
    .replace('<a class="back n" id="back" href="/" hidden>', '<a class="back n" id="back" href="/">')
    .replace('<div class="pick" id="pick">', '<div class="pick" id="pick" hidden>');
  if (!c) {
    html = setHead(html, { title: 'Alert not found · 808 Alerts', noindex: true });
    html = html.replace('<div id="detail" hidden></div>', '<div id="detail" data-ssr="1">' + C.missingHTML() + '</div>');
    return send(stamp(html), 404);
  }
  const path = C.alertPath(c);
  html = setHead(html, {
    title: C.detailTitle(c) + ' · 808 Alerts',
    desc: C.detailDesc(c),
    url: 'https://808alerts.com' + path,
    noindex: !c.active
  });
  html = html.replace('<a class="mapbtn n" id="mapbtn" href="/map/"', '<a class="mapbtn n" id="mapbtn" href="' + C.mapHref(c.isl) + '"');
  html = html.replace('<div id="detail" hidden></div>', '<div id="detail" data-ssr="1">' + C.detailHTML(c) + '</div>');
  return send(stamp(html));
}

export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  const p = url.pathname;
  if (ctx.request.method !== 'GET') return ctx.next();
  const alert = /^\/alert\/([^/]+)\/?$/.exec(p);
  const island = FEEDS[p];
  if (!alert && !island && p !== ROADS) return ctx.next();
  try {
    if (alert) return await alertPage(ctx, url, decodeURIComponent(alert[1]));
    const res = await ctx.next();
    const type = res.headers.get('content-type') || '';
    if (!res.ok || type.indexOf('text/html') < 0) return res;
    return p === ROADS ? await roadsPage(res) : await feedPage(res, island);
  } catch (e) {
    // Never let a feed or render problem take the page down: send it as a plain
    // static page and let the browser load the alerts itself.
    return ctx.env.ASSETS.fetch(alert ? new URL('/', url) : ctx.request);
  }
}
