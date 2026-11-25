/* Reads an EBS Screen Designer export (.uafx) into a plain summary:
   pages (one per PageConfigEntity, i.e. each version in the file), their DataLinks,
   the control tree, custom HTML and a list of checks. Browser only (DOMParser). */
window.UAFX = (function () {
  var TYPES = { 1: "Search", 4: "Detail (expander content)", 75: "Formatter", 76: "Grid", 97: "Custom HTML" };

  function kids(el, tag) { return Array.prototype.filter.call(el.children, function (c) { return c.tagName === tag; }); }
  function kid(el, tag) { return kids(el, tag)[0] || null; }
  function val(el, tag) { var k = el && kid(el, tag); return k ? k.textContent : ""; }
  function attrs(s) {   // "A=1|B|C=x=y" -> {A:"1",B:true,C:"x=y"}
    var o = {}; String(s || "").split("|").forEach(function (p) { if (!p) return; var i = p.indexOf("="); if (i < 0) o[p] = true; else o[p.slice(0, i)] = p.slice(i + 1); });
    return o;
  }
  function hidden(a) { return ["VISIBLEXS", "VISIBLESM", "VISIBLEMD", "VISIBLELG"].every(function (k) { return String(a[k]) === "False"; }); }
  function ebsDate(s) {   // 03/Aug/2026 15:24:13 -> ISO-ish for sorting
    var m = /(\d{1,2})\/([A-Za-z]{3})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(s || ""); if (!m) return "";
    var mo = "JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(m[2].slice(0, 1).toUpperCase() + m[2].slice(1, 3).toLowerCase()) / 3 + 1;
    return m[3] + "-" + ("0" + mo).slice(-2) + "-" + ("0" + m[1]).slice(-2) + (m[4] ? " " + ("0" + m[4]).slice(-2) + ":" + m[5] : "");
  }

  function parse(text) {
    var doc = new DOMParser().parseFromString(String(text).replace(/^﻿/, ""), "application/xml");
    if (doc.getElementsByTagName("parsererror").length || !doc.documentElement || doc.documentElement.tagName !== "UAFEntities") throw new Error("This doesn't look like a Screen Designer .uafx export.");
    var dls = {}, pages = [];
    Array.prototype.forEach.call(doc.documentElement.children, function (anc) {
      if (anc.tagName !== "UAF_ANC_Entity") return;
      var meta = { by: anc.getAttribute("UpdatedBy") || anc.getAttribute("CreatedBy") || "", at: ebsDate(anc.getAttribute("UpdatedDate") || anc.getAttribute("CreatedDate")), comment: anc.getAttribute("Comment") || "" };
      var dle = anc.getElementsByTagName("DataLinkEntity")[0], pce = anc.getElementsByTagName("PageConfigEntity")[0];
      if (dle) {
        var sql = val(dle, "DataLookup") || val(dle, "SqlDataLookup");
        dls[val(dle, "ID")] = { id: val(dle, "ID"), name: val(dle, "DataLinkName"), sql: sql, single: val(dle, "ExpectedResultType") === "1", maxRows: +val(dle, "MaximumRows") || 0, updated: ebsDate(val(dle, "UpdatedDate")), meta: meta };
      }
      if (pce) pages.push(readPage(pce, meta));
    });
    pages.forEach(function (pg) {
      pg.datalinks = pg.dlIds.map(function (i) { return dls[i] || { id: i, name: "(DataLink " + i + " not in this file)", sql: "", missing: true }; });
      pg.checks = check(pg);
    });
    pages.sort(function (a, b) { return (a.updated || "").localeCompare(b.updated || ""); });
    return { pages: pages, screenName: pages.length ? pages[pages.length - 1].screen : "", title: pages.length ? pages[pages.length - 1].title : "" };
  }

  function readPage(pce, meta) {
    var pd = kid(pce, "PageDefinitionEntity"), params = [];
    var px = pd ? val(pd, "PageContextParams") : "";
    if (px) { try { var pdoc = new DOMParser().parseFromString(px, "application/xml"); Array.prototype.forEach.call(pdoc.getElementsByTagName("Parameter"), function (p) { params.push({ name: val(p, "Name"), type: val(p, "Type"), test: val(p, "TestValue") }); }); } catch (e) {} }
    var controls = kids(pce, "ControlConfigEntity").map(function (c) {
      var a = attrs(val(c, "CUSTOMATTRIBUTES"));
      var cols = kids(c, "ControlColumnConfigEntity").map(function (k) {
        var ka = attrs(val(k, "CUSTOMATTRIBUTES")), link = kid(k, "ControlColumnConfigLinkEntity");
        return { id: val(k, "ColumnConfigID"), name: val(k, "ColumnName"), text: val(k, "DisplayText"), seq: +val(k, "SequenceNumber") || 0, table: val(k, "TableColumn"),
          editable: val(k, "Editable") === "-1", required: val(k, "Required") === "-1", hidden: hidden(ka), writeback: ka.WRITEBACKFIELD || "", lookup: val(k, "LookUpSqlParam1"),
          link: link ? { action: val(link, "ActionName"), to: val(link, "LinkOperation") } : null, attrs: ka };
      }).sort(function (x, y) { return x.seq - y.seq; });
      var ev = null; if (a.EVENTHANDLER) { try { ev = JSON.parse(a.EVENTHANDLER); } catch (e) {} }
      return { id: val(c, "ControlConfigID"), name: val(c, "ControlName"), type: +val(c, "ConfigType") || 0, typeName: TYPES[+val(c, "ConfigType")] || "Type " + val(c, "ConfigType"),
        view: val(c, "ViewName"), parent: val(c, "ParentID"), seq: +val(c, "SequenceNumber") || 0, html: val(c, "HTMLTEMPLATE"), attrs: a, event: ev, cols: cols, hidden: hidden(a) };
    });
    // tree: a control's ParentID is the ColumnConfigID of a column (cell) in its parent formatter
    var byCol = {}; controls.forEach(function (c) { c.cols.forEach(function (k) { byCol[k.id] = c; }); c.children = []; });
    var roots = [];
    controls.forEach(function (c) { var par = c.parent && byCol[c.parent]; if (par && par !== c) par.children.push(c); else roots.push(c); });
    function srt(l) { l.sort(function (x, y) { return x.seq - y.seq; }); l.forEach(function (c) { srt(c.children); }); }
    srt(roots);
    return { id: val(pce, "PageConfigID"), screen: val(pce, "ScreenName"), title: val(pce, "Title"), version: pd ? val(pd, "Description") : "", context: pd ? val(pd, "PageContext") : "",
      params: params, updated: ebsDate(val(pce, "UpdatedDate")) > meta.at ? ebsDate(val(pce, "UpdatedDate")) : meta.at, meta: meta,
      dlIds: kids(pce, "ConfigDataLinkEntity").map(function (x) { return val(x, "DataLinkID"); }), controls: controls, roots: roots };
  }

  function check(pg) {
    var out = [], byName = {};
    pg.datalinks.forEach(function (d) { byName[d.name.toUpperCase()] = d; });
    function add(level, text, dl) { out.push({ level: level, text: text, dl: dl || null }); }
    var used = {};
    pg.controls.forEach(function (c) {
      if (c.view) { used[c.view.toUpperCase()] = 1; if (!byName[c.view.toUpperCase()]) add("bad", c.name + " uses DataLink " + c.view + ", which isn't attached to this page."); }
      c.cols.forEach(function (k) { if (k.lookup) used[k.lookup.toUpperCase()] = 1; });
    });
    pg.datalinks.forEach(function (d) {
      var s = d.sql || "", plain = s.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
      if (d.missing) { add("warn", d.name + ": not in this export, so its SQL can't be checked."); return; }
      if (/\b(OUTER|CROSS)\s+APPLY\b/i.test(plain) || /\bSTRING_AGG\s*\(/i.test(plain)) add("warn", d.name + ": uses " + (/APPLY/i.test(plain) ? "OUTER/CROSS APPLY" : "STRING_AGG") + ". The EBS Central validator can reject this when you next save it; Fix for EBS rewrites it.", d);
      if (!used[d.name.toUpperCase()] && !/\{\{parent:/i.test(s)) add("info", d.name + ": attached but no control on this page uses it.", d);
      var lits = (plain.match(/'\d{2}\/\d{2}\/20\d{2}'/g) || []).concat(plain.match(/CALOCC\w*\s*(=|LIKE)\s*'\d{2}'/gi) || []);
      if (lits.length) add("warn", d.name + ": hard-coded dates or year codes (" + lits.slice(0, 3).join(", ") + (lits.length > 3 ? ", …" : "") + "). Update these each year.", d);
      if (/\bSELECT\s+\*\s+FROM\s+\(/i.test(plain) === false && /\bSELECT\s+\*/i.test(plain)) add("info", d.name + ": SELECT * from a table; columns change if the table does.", d);
      // expander child: {{parent:DL:COL}} needs COL as a column in the parent grid
      var re = /\{\{parent:([\w]+):([\w]+)\}\}/gi, m;
      while ((m = re.exec(s))) {
        var pdl = m[1], col = m[2].toUpperCase();
        var grids = pg.controls.filter(function (c) { return c.view && c.view.toUpperCase() === pdl.toUpperCase(); });
        if (!grids.length) add("bad", d.name + ": expander points at parent " + pdl + ", but no grid on the page shows that DataLink.", d);
        else if (!grids.some(function (g) { return g.cols.some(function (k) { return (k.name || "").toUpperCase() === col || (k.table || "").toUpperCase() === col; }); }))
          add("bad", d.name + ": needs column " + col + " in the " + pdl + " grid (add it as a hidden column), or expanding a row gives an ajax 500.", d);
      }
    });
    // a count DataLink that repeats a list DataLink's SQL (same FROM ... WHERE)
    function core(x) { var n = (x || "").replace(/--[^\n]*/g, "").replace(/\s+/g, " ").toUpperCase().replace(/ORDER BY [^)]*$/, "").trim(); var i = n.indexOf(" FROM ", n.indexOf("SELECT", 8)); return i > 0 ? n.slice(i) : ""; }
    pg.datalinks.forEach(function (d) {
      if (!/^\s*SELECT\s+COUNT\s*\(\s*\*\s*\)/i.test(d.sql || "")) return;
      var c = core(d.sql); if (c.length < 80) return;
      var twin = pg.datalinks.filter(function (o) { return o !== d && core(o.sql) === c; })[0];
      if (twin) add("info", d.name + " repeats the SQL of " + twin.name + ". Change both together.", d);
    });
    pg.controls.forEach(function (c) {
      if (c.attrs.USERTABLE) {
        var wb = c.cols.filter(function (k) { return k.writeback; }).map(function (k) { return k.writeback; });
        add("info", c.name + " writes back to " + c.attrs.USERTABLE + " (" + (wb.join(", ") || "no WRITEBACKFIELD columns") + "). Audit columns (CREATED_BY etc.) may override table defaults.");
      }
      if (c.html && /https?:\/\//i.test(c.html)) add("info", c.name + ": custom HTML loads files from the internet (" + (c.html.match(/https?:\/\/[^\s"'<>]+/i) || [""])[0].slice(0, 60) + ").");
      if (c.html && /\$\(|jQuery/.test(c.html)) add("info", c.name + ": custom HTML uses jQuery; it relies on the page having it loaded.");
    });
    var groups = []; pg.datalinks.forEach(function (d) { var m2 = /GROUP_DEFS_ID\s+IN\s*\(([^)]*)\)/i.exec(d.sql || ""); if (m2) groups.push(m2[1].trim()); });
    if (groups.length) add("info", "Access: shown to EBS security group " + groups.filter(function (g, i) { return groups.indexOf(g) === i; }).join(", ") + " (GROUP_LINKS); everyone else sees it hidden.");
    // merge the same finding across DataLinks: "A, B: uses OUTER APPLY…"
    var merged = [], seen = {};
    out.forEach(function (c) {
      var m = /^(\w+): (.*)$/.exec(c.text), k = m ? c.level + "|" + m[2].replace(/\([^)]*\)\. Update/, "Update") : null;
      if (k && seen[k]) { seen[k].names.push(m[1]); return; }
      var o = { level: c.level, text: c.text, dl: c.dl, names: m ? [m[1]] : null, rest: m ? m[2] : null };
      if (k) seen[k] = o; merged.push(o);
    });
    merged.forEach(function (o) { if (o.names && o.names.length > 1) o.text = o.names.join(", ") + ": " + o.rest; });
    var order = { bad: 0, warn: 1, info: 2 };
    return merged.sort(function (a, b) { return order[a.level] - order[b.level]; });
  }
  return { parse: parse, TYPES: TYPES };
})();
