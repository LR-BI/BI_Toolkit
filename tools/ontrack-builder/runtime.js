/* Ontrack Page Builder runtime. The builder copies this function's source into the
   generated <script> and calls it with CFG and RULES. Plain ES5 + DOM, no jQuery needed. */
window.OTB_RUNTIME = function (CFG, RULES) {
  'use strict';
  var KEY = 'bitk_' + CFG.id;
  if (window[KEY]) { window[KEY].apply(); return; }       // CustomHTML re-rendered: just re-run
  var HERE = document.currentScript, done = {}, busy = false, timer = null;
  function log() { if (CFG.debug && window.console) console.log.apply(console, ['[' + CFG.name + ']'].concat([].slice.call(arguments))); }
  function qa(s, r) { try { return [].slice.call((r || document).querySelectorAll(s)); } catch (e) { log('bad selector', s); return []; } }
  function low(x) { return String(x == null ? '' : x).trim().toLowerCase(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // ---- fields: EBS inputs have no id; match the end of their name ----
  function sel(f) {
    var p = String(f).split('.'), fld = p.pop(), dl = p.length ? p[0] : CFG.dl;
    return { fld: fld, t: (dl ? 'DataLinks[' + dl + '].Data[' + CFG.row + '].' : '') + 'Items[' + fld + ']' };
  }
  function inputs(f) { return qa('[name$="' + sel(f).t + '.Value"]:not([type="hidden"])'); }
  function input(f) { return inputs(f)[0] || null; }
  function twin(f) { return qa('[name$="' + sel(f).t + '.OriginalItem.Value"]')[0] || null; }
  function disp(f) { return qa('[id*="_Items_' + sel(f).fld + '__Value_"][id$="_DISP"]')[0] || null; }
  function get(f) {
    var a = inputs(f), i = a[0];
    if (i) {
      if (i.type === 'radio') { var c = a.filter(function (x) { return x.checked; })[0]; return c ? c.value : ''; }
      if (i.type === 'checkbox') return i.checked ? 'Y' : 'N';
      return String(i.value == null ? '' : i.value).trim();
    }
    var d = disp(f); return d ? d.textContent.trim() : '';
  }
  function fire(i) { ['input', 'change'].forEach(function (t) { i.dispatchEvent(new Event(t, { bubbles: true })); }); }
  function set(f, v) {
    var a = inputs(f), i = a[0]; v = v == null ? '' : String(v);
    if (!i) { log('no editable input for', f); return false; }
    if (i.type === 'radio') { a.forEach(function (x) { x.checked = low(x.value) === low(v); }); fire(i); return true; }
    if (i.type === 'checkbox') { i.checked = /^(y|yes|1|true)$/i.test(v); fire(i); return true; }
    if (i.tagName === 'SELECT' && v !== '' && ![].some.call(i.options, function (o) { return o.value === v; })) {
      var o = [].filter.call(i.options, function (o) { return low(o.text) === low(v); })[0];
      if (!o) { log('no option', v, 'in', f); return false; } v = o.value;
    }
    i.value = v; fire(i); return true;
  }
  function box(f) {
    var e = input(f) || disp(f); if (!e) return null;
    if (CFG.box && e.closest) { var b = e.closest(CFG.box); if (b) return b; }
    for (var x = e.parentElement, n = 0; x && n < 5 && x !== document.body; x = x.parentElement, n++) if (x.querySelector('label')) return x;
    return e.parentElement;
  }
  function shown(f) { var b = box(f); return !!b && b.offsetParent !== null; }

  // ---- dates and ages ----
  var MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  function mk(y, m, d) { if (y < 100) y += y > 50 ? 1900 : 2000; var x = new Date(y, m, d); return x.getMonth() === m && x.getDate() === d ? x : null; }
  function date(s) {
    if (s instanceof Date) return s; s = String(s || '').trim(); var m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return mk(+m[1], m[2] - 1, +m[3]);
    if ((m = /^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2,4})/.exec(s))) return mk(+m[3], m[2] - 1, +m[1]);
    if ((m = /^(\d{1,2})[\-\s]([A-Za-z]{3})[A-Za-z]*[\-\s](\d{2,4})/.exec(s)) && MON[m[2].toLowerCase()] != null) return mk(+m[3], MON[m[2].toLowerCase()], +m[1]);
    return null;
  }
  function midnight() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function fmt(d) {
    if (!d) return '';
    if (CFG.datefmt === 'iso') return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    if (CFG.datefmt === 'mon') return pad(d.getDate()) + '-' + 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[d.getMonth()] + '-' + d.getFullYear();
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
  }
  function today() { return fmt(midnight()); }
  // Age on 31 August at the start of the current academic year (ILR rule)
  function age(dob) {
    var d = date(dob); if (!d) return null;
    var n = new Date(), y = n.getMonth() >= 7 ? n.getFullYear() : n.getFullYear() - 1, a = y - d.getFullYear();
    if (d.getMonth() > 7) a--;                                // birthday falls after 31 August
    return a;
  }
  function num(x) { var n = parseFloat(String(x).replace(/[,£\s]/g, '')); return isNaN(n) ? 0 : n; }
  function v(f) { var x = get(f); return x !== '' && !isNaN(+x) ? +x : x; }   // used by expressions

  // ---- conditions ----
  function range(s) {
    var m = /^\s*(-?[\d.]+)\s*(?:-|to)\s*(-?[\d.]+)\s*$/.exec(s); if (m) return [+m[1], +m[2]];
    m = /^\s*(-?[\d.]+)\s*\+\s*$/.exec(s); if (m) return [+m[1], Infinity];
    var n = parseFloat(s); return [n, n];
  }
  function list(s) { return String(s).split(',').map(low).filter(function (x) { return x !== ''; }); }
  function cmp(x, y) {
    if (x !== '' && y !== '' && !isNaN(+x) && !isNaN(+y)) return +x - +y;
    var a = date(x), b = date(y); if (a && b) return a - b;
    return low(x) < low(y) ? -1 : low(x) > low(y) ? 1 : 0;
  }
  function test(x, op, val) {
    val = val == null ? '' : String(val);
    switch (op) {
      case 'is': return low(x) === low(val);
      case 'not': return low(x) !== low(val);
      case 'blank': return x === '';
      case 'filled': return x !== '';
      case 'in': return list(val).indexOf(low(x)) >= 0;
      case 'notin': return list(val).indexOf(low(x)) < 0;
      case 'has': return low(x).indexOf(low(val)) >= 0;
      case 'gt': return x !== '' && cmp(x, val) > 0;
      case 'lt': return x !== '' && cmp(x, val) < 0;
      case 'age': var a = age(x), r = range(val); return a != null && a >= r[0] && a <= r[1];
      case 'future': var d = date(x); return !!d && d > midnight();
      case 'past': var p = date(x); return !!p && p < midnight();
    }
    return false;
  }
  function ok(r) {
    if (!r.when || !r.when.length) return true;
    var t = function (c) { return test(get(c.f), c.op, c.v); };
    return r.any ? r.when.some(t) : r.when.every(t);
  }

  // ---- format checks (blank passes; use "Required" for blanks) ----
  var CHECK = {
    uln: function (s) { s = s.replace(/\s/g, ''); if (s === '9999999999') return true; if (!/^[1-9]\d{9}$/.test(s)) return false; var t = 0; for (var i = 0; i < 9; i++) t += +s[i] * (10 - i); var r = t % 11; return r !== 0 && 10 - r === +s[9]; },
    ni: function (s) { return /^(?!BG|GB|KN|NK|NT|TN|ZZ)[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\d{6}[A-D]$/.test(s.replace(/\s/g, '').toUpperCase()); },
    postcode: function (s) { return /^[A-Z]{1,2}\d[A-Z\d]? ?\d[ABD-HJLNP-UW-Z]{2}$/i.test(s); },
    email: function (s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s); },
    phone: function (s) { return /^(\+44\s?|0)\d[\d\s]{8,12}$/.test(s); },
    date: function (s) { return !!date(s); },
    notfuture: function (s) { var d = date(s); return !!d && d <= midnight(); },
    range: function (s, a) { var r = range(a), n = parseFloat(s); return !isNaN(n) && n >= r[0] && n <= r[1]; },
    maxlen: function (s, a) { return s.length <= +a; },
    regex: function (s, a) { try { return new RegExp(a).test(s); } catch (e) { return true; } }
  };
  function bad(r) { var x = get(r.field); return x !== '' && ok(r) && CHECK[r.check] && !CHECK[r.check](x, r.arg); }

  // ---- bits of UI ----
  function css() {
    if (document.getElementById('bitk-css')) return;
    var s = document.createElement('style'); s.id = 'bitk-css';
    s.textContent = '.bitk-need{border-left:3px solid #522fb6 !important}.bitk-bad{outline:2px solid #c0392b !important}' +
      '.bitk-msg{display:block;color:#a32d2d;font-size:12px;margin-top:2px}.bitk-lock{background:#f1eff7 !important;color:#555 !important}' +
      '.bitk-banner{padding:8px 12px;border-radius:6px;margin:8px 0;border-left:4px solid}.bitk-info{background:#eeeaff;border-color:#765de5;color:#2e176d}' +
      '.bitk-warn{background:#fff3d6;border-color:#d39b16;color:#633806}.bitk-badb{background:#fde4e4;border-color:#c0392b;color:#7a1f1f}.bitk-good{background:#e1f4e8;border-color:#2e8b57;color:#1d5236}' +
      '.bitk-btn{margin:6px 6px 6px 0}.bitk-toast{position:fixed;right:16px;bottom:16px;z-index:99999;max-width:420px;padding:10px 14px;border-radius:8px;box-shadow:0 4px 18px rgba(0,0,0,.2);font-size:14px;cursor:pointer}' +
      '.bitk-toast ul{margin:6px 0 0;padding-left:18px}' +
      '.bitk-g-green,.bitk-g-green>td{background:#d9f2e3 !important}.bitk-g-amber,.bitk-g-amber>td{background:#fff1cc !important}' +
      '.bitk-g-red,.bitk-g-red>td{background:#fbdada !important}.bitk-g-purple,.bitk-g-purple>td{background:#e9e3ff !important}.bitk-g-bold,.bitk-g-bold>td{font-weight:700 !important}';
    (document.head || document.documentElement).appendChild(s);
  }
  function toast(msg, tone, items, stay) {
    var t = document.querySelector('.bitk-toast'); if (t) t.remove();
    t = document.createElement('div'); t.className = 'bitk-toast bitk-' + (tone === 'bad' ? 'badb' : tone || 'info'); t.textContent = msg;
    if (items && items.length) { var u = document.createElement('ul'); items.forEach(function (x) { var li = document.createElement('li'); li.textContent = x; u.appendChild(li); }); t.appendChild(u); }
    t.title = 'Click to close'; t.addEventListener('click', function () { t.remove(); });
    document.body.appendChild(t); if (!stay) setTimeout(function () { t.remove(); }, 6000);
  }
  function fill(s, enc) { return String(s).replace(/\{([\w.]+)\}/g, function (m, f) { var x = get(f); return enc ? encodeURIComponent(x) : x; }); }
  function place(node, r) {
    if (node.parentNode) return;
    var b = r.place === 'field' && r.at ? box(r.at) : null;
    if (b) { b.parentNode.insertBefore(node, b.nextSibling); return; }
    if (r.place === 'field') return;                       // field not on the page (yet)
    if (HERE && HERE.parentNode) { HERE.parentNode.insertBefore(node, HERE); return; }
    var f = document.querySelector('form') || document.body; f.insertBefore(node, f.firstChild);
  }
  function mine(i, kind) { return document.querySelector('[data-bitk="' + CFG.id + '-' + i + kind + '"]'); }
  function tag(n, i, kind) { n.setAttribute('data-bitk', CFG.id + '-' + i + kind); return n; }

  // ---- the rules ----
  var DO = {
    'default': function (r, i) {
      if (done[i] || !input(r.field)) return;
      if (get(r.field) !== '') { done[i] = 1; return; }
      var tw = twin(r.field); if (r.onlyNew && tw && String(tw.value).trim() !== '') { done[i] = 1; return; }
      if (!ok(r)) return;
      var val = r.fn ? r.fn(H) : r.value;
      if (val == null || val === '') return;
      if (set(r.field, val)) { done[i] = 1; log('default', r.field, '=', val); }
    },
    computed: function (r) {
      if (!ok(r) || !input(r.field) || (r.onlyBlank && get(r.field) !== '')) return;
      var val; try { val = r.fn(H); } catch (e) { log('formula error', e); return; }
      if (typeof val === 'number') val = isFinite(val) ? String(Math.round(val * 1e6) / 1e6) : '';
      if (val instanceof Date) val = fmt(val);
      if (val != null && String(val) !== get(r.field)) set(r.field, val);
    },
    showhide: function (r) {
      var c = ok(r), show = r.mode === 'show' ? c : !c;
      r.fields.forEach(function (f) {
        var b = box(f); if (!b) return;
        if (show) { if (b.getAttribute('data-bitk-hid')) { b.style.display = ''; b.removeAttribute('data-bitk-hid'); } }
        else { if (!b.getAttribute('data-bitk-hid')) { b.style.display = 'none'; b.setAttribute('data-bitk-hid', '1'); } if (r.clear && get(f) !== '' && input(f)) set(f, ''); }
      });
    },
    required: function (r) { var c = ok(r); r.fields.forEach(function (f) { var i = input(f); if (i) i.classList.toggle('bitk-need', c); }); },
    lock: function (r) {
      var c = ok(r);
      r.fields.forEach(function (f) {
        inputs(f).forEach(function (i) {
          if (c && !i.getAttribute('data-bitk-lock')) {
            i.setAttribute('data-bitk-lock', '1'); i.classList.add('bitk-lock');
            if (/^(text|textarea|number|email|tel|date)/i.test(i.type || i.tagName)) i.readOnly = true;
            else { i.style.pointerEvents = 'none'; i.tabIndex = -1; i.setAttribute('aria-disabled', 'true'); }
          } else if (!c && i.getAttribute('data-bitk-lock')) {
            i.removeAttribute('data-bitk-lock'); i.classList.remove('bitk-lock'); i.readOnly = false; i.style.pointerEvents = ''; i.removeAttribute('tabindex'); i.removeAttribute('aria-disabled');
          }
        });
      });
    },
    validate: function (r, i) {
      var inp = input(r.field); if (!inp) return;
      var m = mine(i, 'v'), b = bad(r);
      inp.classList.toggle('bitk-bad', b);
      if (b && !m) { m = tag(document.createElement('span'), i, 'v'); m.className = 'bitk-msg'; m.textContent = r.msg; inp.parentNode.insertBefore(m, inp.nextSibling); }
      if (!b && m) m.remove();
    },
    grid: function (r) {
      qa(r.grid).forEach(function (g) {
        var idx = -1;
        qa('th', g).forEach(function (th) { if (idx < 0 && low(th.textContent) === low(r.col)) idx = [].indexOf.call(th.parentNode.children, th); });
        if (idx < 0) { log('column not found:', r.col); return; }
        qa('tbody tr', g).forEach(function (tr) {
          var td = tr.children[idx]; if (!td) return;
          var hit = test(td.textContent.trim(), r.op, r.v), el = r.row ? tr : td, cls = 'bitk-g-' + r.tone;
          el.classList.toggle(cls, hit);
        });
      });
    },
    banner: function (r, i) {
      var m = mine(i, 'b'), c = ok(r);
      if (!c) { if (m) m.style.display = 'none'; return; }
      if (!m) { m = tag(document.createElement('div'), i, 'b'); m.className = 'bitk-banner bitk-' + (r.tone === 'bad' ? 'badb' : r.tone); }
      place(m, r); m.style.display = ''; var t = fill(r.text); if (m.textContent !== t) m.textContent = t;
    },
    button: function (r, i) {
      var m = mine(i, 'k'), c = ok(r);
      if (!m) {
        m = tag(document.createElement('button'), i, 'k'); m.type = 'button'; m.className = 'bitk-btn ' + (CFG.btnClass || ''); m.textContent = r.label;
        m.addEventListener('click', function (e) {
          e.preventDefault();
          if (r.action === 'set') { set(r.a1, fill(r.a2)); apply(); }
          else if (r.action === 'click') { var b = document.querySelector(r.a1); if (b) b.click(); else toast('Button not found: ' + r.a1, 'bad'); }
          else if (r.action === 'url') window.open(fill(r.a1, true), r.a2 === 'same' ? '_self' : '_blank');
          else if (r.fn) r.fn(H);
        });
      }
      place(m, r); m.style.display = c ? '' : 'none';
    }
  };
  function apply() {
    if (busy) return; busy = true;
    try { RULES.forEach(function (r, i) { if (r.off || !DO[r.t]) return; try { DO[r.t](r, i); } catch (e) { log('rule', i + 1, 'failed', e); } }); }
    finally { busy = false; if (obs) obs.takeRecords(); }
  }
  function soon() { clearTimeout(timer); timer = setTimeout(apply, 120); }

  // ---- block save while something is missing or wrong ----
  function problems() {
    var out = [];
    RULES.forEach(function (r) {
      if (r.off) return;
      if (r.t === 'required' && ok(r)) r.fields.forEach(function (f) { if ((input(f) || disp(f)) && shown(f) && get(f) === '') out.push(r.msg ? fill(r.msg) : f + ' is required'); });
      if (r.t === 'validate' && shown(r.field) && bad(r)) out.push(r.msg);
    });
    return out.filter(function (x, i) { return out.indexOf(x) === i; });
  }
  function isSave(el) {
    if (!el || !el.closest) return null;
    if (CFG.saveSel) return el.closest(CFG.saveSel);
    var b = el.closest('button, input[type="submit"], input[type="button"], a');
    if (!b) return null;
    var t = (b.textContent || '') + ' ' + (b.value || '') + ' ' + (b.title || '') + ' ' + (b.id || '');
    return new RegExp(CFG.saveWords || 'save', 'i').test(t) ? b : null;
  }
  function guard(e) {
    if (e.type === 'click' && !isSave(e.target)) return;
    var p = problems(); if (!p.length) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    apply(); toast('Not saved yet. Please fix:', 'bad', p, true);
  }

  // ---- after save: watch ajax responses ----
  function afterAjax(url, status, method) {
    soon();
    if (status < 200 || status >= 300) return;
    RULES.forEach(function (r, i) {
      if (r.off || r.t !== 'aftersave' || !r.url || low(url).indexOf(low(r.url)) < 0) return;
      if (r.postOnly && /^get$/i.test(method || 'GET')) return;
      if (r.later) { try { sessionStorage.setItem(KEY + '.next', JSON.stringify({ i: i, at: Date.now() })); } catch (e) {} log('after save: queued for next page load', i + 1); return; }
      runAfter(r);
    });
  }
  function runAfter(r) {
    log('after save', r.action, r.arg);
    if (r.action === 'message') toast(fill(r.arg), 'good');
    else if (r.action === 'click') setTimeout(function () { var b = document.querySelector(r.arg); if (b) b.click(); else toast('Button not found: ' + r.arg, 'bad'); }, 300);
    else if (r.action === 'reload') location.reload();
    else if (r.action === 'goto') location.href = fill(r.arg, true);
  }
  function hookAjax() {
    var H = window.__bitkAjax = window.__bitkAjax || [];
    H.push(afterAjax);
    if (H.length > 1) return;                               // already hooked by another page script
    var X = window.XMLHttpRequest.prototype, open = X.open, send = X.send;
    X.open = function (m, u) { this.__bm = m; this.__bu = u; return open.apply(this, arguments); };
    X.send = function () { var x = this; x.addEventListener('loadend', function () { H.forEach(function (cb) { try { cb(String(x.__bu || ''), x.status, x.__bm); } catch (e) {} }); }); return send.apply(this, arguments); };
    if (window.fetch) {
      var f = window.fetch;
      window.fetch = function (i, o) { var u = typeof i === 'string' ? i : (i && i.url) || '', m = (o && o.method) || (i && i.method) || 'GET';
        return f.apply(this, arguments).then(function (res) { H.forEach(function (cb) { try { cb(u, res.status, m); } catch (e) {} }); return res; }); };
    }
  }

  var H = { v: v, get: get, set: set, age: age, today: today, date: date, num: num, fmt: fmt, toast: toast, apply: apply };

  // ---- start ----
  var obs = null;
  function start() {
    css(); apply();
    document.addEventListener('change', soon, true);
    document.addEventListener('input', soon, true);
    document.addEventListener('click', guard, true);
    document.addEventListener('submit', guard, true);
    if (window.MutationObserver) {
      obs = new MutationObserver(function (ms) {
        if (ms.some(function (m) { return !(m.target.closest && m.target.closest('[data-bitk],.bitk-toast')); })) soon();
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
    hookAjax();
    try {
      var n = JSON.parse(sessionStorage.getItem(KEY + '.next') || 'null');
      if (n) { sessionStorage.removeItem(KEY + '.next'); if (Date.now() - n.at < 120000 && RULES[n.i]) setTimeout(function () { runAfter(RULES[n.i]); }, 500); }
    } catch (e) {}
    log('ready:', RULES.length, 'rules');
  }
  window[KEY] = { get: get, set: set, apply: apply, problems: problems, age: age, rules: RULES, cfg: CFG };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
};
