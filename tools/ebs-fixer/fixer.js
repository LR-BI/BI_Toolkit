// EBS Validator Fixer: rewrites constructs EBS Central's query validator rejects.
//   OUTER / CROSS APPLY (SELECT ...)  -> scalar subqueries (method "scalar") or a derived-table join (method "join")
//   STRING_AGG(expr, sep)             -> STUFF((SELECT sep + expr ... FOR XML PATH(''), TYPE).value(...), 1, n, '')
// EBSFix.analyse(sql)              -> [{ kind, at, alias, title, methods }]
// EBSFix.fix(sql, { methods: { "apply:<n>": "scalar"|"join" } }) -> { sql, changes, problems }
(function (root) {
  var KW = {};
  ("SELECT FROM WHERE GROUP BY HAVING ORDER JOIN INNER LEFT RIGHT FULL OUTER CROSS APPLY ON AND OR NOT IN IS NULL AS CASE WHEN THEN ELSE END " +
   "UNION ALL EXCEPT INTERSECT DISTINCT TOP PERCENT WITH TIES INTO INSERT UPDATE DELETE SET VALUES DECLARE EXISTS BETWEEN LIKE OVER PARTITION " +
   "OPTION FOR XML PATH TYPE BEGIN IF WHILE RETURN EXEC EXECUTE GO USE ASC DESC NOLOCK WITHIN OFFSET FETCH NEXT ROWS ONLY PIVOT UNPIVOT").split(" ").forEach(function (w) { KW[w] = 1; });
  var AGG = { COUNT: 1, COUNT_BIG: 1, SUM: 1, AVG: 1, MIN: 1, MAX: 1, STRING_AGG: 1, STDEV: 1, VAR: 1 };
  var STMT = { INSERT: 1, UPDATE: 1, DELETE: 1, DECLARE: 1, SET: 1, IF: 1, WHILE: 1, BEGIN: 1, END: 1, EXEC: 1, EXECUTE: 1, GO: 1, RETURN: 1, PRINT: 1, MERGE: 1, TRUNCATE: 1, CREATE: 1, ALTER: 1, DROP: 1 };

  // ---------- tokenizer (keeps every character, so slices of the source stay exact) ----------
  function tokenize(s) {
    var T = [], i = 0, n = s.length;
    function push(t, st, en) { var v = s.slice(st, en); T.push({ t: t, v: v, u: v.toUpperCase(), s: st, e: en }); }
    while (i < n) {
      var c = s[i], st = i;
      if (/\s/.test(c)) { while (i < n && /\s/.test(s[i])) i++; push("ws", st, i); continue; }
      if (c === "-" && s[i + 1] === "-") { while (i < n && s[i] !== "\n") i++; push("com", st, i); continue; }
      if (c === "/" && s[i + 1] === "*") { var d = 1; i += 2; while (i < n && d) { if (s[i] === "/" && s[i + 1] === "*") { d++; i += 2; } else if (s[i] === "*" && s[i + 1] === "/") { d--; i += 2; } else i++; } push("com", st, i); continue; }
      if (c === "'" || ((c === "N" || c === "n") && s[i + 1] === "'")) { i += c === "'" ? 1 : 2; while (i < n) { if (s[i] === "'") { if (s[i + 1] === "'") { i += 2; continue; } i++; break; } i++; } push("str", st, i); continue; }
      if (c === "[") { i++; while (i < n && s[i] !== "]") i++; i++; push("id", st, i); continue; }
      if (c === '"') { i++; while (i < n && s[i] !== '"') i++; i++; push("id", st, i); continue; }
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(s[i + 1] || ""))) { while (i < n && /[0-9.eE]/.test(s[i])) i++; push("num", st, i); continue; }
      if (/[A-Za-z_@#]/.test(c)) { while (i < n && /[A-Za-z0-9_@#$]/.test(s[i])) i++; push(c === "@" ? "var" : "word", st, i); continue; }
      var two = s.substr(i, 2);
      if (/^(<=|>=|<>|!=|!<|!>|\+=|-=|\*=|\/=)$/.test(two)) { i += 2; push("op", st, i); continue; }
      i++; push("op", st, i);
    }
    return T;
  }
  // Index of significant (non-space, non-comment) tokens, with matching brackets.
  function sig(s) {
    var all = tokenize(s), T = all.filter(function (t) { return t.t !== "ws" && t.t !== "com"; }), M = {}, st = [];
    T.forEach(function (t, k) { if (t.v === "(") st.push(k); else if (t.v === ")" && st.length) { var o = st.pop(); M[o] = k; M[k] = o; } });
    return { T: T, M: M, src: s };
  }
  function W(T, i) { return T[i] && T[i].t === "word" ? T[i].u : ""; }
  function V(T, i) { return T[i] && T[i].t === "op" ? T[i].v : ""; }
  function isName(T, i) { var t = T[i]; return !!t && (t.t === "id" || (t.t === "word" && !KW[t.u])); }
  function bare(name) { return name.replace(/^\[|\]$/g, "").replace(/^"|"$/g, "").toUpperCase(); }
  function txt(P, a, b) { return a > b ? "" : P.src.slice(P.T[a].s, P.T[b].e); }

  // Find the SELECT block (same bracket level) that contains token k.
  function blockAt(P, k) {
    var T = P.T, M = P.M, open = -1;
    for (var j = k - 1; j >= 0; j--) { if (V(T, j) === ")" && M[j] !== undefined) { j = M[j]; continue; } if (V(T, j) === "(") { open = j; break; } }
    var lo = open + 1, hi = open >= 0 && M[open] !== undefined ? M[open] - 1 : T.length - 1;
    // start: last SELECT at this level before k (skipping a leading WITH ... AS (...) list)
    var sel = -1;
    for (j = k; j >= lo; j--) { if (V(T, j) === ")" && M[j] !== undefined) { j = M[j]; continue; } if (W(T, j) === "SELECT") { sel = j; break; } }
    if (sel < 0) return null;
    var end = hi, cd = 0;
    for (j = sel + 1; j <= hi; j++) {
      if (V(T, j) === "(" && M[j] !== undefined) { j = M[j]; continue; }
      var u = W(T, j);
      if (u === "CASE") cd++; else if (u === "END" && cd) { cd--; continue; }
      if (V(T, j) === ";" || u === "UNION" || u === "EXCEPT" || u === "INTERSECT" || (STMT[u] && !(u === "END" && cd)) || (u === "SELECT" && j > k) || (u === "WITH" && V(T, j + 1) !== "(" && j > k)) { end = j - 1; break; }
    }
    var b = { sel: sel, end: end, open: open, cl: {} };
    for (j = sel + 1; j <= end; j++) {
      if (V(T, j) === "(" && M[j] !== undefined) { j = M[j]; continue; }
      var w = W(T, j);
      if (w === "CASE") { cd++; continue; } if (w === "END" && cd) { cd--; continue; }
      if (w === "FROM" && b.cl.FROM === undefined) b.cl.FROM = j;
      else if (w === "WHERE" && b.cl.WHERE === undefined) b.cl.WHERE = j;
      else if (w === "GROUP" && W(T, j + 1) === "BY" && b.cl.GROUP === undefined) b.cl.GROUP = j;
      else if (w === "HAVING" && b.cl.HAVING === undefined) b.cl.HAVING = j;
      else if (w === "ORDER" && W(T, j + 1) === "BY" && b.cl.ORDER === undefined) b.cl.ORDER = j;
      else if (w === "OPTION" && b.cl.OPTION === undefined) b.cl.OPTION = j;
      else if (w === "FOR" && /^(XML|JSON)$/.test(W(T, j + 1)) && b.cl.FOR === undefined) b.cl.FOR = j;
    }
    function nextAfter(c) { var best = b.end + 1; Object.keys(b.cl).forEach(function (x) { if (b.cl[x] > c && b.cl[x] < best) best = b.cl[x]; }); return best; }
    b.range = function (name) { var at = b.cl[name]; if (at === undefined) return null; var from = at + (name === "GROUP" || name === "ORDER" ? 2 : 1); return [from, nextAfter(at) - 1]; };
    var sl = sel + 1; if (W(T, sl) === "DISTINCT" || W(T, sl) === "ALL") sl++;
    if (W(T, sl) === "TOP") { b.top = { at: sl }; sl++; if (V(T, sl) === "(" && M[sl] !== undefined) { b.top.n = txt(P, sl + 1, M[sl] - 1).trim(); sl = M[sl] + 1; } else { b.top.n = T[sl] ? T[sl].v : ""; sl++; } if (W(T, sl) === "PERCENT") { b.top.pct = true; sl++; } if (W(T, sl) === "WITH" && W(T, sl + 1) === "TIES") { b.top.ties = true; sl += 2; } }
    b.ls = sl; b.le = nextAfter(sel) - 1;
    return b;
  }
  function split(P, a, b, sepWord) { // top-level split on "," (default) or a keyword like AND
    var T = P.T, M = P.M, out = [], st = a, cd = 0;
    for (var j = a; j <= b + 1; j++) {
      if (j <= b && V(T, j) === "(" && M[j] !== undefined) { j = M[j]; continue; }
      if (j <= b && W(T, j) === "CASE") cd++; if (j <= b && W(T, j) === "END" && cd) cd--;
      if (j <= b && W(T, j) === "BETWEEN") { var k2 = j + 1; while (k2 <= b && W(T, k2) !== "AND") k2++; j = k2; continue; }
      var hit = j > b || (cd === 0 && (sepWord ? W(T, j) === sepWord : V(T, j) === ","));
      if (hit) { if (j - 1 >= st) out.push([st, j - 1]); st = j + 1; }
    }
    return out;
  }
  function hasTopLevel(P, a, b, word) { var T = P.T, M = P.M; for (var j = a; j <= b; j++) { if (V(T, j) === "(" && M[j] !== undefined) { j = M[j]; continue; } if (W(T, j) === word) return true; } return false; }
  // Tables / aliases declared in a FROM range
  function fromItems(P, a, b) {
    var T = P.T, M = P.M, items = [], k = a;
    function read(p) {
      var o = { at: p, alias: "", name: "", kind: "table" }, q = p;
      if (V(T, q) === "(" && M[q] !== undefined) { o.kind = "derived"; q = M[q] + 1; }
      else if (isName(T, q) || (T[q] && T[q].t === "var")) { o.nameStart = q; while (V(T, q + 1) === "." && T[q + 2]) q += 2; o.name = bare(T[q].v); o.nameRaw = T[q].v.replace(/^\[|\]$/g, ""); o.nameEnd = q; q++; if (V(T, q) === "(" && M[q] !== undefined) { o.kind = "function"; q = M[q] + 1; } }
      else return null;
      if (W(T, q) === "AS") q++;
      if (isName(T, q) && !/^(ON|JOIN|INNER|LEFT|RIGHT|FULL|CROSS|OUTER|WHERE|GROUP|ORDER|HAVING|WITH|APPLY|PIVOT|UNPIVOT)$/.test(W(T, q))) { o.alias = bare(T[q].v); o.aliasRaw = T[q].v.replace(/^\[|\]$/g, ""); o.aliasAt = q; q++; }
      if (W(T, q) === "WITH" && V(T, q + 1) === "(" && M[q + 1] !== undefined) q = M[q + 1] + 1;
      o.end = q - 1; o.key = o.alias || o.name; return o;
    }
    while (k <= b) {
      if (V(T, k) === "(" && M[k] !== undefined && W(T, k - 1) !== "APPLY" && !/^(FROM|JOIN)$/.test(W(T, k - 1)) && V(T, k - 1) !== ",") { k = M[k] + 1; continue; }
      var w = W(T, k - 1);
      if (k === a || w === "JOIN" || w === "APPLY" || V(T, k - 1) === ",") { var o = read(k); if (o) { o.join = k === a ? "FROM" : w === "APPLY" ? W(T, k - 2) + " APPLY" : w === "JOIN" ? "JOIN" : ","; items.push(o); k = o.end + 1; continue; } }
      k++;
    }
    return items;
  }
  function qualifiers(P, a, b) { var T = P.T, out = {}; for (var j = a; j <= b; j++) if ((isName(T, j) || T[j].t === "id") && V(T, j + 1) === "." && V(T, j - 1) !== "." && T[j + 2] && (T[j + 2].t === "word" || T[j + 2].t === "id" || V(T, j + 2) === "*")) out[bare(T[j].v)] = 1; return out; }
  function itemName(P, it) { // output name of a select-list item
    var T = P.T, a = it[0], b = it[1];
    if (isName(T, a) && V(T, a + 1) === "=" && b > a + 1) return { name: bare(T[a].v), raw: T[a].v, expr: [a + 2, b], explicit: true };
    if (W(T, b - 1) === "AS" && b - 1 > a) return { name: bare(T[b].v), raw: T[b].v, expr: [a, b - 2], explicit: true };
    if (b > a && isName(T, b) && V(T, b - 1) !== "." && (V(T, b - 1) === ")" || W(T, b - 1) === "END" || isName(T, b - 1) || /^(num|str|id)$/.test(T[b - 1].t))) return { name: bare(T[b].v), raw: T[b].v, expr: [a, b - 1], explicit: true };
    if (isName(T, b) || T[b].t === "id") return { name: bare(T[b].v), raw: T[b].v, expr: [a, b], explicit: false };
    return { name: "", raw: "", expr: [a, b], explicit: false };
  }
  function isAggItem(P, e) { var T = P.T; return AGG[W(T, e[0])] && V(T, e[0] + 1) === "(" && P.M[e[0] + 1] === e[1]; }
  function onlyQual(qs, set) { var k = Object.keys(qs); return k.length > 0 && k.every(function (q) { return set[q]; }); }

  // ---------- find things to fix ----------
  function analyse(sql) {
    var P = sig(sql), T = P.T, out = [], n = 0;
    for (var k = 0; k < T.length; k++) {
      if (W(T, k) === "APPLY" && /^(OUTER|CROSS)$/.test(W(T, k - 1))) {
        var kind = W(T, k - 1), body = V(T, k + 1) === "(" && W(T, k + 2) === "SELECT";
        var aliasAt = body ? P.M[k + 1] + 1 : -1; if (aliasAt > 0 && W(T, aliasAt) === "AS") aliasAt++;
        n++; out.push({ kind: "apply", id: "apply:" + (aliasAt > 0 && T[aliasAt] ? bare(T[aliasAt].v) : "#" + n), at: T[k - 1].s, apply: kind, alias: aliasAt > 0 && T[aliasAt] ? bare(T[aliasAt].v) : "", line: lineOf(sql, T[k - 1].s),
          title: kind + " APPLY" + (aliasAt > 0 && T[aliasAt] ? " " + T[aliasAt].v : ""), fixable: body });
      }
      if (W(T, k) === "STRING_AGG" && V(T, k + 1) === "(") out.push({ kind: "stringagg", id: "sa:" + out.length, at: T[k].s, line: lineOf(sql, T[k].s), title: "STRING_AGG", fixable: true });
    }
    return out;
  }
  function lineOf(s, pos) { return s.slice(0, pos).split("\n").length; }

  // ---------- APPLY rewrite ----------
  function rewriteApply(sql, method, notes) {
    var P = sig(sql), T = P.T, M = P.M;
    for (var k = 0; k < T.length; k++) {
      if (!(W(T, k) === "APPLY" && /^(OUTER|CROSS)$/.test(W(T, k - 1)) && V(T, k + 1) === "(" && W(T, k + 2) === "SELECT")) continue;
      var kind = W(T, k - 1), po = k + 1, pc = M[po]; if (pc === undefined) return { error: "Unbalanced brackets after APPLY." };
      var ai = pc + 1; if (W(T, ai) === "AS") ai++;
      if (!(isName(T, ai) || (T[ai] && T[ai].t === "id"))) return { error: "APPLY at line " + lineOf(sql, T[k].s) + " has no alias." };
      var alias = bare(T[ai].v), aliasRaw = T[ai].v, applyEnd = ai;
      var outer = blockAt(P, k - 1); if (!outer) return { error: "Couldn't find the SELECT around the APPLY." };
      var inner = blockAt(P, k + 2);
      if (inner.cl.GROUP !== undefined || inner.cl.HAVING !== undefined) return { skip: true, why: kind + " APPLY " + aliasRaw + " has GROUP BY inside; rewrite by hand (or try the other method)." };
      if (inner.cl.FROM === undefined) return { skip: true, why: kind + " APPLY " + aliasRaw + " has no FROM inside." };
      var items = split(P, inner.ls, inner.le).map(function (r) { var nm = itemName(P, r); nm.r = r; nm.agg = isAggItem(P, nm.expr); return nm; });
      if (items.some(function (x) { return !x.name; })) return { skip: true, why: kind + " APPLY " + aliasRaw + " has a column with no name." };
      if (items.some(function (x) { return V(T, x.expr[1]) === "*"; })) return { skip: true, why: kind + " APPLY " + aliasRaw + " uses * inside; list the columns first." };
      var allAgg = items.every(function (x) { return x.agg; }), top = inner.top, topN = top ? parseInt(top.n, 10) : 0;
      var fromR = inner.range("FROM"), whereR = inner.range("WHERE"), orderR = inner.range("ORDER");
      var fromTxt = txt(P, fromR[0], fromR[1]), whereTxt = whereR ? txt(P, whereR[0], whereR[1]) : "", orderTxt = orderR ? txt(P, orderR[0], orderR[1]) : "";
      // outer aliases (FROM items before this APPLY) and inner aliases
      var ofr = outer.range("FROM"), oItems = fromItems(P, ofr[0], ofr[1]), oSet = {}, iSet = {};
      oItems.forEach(function (o) { if (o.at < k && o.key) oSet[o.key] = 1; });
      fromItems(P, fromR[0], fromR[1]).forEach(function (o) { if (o.key) iSet[o.key] = 1; });
      // references to alias.col in the outer block, outside the APPLY
      var refs = [];
      for (var j = outer.sel; j <= outer.end; j++) {
        if (j >= k - 1 && j <= applyEnd) { j = applyEnd; continue; }
        if ((isName(T, j) || T[j].t === "id") && bare(T[j].v) === alias && V(T, j + 1) === "." && V(T, j - 1) !== ".") refs.push({ a: j, b: j + 2, col: V(T, j + 2) === "*" ? "*" : bare(T[j + 2].v) });
      }
      var byName = {}; items.forEach(function (x) { byName[x.name] = x; });
      var bad = refs.filter(function (r) { return r.col !== "*" && !byName[r.col]; })[0];
      if (bad) return { skip: true, why: aliasRaw + "." + T[bad.b].v + " is used but the APPLY doesn't return that column." };
      var inSel = function (r) { return r.a >= outer.ls && r.a <= outer.le; };
      // select items that are exactly alias.col need "AS col" to keep their name
      var outItems = split(P, outer.ls, outer.le);
      function wholeItem(r) { return outItems.some(function (it) { return it[0] === r.a && it[1] === r.b; }); }
      var edits = []; // {s, e, text}
      if (method === "scalar") {
        var oneRow = topN === 1 && !top.pct && !top.ties;
        if (!(oneRow || (allAgg && !top))) return { skip: true, needJoin: true, why: kind + " APPLY " + aliasRaw + " can return several rows (no TOP 1), so it can't become scalar subqueries; use the join method." };
        var sub = function (x) { return "(SELECT " + (oneRow ? "TOP 1 " : "") + txt(P, x.expr[0], x.expr[1]).trim() + " FROM " + fromTxt.trim() + (whereTxt ? " WHERE " + whereTxt.trim() : "") + (orderTxt && oneRow ? " ORDER BY " + orderTxt.trim() : "") + ")"; };
        refs.forEach(function (r) {
          if (r.col === "*") {
            if (!inSel(r)) throw new Error(aliasRaw + ".* outside the SELECT list can't be rewritten.");
            edits.push({ s: T[r.a].s, e: T[r.b].e, text: items.map(function (x) { return sub(x) + " AS " + x.raw; }).join(",\n    ") });
          } else edits.push({ s: T[r.a].s, e: T[r.b].e, text: sub(byName[r.col]) + (inSel(r) && wholeItem(r) ? " AS " + T[r.b].v : "") });
        });
        // remove the APPLY
        var cut = T[k - 1].s; var before = sql.slice(0, cut).replace(/[ \t]*\n?[ \t]*$/, ""); edits.push({ s: before.length, e: T[applyEnd].e, text: "" });
        if (kind === "CROSS" && !(allAgg && !top)) {
          var ex = "EXISTS (SELECT 1 FROM " + fromTxt.trim() + (whereTxt ? " WHERE " + whereTxt.trim() : "") + ")";
          var ow = outer.range("WHERE");
          if (ow) { edits.push({ s: T[ow[0]].s, e: T[ow[0]].s, text: "(" }); edits.push({ s: T[ow[1]].e, e: T[ow[1]].e, text: ")\n  AND " + ex }); }
          else { var insAt = outer.end + 1, cands = ["GROUP", "HAVING", "ORDER", "OPTION", "FOR"].map(function (c) { return outer.cl[c]; }).filter(function (x) { return x !== undefined; }); if (cands.length) insAt = Math.min.apply(null, cands); var pos = insAt <= outer.end ? T[insAt].s : T[outer.end].e; edits.push({ s: pos, e: pos, text: (insAt <= outer.end ? "" : "\n") + "WHERE " + ex + (insAt <= outer.end ? "\n" : "") }); }
          notes.push("CROSS APPLY " + aliasRaw + " also filtered rows with no match, so an EXISTS was added to the WHERE.");
        }
        if (items.length > 3) notes.push(aliasRaw + ": " + items.length + " columns became " + items.length + " separate subqueries. Fine for small result sets; on big ones the join method is faster.");
        notes.push((kind === "OUTER" ? "OUTER" : "CROSS") + " APPLY " + aliasRaw + " → " + items.length + " scalar subquer" + (items.length === 1 ? "y" : "ies") + ".");
      } else {
        // join method: correlation must be simple equalities
        var conj = whereR ? (hasTopLevel(P, whereR[0], whereR[1], "OR") ? [whereR] : split(P, whereR[0], whereR[1], "AND")) : [];
        var keys = [], keep = [];
        for (var c = 0; c < conj.length; c++) {
          var r0 = conj[c], qs = qualifiers(P, r0[0], r0[1]), outerQ = Object.keys(qs).filter(function (q) { return oSet[q] && !iSet[q]; });
          if (!outerQ.length) { keep.push(txt(P, r0[0], r0[1]).trim()); continue; }
          var eq = -1, d0 = 0; for (var e = r0[0]; e <= r0[1]; e++) { if (V(T, e) === "(" && M[e] !== undefined) { e = M[e]; continue; } if (V(T, e) === "=") { eq = e; break; } }
          if (eq < 0) return { skip: true, needScalar: true, why: "APPLY " + aliasRaw + " links to the outer query with something other than '=' (" + txt(P, r0[0], r0[1]).trim() + "); use the scalar method." };
          var L = [r0[0], eq - 1], R = [eq + 1, r0[1]], lq = qualifiers(P, L[0], L[1]), rq = qualifiers(P, R[0], R[1]);
          var lIn = Object.keys(lq).every(function (q) { return !oSet[q] || iSet[q]; }), rOut = onlyQual(rq, oSet) && Object.keys(rq).every(function (q) { return !iSet[q]; });
          var rIn = Object.keys(rq).every(function (q) { return !oSet[q] || iSet[q]; }), lOut = onlyQual(lq, oSet) && Object.keys(lq).every(function (q) { return !iSet[q]; });
          if (lIn && rOut) keys.push({ inner: txt(P, L[0], L[1]).trim(), outer: txt(P, R[0], R[1]).trim() });
          else if (rIn && lOut) keys.push({ inner: txt(P, R[0], R[1]).trim(), outer: txt(P, L[0], L[1]).trim() });
          else return { skip: true, needScalar: true, why: "APPLY " + aliasRaw + ": couldn't split \"" + txt(P, r0[0], r0[1]).trim() + "\" into inner and outer sides; use the scalar method." };
        }
        if (!keys.length && !allAgg) notes.push("APPLY " + aliasRaw + " isn't linked to the outer query at all; the join matches every row.");
        var kn = function (i) { return "JoinKey" + (i + 1); };
        var cols = items.map(function (x) { return txt(P, x.expr[0], x.expr[1]).trim() + " AS " + x.raw; });
        var kcols = keys.map(function (q, i) { return q.inner + " AS " + kn(i); });
        var whereIn = keep.length ? "\n    WHERE " + keep.join("\n      AND ") : "";
        var dsql, on = keys.map(function (q, i) { return aliasRaw + "." + kn(i) + " = " + q.outer; }), joinKind;
        if (allAgg && !top) {
          dsql = "SELECT " + kcols.concat(cols).join(", ") + "\n    FROM " + fromTxt.trim() + whereIn + (keys.length ? "\n    GROUP BY " + keys.map(function (q) { return q.inner; }).join(", ") : "");
          joinKind = "LEFT JOIN";
        } else if (top) {
          var part = keys.length ? "PARTITION BY " + keys.map(function (q) { return q.inner; }).join(", ") + " " : "";
          dsql = "SELECT " + kcols.concat(cols).join(", ") + ",\n           ROW_NUMBER() OVER (" + part + "ORDER BY " + (orderTxt ? orderTxt.trim() : "(SELECT NULL)") + ") AS JoinRowNo\n    FROM " + fromTxt.trim() + whereIn;
          on.push(aliasRaw + ".JoinRowNo " + (topN === 1 ? "= 1" : "<= " + (topN || 1)));
          joinKind = kind === "CROSS" ? "INNER JOIN" : "LEFT JOIN";
          if (!orderTxt) notes.push("APPLY " + aliasRaw + " had TOP without ORDER BY, so which row is picked was never defined; it still isn't.");
        } else {
          dsql = "SELECT " + kcols.concat(cols).join(", ") + "\n    FROM " + fromTxt.trim() + whereIn;
          joinKind = kind === "CROSS" ? "INNER JOIN" : "LEFT JOIN";
        }
        var jt = joinKind + " (\n    " + dsql + "\n) " + aliasRaw + (on.length ? " ON " + on.join("\n   AND ") : " ON 1 = 1");
        edits.push({ s: T[k - 1].s, e: T[applyEnd].e, text: jt });
        if (allAgg && !top) {
          refs.forEach(function (r) {
            var x = byName[r.col]; if (!x) return;
            if (/^COUNT/.test(W(T, x.expr[0]))) edits.push({ s: T[r.a].s, e: T[r.b].e, text: "ISNULL(" + txt(P, r.a, r.b) + ", 0)" + (inSel(r) && wholeItem(r) ? " AS " + T[r.b].v : "") });
          });
          if (items.some(function (x) { return /^COUNT/.test(W(T, x.expr[0])); })) notes.push("APPLY " + aliasRaw + ": counts are wrapped in ISNULL(…, 0) because a join gives NULL where APPLY gave 0.");
        }
        notes.push(kind + " APPLY " + aliasRaw + " → " + joinKind + " to a derived table" + (top ? " (ROW_NUMBER picks the TOP row per key)" : "") + ".");
      }
      return { sql: applyEdits(sql, edits) };
    }
    return null;
  }

  // ---------- STRING_AGG rewrite ----------
  function sepLen(sep) { var m = /^N?'((?:[^']|'')*)'$/i.exec(sep.trim()); return m ? String(m[1].replace(/''/g, "'").length) : "LEN(" + sep.trim() + " + 'x') - 1"; }
  function stuff(sep, expr, fromWhere, order) {
    return "STUFF((SELECT " + sep.trim() + " + CONVERT(nvarchar(max), " + expr.trim() + ")\n" + fromWhere + (order ? "\n        ORDER BY " + order.trim() : "") + "\n        FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, " + sepLen(sep) + ", '')";
  }
  function rewriteAgg(sql, notes) {
    var P = sig(sql), T = P.T, M = P.M;
    for (var k = 0; k < T.length; k++) {
      if (!(W(T, k) === "STRING_AGG" && V(T, k + 1) === "(" && M[k + 1] !== undefined)) continue;
      var close = M[k + 1], args = split(P, k + 2, close - 1);
      if (args.length !== 2) return { skip: true, why: "STRING_AGG at line " + lineOf(sql, T[k].s) + " needs two arguments." };
      var expr = txt(P, args[0][0], args[0][1]), sep = txt(P, args[1][0], args[1][1]), callEnd = close, wg = "";
      if (W(T, close + 1) === "WITHIN" && W(T, close + 2) === "GROUP" && V(T, close + 3) === "(" && M[close + 3] !== undefined) {
        var wo = close + 3; wg = txt(P, wo + 3, M[wo] - 1); callEnd = M[wo];
      }
      var b = blockAt(P, k); if (!b || b.cl.FROM === undefined) return { skip: true, why: "STRING_AGG at line " + lineOf(sql, T[k].s) + " isn't in a SELECT with a FROM." };
      var fr = b.range("FROM"), wr = b.range("WHERE"), gr = b.range("GROUP");
      var items = split(P, b.ls, b.le);
      var single = !gr && items.length === 1 && b.open >= 0 && !/^(FROM|JOIN|APPLY|EXISTS|IN)$/.test(W(T, b.open - 1));
      var mine = items.filter(function (it) { return it[0] <= k && it[1] >= callEnd; })[0];
      if (single) { // (SELECT STRING_AGG(x, ', ') FROM ... WHERE ...) used as a value
        var fw = "        FROM " + txt(P, fr[0], fr[1]).trim() + (wr ? "\n        WHERE " + txt(P, wr[0], wr[1]).trim() : "");
        var nm = itemName(P, mine);
        var whole = nm.expr[0] === k && nm.expr[1] === callEnd;
        var rep = stuff(sep, expr, fw, wg);
        if (whole) return { sql: applyEdits(sql, [{ s: T[b.open].s, e: T[P.M[b.open]].e, text: rep }]), done: notes.push("STRING_AGG in a subquery → STUFF(… FOR XML PATH('')) on line " + lineOf(sql, T[k].s) + ".") };
      }
      // grouped (or whole-table) query: correlated subquery over a renamed copy of FROM/WHERE
      var its = fromItems(P, fr[0], fr[1]), ren = {}, add = [];
      its.forEach(function (o) {
        if (o.alias) ren[o.alias] = o.aliasRaw + "_sa";
        else if (o.name && o.kind === "table") { ren[o.name] = o.nameRaw + "_sa"; add.push(o); }
      });
      function renamed(a, z) {
        var parts = [], last = P.T[a].s;
        for (var j = a; j <= z; j++) {
          var t = P.T[j], key = (t.t === "word" || t.t === "id") ? bare(t.v) : "";
          if (key && ren[key] && V(T, j + 1) === "." && V(T, j - 1) !== ".") { parts.push(sql.slice(last, t.s) + ren[key]); last = t.e; continue; }
          var decl = its.filter(function (o) { return o.aliasAt === j; })[0];
          if (decl) { parts.push(sql.slice(last, t.s) + ren[decl.alias]); last = t.e; continue; }
          var noAl = add.filter(function (o) { return o.nameEnd === j; })[0];
          if (noAl) { parts.push(sql.slice(last, t.e) + " " + ren[noAl.name]); last = t.e; continue; }
        }
        return parts.join("") + sql.slice(last, P.T[z].e);
      }
      var conds = [];
      if (wr) conds.push("(" + renamed(wr[0], wr[1]).trim() + ")");
      var gerr = null;
      (gr ? split(P, gr[0], gr[1]) : []).forEach(function (g) {
        var o = txt(P, g[0], g[1]).trim(), q = qualifiers(P, g[0], g[1]);
        if (!Object.keys(q).length && (isName(T, g[0]) || T[g[0]].t === "id") && g[0] === g[1]) {
          if (its.length !== 1) { gerr = "GROUP BY column " + o + " has no table alias, so the STRING_AGG rewrite can't tell which table it belongs to. Add the alias (e.g. p." + o + ") and try again."; return; }
          conds.push(ren[its[0].key] + "." + o + " = " + (its[0].aliasRaw || its[0].nameRaw) + "." + o); return;
        }
        if (!Object.keys(q).length) { gerr = "GROUP BY expression " + o + " has no table alias; add one so the rewrite can match groups."; return; }
        conds.push(renamed(g[0], g[1]).trim() + " = " + o);
      });
      if (gerr) return { skip: true, why: gerr };
      var fw2 = "        FROM " + renamed(fr[0], fr[1]).trim() + (conds.length ? "\n        WHERE " + conds.join("\n          AND ") : "");
      var ordR = "";
      if (wg) ordR = renamedText(sql, wg, ren);
      var rep2 = stuff(renamedText(sql, sep, ren), renamedText(sql, expr, ren), fw2, ordR);
      if (gr) notes.push("STRING_AGG in a GROUP BY query → correlated STUFF(… FOR XML PATH('')) matched on the GROUP BY columns (line " + lineOf(sql, T[k].s) + "). Groups whose key is NULL get an empty list.");
      else notes.push("STRING_AGG → STUFF(… FOR XML PATH('')) over the same FROM/WHERE (line " + lineOf(sql, T[k].s) + ").");
      return { sql: applyEdits(sql, [{ s: T[k].s, e: T[callEnd].e, text: rep2 }]) };
    }
    return null;
  }
  function renamedText(sql, piece, ren) { // rename alias.col qualifiers inside a small piece of SQL
    var P = sig(piece), out = [], last = 0;
    P.T.forEach(function (t, j) { var key = (t.t === "word" || t.t === "id") ? bare(t.v) : ""; if (key && ren[key] && V(P.T, j + 1) === "." && V(P.T, j - 1) !== ".") { out.push(piece.slice(last, t.s) + ren[key]); last = t.e; } });
    return out.join("") + piece.slice(last);
  }
  function applyEdits(sql, edits) {
    edits.sort(function (a, b) { return b.s - a.s || b.e - a.e; });
    var out = sql; edits.forEach(function (e) { out = out.slice(0, e.s) + e.text + out.slice(e.e); }); return out;
  }

  function fix(sql, opts) {
    opts = opts || {};
    var changes = [], problems = [], cur = sql, guard = 0, idx = 0, skipped = {};
    // APPLYs first, outermost-last order doesn't matter: we always take the first remaining one
    while (guard++ < 40) {
      var list = analyse(cur).filter(function (f) { return f.kind === "apply" && f.fixable && !skipped[f.at]; });
      if (!list.length) break;
      var f = list[0], m = (opts.methods && opts.methods[f.id]) || opts.method || "scalar";
      var notes = [], r;
      try { r = rewriteApplyAt(cur, f.at, m, notes); } catch (e) { r = { skip: true, why: e.message }; }
      if (r && r.skip && (r.needJoin || r.needScalar) && !opts.strict) { // fall back to the other method
        var alt = r.needJoin ? "join" : "scalar", n2 = [];
        try { var r2 = rewriteApplyAt(cur, f.at, alt, n2); if (r2 && r2.sql) { notes = n2; notes.unshift("Used the " + (alt === "join" ? "join" : "scalar subquery") + " method for " + f.title + ": " + r.why); r = r2; } } catch (e) {}
      }
      if (!r || r.skip || r.error) { problems.push((r && (r.why || r.error)) || "Couldn't rewrite " + f.title + "."); skipped[f.at] = 1; continue; }
      cur = r.sql; changes = changes.concat(notes);
    }
    analyse(cur).filter(function (f) { return f.kind === "apply" && !f.fixable; }).forEach(function (f) { problems.push(f.title + " (line " + f.line + ") applies a function, not a SELECT; rewrite by hand."); });
    guard = 0; var aggSkip = 0;
    while (guard++ < 40) {
      var notes2 = [], r3 = rewriteAgg(cur, notes2);
      if (!r3) break;
      if (r3.skip) { problems.push(r3.why); break; }
      cur = r3.sql; changes = changes.concat(notes2);
    }
    return { sql: cur, changes: changes, problems: problems };
  }
  // Rewrite only the APPLY that starts at char offset "at" (other APPLYs are hidden while we do it)
  function rewriteApplyAt(sql, at, method, notes) {
    var P = sig(sql), T = P.T, pieces = [], last = 0, hit = false;
    for (var j = 0; j < T.length; j++) {
      if (W(T, j) !== "APPLY") continue;
      if (T[j - 1] && T[j - 1].s === at) { hit = true; continue; }
      pieces.push(sql.slice(last, T[j].s) + "APPL\u0002"); last = T[j].e;
    }
    if (!hit) return null;
    var r = rewriteApply(pieces.join("") + sql.slice(last), method, notes);
    if (r && r.sql) r.sql = r.sql.replace(/APPL\u0002/g, "APPLY");
    return r;
  }

  root.EBSFix = { analyse: analyse, fix: fix, tokenize: tokenize };
  if (typeof module !== "undefined") module.exports = root.EBSFix;
})(typeof window !== "undefined" ? window : this);
