// SSRS (VB.NET) expression checker, shared by the expression checker and the report inspector.
// window.SSRSLint.lint(expr, ctx) -> [{ sev, id, title, msg, fix, s, e }]
//   ctx (optional): { fields: {lowername:true}, datasets: {lowername:true}, params: {lowername:{multi:bool}}, area: "body"|"header"|"", data: true if inside a dataset/parameter definition }
// window.SSRSLint.format(expr) -> indented string
(function () {
  var KNOWN = {};
  ("IIf Switch Choose Sum Avg Count CountDistinct CountRows Min Max First Last Previous RunningValue RowNumber Aggregate Var VarP StDev StDevP " +
   "Lookup LookupSet MultiLookup Join Split Filter Format FormatDateTime FormatNumber FormatPercent FormatCurrency CDate CInt CDbl CDec CStr CBool CLng CSng CShort CByte CObj CType DirectCast TryCast " +
   "IsNothing IsNumeric IsDate IsArray IsError IsDBNull Len Left Right Mid Trim LTrim RTrim UCase LCase Replace InStr InStrRev StrReverse StrConv StrComp Space StrDup Asc AscW Chr ChrW Val Hex Oct " +
   "DateAdd DateDiff DatePart DateSerial DateValue TimeSerial TimeValue Year Month Day Hour Minute Second Weekday WeekdayName MonthName Now Today Round Abs Int Fix Sgn Rnd " +
   "InScope Level UBound LBound Code Math Convert String DateTime Decimal Double Int32 Int64 Microsoft System Nothing ScopeCount ScopeAvg").split(" ").forEach(function (w) { KNOWN[w.toLowerCase()] = 1; });
  var CONVERT = /^(CDate|CInt|CDbl|CDec|CLng|CSng|CShort|CStr|CBool|Format|FormatDateTime|FormatNumber|FormatPercent|FormatCurrency|Len|Left|Right|Mid|Trim|DateAdd|DateDiff|Year|Month|Day|Round|Int|Replace|InStr)$/i;
  var AGG = /^(Sum|Avg|Count|CountDistinct|CountRows|Min|Max|First|Last|RunningValue|Aggregate|Var|VarP|StDev|StDevP|RowNumber|Previous)$/i;
  var COLOURS = /^(#[0-9a-f]{3,8}|red|green|blue|black|white|yellow|orange|gray|grey|silver|maroon|navy|teal|purple|lime|olive|aqua|fuchsia|transparent|lightgrey|lightgray|darkred|darkgreen|lightgreen|lightblue|gold|pink|salmon|khaki|tomato|crimson|firebrick|forestgreen|seagreen|steelblue|royalblue|dimgray|whitesmoke|lightyellow|lightpink|lightcoral|orangered|darkorange|mediumseagreen|limegreen|indianred)$/i;

  function tokenize(src) {
    var T = [], i = 0, n = src.length;
    function push(t, v, s) { T.push({ t: t, v: v, u: v.toUpperCase(), s: s, e: i }); }
    while (i < n) {
      var c = src[i], s = i;
      if (/\s/.test(c)) { i++; continue; }
      if (c === '"') {
        i++; var v = "", closed = false;
        while (i < n) { if (src[i] === '"') { if (src[i + 1] === '"') { v += '"'; i += 2; continue; } i++; closed = true; break; } v += src[i++]; }
        T.push({ t: "str", v: v, u: v.toUpperCase(), s: s, e: i, open: !closed }); continue;
      }
      if (c === "'") { var rest = src.slice(i + 1); T.push({ t: "comment", v: rest, u: "", s: s, e: n, quoteLike: /'/.test(rest) }); break; }
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] || ""))) { var m = /^(\d*\.?\d+([eE][+-]?\d+)?)/.exec(src.slice(i)); i += m[0].length; push("num", m[0], s); continue; }
      if (/[A-Za-z_]/.test(c)) { while (i < n && /[\w]/.test(src[i])) i++; push("word", src.slice(s, i), s); continue; }
      if (c === "#") { var mm = /^#[^#]*#/.exec(src.slice(i)); if (mm) { i += mm[0].length; push("date", mm[0], s); continue; } }
      var two = src.substr(i, 2);
      if (["<>", "<=", ">=", "==", "!=", "&&", "||", "&="].indexOf(two) >= 0) { i += 2; push("op", two, s); continue; }
      i++; push("op", c, s);
    }
    return T;
  }
  function matchParens(T) {
    var M = {}, st = [], bad = [];
    T.forEach(function (t, i) { if (t.t !== "op") return; if (t.v === "(") st.push(i); else if (t.v === ")") { if (st.length) { var o = st.pop(); M[o] = i; M[i] = o; } else bad.push(i); } });
    return { M: M, unclosed: st, extra: bad };
  }
  function args(T, M, open) { // token index ranges of top-level args inside ( )
    var close = M[open], out = [], start = open + 1, depth = 0;
    if (close === undefined) return [];
    for (var i = open + 1; i < close; i++) {
      var v = T[i].t === "op" ? T[i].v : "";
      if (v === "(") depth++; else if (v === ")") depth--;
      else if (v === "," && depth === 0) { out.push([start, i - 1]); start = i + 1; }
    }
    if (close > open + 1) out.push([start, close - 1]);
    return out;
  }
  function text(src, T, r) { return r && T[r[0]] && T[r[1]] ? src.slice(T[r[0]].s, T[r[1]].e) : ""; }

  // Collection references: Fields!X.Prop, Parameters!X.Value, ReportItems!X, Globals!X, User!X
  function refs(T) {
    var out = [];
    for (var i = 0; i + 2 < T.length; i++) {
      if (T[i].t === "word" && T[i + 1].t === "op" && T[i + 1].v === "!" && T[i + 2].t === "word") {
        var r = { coll: T[i].u, name: T[i + 2].v, i: i, end: i + 2, prop: null };
        if (T[i + 3] && T[i + 3].v === "." && T[i + 4] && T[i + 4].t === "word") { r.prop = T[i + 4].v; r.end = i + 4; }
        out.push(r);
      }
    }
    return out;
  }

  function lint(src, ctx) {
    ctx = ctx || {};
    var F = [], raw = String(src || ""), body = raw.trim();
    function add(sev, id, title, msg, fix, s, e) { F.push({ sev: sev, id: id, title: title, msg: msg, fix: fix || "", s: s === undefined ? 0 : s, e: e === undefined ? raw.length : e }); }
    if (!body) return F;
    if (body[0] !== "=") {
      if (/(Fields|Parameters|Globals|ReportItems)!/i.test(body)) add("error", "noequals", "Doesn't start with =", "Without a leading = SSRS shows this as plain text, so you'll see the words, not the value.", "=" + body);
      return F;
    }
    var off = raw.indexOf("=") + 1, code = raw.slice(off);
    var T = tokenize(code).map(function (t) { t.s += off; t.e += off; return t; });
    var P = matchParens(T), M = P.M;
    var R = refs(T);

    // Structure
    T.forEach(function (t) { if (t.t === "str" && t.open) add("error", "string", "String not closed", "A \" opens a string that never closes. Inside a string, write a quote as \"\".", "", t.s, t.e); });
    if (P.unclosed.length) add("error", "parens", "Missing )", P.unclosed.length + " bracket" + (P.unclosed.length > 1 ? "s" : "") + " opened but not closed.", "", T[P.unclosed[0]].s, T[P.unclosed[0]].e);
    if (P.extra.length) add("error", "parens", "Extra )", "A ) has no matching (.", "", T[P.extra[0]].s, T[P.extra[0]].e);
    T.forEach(function (t) {
      if (t.t === "comment" && t.quoteLike) add("error", "squote", "Single quotes used for text", "In VB a ' starts a comment, so everything after it is ignored. Use double quotes for text: \"like this\".", "", t.s, t.e);
      if (t.t === "op" && ({ "==": "=", "!=": "<>", "&&": "AndAlso", "||": "OrElse" })[t.v]) add("error", "csharp", t.v + " isn't VB", "SSRS expressions are VB.NET. Use " + ({ "==": "=", "!=": "<>", "&&": "AndAlso", "||": "OrElse" })[t.v] + " instead of " + t.v + ".", "", t.s, t.e);
      if (t.t === "op" && t.v === ";") add("error", "semicolon", "Semicolon", "VB expressions don't use ; at all. Remove it.", "", t.s, t.e);
    });

    // = Nothing
    T.forEach(function (t, i) {
      if (t.t === "op" && (t.v === "=" || t.v === "<>") && T[i + 1] && T[i + 1].u === "NOTHING") add("warn", "eqnothing", t.v + " Nothing", "Comparing with = Nothing doesn't reliably test for a missing value (and for text, \"\" = Nothing is True). Use IsNothing(x) or x Is Nothing.", t.v === "=" ? "IsNothing(Fields!Col.Value)" : "Not IsNothing(Fields!Col.Value)", t.s, T[i + 1].e);
    });

    // + with strings
    T.forEach(function (t, i) {
      if (t.t === "op" && t.v === "+" && ((T[i - 1] && T[i - 1].t === "str") || (T[i + 1] && T[i + 1].t === "str")))
        add("warn", "plus", "+ used to join text", "With + VB tries to add numbers, so \"Total: \" + Fields!N.Value gives #Error. Use & to join text.", "=\"Total: \" & Fields!N.Value", t.s, t.e);
    });

    // Field / parameter references
    R.forEach(function (r) {
      var s = T[r.i].s, e = T[r.end].e;
      if (r.coll === "FIELDS") {
        if (!r.prop) add("warn", "novalue", "Fields!" + r.name + " without .Value", "That returns the field object, not its value. Add .Value.", "Fields!" + r.name + ".Value", s, e);
        if (ctx.fields && !ctx.fields[r.name.toLowerCase()]) add("error", "unknownfield", "Unknown field " + r.name, "No dataset has a field called " + r.name + ".", "", s, e);
      } else if (r.coll === "PARAMETERS") {
        var p = ctx.params ? ctx.params[r.name.toLowerCase()] : null;
        if (ctx.params && !p) add("error", "unknownparam", "Unknown parameter " + r.name, "There's no report parameter called " + r.name + ".", "", s, e);
        if (!r.prop) add("warn", "novalue", "Parameters!" + r.name + " without .Value", "Add .Value (or .Label for the text the user picked).", "Parameters!" + r.name + ".Value", s, e);
        if (p && p.multi && !ctx.data && (r.prop || "").toLowerCase() !== "count") {
          var inJoin = false; for (var k = r.i - 1; k >= 1; k--) { if (T[k].v === "(" && T[k - 1] && /^JOIN$/i.test(T[k - 1].v) && M[k] > r.end) { inJoin = true; break; } }
          var indexed = T[r.end + 1] && T[r.end + 1].v === "(";
          if (!inJoin && !indexed) add("warn", "multiparam", r.name + " is multi-value", "A multi-value parameter is a list, so using it directly shows #Error or only the first item. Use Join(Parameters!" + r.name + ".Label, \", \") to show it, or .Value(0) for the first.", "=Join(Parameters!" + r.name + ".Label, \", \")", s, e);
        }
      } else if (r.coll === "GLOBALS" && /^(PageNumber|TotalPages|OverallPageNumber|OverallTotalPages|PageName)$/i.test(r.name)) {
        if (ctx.area === "body") add("error", "globalsbody", "Globals!" + r.name + " in the body", "Page numbers can only be used in the page header or footer. Move this textbox there.", "", s, e);
        else if (!ctx.area) add("info", "globalspage", "Globals!" + r.name, "Only works in a page header or footer textbox.", "", s, e);
      } else if (r.coll === "REPORTITEMS") {
        if (ctx.area === "body") add("info", "reportitems", "ReportItems!" + r.name, "In the body, ReportItems can only reference a textbox in the same row/group scope; otherwise you get blanks or errors.", "", s, e);
      }
    });

    // Function calls
    T.forEach(function (t, i) {
      if (t.t !== "word" || !T[i + 1] || T[i + 1].v !== "(" || (T[i - 1] && T[i - 1].v === ".")) return;
      var A = args(T, M, i + 1), fn = t.u;
      if (fn === "IIF") {
        if (A.length !== 3) add("error", "iifargs", "IIf needs 3 parts", "IIf(condition, value if true, value if false) - this one has " + A.length + ".", "", t.s, T[M[i + 1]] ? T[M[i + 1]].e : t.e);
        else {
          var condTxt = text(raw, T, A[0]), b1 = text(raw, T, A[1]), b2 = text(raw, T, A[2]);
          var branches = [A[1], A[2]];
          // division in either branch
          if (branches.some(function (b) { for (var k = b[0]; k <= b[1]; k++) if (T[k].t === "op" && T[k].v === "/") return true; return false; }))
            add("warn", "iifdiv", "IIf with division", "IIf works out BOTH branches before choosing, so IIf(x = 0, 0, a / x) still divides by zero and gives #Error. Guard the divisor inside the division too.", "=IIf(Fields!Den.Value = 0, 0, Fields!Num.Value / IIf(Fields!Den.Value = 0, 1, Fields!Den.Value))", t.s, T[M[i + 1]].e);
          // IsNothing guard + conversion in branch
          var guarded = /IsNothing\s*\(\s*(Fields!\w+\.Value)|(Fields!\w+\.Value)\s+Is\s+Nothing/i.exec(condTxt);
          if (guarded) {
            var f = (guarded[1] || guarded[2]).replace(/\s+/g, ""), esc = f.replace(/[.!]/g, "\\$&");
            var conv = new RegExp("(\\b(CDate|CInt|CDbl|CDec|CLng|Format|FormatDateTime|FormatNumber|Len|Left|Right|Mid|DateAdd|DateDiff|Year|Month|Day|Round)\\s*\\([^)]*" + esc + ")|(" + esc + "\\.(ToString|Trim|Substring|Length|ToUpper|ToLower|Date|Year|Month|Day))", "i");
            if (conv.test(b1) || conv.test(b2)) add("warn", "iifnothing", "IIf guard doesn't protect " + f, "The condition checks for Nothing, but IIf still evaluates the other branch, so converting " + f + " there gives #Error on blank rows. Convert safely, e.g. with a nested IIf inside the conversion or a custom code function.", "=IIf(IsNothing(Fields!D.Value), \"\", Format(IIf(IsNothing(Fields!D.Value), Today(), Fields!D.Value), \"dd/MM/yyyy\"))", t.s, T[M[i + 1]].e);
          }
          // empty colour
          var s1 = T[A[1][0]], s2 = T[A[2][0]];
          if (A[1][0] === A[1][1] && A[2][0] === A[2][1] && s1.t === "str" && s2.t === "str") {
            var vals = [s1.v, s2.v];
            if (vals.some(function (v) { return COLOURS.test(v.trim()); }) && vals.some(function (v) { return v === ""; }))
              add("warn", "emptycolour", "Empty colour", "\"\" isn't a valid colour, so SSRS shows a warning and may ignore the whole expression. Use \"Transparent\" (background) or Nothing.", "=IIf(condition, \"" + (COLOURS.test(s1.v) ? s1.v : s2.v) + "\", \"Transparent\")", t.s, T[M[i + 1]].e);
          }
        }
        // nesting depth
        var depth = 0, k2 = i + 2, maxD = 0;
        (function walk(open, d) { if (d > maxD) maxD = d; for (var k = open + 1; k < M[open]; k++) if (T[k].u === "IIF" && T[k + 1] && T[k + 1].v === "(" && M[k + 1]) { walk(k + 1, d + 1); k = M[k + 1]; } })(i + 1, 1);
        if (maxD >= 3 && !(T[i - 2] && T[i - 2].u === "IIF")) add("info", "nested", "IIf nested " + maxD + " deep", "Hard to read and easy to get wrong. Switch(cond1, val1, cond2, val2, True, otherwise) does the same thing flat.", "=Switch(Fields!S.Value = \"A\", \"Active\", Fields!S.Value = \"W\", \"Withdrawn\", True, \"Other\")", t.s, T[M[i + 1]] ? T[M[i + 1]].e : t.e);
      }
      if (fn === "SWITCH") {
        if (A.length % 2 === 1) add("error", "switchargs", "Switch has an odd number of parts", "Switch takes pairs: condition, value, condition, value…", "", t.s, t.e);
        else if (A.length && !/^\s*True\s*$/i.test(text(raw, T, A[A.length - 2]))) add("info", "switchdefault", "Switch has no default", "If no condition matches, Switch returns Nothing (a blank). Add True, \"default\" as the last pair.", "…, True, \"Other\")", t.s, t.e);
      }
      if (fn === "LOOKUP" || fn === "LOOKUPSET" || fn === "MULTILOOKUP") {
        if (A.length !== 4) add("error", "lookupargs", t.v + " needs 4 parts", t.v + "(source value, destination field, result field, \"DatasetName\") - this one has " + A.length + ".", "", t.s, t.e);
        else {
          var dsTok = T[A[3][0]];
          if (!(A[3][0] === A[3][1] && dsTok.t === "str")) add("error", "lookupds", "Dataset name must be text", "The last part of " + t.v + " must be the dataset name in quotes, e.g. \"Courses\".", "", t.s, t.e);
          else if (ctx.datasets && !ctx.datasets[dsTok.v.toLowerCase()]) add("error", "lookupunknown", "Unknown dataset \"" + dsTok.v + "\"", "There's no dataset called " + dsTok.v + ".", "", dsTok.s, dsTok.e);
        }
        if (fn !== "LOOKUP") {
          var wrapped = false; for (var k3 = i - 1; k3 >= 1; k3--) { if (T[k3].v === "(" && M[k3] > i && T[k3 - 1] && /^(JOIN|COUNT|UBOUND|CODE)$/i.test(T[k3 - 1].u)) { wrapped = true; break; } if (T[k3].v === "(" && M[k3] > i && T[k3 - 1] && T[k3 - 1].v === ".") { wrapped = true; break; } }
          if (!wrapped) add("warn", "lookupsetjoin", t.v + " not wrapped in Join", t.v + " returns a list. Shown directly in a textbox it gives #Error; wrap it in Join(…, \", \").", "=Join(" + text(raw, T, [i, M[i + 1]]) + ", \", \")", t.s, t.e);
        }
      }
      if (AGG.test(t.v) && A.length >= 2) {
        var sc = T[A[A.length - 1][0]];
        if (A[A.length - 1][0] === A[A.length - 1][1] && sc.t === "str" && ctx.datasets && ctx.groups !== undefined && !ctx.datasets[sc.v.toLowerCase()] && !(ctx.groups && ctx.groups[sc.v.toLowerCase()]))
          add("error", "scope", "Unknown scope \"" + sc.v + "\"", "The last part of " + t.v + " must be a dataset, group or data region name.", "", sc.s, sc.e);
      }
      if (/^(CDATE|DATEVALUE)$/.test(fn) && A.length === 1) {
        var a0 = T[A[0][0]];
        if (A[0][0] === A[0][1] && a0.t === "str" && /^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/.test(a0.v)) add("warn", "datestr", "Date written as text", "\"" + a0.v + "\" is read using the server's regional settings, so day and month can swap. Use DateSerial(year, month, day).", "=DateSerial(" + dateGuess(a0.v) + ")", a0.s, a0.e);
      }
      if (fn === "ROWNUMBER" && A.length === 0) add("error", "rownumber", "RowNumber needs a scope", "Use RowNumber(Nothing) for the whole table, or RowNumber(\"GroupName\").", "=RowNumber(Nothing)", t.s, t.e);
      if (!KNOWN[t.v.toLowerCase()] && !(T[i - 1] && T[i - 1].v === ".")) add("info", "unknownfn", t.v + "() isn't a built-in", "Not a standard SSRS/VB function. If it's in the report's custom code, call it as Code." + t.v + "(…). Otherwise check the spelling.", "", t.s, t.e);
    });

    // Date format strings
    T.forEach(function (t, i) {
      if (t.t !== "str" || !/[dDyY]/.test(t.v) || t.v.length > 40) return;
      var inFmt = false;
      for (var k = i - 1; k >= 1; k--) { if (T[k].v === "(" && M[k] > i) { var f = T[k - 1]; inFmt = f && (/^(FORMAT|TOSTRING)$/.test(f.u)); break; } }
      if (!inFmt) return;
      var v = t.v;
      if (/(^|[^m])mm([^m]|$)/.test(v) && /d/.test(v) && /y/i.test(v) && !/[hH]/.test(v)) add("warn", "mmminutes", "\"mm\" means minutes", "In \"" + v + "\", mm is minutes, not month, so you get dates like 14/37/2026. Use MM for the month.", "\"" + v.replace(/(^|[^m])mm(?!m)/g, "$1MM") + "\"", t.s, t.e);
      if (/YYYY|YY|DD/.test(v) && !/^[A-Z]$/.test(v)) add("warn", "upperfmt", "Upper-case YYYY / DD", "Format codes are case-sensitive: use yyyy for year and dd for day. YYYY and DD come out as literal letters.", "\"" + v.replace(/YYYY/g, "yyyy").replace(/YY/g, "yy").replace(/DD/g, "dd") + "\"", t.s, t.e);
    });

    // And / Or after IsNothing (no short-circuit)
    T.forEach(function (t, i) {
      if ((t.u === "AND" || t.u === "OR") && t.t === "word") {
        var before = raw.slice(0, t.s);
        if (/IsNothing\s*\([^()]*\)\s*$|Is\s+Nothing\s*$/i.test(before) || /IsNumeric\s*\([^()]*\)\s*$/i.test(before))
          add("warn", "shortcircuit", t.v + " doesn't stop early", "VB's " + t.v + " checks both sides, so the right-hand side still runs (and errors) when the left already decided. Use " + (t.u === "AND" ? "AndAlso" : "OrElse") + ".", t.u === "AND" ? "AndAlso" : "OrElse", t.s, t.e);
      }
    });

    // Plain division by a field
    T.forEach(function (t, i) {
      if (t.t === "op" && t.v === "/" && T[i + 1] && T[i + 1].u === "FIELDS") {
        var inIif = F.some(function (f) { return f.id === "iifdiv"; });
        if (!inIif) add("info", "div", "Division by a field", "If the field can be 0 or blank you'll get Infinity, NaN or #Error. Guard it with IIf (and the nested trick) or a custom code function.", "", t.s, t.e);
      }
    });

    // A ' comment swallows the rest, so bracket/argument errors after it are just noise
    if (F.some(function (f) { return f.id === "squote"; })) F = F.filter(function (f) { return !/^(parens|iifargs|switchargs|lookupargs)$/.test(f.id); });
    // De-duplicate by id + position
    var seen = {}; F = F.filter(function (f) { var k = f.id + "|" + f.s; if (seen[k]) return false; seen[k] = 1; return true; });
    var order = { error: 0, warn: 1, info: 2 }; F.sort(function (a, b) { return order[a.sev] - order[b.sev] || a.s - b.s; });
    return F;
  }
  function dateGuess(v) { var m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/.exec(v); var y = m[3].length === 2 ? "20" + m[3] : m[3]; return y + ", " + (+m[2]) + ", " + (+m[1]); }

  // Pretty-print: break IIf / Switch / Choose arguments onto their own lines
  function format(src) {
    var raw = String(src || "").trim(); if (!raw) return "";
    var eq = raw[0] === "=", code = eq ? raw.slice(1) : raw;
    var T = tokenize(code), M = matchParens(T).M, out = "";
    function emit(a, b, ind) {
      var s = "";
      for (var i = a; i <= b; i++) {
        var t = T[i];
        if (t.t === "word" && /^(IIF|SWITCH|CHOOSE)$/.test(t.u) && T[i + 1] && T[i + 1].v === "(" && M[i + 1] !== undefined) {
          var A = args(T, M, i + 1), pad = new Array(ind + 2).join("    ");
          s += (s && !/[\s(]$/.test(s) ? sep(T[i - 1], t) : "") + t.v + "(\n" + A.map(function (r) { return pad + emit(r[0], r[1], ind + 1).trim(); }).join(",\n") + "\n" + new Array(ind + 1).join("    ") + ")";
          i = M[i + 1]; continue;
        }
        s += (i > a ? sep(T[i - 1], t) : "") + piece(code, t);
      }
      return s;
    }
    function piece(c, t) { return c.slice(t.s, t.e); }
    function sep(p, t) {
      if (!p) return "";
      var tight = (t.t === "op" && /^[).,!]$/.test(t.v)) || (p.t === "op" && /^[(.!]$/.test(p.v)) || (t.v === "(" && p.t === "word");
      return tight ? "" : " ";
    }
    out = emit(0, T.length - 1, 0);
    return (eq ? "=" : "") + out;
  }

  window.SSRSLint = { lint: lint, format: format, tokenize: tokenize };
})();
