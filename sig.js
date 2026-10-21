/* VPEX Signature themes: the few things CSS can't do alone. Loaded only with sig.css (index.html: ensureSigAssets).
   VPEXSig.mount(id, opts) is called whenever the theme is applied; any non-signature id tears everything down.
   Nothing here reads or writes app data; the only app value used is opts.liveAt() (when Call was tapped). */
(function () {
  "use strict";
  var cur = null, mo = null, bodyMo = null, tick = null, cleanups = [], seen = typeof WeakSet === "function" ? new WeakSet() : null;
  var NS = "http://www.w3.org/2000/svg";

  function art() {
    var a = document.getElementById("sigArt");
    if (!a) { a = document.createElement("div"); a.id = "sigArt"; a.setAttribute("aria-hidden", "true"); document.body.insertBefore(a, document.body.firstChild); }
    return a;
  }
  function over(make) {
    var o = document.getElementById("sigOver");
    if (!o && make) { o = document.createElement("div"); o.id = "sigOver"; o.setAttribute("aria-hidden", "true"); document.body.appendChild(o); }
    return o;
  }
  function stop() {
    if (mo) { mo.disconnect(); mo = null; }
    if (bodyMo) { bodyMo.disconnect(); bodyMo = null; }
    if (tick) { clearInterval(tick); tick = null; }
    while (cleanups.length) cleanups.pop()();
    var a = document.getElementById("sigArt"); if (a) a.innerHTML = "";
    var o = over(false); if (o && o.parentNode) o.parentNode.removeChild(o);
  }

  /* Urushi: the cracks in the lacquer, gold filling them one by one as the day's calls build (CSS reads --goal-p) */
  var SEAMS = [
    "M-10 210 L48 196 L71 214 L118 188 L139 201 L186 170 L204 183 L251 152 L268 166 L322 134 L340 142 L410 118",
    "M410 520 L362 532 L344 517 L297 548 L276 538 L238 571 L214 560 L176 596 L151 589 L118 624 L96 618 L-10 660",
    "M186 170 L180 132 L194 101 L188 62 L201 30 L196 -10",
    "M238 571 L246 612 L231 648 L240 690 L228 732 L236 810",
    "M-10 402 L34 410 L52 396 L88 420 L104 412 L131 438",
    "M410 330 L371 322 L354 338 L318 316 L301 327 L276 304"
  ];
  function seams() {
    var svg = document.createElementNS(NS, "svg"), raf = 0;
    svg.setAttribute("focusable", "false");
    // drawn in screen pixels (the crack shapes are stretched to the screen), so lines stay hairline-thin at any size
    function draw() {
      raf = 0;
      var W = Math.max(1, innerWidth), H = Math.max(1, innerHeight), sx = W / 400, sy = H / 800;
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.innerHTML = '<defs><linearGradient id="sgGold" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="' + W + '" y2="' + H + '">' +
        '<stop offset="0" stop-color="#A57A26"/><stop offset=".35" stop-color="#FBE6A8"/><stop offset=".6" stop-color="#C99D41"/><stop offset="1" stop-color="#F2D68A"/></linearGradient></defs>';
      SEAMS.forEach(function (d, i) {
        var dd = d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, function (m, x, y) { return (x * sx).toFixed(1) + " " + (y * sy).toFixed(1); });
        ["sg-crack", "sg-glow", "sg-gold"].forEach(function (cls) {
          var p = document.createElementNS(NS, "path");
          p.setAttribute("d", dd); p.setAttribute("class", cls); p.setAttribute("pathLength", "1");
          if (cls !== "sg-crack") p.style.setProperty("--i", String(i));
          svg.appendChild(p);
        });
      });
    }
    draw(); art().appendChild(svg);
    var onResize = function () { if (!raf) raf = requestAnimationFrame(draw); };
    addEventListener("resize", onResize); cleanups.push(function () { removeEventListener("resize", onResize); if (raf) cancelAnimationFrame(raf); });
  }

  /* Premiere: curtains either side of the screen on wide displays; Prism: a ray split across the page */
  function el(cls) { var d = document.createElement("div"); d.className = cls; art().appendChild(d); return d; }

  /* Horologe: each new Call button's seconds hand starts where the real clock's seconds are */
  function stampSeconds(root) {
    var list = (root || document).querySelectorAll ? (root || document).querySelectorAll(".call-btn") : [];
    for (var i = 0; i < list.length; i++) {
      var b = list[i]; if (seen && seen.has(b)) continue;
      if (seen) seen.add(b);
      b.style.setProperty("--sig-s0", ((Date.now() / 1000) % 60).toFixed(2));
    }
  }

  /* Premiere: the letterbox, its timecode, the shutter and the wrap title */
  function premiere(opts) {
    var o = over(true);
    o.innerHTML = '<div class="pm-grain"></div><div class="pm-bar pm-top"></div><div class="pm-bar pm-bot"><span class="pm-tc">00:00</span></div>' +
      '<div class="pm-shut"></div><div class="pm-wrap">That’s a wrap</div>';
    el("pm-flare"); el("pm-curtain pm-cl"); el("pm-curtain pm-cr");
    var tc = o.querySelector(".pm-tc");
    function paint() {
      var at = (opts && opts.liveAt && opts.liveAt()) || 0, s = at ? Math.max(0, Math.floor((Date.now() - at) / 1000)) : 0;
      if (s > 5400) s = 0;
      var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
      tc.textContent = (h ? h + ":" + (m < 10 ? "0" : "") : (m < 10 ? "0" : "")) + m + ":" + (x < 10 ? "0" : "") + x;
    }
    function sync() {
      var live = document.body.classList.contains("st-live");
      if (live && !tick) { paint(); tick = setInterval(function () { if (!document.hidden) paint(); }, 1000); }
      if (!live && tick) { clearInterval(tick); tick = null; }
    }
    bodyMo = new MutationObserver(sync); bodyMo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    sync();
  }

  function mount(id, opts) {
    if (id === cur) return;
    stop(); cur = id;
    if (!id || id.indexOf("sig-") !== 0) { cur = null; return; }
    if (id === "sig-urushi") seams();
    if (id === "sig-premiere") premiere(opts);
    if (id === "sig-prism") el("pr-beam");
    if (id === "sig-horologe") {
      stampSeconds(document);
      mo = new MutationObserver(function () { stampSeconds(document.getElementById("mainArea") || document); });
      mo.observe(document.getElementById("mainArea") || document.body, { childList: true, subtree: true });
    }
  }
  /* a short cross-fade when the theme changes, so it reads as deliberate */
  function fade() {
    var r = document.documentElement; r.classList.remove("sig-switching"); void r.offsetWidth; r.classList.add("sig-switching");
    clearTimeout(fade.t); fade.t = setTimeout(function () { r.classList.remove("sig-switching"); }, 520);
  }
  window.VPEXSig = { mount: mount, fade: fade, current: function () { return cur; } };
})();
