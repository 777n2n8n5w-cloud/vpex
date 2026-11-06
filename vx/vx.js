  /* ===== VPEX Experience engine: motion that answers what you do =====
     Lives inside the main script (built in by vx/build.py). Everything here is decoration on top of
     working UI: if any piece fails or motion is off, the app behaves exactly as before.
     Under automation (navigator.webdriver) the vx motion stays off (html.vx-auto) so the functional tests
     measure settled layout and read real numbers, exactly as before; window.__vxForce turns it on for
     tests/vx_experience.js, which checks the motion itself. */
  var VX = { ptr: null, pick: false, idleT: 0, view: null, booted: false };
  function vxReduced() { try { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }
  function vxAuto() { return !!navigator.webdriver && !window.__vxForce; }
  function vxOn() { return motionOn() && !vxReduced() && !vxAuto(); }
  if (vxAuto()) document.documentElement.classList.add("vx-auto");
  function vxVar(n, fb) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || fb; }
  function vxMs(n, fb) { var v = vxVar(n, ""); var x = parseFloat(v); if (isNaN(x)) return fb; return /ms$/.test(v) ? x : x * 1000; }

  // Kits (round two): mirror data-theme into data-vx-kit synchronously-enough (a microtask, before paint), whoever changes it.
  function vxKitSync() {
    var r = document.documentElement, t = r.getAttribute("data-theme"), k = t ? (VX_KIT[t] || (/^sig-/.test(t) ? "none" : "none")) : VX_KIT.flow;
    if (r.getAttribute("data-vx-kit") !== k) r.setAttribute("data-vx-kit", k);
  }
  vxKitSync();
  if (window.MutationObserver) new MutationObserver(vxKitSync).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // The touch light, and the Call button's light that follows your finger or cursor.
  function vxTouch(x, y) {
    var el = document.getElementById("vxTouch"); if (!el || !el.animate) return;
    var t = "translate3d(" + x + "px," + y + "px,0)";
    el.animate([{ transform: t + " scale(.35)", opacity: 0.95 }, { transform: t + " scale(2.1)", opacity: 0 }], { duration: 560, easing: "cubic-bezier(.2,.8,.2,1)" });
  }
  function vxLightAt(btn, x, y) {
    var r = btn.getBoundingClientRect(); if (!r.width) return;
    btn.style.setProperty("--vx-px", Math.round(x - r.left) + "px"); btn.style.setProperty("--vx-py", Math.round(y - r.top) + "px");
  }
  document.addEventListener("pointerdown", function (e) {
    VX.ptr = { x: e.clientX, y: e.clientY, t: Date.now() }; vxWake();
    if (!vxOn()) return;
    var hit = e.target && e.target.closest ? e.target.closest("button, a, [role=button], .theme-card, .out-btn, .view-tab, .filter-chip") : null;
    if (!hit || hit.disabled) return;
    vxTouch(e.clientX, e.clientY);
    var cb = e.target.closest(".call-btn");
    if (cb) { vxLightAt(cb, e.clientX, e.clientY); cb.classList.add("vx-lit"); setTimeout(function () { cb.classList.remove("vx-lit"); }, 650); }
  }, { capture: true, passive: true });
  var vxFine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches, vxMoveQ = null;
  if (vxFine) document.addEventListener("pointermove", function (e) {
    if (vxMoveQ) { vxMoveQ = e; return; } vxMoveQ = e;
    requestAnimationFrame(function () {
      var ev = vxMoveQ; vxMoveQ = null; if (!ev || !ev.target || !ev.target.closest) return;
      var cb = ev.target.closest(".call-btn"); if (cb) vxLightAt(cb, ev.clientX, ev.clientY);
      var card = ev.target.closest("#mainArea .card");
      if (card) { var r = card.getBoundingClientRect(); card.style.setProperty("--vx-lx", Math.max(8, Math.min(92, Math.round(((ev.clientX - r.left) / r.width) * 100))) + "%"); }
    });
  }, { passive: true });

  // Ambient light and moving backgrounds hold still after 90 seconds without input.
  function vxWake() {
    if (VX.idle) { VX.idle = false; document.documentElement.classList.remove("vx-idle"); }
    clearTimeout(VX.idleT); VX.idleT = setTimeout(function () { VX.idle = true; document.documentElement.classList.add("vx-idle"); }, 90000);
  }
  ["keydown", "wheel", "touchmove"].forEach(function (ev) { document.addEventListener(ev, vxWake, { passive: true, capture: true }); });
  vxWake();

  // The header earns a shadow once the page scrolls under it.
  var vxScrollQ = false;
  window.addEventListener("scroll", function () {
    if (vxScrollQ) return; vxScrollQ = true;
    requestAnimationFrame(function () { vxScrollQ = false; document.documentElement.classList.toggle("vx-scrolled", window.scrollY > 6); });
  }, { passive: true });

  // Numbers count up to their value when a view opens.
  function vxCount(el, dur) {
    var text = el.textContent; if (!/\d/.test(text) || el.__vxBusy) return;
    var toks = [], re = /\d[\d,]*(?:\.\d+)?/g, m;
    while ((m = re.exec(text))) toks.push({ i: m.index, s: m[0], v: parseFloat(m[0].replace(/,/g, "")), d: (m[0].split(".")[1] || "").length, c: m[0].indexOf(",") !== -1 });
    if (!toks.length || toks.every(function (t) { return t.v === 0; })) return;
    var t0 = performance.now(), last = text; el.__vxBusy = true;
    function fmt(t, p) {
      var n = t.v * p, s = t.d ? n.toFixed(t.d) : String(Math.round(n));
      if (t.c) { var parts = s.split("."); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ","); s = parts.join("."); }
      return s;
    }
    (function step(now) {
      if (el.textContent !== last) { el.__vxBusy = false; return; }   // re-rendered underneath us: let it be
      var k = Math.min(1, (now - t0) / dur), p = 1 - Math.pow(1 - k, 3), out = "", at = 0;
      if (k >= 1) { el.textContent = text; el.__vxBusy = false; return; }
      toks.forEach(function (t) { out += text.slice(at, t.i) + fmt(t, p); at = t.i + t.s.length; });
      out += text.slice(at); el.textContent = out; last = out;
      requestAnimationFrame(step);
    })(t0);
  }
  var VX_COUNT = ".pipe-summary b, .pipe-forecast b, .deal-bar-amounts, .dl-kpi b, .cx-kpi b, .cx-mini b, .cx-money b, .rp-kpi b, .gb-top b";
  function vxCountAll(root) {
    if (vxAuto() || !vxOn() || !root) return;
    var dur = Math.max(520, Math.min(1100, vxMs("--vx-dur", 380) * 2));
    root.querySelectorAll(VX_COUNT).forEach(function (el) { vxCount(el, dur); });
  }

  // A view arrives from the side you moved toward; its rows rise in sequence and its bars grow.
  var VX_ORDER = ["dial", "history", "pipeline", "tasks", "vault"];
  function vxPlay(el, cls) {
    if (!el) return;
    el.classList.remove("vx-in-r", "vx-in-l", "vx-rise", "vx-grow"); void el.offsetWidth; el.classList.add(cls);
    var done = function () { el.classList.remove(cls); el.removeEventListener("animationend", done); };
    el.addEventListener("animationend", done); setTimeout(done, 2400);
  }
  function vxArrive(from, to) {
    if (!vxOn()) return;
    var main = document.getElementById("mainArea"); if (!main) return;
    var dir = VX_ORDER.indexOf(to) >= VX_ORDER.indexOf(from) ? "vx-in-r" : "vx-in-l";
    if (to === "dial") { vxPlay(document.getElementById("progressWrap"), dir); vxPlay(main, dir); }
    else {
      var n = 0;
      main.querySelectorAll(".deal-bar-card, .stage-section, .hist-day, .hist-item, .pipe-item, .task-item, .vault-item, .hist-head, .tasks-head").forEach(function (el) {
        if (n > 16 || el.closest(".vx-rise")) return;
        var r = el.getBoundingClientRect(); if (r.top > window.innerHeight + 40 || !r.height) return;
        el.style.setProperty("--vx-i", n++); vxPlay(el, "vx-rise");
      });
      if (!n) vxPlay(main, dir);
    }
    main.querySelectorAll(".deal-bar-fill, .bar-fill").forEach(function (b) { vxPlay(b, "vx-grow"); });
    vxCountAll(main);
  }

  // Tab ink: the selection glides from the old tab to the new one.
  function vxGlide(tabs, fromBtn, toBtn) {
    if (!vxOn() || !fromBtn || !toBtn || fromBtn === toBtn || !tabs.animate) return;
    var ink = tabs.querySelector(".vx-ink");
    if (!ink) { ink = document.createElement("i"); ink.className = "vx-ink"; ink.setAttribute("aria-hidden", "true"); tabs.insertBefore(ink, tabs.firstChild); }
    var cs = getComputedStyle(toBtn), tr = tabs.getBoundingClientRect(), a = fromBtn.getBoundingClientRect(), b = toBtn.getBoundingClientRect();
    if (!a.width || !b.width) return;
    ink.style.background = cs.backgroundImage !== "none" ? cs.backgroundImage : cs.backgroundColor;
    if (cs.backgroundImage !== "none") ink.style.backgroundColor = cs.backgroundColor;
    ink.style.borderRadius = cs.borderRadius; ink.style.boxShadow = cs.boxShadow; ink.style.height = b.height + "px";
    ink.style.border = cs.borderTopWidth + " " + cs.borderTopStyle + " " + cs.borderTopColor; ink.style.boxSizing = "border-box";
    var ox = -tr.left - tabs.clientLeft + tabs.scrollLeft, oy = -tr.top - tabs.clientTop;
    var A = "translate3d(" + (a.left + ox) + "px," + (a.top + oy) + "px,0)", B = "translate3d(" + (b.left + ox) + "px," + (b.top + oy) + "px,0)";
    ink.style.opacity = "1"; tabs.classList.add("vx-gliding");
    if (VX.glide) VX.glide.cancel();
    var dur = Math.max(160, Math.min(520, vxMs("--vx-dur", 380) * 0.85));
    VX.glide = ink.animate([{ transform: A, width: a.width + "px" }, { transform: B, width: b.width + "px" }], { duration: dur, easing: vxVar("--vx-ease", "ease"), fill: "forwards" });
    var end = function () { tabs.classList.remove("vx-gliding"); ink.style.opacity = "0"; VX.glide = null; };
    VX.glide.onfinish = end; VX.glide.oncancel = function () { tabs.classList.remove("vx-gliding"); };
  }
  (function () {
    var tabs = document.getElementById("viewTabs"); if (!tabs) return;
    var fromBtn = null, from = null;
    tabs.addEventListener("click", function () { from = state.activeView || "dial"; fromBtn = tabs.querySelector(".view-tab.active"); }, true);
    tabs.addEventListener("click", function (e) {
      var to = state.activeView || "dial", btn = e.target.closest && e.target.closest(".view-tab");
      if (!btn || from === null || from === to) { from = null; return; }
      try { vxGlide(tabs, fromBtn, btn); vxArrive(from, to); } catch (err) {}
      from = null;
    });
  })();

  // Today's count rolls up a notch each time it climbs.
  (function () {
    var n = document.getElementById("todayNum"); if (!n || !window.MutationObserver) return;
    var prev = parseInt(n.textContent, 10) || 0;
    new MutationObserver(function () {
      var v = parseInt(n.textContent, 10) || 0;
      if (v > prev && vxOn()) { n.classList.remove("vx-roll"); void n.offsetWidth; n.classList.add("vx-roll"); setTimeout(function () { n.classList.remove("vx-roll"); }, 600); }
      prev = v;
    }).observe(n, { childList: true, characterData: true, subtree: true });
  })();

  // First arrival: one orchestrated entrance when your list appears.
  (function () {
    var tabs = document.getElementById("viewTabs"); if (!tabs || !window.MutationObserver) return;
    var mo = new MutationObserver(function () {
      if (VX.booted || tabs.style.display === "none") return;
      VX.booted = true; mo.disconnect();
      if (!vxOn()) return;
      var root = document.documentElement; root.classList.add("vx-boot");
      setTimeout(function () { root.classList.remove("vx-boot"); }, 1600);
      setTimeout(function () { vxCountAll(document.getElementById("mainArea")); vxCountAll(document.getElementById("deskLive")); }, 120);
    });
    mo.observe(tabs, { attributes: true, attributeFilter: ["style"] });
  })();

  // Theme switching from the picker: the new theme opens out from the card you tapped.
  document.addEventListener("click", function (e) { if (e.target && e.target.closest && e.target.closest(".theme-card[data-theme-choice], .sig-card, [data-sig-choice]")) VX.pick = true; }, true);
  document.addEventListener("click", function () { VX.pick = false; });
  var vxSetTheme0 = setTheme;
  setTheme = function (name) {
    var pick = VX.pick; VX.pick = false;
    if (!pick || vxAuto() || !vxOn() || !document.startViewTransition || name === currentThemeName()) return vxSetTheme0(name);
    var p = VX.ptr && Date.now() - VX.ptr.t < 1500 ? VX.ptr : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    var w = window.innerWidth, h = window.innerHeight, rr = Math.ceil(Math.hypot(Math.max(p.x, w - p.x), Math.max(p.y, h - p.y)));
    var st = document.documentElement.style;
    st.setProperty("--vx-rx", Math.round(p.x) + "px"); st.setProperty("--vx-ry", Math.round(p.y) + "px"); st.setProperty("--vx-rr", rr + "px");
    try { document.startViewTransition(function () { vxSetTheme0(name); }); } catch (err) { vxSetTheme0(name); }
  };

  // Command: its numbers count up once the first data lands.
  var vxOpenCmd0 = openCommand;
  openCommand = function () {
    var r = vxOpenCmd0.apply(this, arguments);
    vxFresh(document.getElementById("cmd"), 2600);
    setTimeout(function () { var c = document.getElementById("cmd"); if (c && !c.hidden) vxCountAll(c); }, 380);
    return r;
  };

  // Reports and other feature sheets: charts draw in and the headline numbers count up as the sheet opens.
  function vxFresh(el, ms) {
    if (!el || !vxOn()) return;
    el.classList.add("vx-fresh"); clearTimeout(el.__vxFreshT);
    el.__vxFreshT = setTimeout(function () { el.classList.remove("vx-fresh"); }, ms || 1800);
  }
  var vxFeat0 = featOpen;
  featOpen = function () {
    var b = vxFeat0.apply(this, arguments);
    vxFresh(document.getElementById("featModal"));
    setTimeout(function () { vxCountAll(b); }, 120);
    return b;
  };
