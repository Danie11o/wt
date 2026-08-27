/* Waga — prywatny dziennik wagi ciała. Dane trzymane w localStorage. */
'use strict';

const VERSION = 'v1.0';
const KEY = 'waga.entries.v1';

const DAYS_SHORT = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
const DAYS_LONG = ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'];
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

const COL = { blue: '#3b82f6', blueL: '#60a5fa', line: '#22303f', muted: '#8095ab', bg: '#0f151c' };

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ dane */

let entries = load();
let weekCursor = mondayOf(new Date());   // poniedziałek oglądanego tygodnia
let activeTab = 'week';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(valid).sort(byDate) : [];
  } catch (e) {
    console.warn('Nie udało się wczytać danych', e);
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
    return true;
  } catch (e) {
    console.warn('Nie udało się zapisać', e);
    return false;
  }
}

function valid(e) {
  return e && typeof e.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.d)
    && Number.isFinite(+e.kg) && +e.kg > 0;
}

function byDate(a, b) {
  return (a.d + (a.t || '00:00')).localeCompare(b.d + (b.t || '00:00'));
}

/* ------------------------------------------------------------------ daty */

function iso(dt) {
  const p = (n) => String(n).padStart(2, '0');
  return dt.getFullYear() + '-' + p(dt.getMonth() + 1) + '-' + p(dt.getDate());
}

function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** poniedziałek tygodnia, w którym leży `dt` */
function mondayOf(dt) {
  const d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function addDays(dt, n) {
  const d = new Date(dt);
  d.setDate(d.getDate() + n);
  return d;
}

/** indeks dnia w tygodniu: poniedziałek = 0 */
function dowIndex(dt) {
  return (dt.getDay() + 6) % 7;
}

/** liczba tygodni między dwoma poniedziałkami */
function weeksBetween(a, b) {
  return Math.round((b - a) / (7 * 864e5));
}

function dm(dt) {
  return dt.getDate() + '.' + String(dt.getMonth() + 1).padStart(2, '0');
}

function fmtDay(dt, withYear) {
  return dt.getDate() + ' ' + MONTHS[dt.getMonth()] + (withYear ? ' ' + dt.getFullYear() : '');
}

function fmtWeekRange(mon) {
  const sun = addDays(mon, 6);
  const showYear = mon.getFullYear() !== new Date().getFullYear();
  if (mon.getMonth() === sun.getMonth()) {
    return mon.getDate() + '–' + sun.getDate() + ' ' + MONTHS[mon.getMonth()]
      + (showYear ? ' ' + mon.getFullYear() : '');
  }
  return fmtDay(mon, false) + ' – ' + fmtDay(sun, showYear);
}

/* --------------------------------------------------------------- liczby */

function fmt(n, dec) {
  return n.toFixed(dec == null ? 1 : dec).replace('.', ',');
}

function fmtKg(n, dec) {
  return fmt(n, dec) + ' kg';
}

function fmtDelta(n, dec) {
  const d = dec == null ? 1 : dec;
  if (Math.abs(n) < 0.5 / Math.pow(10, d)) return fmt(0, d);
  return (n > 0 ? '+' : '−') + fmt(Math.abs(n), d);
}

function deltaClass(n) {
  if (Math.abs(n) < 0.05) return 'flat';
  return n > 0 ? 'up' : 'down';
}

function mean(nums) {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** polska odmiana: 1 / 2-4 / 5+ */
function plural(n, one, few, many) {
  if (n === 1) return one;
  const t = n % 10, h = n % 100;
  return (t >= 2 && t <= 4 && !(h >= 12 && h <= 14)) ? few : many;
}

function weekWord(n) {
  return plural(n, 'tydzień', 'tygodnie', 'tygodni');
}

function weighWord(n) {
  return plural(n, 'ważenie', 'ważenia', 'ważeń');
}

/* -------------------------------------------------------- grupowanie */

/** tygodnie z danymi, od najstarszego: { mon, items, avg } */
function weekGroups() {
  const map = new Map();
  for (const e of entries) {
    const mon = mondayOf(parseISO(e.d));
    const key = iso(mon);
    if (!map.has(key)) map.set(key, { mon: mon, items: [] });
    map.get(key).items.push(e);
  }
  const out = Array.from(map.values()).sort((a, b) => a.mon - b.mon);
  for (const g of out) {
    g.items.sort(byDate);
    g.avg = mean(g.items.map((e) => +e.kg));
  }
  return out;
}

function entriesOfWeek(mon) {
  const from = iso(mon), to = iso(addDays(mon, 6));
  return entries.filter((e) => e.d >= from && e.d <= to).sort(byDate);
}

/* ------------------------------------------------------------- wykresy */

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs, text) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text != null) n.textContent = text;
  return n;
}

/** skala Y: dopełnienie + zaokrąglone linie siatki */
function niceScale(min, max) {
  if (max - min < 0.4) {
    const c = (min + max) / 2;
    min = c - 0.3;
    max = c + 0.3;
  } else {
    const pad = (max - min) * 0.18;
    min -= pad;
    max += pad;
  }
  const steps = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20];
  const raw = (max - min) / 4;
  const step = steps.find((s) => s >= raw) || 20;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(+v.toFixed(4));
  return { lo: lo, hi: hi, ticks: ticks, step: step };
}

/**
 * Wykres liniowy.
 * opts: { pts:[{x,y}], xMin, xMax, xTicks:[{x,label,strong}], avg, height, emptyText }
 */
function lineChart(host, opts) {
  host.textContent = '';

  if (!opts.pts || !opts.pts.length) {
    const d = document.createElement('div');
    d.className = 'chart-empty';
    d.textContent = opts.emptyText || 'Brak danych';
    host.appendChild(d);
    return;
  }

  const W = Math.max(280, Math.round(host.clientWidth || 340));
  const H = opts.height || 210;
  const padL = 40, padR = 14, padT = 22, padB = 24;
  const pw = W - padL - padR, ph = H - padT - padB;

  const ys = opts.pts.map((p) => p.y);
  const sc = niceScale(Math.min.apply(null, ys), Math.max.apply(null, ys));

  const X = (x) => padL + ((x - opts.xMin) / (opts.xMax - opts.xMin)) * pw;
  const Y = (y) => padT + (1 - (y - sc.lo) / (sc.hi - sc.lo)) * ph;

  const svg = el('svg', {
    width: W, height: H, viewBox: '0 0 ' + W + ' ' + H,
    role: 'img', 'aria-label': opts.aria || 'wykres wagi'
  });

  // gradient pod linią
  const gid = 'g' + Math.random().toString(36).slice(2, 8);
  const defs = el('defs');
  const grad = el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
  grad.appendChild(el('stop', { offset: '0%', 'stop-color': COL.blue, 'stop-opacity': 0.32 }));
  grad.appendChild(el('stop', { offset: '100%', 'stop-color': COL.blue, 'stop-opacity': 0 }));
  defs.appendChild(grad);
  svg.appendChild(defs);

  // siatka pozioma + podpisy kg
  const dec = sc.step < 1 ? 1 : 0;
  for (const t of sc.ticks) {
    const y = Y(t);
    svg.appendChild(el('line', {
      x1: padL, y1: y, x2: W - padR, y2: y, stroke: COL.line, 'stroke-width': 1
    }));
    svg.appendChild(el('text', {
      x: padL - 7, y: y + 3.5, fill: COL.muted, 'font-size': 10.5, 'text-anchor': 'end'
    }, fmt(t, dec)));
  }

  // podpisy osi X
  for (const t of (opts.xTicks || [])) {
    svg.appendChild(el('text', {
      x: X(t.x), y: H - 7, fill: t.strong ? COL.blueL : COL.muted,
      'font-size': 10.5, 'text-anchor': 'middle', 'font-weight': t.strong ? 700 : 400
    }, t.label));
  }

  // linia średniej
  if (opts.avg != null && opts.pts.length > 1) {
    const y = Y(opts.avg);
    svg.appendChild(el('line', {
      x1: padL, y1: y, x2: W - padR, y2: y, stroke: COL.blueL,
      'stroke-width': 1.2, 'stroke-dasharray': '4 4', 'stroke-opacity': 0.55
    }));
    svg.appendChild(el('text', {
      x: W - padR - 2, y: y - 5, fill: COL.blueL,
      'font-size': 9.5, 'text-anchor': 'end', 'fill-opacity': 0.8
    }, 'śr.'));
  }

  const P = opts.pts.map((p) => ({ x: p.x, y: p.y, px: X(p.x), py: Y(p.y) }));

  if (P.length > 1) {
    const d = P.map((p, i) => (i ? 'L' : 'M') + p.px.toFixed(1) + ',' + p.py.toFixed(1)).join(' ');
    const base = padT + ph;
    svg.appendChild(el('path', {
      d: d + ' L' + P[P.length - 1].px.toFixed(1) + ',' + base + ' L' + P[0].px.toFixed(1) + ',' + base + ' Z',
      fill: 'url(#' + gid + ')'
    }));
    svg.appendChild(el('path', {
      d: d, fill: 'none', stroke: COL.blueL, 'stroke-width': 2.4,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }));
  }

  P.forEach((p, i) => {
    const last = i === P.length - 1;
    svg.appendChild(el('circle', {
      cx: p.px, cy: p.py, r: last ? 5 : 4, fill: COL.bg,
      stroke: last ? '#ffffff' : COL.blueL, 'stroke-width': last ? 2.4 : 2
    }));
  });

  // wartości nad punktami — tylko gdy jest ich mało, inaczej robi się bałagan
  if (P.length <= 9) {
    P.forEach((p) => {
      const above = p.py > padT + 14;
      svg.appendChild(el('text', {
        x: Math.min(Math.max(p.px, padL + 12), W - padR - 12),
        y: above ? p.py - 10 : p.py + 16,
        fill: '#e7eef7', 'font-size': 10.5, 'text-anchor': 'middle', 'font-weight': 600
      }, fmt(p.y, 1)));
    });
  }

  host.appendChild(svg);
}

/* ------------------------------------------------------------ render */

function render() {
  renderTop();
  if (activeTab === 'week') renderWeek();
  if (activeTab === 'all') renderAll();
  if (activeTab === 'hist') renderHist();
}

function renderTop() {
  if (!entries.length) {
    $('topKg').textContent = '—';
    $('topSub').textContent = 'Brak wpisów — dodaj pierwsze ważenie';
    return;
  }
  const last = entries[entries.length - 1];
  $('topKg').textContent = fmt(+last.kg);

  const d = parseISO(last.d);
  const today = iso(new Date());
  const when = last.d === today ? 'dzisiaj'
    : last.d === iso(addDays(new Date(), -1)) ? 'wczoraj'
      : DAYS_LONG[dowIndex(d)] + ' ' + fmtDay(d, false);

  const prev = entries.length > 1 ? +entries[entries.length - 2].kg : null;
  const diff = prev == null ? '' : ' · ' + fmtDelta(+last.kg - prev) + ' kg od poprzedniego';
  $('topSub').textContent = 'Ostatnio ' + when + (last.t ? ' o ' + last.t : '') + diff;
}

function entryRow(e, prevKg) {
  const d = parseISO(e.d);
  const li = document.createElement('li');

  const day = document.createElement('span');
  day.className = 'li-day';
  day.textContent = DAYS_LONG[dowIndex(d)] + ' ' + dm(d) + (e.t ? ' · ' + e.t : '');

  const kg = document.createElement('span');
  kg.className = 'li-kg';
  kg.textContent = fmt(+e.kg);

  const diff = document.createElement('span');
  diff.className = 'li-diff ' + (prevKg == null ? 'flat' : deltaClass(+e.kg - prevKg));
  diff.textContent = prevKg == null ? '' : fmtDelta(+e.kg - prevKg);

  li.append(day, kg, diff);

  const del = document.createElement('button');
  del.className = 'del';
  del.type = 'button';
  del.textContent = '✕';
  del.setAttribute('aria-label', 'Usuń wpis');
  del.addEventListener('click', () => removeEntry(e.id));
  li.appendChild(del);

  return li;
}

function renderWeek() {
  const mon = weekCursor;
  const items = entriesOfWeek(mon);
  const thisMon = mondayOf(new Date());
  const groups = weekGroups();

  $('weekLabel').textContent = fmtWeekRange(mon);
  const back = weeksBetween(mon, thisMon);
  $('weekTag').textContent = back === 0 ? 'ten tydzień'
    : back === 1 ? 'poprzedni tydzień'
      : back > 0 ? back + ' tyg. temu' : 'przyszły tydzień';

  $('nextWeek').disabled = mon >= thisMon;
  $('prevWeek').disabled = !groups.length || mon <= groups[0].mon;

  // statystyki tygodnia
  if (items.length) {
    const avg = mean(items.map((e) => +e.kg));
    $('wAvg').textContent = fmtKg(avg);
    $('wCount').textContent = String(items.length);

    const prevG = groups.filter((g) => g.mon < mon).pop();
    const dEl = $('wDelta');
    if (prevG) {
      const diff = avg - prevG.avg;
      dEl.textContent = fmtDelta(diff) + ' kg';
      dEl.className = deltaClass(diff);
    } else {
      dEl.textContent = '—';
      dEl.className = 'flat';
    }
  } else {
    $('wAvg').textContent = '—';
    $('wCount').textContent = '0';
    $('wDelta').textContent = '—';
    $('wDelta').className = 'flat';
  }

  // punkty: dzień tygodnia + rozłożenie kilku ważeń w obrębie jednego dnia
  const byDay = new Map();
  for (const e of items) {
    const i = dowIndex(parseISO(e.d));
    if (!byDay.has(i)) byDay.set(i, []);
    byDay.get(i).push(e);
  }
  const pts = [];
  Array.from(byDay.entries()).sort((a, b) => a[0] - b[0]).forEach((pair) => {
    const i = pair[0], list = pair[1];
    list.forEach((e, j) => pts.push({ x: i + (j + 1) / (list.length + 1), y: +e.kg }));
  });

  const todayIdx = iso(thisMon) === iso(mon) ? dowIndex(new Date()) : -1;
  lineChart($('weekChart'), {
    pts: pts,
    xMin: 0,
    xMax: 7,
    xTicks: DAYS_SHORT.map((l, i) => ({ x: i + 0.5, label: l, strong: i === todayIdx })),
    avg: items.length ? mean(items.map((e) => +e.kg)) : null,
    emptyText: 'Brak ważeń w tym tygodniu',
    aria: 'wykres ważeń w tygodniu'
  });

  const note = $('weekNote');
  if (items.length >= 2) {
    const kgs = items.map((e) => +e.kg);
    const diff = kgs[kgs.length - 1] - kgs[0];
    note.textContent = 'Od pierwszego do ostatniego ważenia: ' + fmtDelta(diff) + ' kg. '
      + 'Najniżej ' + fmtKg(Math.min.apply(null, kgs)) + ', najwyżej ' + fmtKg(Math.max.apply(null, kgs)) + '.';
  } else if (items.length === 1) {
    note.textContent = 'Jedno ważenie — średnia policzy się z tego, co dodasz do niedzieli.';
  } else {
    note.textContent = '';
  }

  // lista ważeń w tygodniu
  const ul = $('weekList');
  ul.textContent = '';
  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Nic tu jeszcze nie ma.';
    ul.appendChild(p);
    return;
  }
  items.forEach((e) => {
    const idx = entries.indexOf(e);
    const prev = idx > 0 ? +entries[idx - 1].kg : null;
    ul.appendChild(entryRow(e, prev));
  });
}

function renderAll() {
  const groups = weekGroups();

  if (!groups.length) {
    lineChart($('allChart'), { pts: [], emptyText: 'Dodaj ważenia, żeby zobaczyć trend' });
    $('allSummary').textContent = '';
    ['sWeeks', 'sChange', 'sRate', 'sTotal', 'sMin', 'sMax', 'sSpan'].forEach((id) => {
      $(id).textContent = (id === 'sWeeks' || id === 'sTotal') ? '0' : '—';
      $(id).className = '';
    });
    return;
  }

  // oś X w realnych tygodniach — pominięty tydzień robi widoczną przerwę
  const first = groups[0].mon;
  const pts = groups.map((g) => ({ x: weeksBetween(first, g.mon), y: g.avg }));
  const maxX = pts[pts.length - 1].x;

  const step = Math.max(1, Math.ceil(groups.length / 6));
  const xTicks = [];
  groups.forEach((g, i) => {
    if (i === groups.length - 1 || i % step === 0) {
      xTicks.push({ x: pts[i].x, label: dm(g.mon), strong: i === groups.length - 1 });
    }
  });

  lineChart($('allChart'), {
    pts: pts,
    xMin: -0.4,
    xMax: maxX + 0.4,
    xTicks: xTicks,
    height: 220,
    aria: 'wykres średnich tygodniowych'
  });

  // krótkie podsumowanie słowne
  const a = groups[0].avg;
  const b = groups[groups.length - 1].avg;
  const change = b - a;
  const spanWeeks = maxX + 1;
  const rate = spanWeeks > 1 ? change / (spanWeeks - 1) : 0;
  const s = $('allSummary');

  if (groups.length === 1) {
    s.innerHTML = 'Masz na razie jeden tydzień: średnia <b>' + fmtKg(a) + '</b>. '
      + 'Dodaj ważenia w kolejnym tygodniu, a pokażę Ci trend.';
  } else if (Math.abs(change) < 0.15) {
    s.innerHTML = 'Przez <b>' + spanWeeks + ' ' + weekWord(spanWeeks) + '</b> waga praktycznie stoi w miejscu ('
      + fmtKg(a) + ' → ' + fmtKg(b) + '). Jeśli miała rosnąć — czas dołożyć jedzenia.';
  } else {
    s.innerHTML = 'Przez <b>' + spanWeeks + ' ' + weekWord(spanWeeks) + '</b> waga '
      + (change > 0 ? 'wzrosła' : 'spadła') + ' o <b>' + fmtKg(Math.abs(change)) + '</b> ('
      + fmtKg(a) + ' → ' + fmtKg(b) + '), czyli średnio <b>' + fmtDelta(rate, 2) + ' kg</b> na tydzień.';
  }

  const all = entries.map((e) => +e.kg);
  const min = Math.min.apply(null, all);
  const max = Math.max.apply(null, all);

  const many = groups.length > 1;
  $('sWeeks').textContent = String(spanWeeks);
  $('sChange').textContent = many ? fmtDelta(change) + ' kg' : '—';
  $('sChange').className = many ? deltaClass(change) : 'flat';
  $('sRate').textContent = many ? fmtDelta(rate, 2) : '—';
  $('sRate').className = many ? deltaClass(rate) : 'flat';
  $('sTotal').textContent = String(entries.length);
  $('sMin').textContent = fmtKg(min);
  $('sMax').textContent = fmtKg(max);
  $('sSpan').textContent = fmtKg(max - min);
}

function renderHist() {
  const host = $('histList');
  host.textContent = '';
  const groups = weekGroups();

  if (!groups.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Brak wpisów.';
    host.appendChild(p);
    return;
  }

  const thisMon = iso(mondayOf(new Date()));

  groups.slice().reverse().forEach((g) => {
    const i = groups.indexOf(g);
    const prev = i > 0 ? groups[i - 1] : null;

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'wrow' + (iso(g.mon) === thisMon ? ' is-now' : '');
    row.title = 'Pokaż ważenia z tego tygodnia';

    const left = document.createElement('span');
    left.className = 'wrow-side';
    const range = document.createElement('b');
    range.textContent = fmtWeekRange(g.mon);
    const count = document.createElement('small');
    count.textContent = g.items.length + ' ' + weighWord(g.items.length);
    left.append(range, count);

    const right = document.createElement('span');
    right.className = 'wrow-side wrow-num';
    const avg = document.createElement('b');
    avg.textContent = fmtKg(g.avg);
    const delta = document.createElement('small');
    if (prev) {
      const d = g.avg - prev.avg;
      delta.textContent = fmtDelta(d) + ' kg';
      delta.className = deltaClass(d);
    } else {
      delta.textContent = 'start';
      delta.className = 'flat';
    }
    right.append(avg, delta);

    row.append(left, right);
    row.addEventListener('click', () => {
      weekCursor = new Date(g.mon);
      switchTab('week');
    });
    host.appendChild(row);
  });
}

/* ------------------------------------------------------------ akcje */

function flash(node, text, isErr) {
  node.textContent = text;
  node.className = 'msg' + (isErr ? ' err' : '');
  node.hidden = false;
  clearTimeout(node._t);
  node._t = setTimeout(() => { node.hidden = true; }, 3500);
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function addEntry() {
  const msg = $('addMsg');
  const raw = $('kg').value.trim().replace(',', '.');
  const kg = parseFloat(raw);

  if (!raw || !Number.isFinite(kg)) return flash(msg, 'Wpisz wagę, np. 72,4', true);
  if (kg < 20 || kg > 400) return flash(msg, 'Waga poza zakresem 20–400 kg', true);

  const d = $('date').value || iso(new Date());
  const t = $('time').value || new Date().toTimeString().slice(0, 5);

  // ochrona przed literówką
  if (entries.length) {
    const last = +entries[entries.length - 1].kg;
    if (Math.abs(kg - last) > 5 && !confirm(
      fmt(kg) + ' kg to ' + fmtDelta(kg - last) + ' kg względem ostatniego wpisu ('
      + fmt(last) + ' kg). Na pewno?')) return;
  }

  entries.push({ id: newId(), d: d, t: t, kg: +kg.toFixed(2) });
  entries.sort(byDate);

  if (!save()) return flash(msg, 'Nie udało się zapisać (tryb prywatny?)', true);

  $('kg').value = '';
  $('kg').blur();
  weekCursor = mondayOf(parseISO(d));
  resetWhen();
  render();
  flash(msg, 'Zapisane: ' + fmtKg(kg));
}

function removeEntry(id) {
  const e = entries.find((x) => x.id === id);
  if (!e) return;
  if (!confirm('Usunąć wpis ' + fmtKg(+e.kg) + ' z ' + e.d + '?')) return;
  entries = entries.filter((x) => x.id !== id);
  save();
  render();
}

function resetWhen() {
  $('date').value = iso(new Date());
  $('time').value = new Date().toTimeString().slice(0, 5);
  document.querySelector('.when').open = false;
}

function exportData() {
  const blob = new Blob([JSON.stringify({ app: 'waga', version: 1, entries: entries }, null, 2)],
    { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'waga-' + iso(new Date()) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  flash($('backupMsg'), 'Zapisano kopię ' + entries.length + ' wpisów');
}

function importData(file) {
  const msg = $('backupMsg');
  const fr = new FileReader();
  fr.onload = () => {
    let incoming;
    try {
      const data = JSON.parse(String(fr.result));
      incoming = (Array.isArray(data) ? data : (data.entries || [])).filter(valid);
    } catch (err) {
      return flash(msg, 'Nie udało się odczytać pliku', true);
    }
    if (!incoming.length) return flash(msg, 'W pliku nie ma wpisów', true);

    const merge = entries.length ? confirm(
      'Plik ma ' + incoming.length + ' wpisów.\n\nOK = dołącz do obecnych ' + entries.length
      + '\nAnuluj = zastąp wszystko') : true;

    if (merge) {
      const seen = new Set(entries.map((e) => e.d + (e.t || '') + e.kg));
      let added = 0;
      for (const e of incoming) {
        const k = e.d + (e.t || '') + e.kg;
        if (seen.has(k)) continue;
        seen.add(k);
        entries.push({ id: e.id || newId(), d: e.d, t: e.t || '', kg: +e.kg });
        added++;
      }
      entries.sort(byDate);
      save();
      render();
      flash(msg, 'Dodano ' + added + ' nowych wpisów');
    } else {
      entries = incoming.map((e) => ({ id: e.id || newId(), d: e.d, t: e.t || '', kg: +e.kg })).sort(byDate);
      save();
      render();
      flash(msg, 'Wczytano ' + entries.length + ' wpisów');
    }
  };
  fr.readAsText(file);
}

/* ------------------------------------------------------------ start */

function switchTab(name) {
  activeTab = name;
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === name));
  document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.id !== 'panel-' + name; });
  render();
}

function init() {
  $('ver').textContent = VERSION;
  resetWhen();

  $('addBtn').addEventListener('click', addEntry);
  $('kg').addEventListener('keydown', (e) => { if (e.key === 'Enter') addEntry(); });
  $('nowBtn').addEventListener('click', resetWhen);

  $('prevWeek').addEventListener('click', () => { weekCursor = addDays(weekCursor, -7); renderWeek(); });
  $('nextWeek').addEventListener('click', () => { weekCursor = addDays(weekCursor, 7); renderWeek(); });

  document.querySelectorAll('.tab').forEach((b) =>
    b.addEventListener('click', () => switchTab(b.dataset.tab)));

  $('exportBtn').addEventListener('click', exportData);
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });

  // wykresy rysowane w pikselach, więc po zmianie szerokości trzeba je przerysować
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(render, 150); });

  render();

  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}

init();
