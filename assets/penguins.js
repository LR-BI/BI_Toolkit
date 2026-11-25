// Home page background: whole ASCII penguins falling down the page like digital rain,
// with a few characters flickering. Each penguin keeps its shape so you can see it.
// Drawn on a canvas behind the page; text always sits on solid panels on top.
window.PENGUIN_ART = [
"dHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHb",
"HHP%%#%%%%%%%%%%%%%%%%#%%%%%%%#%%VHH",
"HH%%%%%%%%%%#%v~~~~~~\\%%%#%%%%%%%%HH",
"HH%%%%%#%%%%v'        ~~~~\\%%%%%#%HH",
"HH%%#%%%%%%v'dHHb      a%%%#%%%%%%HH",
"HH%%%%%#%%v'dHHHA     :%%%%%%#%%%%HH",
"HH%%%#%%%v' VHHHHaadHHb:%#%%%%%%%%HH",
"HH%%%%%#v'   `VHHHHHHHHb:%%%%%#%%%HH",
"HH%#%%%v'      `VHHHHHHH:%%%#%%#%%HH",
"HH%%%%%'        dHHHHHHH:%%#%%%%%%HH",
"HH%%#%%        dHHHHHHHH:%%%%%%#%%HH",
"HH%%%%%       dHHHHHHHHH:%%#%%%%%%HH",
"HH#%%%%       VHHHHHHHHH:%%%%%#%%%HH",
"HH%%%%#   b    HHHHHHHHV:%%%#%%%%#HH",
"HH%%%%%   Hb   HHHHHHHV'%%%%%%%%%%HH",
"HH%%#%%   HH  dHHHHHHV'%%%#%%%%%%%HH",
"HH%#%%%   VHbdHHHHHHV'#%%%%%%%%#%%HH",
"HHb%%#%    VHHHHHHHV'%%%%%#%%#%%%%HH",
"HHHHHHHb    VHHHHHHH:%odHHHHHHbo%dHH",
"HHHHHHHHboodboooooodHHHHHHHHHHHHHHHH",
"HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH",
"VHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHV"
];
(function () {
  if (!document.querySelector(".home-hero")) return;
  var art = window.PENGUIN_ART, W = art[0].length, H = art.length;

  var cv = document.createElement("canvas");
  cv.className = "rain"; cv.setAttribute("aria-hidden", "true");
  document.body.insertBefore(cv, document.body.firstChild);
  var ctx = cv.getContext("2d"), FS = 11, LH = 12, CW = 0, AW = 0, AH = H * LH, lanes = [], vh = 0, dpr = 1, raf = 0, last = 0, col = "#765de5", base = 0.3;
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var GLYPH = "H%#dbVA:~'`ao";
  // How strongly each character shows: the solid H outline and body stand out, the % fill sits back
  function weight(ch) { return /[HdbVA]/.test(ch) ? 1 : /[%#]/.test(ch) ? 0.38 : 0.75; }

  function theme() {
    var t = document.documentElement.getAttribute("data-theme");
    var dark = t === "dark" || (!t && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    col = dark ? "#9e89ff" : "#765de5"; base = dark ? 0.34 : 0.28;
  }
  var SCALES = [0.6, 0.75, 0.9, 1, 1.15], vw = 0;
  // a penguin anywhere across the page; smaller ones are fainter and slower, so it has some depth
  function lane(x, first) {
    var sc = SCALES[Math.floor(Math.random() * SCALES.length)], h = AH * sc;
    return { sc: sc, x: Math.random() * (vw - AW * sc * 0.5) - AW * sc * 0.25, y: first ? Math.random() * (vh + h) - h : -h - Math.random() * vh * 0.6,
      v: (1.6 + Math.random() * 2.4) * sc, glitch: {} };
  }
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth; vh = window.innerHeight; vw = w;
    cv.width = Math.round(w * dpr); cv.height = Math.round(vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = FS + "px Consolas, 'Cascadia Mono', 'Courier New', monospace"; ctx.textBaseline = "top";
    CW = ctx.measureText("H").width; AW = Math.ceil(CW * W);
    var n = Math.max(3, Math.round(w * vh / (AW * AH) * 0.9));   // roughly one screen's worth, overlapping freely
    lanes = [];
    for (var i = 0; i < n; i++) lanes.push(lane(0, true));
    lanes.sort(function (a, b) { return a.sc - b.sc; });       // big ones drawn on top
  }
  function draw() {
    ctx.clearRect(0, 0, cv.width, cv.height); ctx.fillStyle = col;
    for (var i = 0; i < lanes.length; i++) {
      var p = lanes[i], cw = CW * p.sc, lh = LH * p.sc, depth = 0.55 + 0.45 * (p.sc - 0.6) / 0.55;
      ctx.font = (FS * p.sc).toFixed(1) + "px Consolas, 'Cascadia Mono', 'Courier New', monospace";
      for (var r = 0; r < H; r++) {
        var y = p.y + r * lh; if (y < -lh || y > vh) continue;
        var fade = 0.25 + 0.75 * (r / (H - 1));            // top of the penguin trails off, leading edge brightest
        for (var c = 0; c < W; c++) {
          var ch = p.glitch[r * W + c] || art[r][c]; if (ch === " ") continue;
          ctx.globalAlpha = Math.min(1, base * depth * fade * weight(art[r][c]) * (r === H - 1 ? 1.6 : 1));
          ctx.fillText(ch, p.x + c * cw, y);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  function step(t) {
    raf = requestAnimationFrame(step);
    if (t - last < 33) return;                       // ~30 fps is plenty
    var dt = Math.min((t - last) / 33, 3); last = t;
    for (var i = 0; i < lanes.length; i++) {
      var p = lanes[i]; p.y += p.v * dt;
      // a few characters flicker, like falling code, without losing the shape
      if (Math.random() < 0.5) { var k = Math.floor(Math.random() * W * H); if (art[Math.floor(k / W)][k % W] !== " ") p.glitch[k] = GLYPH[Math.floor(Math.random() * GLYPH.length)]; }
      if (Math.random() < 0.5) { var keys = Object.keys(p.glitch); if (keys.length) delete p.glitch[keys[Math.floor(Math.random() * keys.length)]]; }
      if (p.y > vh) { lanes[i] = lane(0, false); lanes[i].sc = p.sc; lanes[i].v = (1.6 + Math.random() * 2.4) * p.sc; }
    }
    draw();
  }
  function start() { if (!still && !raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(step); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  theme(); size(); draw(); start();
  var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { size(); draw(); }, 150); });
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });
  new MutationObserver(function () { theme(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  if (window.matchMedia) { var m = matchMedia("(prefers-color-scheme: dark)"); if (m.addEventListener) m.addEventListener("change", function () { theme(); draw(); }); }
  window.__rain = { stop: stop, start: start };
})();
