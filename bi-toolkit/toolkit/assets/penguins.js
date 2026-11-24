// ASCII penguin used as the home page background (tiled, faint, whole page).
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
  function build() {
    var el = document.body; if (!document.querySelector(".home-hero")) return;
    var art = window.PENGUIN_ART, fs = 9, lh = 9.5, cw = fs * 0.6;
    var w = Math.ceil(art[0].length * cw) + 34, h = Math.ceil(art.length * lh) + 30;
    function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function block(x, y) {
      return '<text x="' + x + '" y="' + y + '" xml:space="preserve">' + art.map(function (l, i) {
        return '<tspan x="' + x + '" dy="' + (i ? lh : 0) + '">' + esc(l) + '</tspan>';
      }).join("") + "</text>";
    }
    var dark = document.documentElement.getAttribute("data-theme") === "dark" ||
      (!document.documentElement.getAttribute("data-theme") && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    var colour = dark ? "#9e89ff" : "#765de5", op = dark ? 0.16 : 0.13;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + (w * 2) + '" height="' + (h * 2) + '">' +
      '<g font-family="Consolas, \'Courier New\', monospace" font-size="' + fs + '" fill="' + colour + '" fill-opacity="' + op + '">' +
      block(10, 18) + block(10 + w, 18 + h) + "</g></svg>";
    el.style.backgroundImage = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }
  build();
  // Re-colour when the theme changes
  new MutationObserver(build).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  if (window.matchMedia) { var m = matchMedia("(prefers-color-scheme: dark)"); if (m.addEventListener) m.addEventListener("change", build); }
})();
