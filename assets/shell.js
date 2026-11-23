// Builds the sidebar + page bar around each page from assets/tools.js.
(function () {
  var me = document.currentScript;
  var root = me.src.replace(/assets\/shell\.js(\?.*)?$/, "");
  var tools = window.TOOLS || [], cats = (window.CATEGORIES || []).slice();
  tools.forEach(function (t) { if (cats.indexOf(t.cat) < 0) cats.push(t.cat); });
  var here = location.href.split("#")[0].split("?")[0];
  var current = tools.filter(function (t) { return here === root + t.path || here.slice(-(t.path.length + 1)) === "/" + t.path; })[0] || null;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function svgIcon(key, size) {
    var paths = (window.TOOL_ICONS || {})[key]; if (!paths) return null;
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + paths + "</svg>";
  }
  window.BITK_ICON = svgIcon;
  function icon(t) {
    var i = el("span", "sic"), s = svgIcon(t.svg, 19);
    if (s) i.innerHTML = s; else { i.textContent = t.icon || t.name.slice(0, 2); i.classList.add("txt"); }
    i.setAttribute("aria-hidden", "true"); return i;
  }

  // Sidebar
  var side = el("aside", "sidebar");
  var brand = el("a", "brand"); brand.href = root + "index.html";
  var logo = el("img", "logo"); logo.src = root + "assets/favicon.svg"; logo.alt = ""; brand.appendChild(logo);
  var bt = el("span", "bt"); bt.appendChild(el("span", "bn", "BI Toolkit")); bt.appendChild(el("span", "bs", "work tools"));
  brand.appendChild(bt); side.appendChild(brand);

  var sw = el("div", "sidesearch");
  var si = el("input"); si.type = "search"; si.placeholder = "Search tools…"; si.setAttribute("aria-label", "Search tools");
  sw.appendChild(si); sw.appendChild(el("kbd", "", "Ctrl K")); side.appendChild(sw);

  var nav = el("nav", "sidenav");
  var home = el("a", "item" + (current ? "" : " on")); home.href = root + "index.html";
  var hi = el("span", "sic home"); hi.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/></svg>'; home.appendChild(hi); home.appendChild(el("span", "", "Home")); nav.appendChild(home);
  var groups = [];
  cats.forEach(function (c) {
    var list = tools.filter(function (t) { return t.cat === c; }); if (!list.length) return;
    var g = el("div", "group"); g.appendChild(el("div", "gh", c));
    list.forEach(function (t) {
      var a = el("a", "item" + (t === current ? " on" : "")); a.href = root + t.path; a.title = t.desc;
      a.dataset.hay = (t.name + " " + t.desc + " " + t.cat + " " + (t.tags || []).join(" ")).toLowerCase();
      a.appendChild(icon(t)); a.appendChild(el("span", "", t.name));
      g.appendChild(a);
    });
    nav.appendChild(g); groups.push(g);
  });
  side.appendChild(nav);
  side.appendChild(el("div", "sidefoot", "No logins · nothing uploaded"));

  si.addEventListener("input", function () {
    var q = si.value.trim().toLowerCase();
    groups.forEach(function (g) {
      var any = false;
      g.querySelectorAll("a.item").forEach(function (a) { var ok = !q || a.dataset.hay.indexOf(q) >= 0; a.hidden = !ok; any = any || ok; });
      g.hidden = !any;
    });
  });
  si.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { var a = nav.querySelector(".group a.item:not([hidden])"); if (a) location.href = a.href; }
    if (e.key === "Escape") { si.value = ""; si.dispatchEvent(new Event("input")); si.blur(); }
  });

  // Page bar
  var bar = el("header", "pagebar");
  var menu = el("button", "iconbtn menu"); menu.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'; menu.title = "Menu"; menu.setAttribute("aria-label", "Menu");
  menu.addEventListener("click", function () { document.body.classList.toggle("side-open"); });
  bar.appendChild(menu);
  var crumb = el("div", "crumb");
  if (current) { crumb.appendChild(el("span", "cn", current.name)); crumb.appendChild(el("span", "cd", current.desc)); }
  else { crumb.appendChild(el("span", "cn", "Home")); crumb.appendChild(el("span", "cd", "Small tools for SQL Server, EBS, ILR and SSRS work")); }
  bar.appendChild(crumb);
  var acts = el("div", "baracts");
  var theme = el("button", "iconbtn"); theme.setAttribute("aria-label", "Theme");
  function themeLabel() {
    var t = document.documentElement.getAttribute("data-theme") || "auto";
    var svg = {
      light: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>',
      dark: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>',
      auto: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></svg>'
    };
    theme.innerHTML = svg[t] || svg.auto;
    theme.title = "Theme: " + t + " (click to change)";
  }
  theme.addEventListener("click", function () {
    var t = document.documentElement.getAttribute("data-theme") || "auto";
    var next = t === "auto" ? "light" : t === "light" ? "dark" : "auto";
    if (next === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", next);
    try { if (next === "auto") localStorage.removeItem("bitk.theme"); else localStorage.setItem("bitk.theme", next); } catch (e) {}
    themeLabel();
  });
  themeLabel(); acts.appendChild(theme); bar.appendChild(acts);

  // Wrap existing page
  var old = document.querySelector("nav.topbar"); if (old) old.remove();
  var wrap = el("div", "mainwrap");
  wrap.appendChild(bar);
  var nodes = Array.prototype.slice.call(document.body.childNodes);
  nodes.forEach(function (n) { if (n.nodeType === 1 && n.tagName === "SCRIPT") return; wrap.appendChild(n); });
  var scrim = el("div", "scrim"); scrim.addEventListener("click", function () { document.body.classList.remove("side-open"); });
  document.body.insertBefore(scrim, document.body.firstChild);
  document.body.insertBefore(wrap, document.body.firstChild);
  document.body.insertBefore(side, document.body.firstChild);
  document.body.classList.add("shell");

  // Penguin-shaped tab cut into the sidebar edge, with the page name written down it
  (function () {
    var label = current ? current.name : "Home", NS = "http://www.w3.org/2000/svg";
    var cv = document.createElement("canvas").getContext("2d"); cv.font = "600 14px " + getComputedStyle(document.body).fontFamily;
    var len = Math.ceil(cv.measureText(label).width) + 10, W = 58, B = Math.max(30, len - 40), H = 140 + B;
    // Left-facing standing penguin; everything to its right is open to the page
    var d = "M" + (W + 1) + ",-14 Q" + (W + 1) + ",2 " + (W - 8) + ",3 " +
      "C" + (W - 18) + ",2 24,3 19,9 C15,13 14,18 14,21 " +           // crown to forehead
      "L1,27 L15,31 " +                                                // beak
      "C16,36 18,40 21,43 " +                                          // chin / neck
      "C9,52 4,68 4,86 L4," + (86 + B) + " " +                         // chest, then body
      "C4," + (106 + B) + " 9," + (118 + B) + " 18," + (124 + B) + " " + // belly curves in
      "L3," + (130 + B) + " L30," + (130 + B) + " " +                  // front foot
      "C38," + (131 + B) + " 46," + (131 + B) + " " + (W - 6) + "," + (133 + B) + " Q" + (W + 1) + "," + (134 + B) + " " + (W + 1) + "," + (H + 12) + " Z";
    var belly = "M21,46 C12,56 9,70 9,86 L9," + (86 + B) + " C9," + (102 + B) + " 13," + (113 + B) + " 21," + (120 + B) + " C29," + (110 + B) + " 33," + (98 + B) + " 33," + (86 + B) + " L33,86 C33,68 29,54 21,46 Z";
    var svg = document.createElementNS(NS, "svg"); svg.setAttribute("width", W + 1); svg.setAttribute("height", H); svg.setAttribute("aria-hidden", "true");
    function mk(tag, at) { var e = document.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); return e; }
    svg.appendChild(mk("path", { "class": "body", d: d }));
    svg.appendChild(mk("path", { "class": "outline", d: d.replace(/ Z$/, "") }));
    svg.appendChild(mk("path", { "class": "belly", d: belly }));
    svg.appendChild(mk("path", { "class": "flipper", d: "M" + (W - 10) + ",58 C" + (W - 4) + "," + (78 + B / 3) + " " + (W - 6) + "," + (96 + B / 2) + " " + (W - 16) + "," + (112 + B / 2) }));
    svg.appendChild(mk("path", { "class": "beak", d: "M15,21 L1,27 L15,31 Z" }));
    svg.appendChild(mk("circle", { "class": "eyering", cx: 27, cy: 18, r: 5 }));
    svg.appendChild(mk("circle", { "class": "eye", cx: 26, cy: 18, r: 2.6 }));
    svg.appendChild(mk("path", { "class": "feet", d: "M18," + (124 + B) + " L3," + (130 + B) + " L30," + (130 + B) + " Z" }));
    // centred in the belly: across (x = 21) and along (between its top at 46 and bottom at 120 + B)
    var tx = mk("text", { "class": "lbl", x: 0, y: 0, "text-anchor": "middle", "dominant-baseline": "central", transform: "translate(21," + (83 + B / 2) + ") rotate(90)" }); tx.textContent = label;
    svg.appendChild(tx);
    var tab = el("div", "penguin-tab"); tab.title = label + " (back to top)"; tab.appendChild(svg);
    tab.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
    function place() { tab.style.left = (side.getBoundingClientRect().right - W) + "px"; }
    document.body.appendChild(tab); place();
    window.addEventListener("resize", place);
  })();

  // Text boxes grow to fit what's in them (typed, pasted or loaded by a button)
  function grow(t) {
    if (!t || t.tagName !== "TEXTAREA" || t.offsetParent === null) return;
    t.style.height = "auto";
    var min = parseFloat(getComputedStyle(t).minHeight) || 0;
    t.style.height = Math.max(min, t.scrollHeight + 2) + "px";
  }
  document.addEventListener("input", function (e) { grow(e.target); });
  var lastVals = new WeakMap();
  setInterval(function () { document.querySelectorAll("textarea").forEach(function (t) { if (lastVals.get(t) !== t.value) { lastVals.set(t, t.value); grow(t); } }); }, 300);
  window.addEventListener("resize", function () { document.querySelectorAll("textarea").forEach(grow); });

  // Drag to scroll anything marked .pan (scrollbars are hidden site-wide)
  document.addEventListener("pointerdown", function (e) {
    var box = e.target.closest && e.target.closest(".pan");
    if (!box || e.button !== 0 || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(e.target.tagName)) return;
    if (box.scrollWidth <= box.clientWidth && box.scrollHeight <= box.clientHeight) return;
    var x0 = e.clientX, y0 = e.clientY, sx = box.scrollLeft, sy = box.scrollTop, moved = false;
    function mv(ev) {
      var dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      moved = true; box.classList.add("dragging");
      box.scrollLeft = sx - dx; box.scrollTop = sy - dy;
    }
    function up() {
      document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up);
      box.classList.remove("dragging");
      if (moved) { var stop = function (ce) { ce.stopPropagation(); ce.preventDefault(); }; box.addEventListener("click", stop, { capture: true, once: true }); setTimeout(function () { box.removeEventListener("click", stop, true); }, 50); }
    }
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
  });

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      var hs = document.getElementById("homebox");
      if (hs && window.innerWidth > 860) hs.focus(); else { document.body.classList.add("side-open"); si.focus(); }
    }
  });
  var on = nav.querySelector("a.item.on"); if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
})();
