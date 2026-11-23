// "How to use" boxes always start closed; open them when needed.
// (Older versions remembered the state, so clear any saved values.)
(function () {
  try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf("bitk.howto.") === 0) localStorage.removeItem(k); }); } catch (e) {}
})();
