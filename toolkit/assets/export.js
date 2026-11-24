// Shared diagram export: SVG, PNG and PDF, all made in the browser.
// BITK_EXPORT.svg(svgEl, "name") / .png(svgEl, "name") / .pdf(svgEl, "name")
// svgEl can be a live <svg> on the page (styles are copied in) or an SVG string.
(function () {
  var PROPS = ["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "opacity", "fill-opacity", "stroke-opacity",
    "font-family", "font-size", "font-weight", "font-style", "text-anchor", "dominant-baseline", "letter-spacing"];

  // Copy a live SVG with every colour, font and size written in, so it looks the same outside the page.
  function standalone(svg, opts) {
    opts = opts || {};
    if (typeof svg === "string") return svg;
    // Always export with the light theme so it prints well on white.
    var root = document.documentElement, was = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "light"); getComputedStyle(svg).fill;
    try { return build(svg, opts); } finally { if (was === null) root.removeAttribute("data-theme"); else root.setAttribute("data-theme", was); }
  }
  function build(svg, opts) {
    var clone = svg.cloneNode(true);
    var src = [svg].concat(Array.prototype.slice.call(svg.querySelectorAll("*")));
    var dst = [clone].concat(Array.prototype.slice.call(clone.querySelectorAll("*")));
    for (var i = src.length - 1; i >= 0; i--) {
      var cs = getComputedStyle(src[i]), d = dst[i];
      if (cs.display === "none" || cs.visibility === "hidden" || (d.getAttribute("class") || "").indexOf("noexport") >= 0) { if (d.parentNode) d.parentNode.removeChild(d); continue; }
      PROPS.forEach(function (p) {
        var v = cs.getPropertyValue(p);
        if (v && v !== "normal" && !(p === "letter-spacing" && v === "0px")) d.setAttribute(p, v);
      });
      d.removeAttribute("class"); d.removeAttribute("style");
    }
    var vb = (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
    var w = vb.length === 4 ? vb[2] : svg.getBoundingClientRect().width, h = vb.length === 4 ? vb[3] : svg.getBoundingClientRect().height;
    if (vb.length !== 4) clone.setAttribute("viewBox", "0 0 " + w + " " + h);
    clone.setAttribute("width", w); clone.setAttribute("height", h);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    var r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", vb.length === 4 ? vb[0] : 0); r.setAttribute("y", vb.length === 4 ? vb[1] : 0);
    r.setAttribute("width", w); r.setAttribute("height", h); r.setAttribute("fill", opts.background || "#ffffff");
    clone.insertBefore(r, clone.firstChild);
    return new XMLSerializer().serializeToString(clone);
  }

  function size(text) {
    var m = /viewBox="([^"]+)"/.exec(text), v = m ? m[1].split(/[\s,]+/).map(Number) : null;
    var w = /<svg[^>]*\swidth="([\d.]+)/.exec(text), h = /<svg[^>]*\sheight="([\d.]+)/.exec(text);
    return { w: w ? +w[1] : v ? v[2] : 800, h: h ? +h[1] : v ? v[3] : 600 };
  }

  function save(blob, name) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function toCanvas(text, maxPx, cb) {
    var s = size(text), scale = Math.min(3, maxPx / Math.max(s.w, s.h));
    var img = new Image();
    img.onload = function () {
      var c = document.createElement("canvas"); c.width = Math.round(s.w * scale); c.height = Math.round(s.h * scale);
      var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      cb(c, s);
    };
    img.onerror = function () { alert("Sorry, the diagram couldn't be drawn for export."); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(text);
  }

  // A one-page PDF holding the diagram as a sharp image, fitted to A4 (landscape or portrait).
  function makePdf(jpegBytes, pxW, pxH, title) {
    var land = pxW >= pxH, PW = land ? 841.89 : 595.28, PH = land ? 595.28 : 841.89, M = 28;
    var k = Math.min((PW - 2 * M) / pxW, (PH - 2 * M - (title ? 18 : 0)) / pxH);
    var dw = pxW * k, dh = pxH * k, dx = (PW - dw) / 2, dy = (PH - dh) / 2 - (title ? 9 : 0);
    var enc = new TextEncoder(), parts = [], off = 0, xref = [];
    function put(x) { var b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); off += b.length; }
    function obj(n, body, stream) {
      xref[n] = off; put(n + " 0 obj\n" + body);
      if (stream) { put("\nstream\n"); put(stream); put("\nendstream"); }
      put("\nendobj\n");
    }
    var safe = (title || "").replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7e]/g, "?");
    var content = "q " + dw.toFixed(2) + " 0 0 " + dh.toFixed(2) + " " + dx.toFixed(2) + " " + dy.toFixed(2) + " cm /Im0 Do Q\n" +
      (title ? "BT /F1 10 Tf 0.35 0.33 0.4 rg " + M + " " + (PH - M + 6) + " Td (" + safe + ") Tj ET\n" : "");
    put("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    obj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PW + " " + PH + "] /Resources << /XObject << /Im0 4 0 R >> /Font << /F1 6 0 R >> >> /Contents 5 0 R >>");
    obj(4, "<< /Type /XObject /Subtype /Image /Width " + pxW + " /Height " + pxH + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpegBytes.length + " >>", jpegBytes);
    var cb = enc.encode(content);
    obj(5, "<< /Length " + cb.length + " >>", cb);
    obj(6, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    var xo = off, x = "xref\n0 7\n0000000000 65535 f \n";
    for (var i = 1; i <= 6; i++) x += ("000000000" + xref[i]).slice(-10) + " 00000 n \n";
    put(x + "trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n" + xo + "\n%%EOF\n");
    return new Blob(parts, { type: "application/pdf" });
  }

  function file(name, ext) { return String(name || "diagram").replace(/[\\/:*?"<>|]+/g, "-").trim() + "." + ext; }

  window.BITK_EXPORT = {
    standalone: standalone,
    svg: function (svg, name, opts) { save(new Blob([standalone(svg, opts)], { type: "image/svg+xml" }), file(name, "svg")); },
    png: function (svg, name, opts) { toCanvas(standalone(svg, opts), 8000, function (c) { c.toBlob(function (b) { save(b, file(name, "png")); }, "image/png"); }); },
    pdf: function (svg, name, opts) {
      opts = opts || {};
      toCanvas(standalone(svg, { background: opts.background || "#ffffff" }), 7000, function (c) {
        var bin = atob(c.toDataURL("image/jpeg", 0.92).split(",")[1]), u = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        save(makePdf(u, c.width, c.height, opts.title || name), file(name, "pdf"));
      });
    }
  };
})();
