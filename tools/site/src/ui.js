
/* ---------- browser layer ----------
   Everything above builds data and HTML strings and runs the same on Cloudflare,
   which uses it to send each page with the current alerts already in it.
   Everything below touches the page. */
var PAGE = document.documentElement.getAttribute('data-page') || 'feed';
var FIXED = document.documentElement.getAttribute('data-island') || 'ALL';
S.island = FIXED;
S.showEnded = false;

function alertKey() {
  var m = /^\/alert\/([^/?#]+)/.exec(location.pathname);
  if (m) return decodeURIComponent(m[1]);
  var h = /^#alert\/(.+)$/.exec(location.hash); // links shared before 2026-09-24
  return h ? decodeURIComponent(h[1]) : null;
}
function updated() {
  var el = $('#upd');
  if (el) el.textContent = S.checkedAt ? 'UPDATED ' + tm(S.checkedAt) + ' HST' : 'CHECKING…';
}
function setMeta(sel, attr, val) { var m = document.querySelector(sel); if (m) m.setAttribute(attr, val); }

function renderFeed() {
  var feed = $('#feed');
  if (!feed) return;
  if (S.nws.status === 'loading') {
    if (!feed.getAttribute('data-ssr')) feed.innerHTML = '<div class="loading">Loading alerts from the National Weather Service and county agencies…</div>';
    return;
  }
  $('#banners').innerHTML = bannerHTML(S.island);
  feed.innerHTML = feedHTML(S.island, S.showEnded);
  var now = $('#now'); if (now) now.innerHTML = rightNowHTML(S.island);
  var more = $('#more');
  if (more) more.onclick = function () { S.showEnded = !S.showEnded; renderFeed(); };
}


function bindDetail(c) {
  var el = $('#detail');
  Array.prototype.forEach.call(el.querySelectorAll('.zones button'), function (b) {
    b.onclick = function () { DZ.zone = +b.getAttribute('data-z'); renderDetail(); };
  });
  var sh = $('#share');
  if (sh) sh.onclick = function () {
    var url = location.origin + (c ? alertPath(c) : location.pathname);
    var h1 = el.querySelector('h1');
    var data = { title: document.title, text: h1 ? h1.textContent : '', url: url };
    if (navigator.share) navigator.share(data).catch(function () { });
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { sh.querySelector('span').textContent = 'LINK COPIED'; });
  };
}
function renderDetail() {
  var el = $('#detail');
  var key = alertKey();
  if (S.nws.status === 'loading') {
    if (!el.getAttribute('data-ssr')) el.innerHTML = '<main><div class="loading">Loading alert…</div></main>';
    bindDetail(null);
    return;
  }
  var c = findCard(key);
  if (!c) {
    if (!S.nws.historyAt) { if (!el.getAttribute('data-ssr')) el.innerHTML = '<main><div class="loading">Looking back through this week’s alerts…</div></main>'; return; }
    el.innerHTML = missingHTML();
    return;
  }
  document.title = detailTitle(c) + ' · 808 Alerts';
  var mb = $('#mapbtn'); if (mb) mb.href = mapHref(c.isl);
  var canon = alertPath(c);
  if (location.pathname !== canon && history.replaceState) history.replaceState(null, '', canon);
  setMeta('link[rel=canonical]', 'href', 'https://808alerts.com' + canon);
  el.innerHTML = detailHTML(c);
  bindDetail(c);
}

function route() {
  if (PAGE === 'roads') { var r = $('#roads'); if (r && (S.roads.status !== 'loading')) r.innerHTML = roadsHTML(); return; }
  var detail = !!alertKey();
  document.body.classList.toggle('detail', detail);
  $('#feedwrap').hidden = detail;
  $('#detail').hidden = !detail;
  $('#pick').hidden = detail;
  $('#back').hidden = !detail;
  if (detail) renderDetail(); else renderFeed();
}

function refresh() {
  var jobs = PAGE === 'roads' ? [loadRoads()] : [loadNWS(), loadRoads(), loadShelters(), loadHECO()];
  return Promise.all(jobs).then(function () {
    S.checkedAt = Date.now();
    if (PAGE !== 'roads') assemble();
    updated(); route();
    if (PAGE === 'roads') return;
    return loadNWSHistory().then(function () { assemble(); route(); });
  });
}

(function init() {
  var sel = $('#island');
  if (sel) {
    sel.value = FIXED;
    sel.onchange = function () { store('808:island', sel.value); location.href = FILTER_PAGE[sel.value] || '/'; };
  }
  var mb = $('#mapbtn'); if (mb) mb.href = filterMapHref(FIXED);
  // "All alerts" goes back to wherever the person came from on this site, so the
  // feed they were scrolling is restored rather than reloaded at the top.
  var back = $('#back');
  if (back) {
    try {
      var ref = document.referrer && new URL(document.referrer);
      if (ref && ref.origin === location.origin && !/^\/alert\//.test(ref.pathname)) {
        back.href = ref.pathname;
        back.onclick = function (e) { if (history.length > 1) { e.preventDefault(); history.back(); } };
      }
    } catch (e) { }
  }
  window.addEventListener('hashchange', route);
  route();
  refresh();
  setInterval(refresh, REFRESH);
  setInterval(function () { if (PAGE !== 'roads' && !alertKey() && S.nws.status !== 'loading') renderFeed(); }, 30e3);
})();
