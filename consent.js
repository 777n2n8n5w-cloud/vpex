/* VPEX cookie and tracking consent (vpexdialer.com). Every page loads this first, in <head>, before anything optional runs.

   What's optional (off until you allow it where the law requires consent; see /cookies/):
     fonts        Google Fonts. Loading them sends your IP address and browser details to Google.
     stats        Anonymous visit statistics: one count per step (page seen, demo opened, trial started) with where the
                  visit came from and phone or computer. No cookies, no IDs, nothing that identifies you.
     attribution  Remembers on this device, for 30 days, which link or post brought you, so a later sign-up is credited to it.
   Everything else VPEX stores on your device is needed for what you asked for (signing in, the demo, your settings).

   Where consent comes first: everywhere outside the United States (the EU/EEA, UK, Switzerland, Canada, Brazil and the
   rest), judged by the device's time zone because the site has no server to look up a location. In the US the optional
   items start on with a clear notice and one-tap Reject all, and the browser's Global Privacy Control signal turns
   statistics and attribution off. No choice is ever pre-ticked in a consent-first region.

   The choice is kept on this device (localStorage "vpex_consent", needed to remember it) and a copy goes to VPEX's server
   as proof (functions/ "consent": a random id, the policy version, the choices, how they were made; no IP address).
   Asked again after 12 months or when this policy version changes. Change or withdraw any time: "Cookie settings" in
   every page's footer, or VPEXConsent.open().

   API: VPEXConsent.allowed(cat) · .decided() · .get() · .open() · .acceptAll() · .rejectAll() · .set({fonts, stats,
   attribution}) · .onChange(fn). Pages activate <link data-consent-href="..."> (fonts) through it. */
(function () {
  "use strict";
  if (window.VPEXConsent) return;
  var VERSION = "2026-11-10", KEY = "vpex_consent", MAX_AGE = 395 * 86400000;
  var ENDPOINT = "https://us-central1-dovetail-f863c.cloudfunctions.net/consent";
  var CATS = ["fonts", "stats", "attribution"];
  var LABELS = {
    fonts: ["External fonts", "The site’s typefaces come from Google Fonts. Loading them sends your IP address and browser details to Google. Off: your device’s own fonts are used."],
    stats: ["Visit statistics", "One anonymous count per step (page seen, demo opened, trial started), with the link or site that sent you and phone or computer. No cookies, no IDs, nothing that identifies you."],
    attribution: ["Campaign attribution", "Remembers on this device, for 30 days, which link or post brought you here, so a later sign-up is credited to it."]
  };
  var listeners = [];

  function ls(k, v) { try { if (v === undefined) return window.localStorage.getItem(k); if (v === null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } catch (e) {} return null; }
  function tz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; } }
  // US time zones: notice with opt-out. Everything else (or unknown): consent first.
  var US_TZ = /^(America\/(New_York|Detroit|Kentucky\/.+|Indiana\/.+|Indianapolis|Louisville|Fort_Wayne|Chicago|Menominee|North_Dakota\/.+|Denver|Boise|Phoenix|Los_Angeles|Anchorage|Juneau|Sitka|Metlakatla|Yakutat|Nome|Adak|Puerto_Rico|St_Thomas|Virgin)|Pacific\/(Honolulu|Guam|Saipan|Pago_Pago)|US\/.+)$/;
  var REGION = US_TZ.test(tz()) ? "optout" : "optin";
  var GPC = !!(navigator.globalPrivacyControl === true || navigator.globalPrivacyControl === "1");
  // An automated browser (test runs, screenshot tools) can't consent: no banner, and the defaults above stay in force
  // (consent-first regions: nothing optional). The consent test bench sets vpex_consent_test to see the banner.
  var AUTOMATED = navigator.webdriver === true && !ls("vpex_consent_test");

  function stored() {
    var r = null; try { r = JSON.parse(ls(KEY) || "null"); } catch (e) {}
    if (!r || typeof r !== "object" || typeof r.c !== "object") return null;
    return r;
  }
  function current() {   // a choice made under this policy version, in the last 12 months
    var r = stored();
    return r && r.v === VERSION && typeof r.t === "number" && Date.now() - r.t < MAX_AGE ? r : null;
  }
  function defaults() {
    var on = REGION === "optout";
    return { fonts: on, stats: on && !GPC, attribution: on && !GPC };
  }
  function choices() {
    var r = current(), d = defaults(), c = {};
    CATS.forEach(function (k) { c[k] = r ? r.c[k] === true : d[k]; });
    return c;
  }
  function newId() {
    var a = new Uint8Array(16), s = "", al = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    try { crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256); }
    for (var j = 0; j < 16; j++) s += al[a[j] % 64];
    return s + Date.now().toString(36).slice(-6);
  }
  function proof(r) {   // the server copy; only on vpexdialer.com (a local test bench can point it elsewhere), never blocks anything
    var url = ENDPOINT;
    if (!/(^|\.)vpexdialer\.com$/.test(location.hostname)) { url = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? ls("vpex_consent_test") : null; if (!url) return; }
    var body = JSON.stringify({ id: r.id, v: r.v, s: r.c.stats, t: r.c.attribution, f: r.c.fonts, m: r.m, r: REGION, g: GPC,
      d: /Mobi|iPhone|iPad|Android/i.test(navigator.userAgent || "") ? "m" : "d" });
    try { if (navigator.sendBeacon && navigator.sendBeacon(url, body)) return; } catch (e) {}
    try { fetch(url, { method: "POST", body: body, mode: "no-cors", keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(function () {}); } catch (e) {}
  }
  function clearOptional(c) {   // withdrawing consent removes what that category stored
    if (!c.attribution) ls("vpex_attr", null);
    if (!c.stats) { try { for (var i = window.sessionStorage.length - 1; i >= 0; i--) { var k = window.sessionStorage.key(i); if (/^vpex_(hit_|bio_view)/.test(k)) window.sessionStorage.removeItem(k); } } catch (e) {} ls("vpex_hit_home", null); }
  }
  function activateFonts() {
    if (!choices().fonts) return;
    var ls2 = document.querySelectorAll("link[data-consent-href]");
    for (var i = 0; i < ls2.length; i++) { var l = ls2[i]; if (!l.getAttribute("href")) l.setAttribute("href", l.getAttribute("data-consent-href")); }
  }
  function emit() {
    var c = choices();
    activateFonts();
    listeners.slice().forEach(function (fn) { try { fn(c); } catch (e) {} });
    try { document.dispatchEvent(new CustomEvent("vpex-consent", { detail: c })); } catch (e) {}
  }
  function save(c, method) {
    var prev = stored(), before = prev ? prev.c : null, out = {};
    CATS.forEach(function (k) { out[k] = c[k] === true; });
    if (method === "save" && before && CATS.some(function (k) { return before[k] && !out[k]; })) method = "withdraw";
    var r = { v: VERSION, t: Date.now(), id: (prev && prev.id) || newId(), c: out, m: method, r: REGION };
    ls(KEY, JSON.stringify(r));
    clearOptional(out);
    proof(r);
    hideBanner();
    emit();
    return r;
  }

  // ---------- the banner and the settings panel ----------
  var CSS = "" +
    ".vc-root{--vc-bg:#fff;--vc-fg:#14171c;--vc-dim:#4a5260;--vc-line:#d6dae1;--vc-btn:#14171c;--vc-btnfg:#fff;--vc-ghost:#eef0f3;--vc-focus:#2563eb;" +
    "font:15px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--vc-fg);-webkit-text-size-adjust:100%}" +
    "@media (prefers-color-scheme:dark){.vc-root{--vc-bg:#171b22;--vc-fg:#eef1f5;--vc-dim:#aab3c0;--vc-line:#323a47;--vc-btn:#eef1f5;--vc-btnfg:#11141a;--vc-ghost:#232934;--vc-focus:#7aa7ff}}" +
    ".vc-bar{position:fixed;z-index:2147483000;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom,0px));max-width:760px;margin:0 auto;background:var(--vc-bg);border:1px solid var(--vc-line);border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.28);padding:16px 18px}" +
    ".vc-bar h2,.vc-panel h2{margin:0 0 4px;font-size:16px;font-weight:700;letter-spacing:0}.vc-bar p{margin:0 0 12px;color:var(--vc-dim);font-size:14px}" +
    ".vc-root a{color:inherit;text-decoration:underline;text-underline-offset:2px}" +
    ".vc-row{display:flex;flex-wrap:wrap;gap:8px}.vc-row button{flex:1 1 140px}" +
    ".vc-root button{font:inherit;font-weight:600;min-height:44px;padding:0 16px;border-radius:10px;border:1px solid var(--vc-line);background:var(--vc-ghost);color:var(--vc-fg);cursor:pointer}" +
    ".vc-root button.vc-main{background:var(--vc-btn);color:var(--vc-btnfg);border-color:var(--vc-btn)}" +
    ".vc-root button:focus-visible,.vc-root input:focus-visible,.vc-root a:focus-visible{outline:3px solid var(--vc-focus);outline-offset:2px}" +
    ".vc-scrim{position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center;padding:12px}" +
    "@media (min-width:640px){.vc-scrim{align-items:center}}" +
    ".vc-panel{background:var(--vc-bg);border:1px solid var(--vc-line);border-radius:16px;width:100%;max-width:560px;max-height:calc(100dvh - 24px);overflow:auto;padding:18px;box-shadow:0 16px 48px rgba(0,0,0,.35)}" +
    ".vc-panel>p{margin:0 0 12px;color:var(--vc-dim);font-size:14px}" +
    ".vc-cat{display:flex;gap:12px;align-items:flex-start;border-top:1px solid var(--vc-line);padding:12px 0}" +
    ".vc-cat div{flex:1;min-width:0}.vc-cat b{display:block;font-size:15px}.vc-cat span{display:block;color:var(--vc-dim);font-size:13.5px;margin-top:2px}" +
    ".vc-cat em{font-style:normal;font-size:12px;font-weight:700;color:var(--vc-dim);white-space:nowrap;padding-top:2px}" +
    ".vc-sw{position:relative;flex:none;width:52px;height:32px;margin-top:2px}.vc-sw input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}" +
    ".vc-sw i{pointer-events:none;position:absolute;inset:0;border-radius:999px;background:var(--vc-line);transition:background .15s}" +
    ".vc-sw i:after{content:'';position:absolute;top:3px;left:3px;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .15s}" +
    ".vc-sw input:checked+i{background:#16a34a}.vc-sw input:checked+i:after{transform:translateX(20px)}.vc-sw input:focus-visible+i{outline:3px solid var(--vc-focus);outline-offset:2px}" +
    ".vc-note{font-size:12.5px;color:var(--vc-dim);margin:10px 0 0}" +
    "@media (prefers-reduced-motion:reduce){.vc-sw i,.vc-sw i:after{transition:none}}" +
    // US notice (opt-out region): the same choices in about half the height, so it doesn't sit on the page's own buttons.
    ".vc-bar.vc-compact{padding:12px 14px;border-radius:14px}" +
    ".vc-compact h2{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}" +
    ".vc-bar.vc-compact p{font-size:13px;line-height:1.4;margin:0 0 10px}" +
    ".vc-compact .vc-row{flex-wrap:nowrap;gap:6px}.vc-compact .vc-row button{flex:1 1 0;min-width:0;padding:0 8px;font-size:14px}" +
    "@media (min-width:900px){.vc-bar.vc-compact{display:flex;align-items:center;gap:16px;max-width:980px}.vc-bar.vc-compact p{margin:0;flex:1}" +
    ".vc-compact .vc-row{flex:none}.vc-compact .vc-row button{flex:none;padding:0 16px}}" +
    // While the bar shows, pages can keep their own bottom buttons above it (--vc-h = its height + gap) and scroll past it.
    "html.vc-on body{padding-bottom:var(--vc-h,0px)}";
  var root = null, bar = null, scrim = null, lastFocus = null;
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in attrs || {}) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function ensureRoot() {
    if (root) return root;
    var st = el("style", { id: "vcStyle" }); st.textContent = CSS; (document.head || document.documentElement).appendChild(st);
    root = el("div", { "class": "vc-root", id: "vpexConsent" }); document.body.appendChild(root);
    return root;
  }
  function intro() {
    return REGION === "optin"
      ? "We’d like to load Google’s fonts and count visits anonymously. Nothing optional runs until you choose. Your choice applies to vpexdialer.com on this device."
      : "VPEX loads Google’s fonts and counts visits anonymously. No ads, no selling, no cross-site tracking." + (GPC ? " Your browser’s Global Privacy Control is on, so statistics and attribution are already off." : "");
  }
  function showBanner() {
    if (!document.body) { document.addEventListener("DOMContentLoaded", showBanner); return; }
    if (bar || current() || AUTOMATED) return;
    ensureRoot();
    bar = el("section", { "class": "vc-bar" + (REGION === "optout" ? " vc-compact" : ""), role: "region", "aria-label": "Cookie choices", id: "vcBar" },
      '<h2 id="vcBarH">Your privacy choices</h2><p>' + intro() + ' <a href="/cookies/">Cookie Policy</a> · <a href="/privacy/">Privacy Policy</a></p>' +
      '<div class="vc-row"><button type="button" class="vc-main" data-vc="accept">Accept all</button><button type="button" class="vc-main" data-vc="reject">Reject all</button><button type="button" data-vc="choose">Choose</button></div>');
    root.appendChild(bar);
    space();
    if (window.ResizeObserver) { ro = new ResizeObserver(space); ro.observe(bar); } else window.addEventListener("resize", space);
  }
  var ro = null;
  function space() {   // --vc-h on <html>: the bar's height plus its gap to the bottom edge (0 when no bar)
    var de = document.documentElement, h = 0;
    if (bar && bar.parentNode) { var r = bar.getBoundingClientRect(); h = Math.max(0, Math.ceil(window.innerHeight - r.top)); }
    if (h) { de.style.setProperty("--vc-h", h + "px"); de.classList.add("vc-on"); }
    else { de.style.removeProperty("--vc-h"); de.classList.remove("vc-on"); }
  }
  function hideBanner() {
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    bar = null;
    if (ro) { ro.disconnect(); ro = null; }
    space();
  }
  function open() {
    if (!document.body) { document.addEventListener("DOMContentLoaded", open); return; }
    ensureRoot();
    if (scrim) return;
    lastFocus = document.activeElement;
    var c = choices();
    var rows = CATS.map(function (k) {
      return '<div class="vc-cat"><div><b id="vcL_' + k + '">' + LABELS[k][0] + '</b><span id="vcD_' + k + '">' + LABELS[k][1] + '</span></div>' +
        '<label class="vc-sw"><input type="checkbox" role="switch" data-vc-cat="' + k + '" aria-labelledby="vcL_' + k + '" aria-describedby="vcD_' + k + '"' + (c[k] ? " checked" : "") + '><i aria-hidden="true"></i></label></div>';
    }).join("");
    scrim = el("div", { "class": "vc-scrim", id: "vcScrim" },
      '<div class="vc-panel" role="dialog" aria-modal="true" aria-labelledby="vcH" id="vcPanel"><h2 id="vcH">Cookie settings</h2>' +
      '<p>Choose what vpexdialer.com may use on this device. You can change this any time from “Cookie settings” at the bottom of every page. <a href="/cookies/">Cookie Policy</a></p>' +
      '<div class="vc-cat"><div><b>Essential</b><span>Signing in and staying signed in, security, the demo you open, your settings, offline use of the app, and remembering this choice. VPEX can’t work without them.</span></div><em>Always on</em></div>' +
      rows +
      '<div class="vc-row" style="margin-top:12px"><button type="button" class="vc-main" data-vc="save">Save my choices</button><button type="button" data-vc="accept">Accept all</button><button type="button" data-vc="reject">Reject all</button></div>' +
      '<p class="vc-note">Turning fonts off takes effect on the next page you open. VPEX doesn’t use advertising cookies, doesn’t sell or share personal information for ads, and doesn’t track you on other sites.</p></div>');
    root.appendChild(scrim);
    var first = scrim.querySelector("input,button"); if (first) first.focus();
    document.addEventListener("keydown", keys, true);
  }
  function close() {
    if (!scrim) return;
    document.removeEventListener("keydown", keys, true);
    scrim.parentNode.removeChild(scrim); scrim = null;
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
  }
  function keys(e) {   // Escape closes; Tab stays inside the panel
    if (!scrim) return;
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    var f = scrim.querySelectorAll("button,input,a[href]"); if (!f.length) return;
    var a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }
  function all(v) { var c = {}; CATS.forEach(function (k) { c[k] = v; }); return c; }
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-vc],[data-cookie-settings]") : null;
    if (!t) { if (scrim && e.target === scrim) close(); return; }
    if (t.hasAttribute("data-cookie-settings")) { e.preventDefault(); open(); return; }
    var a = t.getAttribute("data-vc");
    if (a === "accept") { save(all(true), "accept_all"); close(); }
    else if (a === "reject") { save(all(false), "reject_all"); close(); }
    else if (a === "choose") open();
    else if (a === "save") {
      var c = {}; CATS.forEach(function (k) { var i = scrim.querySelector('[data-vc-cat="' + k + '"]'); c[k] = !!(i && i.checked); });
      save(c, "save"); close();
    }
  });

  window.VPEXConsent = {
    version: VERSION, region: REGION, gpc: GPC, categories: CATS.slice(),
    allowed: function (cat) { return choices()[cat] === true; },
    decided: function () { return !!current(); },
    get: function () { var r = current(); return r ? JSON.parse(JSON.stringify(r)) : null; },
    choices: choices,
    set: function (c) { return save(c || {}, "save"); },
    acceptAll: function () { return save(all(true), "accept_all"); },
    rejectAll: function () { return save(all(false), "reject_all"); },
    open: open, close: close, activateFonts: activateFonts,
    onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); }
  };

  // First run on this page: GPC in the US is recorded once as the visitor's choice; fonts load if allowed; the banner shows
  // until a choice is made under this policy version.
  if (REGION === "optout" && GPC && !current()) {
    var d = defaults();
    var r = { v: VERSION, t: Date.now(), id: newId(), c: d, m: "gpc", r: REGION };
    ls(KEY, JSON.stringify(r)); clearOptional(d); proof(r);
  }
  activateFonts();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { activateFonts(); showBanner(); });
  else showBanner();
})();
