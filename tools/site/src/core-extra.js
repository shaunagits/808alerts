
/* ---------- loading everything ---------- */
function loadAll() {
  return Promise.all([loadNWS(), loadRoads(), loadShelters(), loadHECO()]).then(function () {
    S.checkedAt = Date.now();
    assemble();
  });
}

/* ---------- Big Island road closures page ----------
   Every active closure on the county layer, long-term ones included, newest first.
   The feed only takes closures from the last 7 days; this page is the full list. */
function roadRows() {
  return S.roads.items.slice().sort(function (a, b) {
    return (b.Start_Date || b.CreationDate || 0) - (a.Start_Date || a.CreationDate || 0);
  }).map(function (r) {
    var t = r.Start_Date || r.CreationDate || 0;
    var type = r.Road_Closure_Type || 'Closed';
    var lane = /lane/i.test(type);
    var clean = function (v) { return v && !/^\s*(n\/?a|none)\s*$/i.test(v) ? place(String(v).trim()) : ''; };
    return {
      t: t, fresh: t && Date.now() - t < WEEK, lane: lane, type: type,
      name: place(r.Name || 'Unnamed road'), loc: clean(r.Location), district: clean(r.District),
      mm: clean(r.Mile_Marker), reason: clean(r.Reason), notes: clean(r.Notes), alt: clean(r.Alternate_Route),
      map: r._lon != null ? countyMapAt(r._lon, r._lat, 16) : ''
    };
  });
}
function roadsHTML() {
  if (S.roads.status === 'fail' && !S.roads.items.length) {
    return '<div class="empty"><h2>The county road closure map isn’t answering.</h2><p>That does not mean the roads are open. Check the <a href="' + HCCDA_DASH + '" target="_blank" rel="noopener">Hawaiʻi County Civil Defense map</a> directly, or call (808) 935-0031.</p></div>';
  }
  var rows = roadRows();
  if (!rows.length) {
    return '<div class="empty"><h2>No county road closures listed right now.</h2><p>Checked ' + esc(tm(S.roads.at)) + ' HST. State highways are posted separately by HDOT, linked below.</p></div>';
  }
  var closed = rows.filter(function (r) { return !r.lane; }).length;
  var fresh = rows.filter(function (r) { return r.fresh; }).length;
  var h = '<p class="count"><b>' + rows.length + '</b> listed: ' + closed + ' closed, ' + (rows.length - closed) + ' down to one lane' +
    (fresh ? '. <b>' + fresh + ' new this week.</b>' : '.') + ' Checked ' + esc(tm(S.roads.at)) + ' HST.</p>';
  h += '<div class="roads">' + rows.map(function (r) {
    return '<article class="road' + (r.fresh ? ' new' : '') + '"><div class="r-h">' +
      '<span class="tag n ' + (r.lane ? 't-ADVISORY' : 't-NOTICE') + '">' + (r.lane ? 'ONE LANE' : 'CLOSED') + '</span>' +
      (r.fresh ? '<span class="tag n t-WARNING">NEW</span>' : '') +
      (r.district ? '<span class="dist n">' + esc(r.district.toUpperCase()) + '</span>' : '') + '</div>' +
      '<h2>' + esc(r.name) + (r.loc ? '<span>' + esc(r.loc) + (r.mm ? ', mile ' + esc(r.mm) : '') + '</span>' : '') + '</h2>' +
      (r.reason ? '<p>' + esc(r.reason.replace(/\.?$/, '.')) + '</p>' : '') +
      (r.notes ? '<p>' + esc(r.notes.replace(/\.?$/, '.')) + '</p>' : '') +
      '<p class="alt">' + (r.alt ? 'Alternate route: ' + esc(r.alt) : 'No alternate route listed.') + '</p>' +
      (r.map ? '<a class="onmap" href="' + esc(r.map) + '" target="_blank" rel="noopener">See it on the county map ↗</a>' : '') +
      '<div class="since">' + (r.t ? 'Listed since ' + esc(fmtDay.format(new Date(r.t))) + (Date.now() - r.t < 864e5 * 2 ? ', ' + esc(tm(r.t)) : '') : '') + '</div></article>';
  }).join('') + '</div>';
  return h;
}
