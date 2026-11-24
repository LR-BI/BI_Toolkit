// SQL Checker: extra validity checks, run in steps.
// SQLValidate(T, M, src, ctx) -> [{ step, sev, s, e, title, msg, fix }]
//   T   tokens from the page tokenizer ({ t, v, u, s, e })
//   M   matched brackets (index of "(" <-> index of ")")
//   ctx { KW: keyword map, schema: null | { tables: { NAME: { COL: type } } } }
(function () {
  var AGG = {}; "COUNT COUNT_BIG SUM AVG MIN MAX STDEV STDEVP VAR VARP STRING_AGG GROUPING GROUPING_ID CHECKSUM_AGG APPROX_COUNT_DISTINCT".split(" ").forEach(function (w) { AGG[w] = 1; });
  var WIN = {}; "ROW_NUMBER RANK DENSE_RANK NTILE LAG LEAD FIRST_VALUE LAST_VALUE CUME_DIST PERCENT_RANK".split(" ").forEach(function (w) { WIN[w] = 1; });
  var TY = {}; ("INT BIGINT SMALLINT TINYINT BIT DECIMAL NUMERIC FLOAT REAL MONEY SMALLMONEY DATE DATETIME DATETIME2 SMALLDATETIME DATETIMEOFFSET TIME " +
    "VARCHAR NVARCHAR CHAR NCHAR TEXT NTEXT MAX UNIQUEIDENTIFIER VARBINARY BINARY XML SQL_VARIANT IMAGE").split(" ").forEach(function (w) { TY[w] = 1; });
  var DPF = { DATEADD: 1, DATEDIFF: 1, DATEDIFF_BIG: 1, DATEPART: 1, DATENAME: 1, DATETRUNC: 1, DATE_BUCKET: 1 };
  var NOTCOL = {}; ("CURRENT_TIMESTAMP CURRENT_USER SESSION_USER SYSTEM_USER USER CURRENT_DATE OFFSET FETCH NEXT ROWS ROW ONLY OUTPUT MATCHED USING " +
    "SOURCE TARGET RETURNS ROLLUP CUBE GROUPING SETS XML JSON PATH RAW AUTO EXPLICIT ROOT TYPE ELEMENTS NOCOUNT ANSI_NULLS QUOTED_IDENTIFIER " +
    "RECOMPILE MAXDOP OPTIMIZE UNKNOWN FAST FORCE ORDER HASH LOOP READUNCOMMITTED READPAST ROWLOCK UPDLOCK HOLDLOCK TABLOCK NOWAIT").split(" ").forEach(function (w) { NOTCOL[w] = 1; });
  var JOINW = { JOIN: 1, INNER: 1, LEFT: 1, RIGHT: 1, FULL: 1, CROSS: 1, OUTER: 1, APPLY: 1 };
  var STOP = {}; "UNION EXCEPT INTERSECT SELECT INSERT UPDATE DELETE MERGE DECLARE IF WHILE BEGIN RETURN EXEC EXECUTE PRINT TRUNCATE CREATE ALTER DROP GO USE SET RAISERROR THROW".split(" ").forEach(function (w) { STOP[w] = 1; });
  var CLAUSE = { FROM: 1, WHERE: 1, GROUP: 1, HAVING: 1, ORDER: 1, INTO: 1, OPTION: 1, FOR: 1, OFFSET: 1, WINDOW: 1 };
  var CMP = { "=": 1, "<": 1, ">": 1, "<=": 1, ">=": 1, "<>": 1, "!=": 1, "!<": 1, "!>": 1 };
  var NUMTYPE = /^(int|bigint|smallint|tinyint|bit|decimal|numeric|float|real|money|smallmoney)$/i;
  var STRTYPE = /^(varchar|nvarchar|char|nchar|text|ntext)$/i;
  var TYPOS = { SELCT: "SELECT", SLECT: "SELECT", SELET: "SELECT", SEELCT: "SELECT", SELECET: "SELECT", FORM: "FROM", FRMO: "FROM", FRON: "FROM",
    WHRE: "WHERE", WHER: "WHERE", WEHRE: "WHERE", WHERER: "WHERE", GROPU: "GROUP", GORUP: "GROUP", GRUOP: "GROUP", ODER: "ORDER", OREDR: "ORDER", ORDR: "ORDER",
    JION: "JOIN", JON: "JOIN", INNNER: "INNER", INER: "INNER", LEFTJOIN: "LEFT JOIN", GROUPBY: "GROUP BY", ORDERBY: "ORDER BY", HAVNG: "HAVING",
    DISTINT: "DISTINCT", DISTICT: "DISTINCT", BETWEN: "BETWEEN", UNOIN: "UNION", UINON: "UNION", NULLL: "NULL", ISNUL: "ISNULL", COALESE: "COALESCE", COALESECE: "COALESCE" };

  window.SQLValidate = function (T, M, src, ctx) {
    var KW = ctx.KW, F = [], N = T.length;
    var K2 = {}; Object.keys(KW).forEach(function (k) { K2[k] = 1; }); Object.keys(NOTCOL).forEach(function (k) { K2[k] = 1; });
    function add(step, sev, i, j, title, msg, fix) {
      if (!T[i]) return; j = j === undefined ? i : Math.min(j, N - 1);
      F.push({ step: step, sev: sev, s: T[i].s, e: T[j].e, title: title, msg: msg, fix: fix || "" });
    }
    function W(i) { return T[i] && (T[i].t === "word" || T[i].t === "id") ? T[i].u : ""; }
    function KWd(i) { return T[i] && T[i].t === "word" ? T[i].u : ""; } // bare keyword-style word
    function V(i) { return T[i] && T[i].t === "op" ? T[i].v : ""; }
    function isName(i) { var t = T[i]; return !!t && (t.t === "id" || (t.t === "word" && !K2[t.u])); }
    function isObjName(i) { var t = T[i]; return !!t && (t.t === "id" || t.t === "var" || (t.t === "word" && !KW[t.u])); }
    function txt(a, b) { return T[a] && T[b] ? src.slice(T[a].s, T[b].e).replace(/\s+/g, " ").trim() : ""; }
    function norm(a, b) { var o = []; for (var k = a; k <= b; k++) if (T[k]) o.push(T[k].t === "str" ? "'" + T[k].v + "'" : T[k].u); return o.join(" "); }
    function enclosing(i) { for (var k = i - 1; k >= 0; k--) { if (V(k) === ")" && M[k] !== undefined) { k = M[k]; continue; } if (V(k) === "(") return k; } return -1; }
    function isSubq(k) { return V(k) === "(" && M[k] !== undefined && (KWd(k + 1) === "SELECT" || KWd(k + 1) === "WITH"); }

    // ================= STEP 1: STRUCTURE =================
    (T.bad || []).forEach(function (b) { F.push({ step: "structure", sev: "error", s: b.s, e: b.e, title: b.title, msg: b.msg, fix: "" }); });
    T.forEach(function (t, i) {
      if (t.t !== "op") return;
      if (t.v === "(" && M[i] === undefined) add("structure", "error", i, i, "Bracket never closed", "This ( has no matching ). Everything after it is read as part of the bracket.");
      if (t.v === ")" && M[i] === undefined) add("structure", "error", i, i, "Extra )", "This ) has no matching (.");
      if (t.v === "," && (V(i + 1) === "," )) add("structure", "error", i, i + 1, "Two commas in a row", "Something is missing between these commas, or one comma is extra.");
      if (t.v === "," && V(i + 1) === ")") add("structure", "error", i, i + 1, "Comma before )", "A list can't end with a comma.");
      if (t.v === "(" && V(i + 1) === ",") add("structure", "error", i, i + 1, "Comma after (", "A list can't start with a comma.");
    });
    // BEGIN/END, CASE/END, TRY/CATCH
    (function () {
      var st = [];
      for (var i = 0; i < N; i++) {
        var u = KWd(i);
        if (u === "BEGIN") {
          var nx = KWd(i + 1);
          if (nx === "TRAN" || nx === "TRANSACTION" || nx === "DISTRIBUTED" || nx === "DIALOG" || nx === "CONVERSATION") continue;
          if (nx === "TRY" || nx === "CATCH") { st.push({ k: nx, i: i }); i++; continue; }
          st.push({ k: "BEGIN", i: i });
        } else if (u === "CASE") st.push({ k: "CASE", i: i, when: false });
        else if (u === "WHEN" && st.length && st[st.length - 1].k === "CASE") st[st.length - 1].when = true;
        else if (u === "END") {
          var nx2 = KWd(i + 1), want = nx2 === "TRY" || nx2 === "CATCH" ? nx2 : null;
          if (nx2 === "CONVERSATION") continue;
          var top = st.pop();
          if (!top) { add("structure", "error", i, want ? i + 1 : i, "END without a start", "There's no BEGIN or CASE for this END to close."); continue; }
          if (want && top.k !== want) add("structure", "error", i, i + 1, "END " + want + " doesn't match", "This closes a " + (top.k === "BEGIN" ? "BEGIN" : top.k) + ", not BEGIN " + want + ".");
          if (top.k === "CASE" && !top.when) add("structure", "error", top.i, i, "CASE with no WHEN", "A CASE needs at least one WHEN ... THEN ...");
          if (want) i++;
        }
      }
      st.forEach(function (o) {
        add("structure", "error", o.i, o.k === "TRY" || o.k === "CATCH" ? o.i + 1 : o.i, (o.k === "BEGIN" ? "BEGIN" : o.k === "CASE" ? "CASE" : "BEGIN " + o.k) + " without END",
          o.k === "CASE" ? "Every CASE needs an END, e.g. CASE WHEN x = 1 THEN 'A' ELSE 'B' END." : "This block is never closed with END" + (o.k !== "BEGIN" ? " " + o.k : "") + ".");
      });
    })();
    for (var i0 = 0; i0 < N; i0++) {
      var u0 = KWd(i0);
      if (TYPOS[u0] && V(i0 + 1) !== "." && V(i0 + 1) !== "(" && V(i0 - 1) !== ".") {
        var p = KWd(i0 - 1);
        if (!(u0 === "FORM" && (p === "FROM" || p === "JOIN" || p === "INTO" || p === "UPDATE" || V(i0 - 1) === ",")))
          add("structure", "error", i0, i0, "Typo: " + T[i0].v + "?", "Did you mean " + TYPOS[u0] + "?", TYPOS[u0]);
      }
      if ((u0 === "GROUP" || u0 === "ORDER") && KWd(i0 + 1) !== "BY" && KWd(i0 - 1) !== "WITHIN" && V(i0 + 1) !== "." && V(i0 - 1) !== "." && T[i0].t === "word")
        add("structure", "error", i0, i0, u0 + " without BY", "Write " + u0 + " BY.", u0 + " BY ...");
      if (u0 === "IN" && V(i0 + 1) === "(" && M[i0 + 1] === i0 + 2) add("structure", "error", i0, i0 + 2, "Empty IN ()", "IN needs at least one value. If the list can be empty, build the query so it skips the filter.");
      var setStmt = false; for (var sb = i0 - 1; sb >= Math.max(0, i0 - 6); sb--) if (KWd(sb) === "SET") setStmt = true;
      if ((u0 === "AND" || u0 === "OR" || u0 === "WHERE" || u0 === "ON" || u0 === "HAVING") && T[i0].t === "word" && !(u0 === "ON" && setStmt)) {
        var nx = KWd(i0 + 1);
        if (!T[i0 + 1] || nx === "AND" || nx === "OR" || nx === "WHERE" || nx === "GROUP" || nx === "ORDER" || nx === "HAVING" || (V(i0 + 1) === ")" ) || V(i0 + 1) === ";")
          add("structure", "error", i0, Math.min(i0 + 1, N - 1), "Nothing after " + u0, "There's a condition missing after " + u0 + ".");
      }
      if (CMP[V(i0)]) {
        var nx3 = KWd(i0 + 1);
        if (!T[i0 + 1] || nx3 === "AND" || nx3 === "OR" || nx3 === "WHERE" || nx3 === "GROUP" || nx3 === "ORDER" || nx3 === "FROM" || nx3 === "THEN" || V(i0 + 1) === ")" || V(i0 + 1) === ";" || V(i0 + 1) === ",")
          add("structure", "error", i0, i0, "Nothing after " + T[i0].v, "This comparison is missing its right-hand side.");
      }
    }

    // ================= Find every SELECT block =================
    var blocks = [];
    for (var s0 = 0; s0 < N; s0++) if (KWd(s0) === "SELECT") blocks.push(block(s0));
    function block(sel) {
      var o = enclosing(sel), lim = o >= 0 && M[o] !== undefined ? M[o] - 1 : N - 1;
      var b = { sel: sel, enc: o, cl: {}, term: "", termAt: -1 }, cd = 0, k;
      for (k = sel + 1; k <= lim; k++) {
        if (V(k) === "(" && M[k] !== undefined) { k = M[k]; continue; }
        if (V(k) === ";") break;
        var u = KWd(k);
        if (u === "CASE") { cd++; continue; }
        if (u === "END") { if (cd > 0) { cd--; continue; } break; }
        if (u === "ELSE" && cd === 0) break;
        if (STOP[u]) break;
        if (u === "WITH" && isName(k + 1) && (KWd(k + 2) === "AS" || V(k + 2) === "(") && V(k + 1) !== "(") break;
        if (CLAUSE[u] && b.cl[u] === undefined && (cd === 0 || u !== "FOR")) {
          if ((u === "GROUP" || u === "ORDER") && KWd(k + 1) !== "BY") continue;
          if (u === "FOR" && !/^(XML|JSON|BROWSE)$/.test(KWd(k + 1))) continue;
          b.cl[u] = k;
        }
      }
      b.end = k - 1;
      if (T[k] && (KWd(k) === "UNION" || KWd(k) === "EXCEPT" || KWd(k) === "INTERSECT")) { b.term = KWd(k); b.termAt = k; }
      // select list
      var a = sel + 1;
      if (KWd(a) === "DISTINCT" || KWd(a) === "ALL") a++;
      if (KWd(a) === "TOP") { b.top = a; a++; if (V(a) === "(" && M[a] !== undefined) a = M[a] + 1; else a++; if (KWd(a) === "PERCENT") a++; if (KWd(a) === "WITH" && KWd(a + 1) === "TIES") a += 2; }
      var firstCl = b.end + 1;
      Object.keys(b.cl).forEach(function (c) { if (b.cl[c] < firstCl) firstCl = b.cl[c]; });
      b.ls = a; b.le = firstCl - 1;
      b.items = splitList(a, b.le);
      b.items.forEach(itemInfo);
      // clause ranges
      var starts = Object.keys(b.cl).map(function (c) { return [c, b.cl[c]]; }).sort(function (x, y) { return x[1] - y[1]; });
      b.rng = {};
      starts.forEach(function (x, j) {
        var from = x[1] + ((x[0] === "GROUP" || x[0] === "ORDER") ? 2 : 1), to = j + 1 < starts.length ? starts[j + 1][1] - 1 : b.end;
        b.rng[x[0]] = [from, to];
      });
      return b;
    }
    function splitList(a, e) {
      var out = [], st = a, cd = 0;
      for (var k = a; k <= e + 1; k++) {
        if (k <= e && V(k) === "(" && M[k] !== undefined) { k = M[k]; continue; }
        if (k <= e && KWd(k) === "CASE") cd++;
        if (k <= e && KWd(k) === "END" && cd) cd--;
        if (k > e || (V(k) === "," && cd === 0)) { out.push({ s: st, e: k - 1, comma: k <= e ? k : -1 }); st = k + 1; }
      }
      return out;
    }
    function itemInfo(it) {
      var s = it.s, e = it.e;
      it.es = s; it.ee = e; it.name = ""; it.alias = false;
      if (e < s) return;
      if (isName(s) && V(s + 1) === "=" && e > s + 1) { it.name = T[s].u; it.es = s + 2; it.alias = true; }
      else if (T[s] && T[s].t === "var" && (V(s + 1) === "=" || /^[+\-*\/]=$/.test(V(s + 1)))) { it.assign = true; it.es = s + 2; }
      else if (KWd(e - 1) === "AS" && e - 1 > s) { it.name = T[e].u; it.ee = e - 2; it.alias = true; }
      else if (e > s && (isName(e) || T[e].t === "str") && V(e - 1) !== "." && (V(e - 1) === ")" || KWd(e - 1) === "END" || isName(e - 1) || /^(num|str|id)$/.test(T[e - 1].t))) {
        it.name = T[e].u; it.ee = e - 1; it.alias = true; it.implicit = true;
      }
      if (V(it.ee) === "*") it.star = true;
      var es = it.es, ee = it.ee;
      it.simple = (es === ee && isName(es)) || (ee - es >= 2 && isName(ee) && V(ee - 1) === "." && chainOK(es, ee));
      if (!it.name && it.simple) it.name = T[ee].u;
      it.norm = norm(es, ee);
    }
    function chainOK(a, b) { for (var k = a; k <= b; k++) { if ((k - a) % 2 === 0 ? !isName(k) && !(T[k] && T[k].t === "id") : V(k) !== ".") return false; } return true; }

    // Column references outside aggregates/subqueries in [a, b]
    function refs(a, b, opt) {
      opt = opt || {};
      var out = [], hasAgg = false, aggAt = -1, winAt = -1;
      for (var t = a; t <= b; t++) {
        var tk = T[t]; if (!tk) break;
        if (V(t) === "(" && M[t] !== undefined) { if (isSubq(t)) { t = M[t]; } continue; }
        if (tk.t !== "word" && tk.t !== "id") continue;
        var u = tk.u;
        if (V(t + 1) === "(" && M[t + 1] !== undefined && tk.t === "word") {
          var close = M[t + 1];
          if (u === "OVER") { t = close; continue; }
          if (AGG[u]) {
            if (KWd(close + 1) === "OVER") { if (winAt < 0) winAt = t; t = (V(close + 2) === "(" && M[close + 2] !== undefined) ? M[close + 2] : close; continue; }
            hasAgg = true; if (aggAt < 0) aggAt = t;
            if (opt.inAgg) opt.inAgg(t, t + 1, close);
            t = close; continue;
          }
          if (WIN[u]) { if (winAt < 0) winAt = t; t = close; if (KWd(t + 1) === "OVER" && V(t + 2) === "(" && M[t + 2] !== undefined) t = M[t + 2]; continue; }
          if (DPF[u]) { t = t + 2; continue; } // skip the datepart argument
          continue; // other function: look at its arguments
        }
        if (tk.t === "word" && K2[u]) continue;
        if (V(t - 1) === ".") continue;
        if (tk.t === "word" && (TY[u] || KWd(t - 1) === "AS" || KWd(t - 1) === "COLLATE")) continue;
        if (V(t + 1) === "." && (isName(t + 2) || T[t + 2] && T[t + 2].t === "id" || V(t + 2) === "*")) {
          var j = t; while (V(j + 1) === "." && T[j + 2] && (T[j + 2].t === "word" || T[j + 2].t === "id" || V(j + 2) === "*")) j += 2;
          if (V(j + 1) === "(") { t = j; continue; } // schema.function( or .method(
          out.push({ i: t, j: j, q: T[j - 2].u, c: V(j) === "*" ? "*" : T[j].u });
          t = j; continue;
        }
        if (tk.t === "id" || !K2[u]) out.push({ i: t, j: t, q: null, c: u });
      }
      return { refs: out, hasAgg: hasAgg, aggAt: aggAt, winAt: winAt };
    }

    // ================= FROM parsing (per block) =================
    var objTok = {}, defined = {}, aliasedNames = {}, usableNames = {}, aliasTable = {}, fromItems = [];
    ["INSERTED", "DELETED"].forEach(function (x) { defined[x] = 1; usableNames[x] = 1; });
    function readObj(p) {
      var o = { at: p, name: "", alias: "", kind: "table", parts: [] }, k = p;
      if (V(k) === "(" && M[k] !== undefined) { o.kind = KWd(k + 1) === "VALUES" ? "values" : "derived"; o.sub = k; k = M[k] + 1; }
      else if (isObjName(k)) {
        o.parts.push(T[k].u); objTok[k] = 1;
        while (V(k + 1) === "." && T[k + 2] && (T[k + 2].t === "word" || T[k + 2].t === "id")) { k += 2; o.parts.push(T[k].u); objTok[k] = 1; }
        o.name = T[k].u; o.nameAt = k;
        if (T[p].t === "var") o.kind = "var"; else if (o.name[0] === "#") o.kind = "temp";
        k++;
        if (V(k) === "(" && M[k] !== undefined) { o.kind = "function"; k = M[k] + 1; }
      } else return null;
      if (KWd(k) === "AS") k++;
      if (isName(k) && !JOINW[KWd(k)]) { o.alias = T[k].u; o.aliasAt = k; k++; if (V(k) === "(" && M[k] !== undefined && (o.kind === "values" || o.kind === "function" || o.kind === "derived")) k = M[k] + 1; }
      if (KWd(k) === "WITH" && V(k + 1) === "(" && M[k + 1] !== undefined) k = M[k + 1] + 1;
      if ((KWd(k) === "PIVOT" || KWd(k) === "UNPIVOT") && V(k + 1) === "(" && M[k + 1] !== undefined) {
        k = M[k + 1] + 1; if (KWd(k) === "AS") k++; if (isName(k)) { o.alias = T[k].u; o.aliasAt = k; k++; }
      }
      o.end = k - 1; o.key = o.alias || o.name;
      return o;
    }
    blocks.forEach(function (b) {
      var r = b.rng.FROM; b.joins = []; b.items2 = [];
      if (!r) return;
      var k = r[0], kind = "FROM";
      while (k <= r[1]) {
        var o = readObj(k);
        if (!o) { k++; continue; }
        o.jk = kind; b.items2.push(o);
        k = o.end + 1;
        // ON condition
        if (KWd(k) === "ON") {
          var on = k, e = k + 1;
          for (; e <= r[1]; e++) { if (V(e) === "(" && M[e] !== undefined) { e = M[e]; continue; } if (JOINW[KWd(e)] || V(e) === ",") break; }
          o.on = [on + 1, e - 1]; k = e;
        }
        // next item
        if (V(k) === ",") { kind = "comma"; k++; continue; }
        var js = k, jw = [];
        while (JOINW[KWd(k)] || /^(HASH|LOOP|MERGE|REMOTE)$/.test(KWd(k))) { jw.push(KWd(k)); if (KWd(k) === "JOIN" || KWd(k) === "APPLY") { k++; break; } k++; }
        if (jw.length) { kind = jw.join(" "); o.nextJoinAt = js; continue; }
        k++;
      }
      b.items2.forEach(function (o) {
        if (o.alias) { defined[o.alias] = 1; usableNames[o.alias] = 1; if (o.name && o.name !== o.alias) aliasedNames[o.name] = o.alias; }
        else if (o.name) { defined[o.name] = 1; usableNames[o.name] = 1; }
        if (o.key) (aliasTable[o.key] = aliasTable[o.key] || []).push(o);
        fromItems.push(o);
      });
    });
    // Other places names get defined
    for (var d = 0; d < N; d++) {
      var du = KWd(d);
      if ((du === "AS" || V(d) === ")") && isName(d + 1)) { defined[T[d + 1].u] = 1; usableNames[T[d + 1].u] = 1; }
      if (/^(UPDATE|INTO|INSERT|DELETE|MERGE|USING|TABLE|EXEC|EXECUTE|PROC|PROCEDURE|VIEW|FUNCTION|TRIGGER|INDEX|JOIN|APPLY|FROM)$/.test(du) && isObjName(d + 1)) {
        var q = d + 1; objTok[q] = 1; while (V(q + 1) === "." && T[q + 2]) { q += 2; objTok[q] = 1; }
        var nm = T[q].u, al2 = KWd(q + 1) === "AS" && isName(q + 2) ? T[q + 2].u : (isName(q + 1) && !JOINW[KWd(q + 1)] ? T[q + 1].u : "");
        defined[nm] = 1;
        if (al2) { defined[al2] = 1; usableNames[al2] = 1; if (al2 !== nm) aliasedNames[nm] = aliasedNames[nm] || al2; }
        else usableNames[nm] = 1;
      }
    }
    // CTEs
    var ctes = [];
    for (var c = 0; c < N; c++) {
      if (KWd(c) !== "WITH" || !isName(c + 1)) continue;
      var x = c + 1, ok = false;
      if (KWd(x + 1) === "AS" && V(x + 2) === "(") ok = true;
      else if (V(x + 1) === "(" && M[x + 1] !== undefined && KWd(M[x + 1] + 1) === "AS" && V(M[x + 1] + 2) === "(") ok = true;
      if (!ok) continue;
      // CTE must start a statement
      var pv = c - 1;
      if (pv >= 0 && V(pv) !== ";" && !/^(AS|BEGIN|GO|THEN|ELSE)$/.test(KWd(pv)) && V(pv) !== "(")
        add("structure", "error", c, c + 1, "Put ; before WITH", "When a CTE isn't the first statement, the statement before it has to end with a semicolon, or SQL Server reports 'Incorrect syntax near the keyword WITH'.", ";WITH " + T[c + 1].v + " AS (");
      while (isName(x)) {
        var def = { name: T[x].u, at: x, cols: null };
        var y = x + 1;
        if (V(y) === "(" && M[y] !== undefined) { def.cols = splitList(y + 1, M[y] - 1); y = M[y] + 1; }
        if (KWd(y) !== "AS" || V(y + 1) !== "(" || M[y + 1] === undefined) break;
        def.body = [y + 1, M[y + 1]]; ctes.push(def); defined[def.name] = 1; usableNames[def.name] = 1;
        x = M[y + 1] + 1;
        if (V(x) === ",") x++; else break;
      }
    }

    // ================= STEP 2: NAMES =================
    for (var r0 = 0; r0 < N; r0++) {
      if (!isName(r0) && !(T[r0] && T[r0].t === "id")) continue;
      if (V(r0 - 1) === "." || V(r0 + 1) !== "." || objTok[r0]) continue;
      if (!(isName(r0 + 2) || (T[r0 + 2] && T[r0 + 2].t === "id") || V(r0 + 2) === "*")) continue;
      if (V(r0 + 3) === "." || V(r0 + 3) === "(") continue;
      if (/^(AS|EXEC|EXECUTE)$/.test(KWd(r0 - 1))) continue;
      var qn = T[r0].u;
      if (aliasedNames[qn] && !usableNames[qn]) {
        add("names", "error", r0, r0 + 2, T[r0].v + " is aliased", T[r0].v + " is given the alias " + aliasedNames[qn].toLowerCase() + " in FROM, so the full name can't be used here ('multi-part identifier could not be bound').", aliasedNames[qn].toLowerCase() + "." + (T[r0 + 2].v || "*"));
        continue;
      }
      if (defined[qn]) continue;
      var known = Object.keys(aliasTable);
      add("names", "error", r0, r0 + 2, "Unknown alias " + T[r0].v, "There's no table or alias called " + T[r0].v + " in this query, so SQL Server says 'multi-part identifier could not be bound'." + (known.length ? " Aliases here: " + known.map(function (k) { return k.toLowerCase(); }).join(", ") + "." : ""));
    }
    // duplicate aliases in one FROM
    blocks.forEach(function (b) {
      var seen = {};
      (b.items2 || []).forEach(function (o) {
        if (!o.key) return;
        if (seen[o.key]) add("names", "error", o.aliasAt || o.nameAt || o.at, o.aliasAt || o.nameAt || o.at, "Alias " + o.key.toLowerCase() + " used twice", "Two tables in the same FROM can't share a name or alias. Give one a different alias.");
        seen[o.key] = 1;
      });
    });
    // variables
    (function () {
      var declared = {}, used = [], hasDecl = false, hasProc = false;
      for (var k = 0; k < N; k++) {
        var u = KWd(k);
        if (u === "DECLARE") {
          hasDecl = true; var dp = 0, e = k + 1;
          if (T[e] && T[e].t === "var") declared[T[e].u] = declared[T[e].u] || e;
          for (; e < N; e++) {
            if (V(e) === "(" && M[e] !== undefined) { e = M[e]; continue; }
            if (V(e) === ";" || (e > k + 1 && /^(SELECT|SET|IF|WHILE|BEGIN|END|INSERT|UPDATE|DELETE|EXEC|EXECUTE|PRINT|RETURN|WITH|DECLARE|GO|MERGE|TRUNCATE|CREATE|DROP)$/.test(KWd(e)) && KWd(e - 1) !== "CURSOR" && KWd(e - 1) !== "FOR")) break;
            if (V(e) === "," && T[e + 1] && T[e + 1].t === "var") declared[T[e + 1].u] = declared[T[e + 1].u] || e + 1;
          }
        }
        if ((u === "PROC" || u === "PROCEDURE" || u === "FUNCTION") && /^(CREATE|ALTER|OR)$/.test(KWd(k - 1))) {
          hasProc = true;
          for (var e2 = k + 1; e2 < N && KWd(e2) !== "AS"; e2++) { if (V(e2) === "(" && M[e2] !== undefined && KWd(e2 - 1) === "TABLE") { e2 = M[e2]; continue; } if (T[e2].t === "var") declared[T[e2].u] = e2; }
        }
      }
      var inExec = -1;
      for (k = 0; k < N; k++) {
        if (/^(EXEC|EXECUTE)$/.test(KWd(k))) inExec = k;
        if (V(k) === ";" || STOP[KWd(k)] && !/^(EXEC|EXECUTE)$/.test(KWd(k))) inExec = -1;
        var t = T[k];
        if (t.t !== "var" || t.u.indexOf("@@") === 0) continue;
        if (inExec >= 0 && V(k + 1) === "=") continue;
        if (declared[t.u] === k) continue;
        used.push(k);
      }
      if (!hasDecl && !hasProc) {
        var names = {}; used.forEach(function (k) { names[T[k].v] = 1; });
        var list = Object.keys(names);
        if (list.length) add("names", "info", used[0], used[0], "Parameters: " + list.slice(0, 6).join(", ") + (list.length > 6 ? " …" : ""), "None of these are declared, which is right for an SSRS dataset (they come from report parameters). To run this in SSMS, DECLARE them at the top first.",
          list.slice(0, 6).map(function (n) { return "DECLARE " + n + " varchar(50) = '...';"; }).join("\n"));
      } else {
        var flagged = {};
        used.forEach(function (k) {
          if (declared[T[k].u] !== undefined || flagged[T[k].u]) return; flagged[T[k].u] = 1;
          add("names", "error", k, k, T[k].v + " isn't declared", "SQL Server will say 'Must declare the scalar variable " + T[k].v + "'. Add a DECLARE, or check the spelling.", "DECLARE " + T[k].v + " varchar(50);");
        });
        Object.keys(declared).forEach(function (v) {
          if (!used.some(function (k) { return T[k].u === v; })) add("names", "info", declared[v], declared[v], T[declared[v]].v + " is never used", "Declared but not used anywhere. Safe to remove.");
        });
      }
    })();
    // CTE checks
    ctes.forEach(function (c) {
      var uses = 0;
      for (var k = 0; k < N; k++) if (k !== c.at && (T[k].t === "word" || T[k].t === "id") && T[k].u === c.name && V(k - 1) !== "." && V(k + 1) !== ".") uses++;
      if (!uses) add("names", "warn", c.at, c.at, "CTE " + T[c.at].v + " is never used", "It's defined but nothing selects from it. Remove it, or you may be selecting from the wrong one.");
      if (c.cols) {
        var bb = blocks.filter(function (b) { return b.sel > c.body[0] && b.enc === c.body[0]; })[0];
        if (bb && !bb.items.some(function (it) { return it.star; }) && bb.items.length !== c.cols.length)
          add("shape", "error", c.at, c.at, "CTE " + T[c.at].v + ": " + c.cols.length + " names, " + bb.items.length + " columns", "The column list after the CTE name must have one name per column in its SELECT.");
      }
    });

    // ================= STEP 3: QUERY SHAPE =================
    var createView = -1;
    for (var cv = 0; cv < N; cv++) if (/^(CREATE|ALTER)$/.test(KWd(cv)) && (KWd(cv + 1) === "VIEW" || (KWd(cv + 1) === "OR" && KWd(cv + 3) === "VIEW"))) createView = cv;
    blocks.forEach(function (b, bi) {
      var items = b.items;
      // empty select list / trailing commas
      if (!items.length || (items.length === 1 && items[0].e < items[0].s)) add("structure", "error", b.sel, b.sel, "Nothing selected", "SELECT needs at least one column.");
      items.forEach(function (it, ii) {
        if (it.e < it.s && items.length > 1) {
          if (ii === items.length - 1 && items[ii - 1] && items[ii - 1].comma >= 0) add("structure", "error", items[ii - 1].comma, items[ii - 1].comma, "Comma before " + (T[b.le + 1] ? T[b.le + 1].v.toUpperCase() : "the end"), "The last column has a comma after it.");
          else if (ii === 0) add("structure", "error", b.sel, b.sel + 1, "Comma straight after SELECT", "The column list starts with a comma.");
        }
      });
      // missing commas inside one item
      items.forEach(function (it) {
        for (var t = it.es; t <= it.ee; t++) {
          if (V(t) === "(" && M[t] !== undefined) { t = M[t]; continue; }
          if (t === it.es) continue;
          if (!(isName(t) || (T[t] && T[t].t === "id")) || V(t + 1) !== "." || V(t - 1) === ".") continue;
          if (!(isName(t + 2) || (T[t + 2] && T[t + 2].t === "id") || V(t + 2) === "*")) continue;
          var pv = t - 1, pt = T[pv];
          var ends = pt && (pt.t === "num" || pt.t === "str" || V(pv) === ")" || KWd(pv) === "END" || pt.t === "id" || (pt.t === "word" && !K2[pt.u]));
          if (ends) { add("structure", "error", pv, t + 2, "Missing comma", "Two columns sit next to each other with no comma between them, so SQL Server reports 'Incorrect syntax near .'.", txt(it.es, pv) + ", " + txt(t, t + 2)); break; }
        }
        if (it.implicit && it.simple === false && it.ee >= it.es && isName(it.ee) && V(it.ee - 1) === "." && it.ee - it.es === 2)
          add("logic", "info", it.ee + 1, it.ee + 1, T[it.ee + 1].v + " becomes a column name", txt(it.es, it.ee) + " " + T[it.ee + 1].v + " renames the column to " + T[it.ee + 1].v + ". If you meant two columns, add a comma; if it's a rename, AS makes that clear.", txt(it.es, it.ee) + " AS " + T[it.ee + 1].v);
      });
      if (!items.length || items[0].e < items[0].s) return;

      var ctxPrev = b.enc >= 0 ? b.enc - 1 : -1, pw = KWd(ctxPrev), pvOp = V(ctxPrev);
      var isCteBody = ctes.some(function (c) { return c.body[0] === b.enc; });
      var cteWithCols = ctes.some(function (c) { return c.body[0] === b.enc && c.cols; });
      var isDerived = b.enc >= 0 && fromItems.some(function (o) { return o.sub === b.enc; });
      var isScalar = b.enc >= 0 && !isCteBody && !isDerived && !/^(IN|EXISTS|AS|INSERT|INTO|VALUES)$/.test(pw) && (CMP[pvOp] || /^[+\-*\/%]$/.test(pvOp) || pvOp === "(" || pvOp === "," || /^(SELECT|THEN|ELSE|WHEN|RETURN|SET|ISNULL|COALESCE)$/.test(pw) || V(ctxPrev) === "=");
      var isIn = b.enc >= 0 && pw === "IN";
      var unionFollower = blocks.some(function (o) { return o.termAt >= 0 && (o.termAt === b.sel - 1 || o.termAt === b.sel - 2); });
      var noStar = !items.some(function (it) { return it.star; });

      // unnamed / duplicate output columns
      var needNames = !unionFollower && (((isCteBody && !cteWithCols) || isDerived) || b.cl.INTO !== undefined);
      var seen = {};
      items.forEach(function (it) {
        if (it.assign || it.star) return;
        if (needNames && !it.name) add("shape", "error", it.es, it.ee, "Column has no name", "Columns from a " + (b.cl.INTO !== undefined ? "SELECT INTO" : isCteBody ? "CTE" : "derived table") + " need a name. Add AS SomeName.", txt(it.es, it.ee) + " AS NewName");
        if (it.name && !unionFollower) {
          if (seen[it.name] !== undefined) add("shape", isCteBody || isDerived || b.cl.INTO !== undefined ? "error" : "warn", it.es, it.e, "Two columns called " + T[it.e].v.replace(/^.*\./, ""),
            isCteBody || isDerived || b.cl.INTO !== undefined ? "Columns in a CTE, derived table or SELECT INTO must have different names." : "SSRS datasets and Excel exports get confused by repeated column names. Rename one with AS.");
          seen[it.name] = 1;
        }
      });
      // scalar subquery shape
      if ((isScalar || isIn) && items.length > 1 && noStar) add("shape", "error", b.sel, b.sel, "Subquery returns " + items.length + " columns", "A subquery used " + (isIn ? "with IN" : "as a single value") + " can only return one column.");
      if (isScalar && !b.top && b.cl.FOR === undefined && !b.cl.GROUP && !items.some(function (it) { return refs(it.es, it.ee).hasAgg; }))
        add("logic", "info", b.sel, b.sel, "Subquery could return more than one row", "If more than one row matches, the whole query fails with 'Subquery returned more than 1 value'. Add TOP 1 with an ORDER BY, or an aggregate like MAX().", "(SELECT TOP 1 ... ORDER BY ...)");
      // ORDER BY placement
      if (b.cl.ORDER !== undefined && b.enc >= 0 && !b.top && b.cl.OFFSET === undefined && b.cl.FOR === undefined)
        add("shape", "error", b.cl.ORDER, b.cl.ORDER + 1, "ORDER BY inside a subquery", "SQL Server doesn't allow ORDER BY in a subquery, CTE or derived table unless it also has TOP, OFFSET or FOR XML. Move the ORDER BY to the outer query.");
      if (b.cl.ORDER !== undefined && b.enc < 0 && createView >= 0 && createView < b.sel && !b.top && b.cl.OFFSET === undefined)
        add("shape", "error", b.cl.ORDER, b.cl.ORDER + 1, "ORDER BY in a view", "Views can't have ORDER BY (unless TOP or OFFSET is used, and even then the order isn't guaranteed). Sort where you select from the view.");
      if (b.cl.ORDER !== undefined && b.term) add("shape", "error", b.cl.ORDER, b.cl.ORDER + 1, "ORDER BY before " + b.term, "Only the last SELECT in a " + b.term + " can have ORDER BY, and it sorts the combined result.");
      // UNION column counts
      if (b.term) {
        var nb = blocks.filter(function (o) { return o.sel === b.termAt + 1 || o.sel === b.termAt + 2; })[0];
        if (nb && noStar && !nb.items.some(function (it) { return it.star; }) && nb.items.length !== items.length && nb.items[0].e >= nb.items[0].s)
          add("shape", "error", b.termAt, b.termAt, b.term + ": " + items.length + " columns vs " + nb.items.length, "Every SELECT in a " + b.term + " must return the same number of columns, in the same order.");
      }
      // no FROM but qualified columns
      if (b.cl.FROM === undefined && b.enc < 0) {
        var q0 = refs(b.ls, b.le).refs.filter(function (r) { return r.q; })[0];
        if (q0) add("shape", "error", q0.i, q0.j, "No FROM", T[q0.i].v + "." + T[q0.j].v + " is used but this SELECT has no FROM.");
      }
      // aggregates and GROUP BY
      var all = items.map(function (it) { return refs(it.es, it.ee); });
      var anyAgg = all.some(function (r) { return r.hasAgg; });
      var grp = b.rng.GROUP;
      if (grp) {
        var gItems = splitList(grp[0], grp[1]).map(function (g) { return norm(g.s, g.e); });
        var gRefs = refs(grp[0], grp[1]).refs;
        var inG = function (r) { return gRefs.some(function (g) { return g.c === r.c && (g.q === r.q || !g.q || !r.q); }); };
        items.forEach(function (it, ii) {
          if (it.assign && !it.name) {}
          if (gItems.indexOf(it.norm) >= 0) return;
          var multi = gItems.filter(function (g) { return g.indexOf(" ") > 0 && it.norm.indexOf(g) >= 0; });
          var bad = all[ii].refs.filter(function (r) { return r.c !== "*" && !inG(r) && !multi.some(function (g) { return g.indexOf(r.c) >= 0; }); })[0];
          if (it.star && !it.ee) return;
          if (bad) add("shape", "error", bad.i, bad.j, txt(bad.i, bad.j) + " isn't grouped", txt(bad.i, bad.j) + " is in SELECT but not in GROUP BY or inside an aggregate like MAX(). SQL Server rejects this.", "GROUP BY ..., " + txt(bad.i, bad.j) + "\n-- or MAX(" + txt(bad.i, bad.j) + ")");
          else if (it.star) add("shape", "error", it.es, it.ee, "* with GROUP BY", "SELECT * can't be used with GROUP BY; list the grouped columns.");
        });
        var ga = refs(grp[0], grp[1]);
        if (ga.hasAgg) add("shape", "error", ga.aggAt, ga.aggAt, "Aggregate in GROUP BY", "You can't group by COUNT/SUM/etc. Group by the columns, and put the aggregate in SELECT.");
      } else if (anyAgg) {
        items.forEach(function (it, ii) {
          if (all[ii].hasAgg) {
            // columns outside the aggregate in the same item
            var o = all[ii].refs.filter(function (r) { return r.c !== "*"; })[0];
            if (o) add("shape", "error", o.i, o.j, txt(o.i, o.j) + " needs GROUP BY", "This mixes an aggregate with a plain column and there's no GROUP BY.", "GROUP BY " + txt(o.i, o.j));
            return;
          }
          var r = all[ii].refs.filter(function (x) { return x.c !== "*"; })[0];
          if (r || it.star) add("shape", "error", r ? r.i : it.es, r ? r.j : it.ee, (r ? txt(r.i, r.j) : "*") + " needs GROUP BY", "Other columns use COUNT/SUM/etc., so every plain column must be in a GROUP BY.", "GROUP BY " + (r ? txt(r.i, r.j) : "..."));
        });
      }
      if (b.rng.HAVING && !grp && !anyAgg && !refs(b.rng.HAVING[0], b.rng.HAVING[1]).hasAgg)
        add("shape", "warn", b.cl.HAVING, b.cl.HAVING, "HAVING without GROUP BY", "HAVING filters groups. With no GROUP BY or aggregate, use WHERE.");
      // aggregates / window functions where they aren't allowed
      var ranges = [["WHERE", b.rng.WHERE]];
      (b.items2 || []).forEach(function (o) { if (o.on) ranges.push(["ON", o.on]); });
      ranges.forEach(function (pair) {
        var rg = pair[1]; if (!rg) return; pair = [pair[0], pair[0]];
        var rr = refs(rg[0], rg[1]);
        if (rr.hasAgg) add("shape", "error", rr.aggAt, rr.aggAt, "Aggregate in " + pair[1], "COUNT/SUM/etc. can't be used in " + pair[1] + ". Filter on aggregates with HAVING, after GROUP BY.", "HAVING " + T[rr.aggAt].v + "(...) ...");
        if (rr.winAt >= 0) add("shape", "error", rr.winAt, rr.winAt, "Window function in " + pair[1], T[rr.winAt].v + "() can only be used in SELECT or ORDER BY. Work it out in a CTE or derived table, then filter outside.", "WITH x AS (SELECT ..., " + T[rr.winAt].v + "() OVER (...) AS rn FROM ...)\nSELECT ... FROM x WHERE rn = 1");
      });
      // SELECT aliases used in WHERE / GROUP BY
      var al = {}; items.forEach(function (it) { if (it.alias && it.name && !it.simple) al[it.name] = it; });
      ["WHERE", "GROUP"].forEach(function (cn) {
        var rg = b.rng[cn]; if (!rg) return;
        refs(rg[0], rg[1]).refs.forEach(function (r) {
          if (!r.q && al[r.c]) add("names", "warn", r.i, r.j, T[r.i].v + " is a SELECT alias", (cn === "GROUP" ? "GROUP BY" : "WHERE") + " runs before SELECT, so it can't see the alias " + T[r.i].v + " ('Invalid column name'). Repeat the expression, or wrap the query in a CTE and filter outside.", txt(al[r.c].es, al[r.c].ee));
        });
      });
      // JOIN / ON checks
      var needOn = 0, haveOn = 0;
      (b.items2 || []).forEach(function (o) {
        var cross = /CROSS|APPLY|FROM|comma/.test(o.jk);
        if (!cross) needOn++; if (o.on) haveOn++;
      });
      (b.items2 || []).forEach(function (o) {
        var cross = /CROSS|APPLY|FROM|comma/.test(o.jk);
        if (!cross && !o.on && haveOn < needOn) add("shape", "error", o.at, o.end, o.jk + " without ON", "Every " + o.jk + " needs an ON condition. If you really want every row matched to every row, use CROSS JOIN.", o.jk + " " + txt(o.at, o.end) + " ON " + (o.key || "x").toLowerCase() + ".Key = ...");
        if (/APPLY/.test(o.jk) && o.on) add("shape", "error", o.on[0] - 1, o.on[0] - 1, "APPLY doesn't take ON", "Put the condition in the WHERE inside the APPLY subquery instead.");
        if (o.jk === "CROSS JOIN" && o.on) add("shape", "error", o.on[0] - 1, o.on[0] - 1, "CROSS JOIN with ON", "CROSS JOIN has no ON. Use INNER JOIN if you need a condition.");
        if (!o.on) return;
        var rr = refs(o.on[0], o.on[1]).refs, qs = {};
        rr.forEach(function (r) { if (r.q) qs[r.q] = 1; });
        if (Object.keys(qs).length && o.key && !qs[o.key] && !(o.name && qs[o.name]))
          add("logic", "warn", o.on[0] - 1, o.on[1], "ON doesn't use " + o.key.toLowerCase(), "This join's condition never mentions " + o.key.toLowerCase() + ", so every " + o.key.toLowerCase() + " row matches and rows multiply. It's usually a copy-paste slip in the alias.");
        for (var t = o.on[0]; t <= o.on[1]; t++) {
          if (T[t] && T[t].t === "num" && V(t + 1) === "=" && T[t + 2] && T[t + 2].t === "num" && T[t].v === T[t + 2].v)
            add("logic", "warn", t, t + 2, "ON " + txt(t, t + 2), "Always true, so this is really a CROSS JOIN: every row matches every row.");
        }
      });
      // comparisons that are always true / never true
      ["WHERE", "FROM", "HAVING"].forEach(function (cn) {
        var rg = b.rng[cn]; if (!rg) return;
        for (var t = rg[0]; t <= rg[1]; t++) {
          if (V(t) === "(" && isSubq(t)) { t = M[t]; continue; }
          if (V(t) !== "=" && V(t) !== "<>" && V(t) !== "!=") continue;
          var L = sideLeft(t), R = sideRight(t);
          if (L && R && L.n === R.n && L.ref && V(L.a - 1) !== "." && V(R.b + 1) !== ".")
            add("logic", "warn", L.a, R.b, "Compares " + txt(L.a, L.b) + " with itself", V(t) === "=" ? "Always true (except for NULLs), so it doesn't filter anything. One side probably needs a different alias." : "Never true. One side probably needs a different alias.");
        }
        if (cn !== "WHERE") return;
        // contradictions: x = 1 AND x = 2 with no OR at this level
        var hasOr = false, eqs = {};
        for (t = rg[0]; t <= rg[1]; t++) { if (V(t) === "(" && M[t] !== undefined) { t = M[t]; continue; } if (KWd(t) === "OR") hasOr = true; }
        if (hasOr) return;
        for (t = rg[0]; t <= rg[1]; t++) {
          if (V(t) === "(" && M[t] !== undefined) { t = M[t]; continue; }
          if (V(t) !== "=") continue;
          var L2 = sideLeft(t), R2 = sideRight(t);
          if (!L2 || !R2 || !L2.ref || R2.lit === undefined) continue;
          if (KWd(L2.a - 1) === "BETWEEN" || KWd(L2.a - 1) === "WHEN") continue;
          if (eqs[L2.n] !== undefined && eqs[L2.n].v !== R2.lit) add("logic", "error", eqs[L2.n].i, R2.b, txt(L2.a, L2.b) + " can't equal both", txt(L2.a, L2.b) + " = " + eqs[L2.n].v + " AND " + txt(L2.a, L2.b) + " = " + R2.lit + " can never both be true, so no rows come back. Did you mean IN (...) or OR?", txt(L2.a, L2.b) + " IN (" + eqs[L2.n].v + ", " + R2.lit + ")");
          else eqs[L2.n] = { v: R2.lit, i: L2.a };
        }
      });
    });
    function sideLeft(t) { // column ref or literal just before operator t
      var k = t - 1; if (!T[k]) return null;
      if (T[k].t === "num" || T[k].t === "str") return { a: k, b: k, n: norm(k, k), lit: T[k].t === "str" ? "'" + T[k].v + "'" : T[k].v };
      if (!(isName(k) || T[k].t === "id")) return null;
      var a = k; while (V(a - 1) === "." && T[a - 2] && (T[a - 2].t === "word" || T[a - 2].t === "id")) a -= 2;
      return { a: a, b: k, n: norm(a, k), ref: true };
    }
    function sideRight(t) {
      var k = t + 1; if (!T[k]) return null;
      if (V(k) === "-" && T[k + 1] && T[k + 1].t === "num") return { a: k, b: k + 1, n: "-" + T[k + 1].v, lit: "-" + T[k + 1].v };
      if (T[k].t === "num" || T[k].t === "str") { if (V(k + 1) === "+" || V(k + 1) === "-" || V(k + 1) === "*" || V(k + 1) === "/") return null; return { a: k, b: k, n: norm(k, k), lit: T[k].t === "str" ? "'" + T[k].v + "'" : T[k].v }; }
      if (!(isName(k) || T[k].t === "id") || V(k + 1) === "(") return null;
      var b = k; while (V(b + 1) === "." && T[b + 2] && (T[b + 2].t === "word" || T[b + 2].t === "id")) b += 2;
      if (V(b + 1) === "(" || /^[+\-*\/]$/.test(V(b + 1))) return null;
      return { a: k, b: b, n: norm(k, b), ref: true };
    }

    // INSERT column counts / UPDATE and DELETE without WHERE / temp tables
    var temps = {};
    for (var k = 0; k < N; k++) {
      var u = KWd(k);
      if (u === "GO") temps = {};
      if (u === "INSERT") {
        var p = k + 1; if (KWd(p) === "INTO") p++;
        if (!isObjName(p)) continue;
        while (V(p + 1) === "." && T[p + 2]) p += 2;
        p++;
        if (V(p) === "(" && M[p] !== undefined) {
          var cols = splitList(p + 1, M[p] - 1).length, q = M[p] + 1;
          if (KWd(q) === "VALUES") {
            q++;
            while (V(q) === "(" && M[q] !== undefined) {
              var nv = splitList(q + 1, M[q] - 1).length;
              if (nv !== cols) add("shape", "error", q, M[q], "INSERT: " + cols + " columns, " + nv + " values", "The VALUES list must have one value per column in the INSERT column list.");
              q = M[q] + 1; if (V(q) === ",") q++; else break;
            }
          } else if (KWd(q) === "SELECT" || KWd(q) === "WITH") {
            var sb = blocks.filter(function (b) { return b.sel >= q && b.enc < 0; })[0];
            if (sb && !sb.items.some(function (it) { return it.star; }) && sb.items.length !== cols)
              add("shape", "error", k, sb.sel, "INSERT: " + cols + " columns, SELECT gives " + sb.items.length, "The SELECT must return one column per column in the INSERT list, in the same order.");
          }
        } else if (KWd(p) === "VALUES" || KWd(p) === "SELECT") {
          add("logic", "info", k, p - 1, "INSERT without a column list", "This relies on the table's column order and breaks if a column is added. List the columns.", "INSERT INTO " + txt(k + 1 + (KWd(k + 1) === "INTO" ? 1 : 0), p - 1) + " (Col1, Col2, ...)");
        }
      }
      if ((u === "UPDATE" || u === "DELETE") && KWd(k - 1) !== "THEN" && V(k + 1) !== "(" && KWd(k + 1) !== "STATISTICS" && !(u === "DELETE" && /^(ON|FOR|AFTER|INSTEAD|OF|,)$/.test(KWd(k - 1) || V(k - 1))) && !(u === "UPDATE" && /^(ON|FOR|AFTER|INSTEAD|OF|,)$/.test(KWd(k - 1) || V(k - 1)))) {
        var sets = 0, where = false, e;
        for (e = k + 1; e < N; e++) {
          if (V(e) === "(" && M[e] !== undefined) { e = M[e]; continue; }
          if (V(e) === ";") break;
          var w = KWd(e);
          if (w === "SET") { sets++; if (sets > 1 || u === "DELETE") break; continue; }
          if (w === "WHERE") { where = true; break; }
          if (w === "WITH" && V(e + 1) === "(") continue;
          if (STOP[w] || w === "END" || w === "ELSE" || (w === "WITH" && isName(e + 1))) break;
        }
        if (!where) add("logic", "warn", k, k, u + " without WHERE", u === "UPDATE" ? "This changes every row in the table. Add a WHERE, or run it as a SELECT first to see which rows it hits." : "This deletes every row in the table. Add a WHERE (or use TRUNCATE if you really mean all rows).");
      }
      // temp tables created twice in one batch
      var tn = null;
      if (u === "INTO" && T[k + 1] && T[k + 1].v[0] === "#" && KWd(k - 1) !== "INSERT") tn = T[k + 1].u;
      if (u === "TABLE" && KWd(k - 1) === "CREATE" && T[k + 1] && T[k + 1].v[0] === "#") tn = T[k + 1].u;
      if (tn) {
        if (temps[tn] !== undefined) add("logic", "warn", k + 1, k + 1, T[k + 1].v + " created twice", "SQL Server won't create the same temp table twice in one batch ('There is already an object named ...'), even with a DROP in between. Use a different name, or INSERT INTO the existing one.");
        temps[tn] = k;
      }
    }

    // ================= STEP 4: LOGIC (extra) =================
    for (k = 0; k < N; k++) {
      u = KWd(k);
      if (u === "DATEDIFF" && V(k + 1) === "(" && /^(YEAR|YY|YYYY)$/.test(KWd(k + 2)))
        add("logic", "warn", k, M[k + 1] !== undefined ? M[k + 1] : k, "DATEDIFF(YEAR) isn't an age", "DATEDIFF counts year boundaries crossed, not birthdays: someone born 31 Dec is '1' on 1 Jan. For age (e.g. at 31 August), knock a year off if the birthday hasn't happened yet.",
          "DATEDIFF(YEAR, p.DATE_OF_BIRTH, @AsAt)\n  - CASE WHEN DATEADD(YEAR, DATEDIFF(YEAR, p.DATE_OF_BIRTH, @AsAt), p.DATE_OF_BIRTH) > @AsAt THEN 1 ELSE 0 END");
      if (u === "NOT" && KWd(k + 1) === "IN" && V(k + 2) === "(" && !isSubq(k + 2) && M[k + 2] !== undefined) {
        for (var z = k + 3; z < M[k + 2]; z++) if (KWd(z) === "NULL") add("logic", "error", k, M[k + 2], "NOT IN list contains NULL", "If the list has a NULL, NOT IN never returns any rows. Remove the NULL and handle it with IS NOT NULL.");
      }
      if (u === "LIKE" && T[k + 1] && T[k + 1].t === "str" && !/[%_\[]/.test(T[k + 1].v))
        add("logic", "info", k, k + 1, "LIKE with no wildcard", "Without % or _ this is the same as =. Did you mean '%" + T[k + 1].v + "%'?", "LIKE '%" + T[k + 1].v + "%'");
      if (V(k) === "/" && T[k + 1] && (isName(k + 1) || T[k + 1].t === "id") && V(k + 2) !== "(" && KWd(k + 1) !== "NULLIF") {
        var b2 = k + 1; while (V(b2 + 1) === "." && T[b2 + 2]) b2 += 2;
        add("perf", "info", k, b2, "Divide by a column", "If " + txt(k + 1, b2) + " is ever 0 the query fails with 'Divide by zero'. NULLIF turns 0 into NULL instead.", "/ NULLIF(" + txt(k + 1, b2) + ", 0)");
      }
      if (AGG[u] && V(k + 1) === "(" && M[k + 1] !== undefined) {
        for (z = k + 2; z < M[k + 1]; z++) {
          if (isSubq(z)) { z = M[z]; continue; }
          if (AGG[KWd(z)] && V(z + 1) === "(" && M[z + 1] !== undefined && KWd(M[z + 1] + 1) !== "OVER") { add("shape", "error", k, M[k + 1], "Aggregate inside an aggregate", T[k].v + "(" + T[z].v + "(...)) isn't allowed. Aggregate in a subquery or CTE first, then aggregate that."); break; }
        }
      }
    }

    // ================= STEP 6: SCHEMA =================
    var S = ctx.schema;
    if (S) {
      var cteNames = {}; ctes.forEach(function (c) { cteNames[c.name] = 1; });
      var tableOf = {};
      fromItems.forEach(function (o) {
        if (o.kind !== "table" || !o.name || cteNames[o.name] || o.parts.length > 3) return;
        var tb = S.tables[o.name];
        if (!tb) { if (o.parts.length <= 2) add("schema", "warn", o.at, o.nameAt, o.name + " isn't in your Schema Map", "No table or view with this name in " + (S.db || "the loaded database") + ". A typo, or a table in another database?"); return; }
        (tableOf[o.key] = tableOf[o.key] || []).push(o.name);
      });
      for (k = 0; k < N; k++) {
        if (!(isName(k) || (T[k] && T[k].t === "id")) || V(k + 1) !== "." || V(k - 1) === "." || objTok[k] || !T[k + 2] || V(k + 3) === "." || V(k + 3) === "(") continue;
        if (!(T[k + 2].t === "word" || T[k + 2].t === "id")) continue;
        var tabs = tableOf[T[k].u]; if (!tabs) continue;
        var col = T[k + 2].u, type = null;
        if (!tabs.some(function (tn) { if (S.tables[tn][col] !== undefined) { type = S.tables[tn][col]; return true; } return false; })) {
          var near = closest(col, Object.keys(S.tables[tabs[0]]));
          add("schema", "error", k, k + 2, "No column " + T[k + 2].v + " on " + tabs[0], tabs[0] + " (" + T[k].v + ") has no column called " + T[k + 2].v + "." + (near ? " Did you mean " + near + "?" : ""), near ? T[k].v + "." + near : "");
          continue;
        }
        // type checks on comparisons
        var opAt = V(k + 3) && CMP[V(k + 3)] ? k + 3 : (CMP[V(k - 1)] ? k - 1 : -1);
        if (opAt < 0 || !type) continue;
        var litAt = opAt === k + 3 ? opAt + 1 : opAt - 1, lt = T[litAt];
        if (!lt || (opAt === k + 3 && /^[+\-*\/]$/.test(V(litAt + 1)))) continue;
        if (NUMTYPE.test(type) && lt.t === "str" && !/^\s*-?\d+(\.\d+)?\s*$/.test(lt.v))
          add("schema", "error", Math.min(k, litAt), Math.max(k + 2, litAt), "Text compared with a number column", T[k + 2].v + " is " + type + ", so SQL Server tries to turn '" + lt.v + "' into a number and fails ('Conversion failed').");
        else if (STRTYPE.test(type) && lt.t === "num")
          add("schema", "warn", Math.min(k, litAt), Math.max(k + 2, litAt), "Number compared with a text column", T[k + 2].v + " is " + type + ". Comparing it with a number converts every row to a number: slow (no index), and it fails if any value isn't numeric. Quote it: '" + lt.v + "'.", T[k].v + "." + T[k + 2].v + " = '" + lt.v + "'");
      }
    }
    function closest(w, list) {
      var best = null, bd = 3;
      list.forEach(function (c) { var d = lev(w, c); if (d < bd) { bd = d; best = c; } });
      return best;
    }
    function lev(a, b) {
      if (Math.abs(a.length - b.length) > 2) return 9;
      var dp = []; for (var i = 0; i <= a.length; i++) { dp[i] = [i]; }
      for (var j = 1; j <= b.length; j++) dp[0][j] = j;
      for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      return dp[a.length][b.length];
    }

    // de-duplicate (same span + title)
    var seenF = {};
    return F.filter(function (f) { var key = f.s + "|" + f.title; if (seenF[key]) return false; seenF[key] = 1; return true; });
  };
})();
