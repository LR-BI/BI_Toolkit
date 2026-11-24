// Loaded in <head>: applies the saved theme before paint, and lets one page hand data to another tool page.
(function () {
  try { var t = localStorage.getItem("bitk.theme"); if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t); } catch (e) {}
  var KEY = "bitk.handoff";
  window.BITK = {
    // Stored in this browser only, read once, and ignored after 2 minutes.
    give: function (obj) { try { obj.at = Date.now(); localStorage.setItem(KEY, JSON.stringify(obj)); return true; } catch (e) { return false; } },
    take: function () {
      try {
        var s = localStorage.getItem(KEY); if (!s) return null;
        localStorage.removeItem(KEY);
        var o = JSON.parse(s); return o && Date.now() - (o.at || 0) < 120000 ? o : null;
      } catch (e) { return null; }
    }
  };
})();
