# Week-3 Reels ("Every floor leaks"): pattern-interrupt edits. One big word at a time, hard cuts, then real VPEX footage
# (screen recordings from a demo office, fictional leads and 555 numbers) in a large phone that pans to the action.
# 1080x1920, 30 fps, H.264, silent track. usage: reel3.py NAME [NAME...]  |  reel3.py preview:NAME
import sys, os, json, subprocess, shutil, asyncio
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__))
FPS = 30

# Segments: words [[text, sec, color]], clock, spam, taps, strike, clip/still (caps + cam keys), end.
# Colors: w white, g gold, r problem red, m muted.  cam: [[u, cssY, zoom, cssX?]] = "be here by u" (0.45 s moves)
END = {"type": "end", "dur": 2.8}
FIX = {"type": "words", "words": [["HERE’S", .38], ["THE FIX.", .62, "g"]]}
REELS = {
  "G-Callback": [
    {"type": "words", "words": [["HE SAID", .55], ["“CALL ME", .45], ["BACK AT 2.”", .75, "g"]]},
    {"type": "clock", "times": [["2:00", "PM", .6, "g"], ["2:47", "PM", .16, "m"], ["3:31", "PM", .16, "m"], ["4:12", "PM", .16, "m"], ["4:45", "PM", .95, "r"]]},
    {"type": "words", "words": [["NOBODY", .45, "r"], ["CALLED.", .65, "r"], ["HE BOUGHT", .5], ["FROM THE", .38], ["NEXT GUY", .45], ["WHO DID.", .75, "g"]]},
    {"type": "words", "words": [["NOT A", .38], ["LEAD", .38], ["PROBLEM.", .55], ["A FOLLOW-UP", .62, "g"], ["PROBLEM.", .62, "g"]]},
    FIX,
    {"type": "clip", "clip": "call_interested", "in": 0.7, "dur": 5.4,
     "caps": [["One tap to call", 1.25], ["One tap: interested", 1.55], ["Follow-up set. Automatically.", 2.6, "g"]],
     "cam": [[0, 500, 1.0], [1.4, 450, 1.0], [2.9, 240, 1.0]]},
    {"type": "clip", "clip": "followups_run", "in": 0.85, "dur": 2.5,
     "caps": [["Due today? First in line.", 1.1], ["With what to say next.", 1.4, "g"]], "cam": [[0, 290, 1.05], [1.05, 420, 1.08]]},
    END],
  "H-SpamLikely": [
    {"type": "words", "words": [["YOUR REP", .5], ["DIALS.", .6]]},
    {"type": "spam", "dur": 2.7, "cap": "Their screen:"},
    {"type": "words", "words": [["DECLINED.", .6, "r"], ["SO IS", .38], ["THE NEXT ONE.", .7, "r"], ["AND THE NEXT.", .7, "r"]]},
    {"type": "words", "words": [["IT’S NOT", .42], ["YOUR LIST.", .6], ["IT’S HOW", .42], ["YOU DIAL.", .75, "g"]]},
    {"type": "words", "words": [["TOO FAST.", .55, "r"], ["TOO SHORT.", .55, "r"], ["TOO SOON.", .65, "r"]]},
    FIX,
    {"type": "clip", "clip": "fast_flow", "in": 8.25, "dur": 2.7,
     "caps": [["Rapid-fire?", 0.9], ["VPEX spaces it out.", 1.8, "g"]], "cam": [[0, 300, 0.9]]},
    {"type": "still", "img": "redial_guard", "dur": 2.7, "caps": [["Redial too soon?", 1.0], ["It asks first.", 1.7, "g"]],
     "cam": [[0, 470, 0.9], [0.9, 640, 1.12]]},
    END],
  "I-FivePM": [
    {"type": "words", "words": [["IT’S", .38]]},
    {"type": "clock", "times": [["5:00", "PM", 1.0, "g"]]},
    {"type": "words", "words": [["DO YOU", .38], ["KNOW", .38], ["WHAT YOUR", .45], ["FLOOR DID", .5], ["TODAY?", .75, "g"]]},
    {"type": "words", "words": [["HOW MANY", .4], ["CALLS?", .5, "g"], ["WHO’S", .35], ["BEHIND?", .5, "g"], ["WHICH LEADS", .5], ["WENT COLD?", .65, "g"]]},
    {"type": "words", "words": [["IF THE", .35], ["ANSWER IS", .45], ["“I’LL ASK", .5], ["AROUND”", .62, "r"], ["YOU’RE", .35], ["MANAGING", .5], ["BLIND.", .8, "r"]]},
    FIX,
    {"type": "clip", "clip": "scoreboard", "in": 2.95, "speed": 0.85, "dur": 2.6,
     "caps": [["Every rep.", 0.8], ["Every call.", 0.8], ["Live.", 1.0, "g"]], "cam": [[0, 420, 0.92]]},
    {"type": "clip", "clip": "team_on_lead", "in": 3.1, "dur": 2.4,
     "caps": [["Who’s on", 0.9], ["which lead.", 1.5, "g"]], "cam": [[0, 420, 1.0], [1.0, 430, 1.45, 140]]},
    END],
  "J-Taps": [
    {"type": "words", "words": [["11 TAPS", .75, "g"], ["TO MAKE", .4], ["ONE CALL.", .7]]},
    {"type": "taps", "per": .3, "hold": .35, "steps": ["Unlock the phone", "Open the sheet", "Find the next row", "Copy the number", "Open Phone", "Paste it", "Call", "Hang up", "Back to the sheet", "Type what happened", "Set a reminder"]},
    {"type": "words", "words": [["× 150 CALLS", .7], ["A DAY", .45], ["=", .28], ["1,650 TAPS.", .95, "r"]]},
    {"type": "words", "words": [["TAPPING", .45], ["ISN’T", .4], ["SELLING.", .75, "g"]]},
    FIX,
    {"type": "clip", "clip": "fast_flow", "in": 0.5, "dur": 4.2,
     "caps": [["One tap to call.", 1.3], ["One tap to log.", 1.1], ["Next try, booked.", 0.9, "g"], ["Next lead, ready.", 0.9, "g"]],
     "cam": [[0, 500, 1.0], [1.2, 450, 1.0], [2.4, 240, 1.0], [3.5, 500, 1.0]]},
    END],
  "K-EveryLeak": [
    {"type": "words", "words": [["EVERY", .38], ["FLOOR", .42], ["LEAKS.", .75, "r"]]},
    {"type": "strike", "per": .38, "items": ["Callbacks nobody made", "Two reps, one lead", "Spam Likely", "Calls at 7 AM", "The rep who quit", "5 PM guesswork"]},
    {"type": "words", "words": [["EVERY ONE", .5], ["HAS A FIX.", .85, "g"]]},
    {"type": "clip", "clip": "call_interested", "in": 2.6, "dur": 2.1, "caps": [["Follow-ups set themselves.", 2.1]], "cam": [[0, 450, 1.0], [0.9, 240, 1.0]]},
    {"type": "clip", "clip": "team_on_lead", "in": 3.1, "dur": 1.9, "caps": [["See who’s on each lead.", 1.9]], "cam": [[0, 420, 1.2]]},
    {"type": "clip", "clip": "fast_flow", "in": 8.5, "dur": 1.9, "caps": [["Pacing that protects your number.", 1.9]], "cam": [[0, 300, 0.9]]},
    {"type": "clip", "clip": "qualify", "in": 1.1, "speed": 1.15, "dur": 2.2, "caps": [["Qualify while you talk.", 2.2]], "cam": [[0, 320, 1.1]]},
    {"type": "clip", "clip": "pipeline", "in": 1.6, "dur": 2.0, "caps": [["Your pipeline, live.", 2.0]], "cam": [[0, 320, 1.15]]},
    {"type": "clip", "clip": "scoreboard", "in": 3.2, "dur": 1.7, "caps": [["The whole floor, on your phone.", 1.7, "g"]], "cam": [[0, 420, 0.95]]},
    END],
}

PAGE = r'''<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Arch; src: url(../../deck/fonts/archivo.ttf); font-weight: 100 900; font-stretch: 62% 125%; }
@font-face { font-family: BigS; src: url(../../deck/fonts/bigshoulders.ttf); font-weight: 100 900; }
@font-face { font-family: Unb; src: url(../../deck/fonts/unbounded.ttf); font-weight: 200 900; }
html, body { margin: 0; -webkit-font-smoothing: antialiased; }
#root { position: relative; width: 1080px; height: 1920px; overflow: hidden; background: #070A1E; font-family: Arch, sans-serif; }
.layer { position: absolute; inset: 0; display: none; }
#word { position: absolute; left: 540px; top: 960px; width: max-content; text-align: center; white-space: nowrap; font-family: Unb; font-weight: 800; line-height: 1; letter-spacing: -0.01em; transform-origin: 50% 50%; }
/* captions sit above the footage, clear of Instagram's top bar */
#cap { position: absolute; left: 70px; right: 70px; top: 190px; height: 230px; display: flex; align-items: center; justify-content: center; }
#cap div { font-family: Arch; font-weight: 800; font-stretch: 112%; line-height: 1.02; text-align: center; text-wrap: balance; letter-spacing: -0.025em; transform-origin: 50% 50%; }
#stage { position: absolute; inset: 0; clip-path: inset(440px 0 0 0); }
#phone { position: absolute; left: 0; top: 0; width: 860px; box-sizing: border-box; padding: 22px; border-radius: 112px; background: #2A3272; transform-origin: 0 0; box-shadow: 0 0 0 3px rgba(199,203,228,.10); }
#screen { position: relative; width: 816px; height: 1766px; overflow: hidden; border-radius: 92px; background: #fff; }
#screen img { position: absolute; inset: 0; width: 100%; height: 100%; }
#fade { position: absolute; left: 0; right: 0; top: 440px; height: 56px; background: linear-gradient(#070A1E, rgba(7,10,30,0)); }
#clock { position: absolute; left: 0; right: 0; top: 960px; transform-origin: 50% 50%; text-align: center; font-family: BigS; font-weight: 800; font-size: 400px; line-height: 0.85; letter-spacing: -0.01em; }
#clock span { font-size: 150px; margin-left: 18px; }
/* a generic incoming-call screen (not any phone maker's design) */
#cap2 { position: absolute; left: 70px; right: 70px; top: 330px; text-align: center; font-family: Arch; font-weight: 800; font-stretch: 112%; font-size: 92px; color: #FFFFFF; letter-spacing: -0.025em; }
#spam { position: absolute; left: 190px; width: 700px; top: 560px; height: 1120px; border-radius: 80px; background: linear-gradient(180deg, #23283F, #11142A); box-shadow: 0 0 0 3px rgba(255,255,255,.06), 0 60px 120px -40px rgba(0,0,0,.85); overflow: hidden; }
#spam .num { position: absolute; left: 0; right: 0; top: 150px; text-align: center; color: #C7CBE4; font-weight: 600; font-size: 46px; }
#spam .lab { position: absolute; left: 0; right: 0; top: 230px; text-align: center; color: #FF6B5E; font-weight: 800; font-stretch: 110%; font-size: 96px; letter-spacing: -0.01em; }
#spam .warn { position: absolute; left: 50%; top: 400px; width: 120px; height: 120px; margin-left: -60px; }
#spam .sub { position: absolute; left: 0; right: 0; top: 540px; text-align: center; color: #8A93B8; font-weight: 500; font-size: 36px; }
#spam .btn { position: absolute; bottom: 160px; width: 170px; height: 170px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
#spam .dec { left: 110px; background: #E5484D; } #spam .acc { right: 110px; background: #2EB872; }
#spam .bl { position: absolute; bottom: 90px; width: 170px; text-align: center; color: #C7CBE4; font-size: 32px; font-weight: 600; }
#taps { position: absolute; left: 100px; right: 90px; top: 500px; }
#taps .n { font-family: BigS; font-weight: 800; font-size: 440px; line-height: 0.8; color: #E8B94A; transform-origin: left center; }
#taps .s { font-family: Arch; font-weight: 800; font-stretch: 112%; font-size: 96px; line-height: 1.02; color: #FFFFFF; margin-top: 46px; letter-spacing: -0.025em; }
#taps .of { font-family: Arch; font-weight: 600; font-size: 44px; color: #8A93B8; margin-top: 30px; }
#strike { position: absolute; left: 90px; right: 90px; top: 520px; }
#strike .it { white-space: nowrap; font-family: Arch; font-weight: 800; font-stretch: 110%; font-size: 76px; line-height: 1.0; color: #FFFFFF; padding: 27px 0; letter-spacing: -0.025em; border-top: 2px solid rgba(199,203,228,.16); }
#strike .tx { position: relative; display: inline-block; }
#strike .ln { position: absolute; left: -8px; top: 52%; height: 10px; border-radius: 5px; background: #FF6B5E; width: 0; }
#Lend { background: #0E1433; }
#Lend .wm { position: absolute; left: 0; right: 0; top: 330px; text-align: center; font-family: Unb; font-weight: 800; font-size: 104px; color: #E8B94A; letter-spacing: -0.01em; }
#Lend .big { position: absolute; left: 540px; width: max-content; text-align: center; white-space: nowrap; font-family: Unb; font-weight: 800; line-height: 1; letter-spacing: -0.01em; }
#Lend .l2 { position: absolute; left: 80px; right: 80px; top: 1110px; text-align: center; font-family: Arch; font-weight: 600; font-size: 54px; line-height: 1.3; color: #C7CBE4; }
#Lend .l3 { position: absolute; left: 80px; right: 80px; top: 1200px; text-align: center; font-family: Arch; font-weight: 700; font-size: 48px; color: #E8B94A; }
</style></head><body><div id="root">
<div class="layer" id="Lword"><div id="word"></div></div>
<div class="layer" id="Lclock"><div id="clock"></div></div>
<div class="layer" id="Lmedia"><div id="stage"><div id="phone"><div id="screen"><img id="shot"></div></div></div><div id="fade"></div><div id="cap"><div></div></div></div>
<div class="layer" id="Lspam"><div id="cap2"></div><div id="spam">
  <div class="num">(212) 555-0148</div><div class="lab">Spam Likely</div>
  <svg class="warn" viewBox="0 0 24 24" fill="none" stroke="#FF6B5E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5"/><path d="M12 17.6h.01"/></svg>
  <div class="sub">mobile</div>
  <div class="btn dec" id="dec"><svg width="80" height="80" viewBox="0 0 24 24" fill="#fff"><path d="M3.6 14.6c4.6-4.1 12.2-4.1 16.8 0l-1.9 2.4c-.4.5-1.1.6-1.6.3l-2.2-1.3c-.4-.2-.6-.7-.5-1.1l.3-1.5c-1.6-.5-3.4-.5-5 0l.3 1.5c.1.4-.1.9-.5 1.1l-2.2 1.3c-.5.3-1.2.2-1.6-.3z"/></svg></div>
  <div class="btn acc"><svg width="76" height="76" viewBox="0 0 24 24" fill="#fff"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1z"/></svg></div>
  <div class="bl" style="left: 110px">Decline</div><div class="bl" style="right: 110px">Accept</div></div></div>
<div class="layer" id="Ltaps"><div id="taps"><div class="n"></div><div class="s"></div><div class="of">taps to make one call</div></div></div>
<div class="layer" id="Lstrike"><div id="strike"></div></div>
<div class="layer" id="Lend"><div class="wm">VPEX</div><div class="big" id="eb1" style="top: 640px; color: #FFFFFF">COMMENT</div><div class="big" id="eb2" style="top: 840px; color: #E8B94A">DEMO</div>
  <div class="l2">We&rsquo;ll send you a live demo office.</div><div class="l3">7 days free. Link in bio.</div></div>
</div><script>
const T = __TL__;
const COL = { w: "#FFFFFF", g: "#E8B94A", r: "#FF6B5E", m: "#8A93B8" };
const $ = id => document.getElementById(id);
const layers = ["Lword", "Lclock", "Lmedia", "Lspam", "Ltaps", "Lstrike", "Lend"];
const show = id => layers.forEach(l => $(l).style.display = l === id ? "block" : "none");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3), inout = x => { x = clamp(x, 0, 1); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const lerp = (a, b, k) => a + (b - a) * k;
const sizes = {};
// biggest size that fits the width (single line for word beats; up to two lines for captions)
function fitOne(el, text, max, width) {
  const k = el.id + "|" + text; if (sizes[k]) return sizes[k];
  let s = max; el.textContent = text; el.style.fontSize = s + "px";
  while (s > 40 && el.scrollWidth > width) { s -= 4; el.style.fontSize = s + "px"; }
  return sizes[k] = s;
}
function fitCap(el, text, max) {
  const k = "cap|" + text; if (sizes[k]) return sizes[k];
  let s = max; el.textContent = text; el.style.fontSize = s + "px";
  while (s > 40 && (el.getBoundingClientRect().height > s * 2.15 || el.scrollWidth > 940)) { s -= 3; el.style.fontSize = s + "px"; }
  return sizes[k] = s;
}
const pop = (t, amt) => 1 + amt * (1 - ease(t / 0.14));
async function setImg(src) { const im = $("shot"); if (im.dataset.src !== src) { im.src = src; im.dataset.src = src; await im.decode().catch(() => {}); } }
// camera: each key says "be here by u"; moves take 0.45 s
function camAt(keys, u) {
  let y = keys[0][1], z = keys[0][2], x = keys[0][3] || 195;
  for (let i = 1; i < keys.length; i++) { const k = keys[i], e = inout((u - (k[0] - 0.45)) / 0.45); y = lerp(y, k[1], e); z = lerp(z, k[2], e); x = lerp(x, k[3] || 195, e); }
  return { x, y, z };
}
window.render = async function (t) {
  const idx = T.segs.findIndex(s => t >= s.t0 && t < s.t1), seg = T.segs[idx < 0 ? T.segs.length - 1 : idx], u = t - seg.t0;
  if (seg.type === "words") {
    show("Lword");
    const w = seg.words.find(w => u >= w.a && u < w.b) || seg.words[seg.words.length - 1], el = $("word");
    el.style.fontSize = fitOne(el, w.text, 236, 950) + "px"; el.textContent = w.text; el.style.color = COL[w.c];
    el.style.transform = "translate(-50%, -50%) scale(" + pop(u - w.a, 0.08) + ")";
  } else if (seg.type === "clock") {
    show("Lclock");
    const k = seg.times.find(x => u >= x.a && u < x.b) || seg.times[seg.times.length - 1], el = $("clock");
    el.innerHTML = k.text + "<span>" + k.ap + "</span>"; el.style.color = COL[k.c];
    el.style.transform = "translateY(-50%) scale(" + pop(u - k.a, 0.05) + ")";
  } else if (seg.type === "clip" || seg.type === "still") {
    show("Lmedia");
    if (seg.type === "clip") { const fi = Math.min(seg.frames - 1, Math.floor((seg.in + u * seg.speed) * T.fps)); await setImg("../clips/" + seg.clip + "/f" + String(fi).padStart(4, "0") + ".jpg"); }
    else await setImg(seg.src);
    const c = seg.caps.find(c => u >= c.a && u < c.b) || seg.caps[seg.caps.length - 1], ce = $("cap").firstElementChild;
    ce.style.fontSize = fitCap(ce, c.text, 104) + "px"; ce.textContent = c.text; ce.style.color = COL[c.c];
    ce.style.transform = "scale(" + pop(u - c.a, 0.06) + ")";
    const prev = T.segs[idx - 1], first = !prev || (prev.type !== "clip" && prev.type !== "still");
    const rise = first ? ease(u / 0.45) : 1, cam = camAt(seg.cam, u), S = 816 / 390;
    const px = 22 + cam.x * S, py = 22 + cam.y * S;
    const tx = 540 - px * cam.z, ty = 1020 - py * cam.z + (1 - rise) * 1500;
    $("phone").style.transform = "translate(" + tx + "px," + ty + "px) scale(" + cam.z + ")";
  } else if (seg.type === "spam") {
    show("Lspam");
    const card = $("spam"), rise = ease(u / 0.35), drop = inout((u - (seg.dur - 0.55)) / 0.5);
    card.style.transform = "translateY(" + ((1 - rise) * 1200 + drop * 1500) + "px) rotate(" + (drop * 7) + "deg)";
    $("dec").style.transform = "scale(" + (u > 1.55 && u < 1.9 ? 0.86 : 1) + ")";
    $("dec").style.boxShadow = u > 1.55 && u < 2.3 ? "0 0 0 " + Math.round(ease((u - 1.55) / 0.5) * 60) + "px rgba(229,72,77," + (0.5 * (1 - ease((u - 1.55) / 0.6))) + ")" : "none";
    const cap = $("cap2"); cap.textContent = seg.cap; cap.style.opacity = ease((u - 0.2) / 0.2) * (1 - drop);
  } else if (seg.type === "taps") {
    show("Ltaps");
    const i = Math.min(seg.steps.length - 1, Math.floor(u / seg.per)), el = $("taps");
    el.querySelector(".n").textContent = i + 1; el.querySelector(".s").textContent = seg.steps[i];
    el.querySelector(".n").style.transform = "scale(" + pop(u - i * seg.per, 0.07) + ")";
  } else if (seg.type === "strike") {
    show("Lstrike");
    const box = $("strike");
    if (!box.dataset.built) { box.innerHTML = seg.items.map(x => '<div class="it"><span class="tx">' + x + '<i class="ln"></i></span></div>').join(""); box.dataset.built = 1; }
    const its = [...box.children], n = its.length, strikeAt = n * seg.per + 0.15;
    its.forEach((it, i) => {
      const a = ease((u - i * seg.per) / 0.16); it.style.opacity = a; it.style.transform = "translateX(" + (1 - a) * 40 + "px)";
      const s = ease((u - strikeAt - i * 0.11) / 0.16);
      it.querySelector(".ln").style.width = "calc(" + (s * 100) + "% + " + (s * 16) + "px)"; it.style.color = s > 0.5 ? "#7C84A8" : "#FFFFFF";
    });
  } else if (seg.type === "end") {
    show("Lend");
    const r = $("Lend"), set = (el, a, dy) => { el.style.opacity = a; el.style.transform = "translateY(" + (1 - a) * dy + "px)"; };
    const b1 = $("eb1"), b2 = $("eb2");
    b1.style.fontSize = fitOne(b1, "COMMENT", 230, 950) + "px"; b2.style.fontSize = b1.style.fontSize;
    set(r.querySelector(".wm"), ease(u / 0.3), 30);
    b1.style.opacity = u > 0.05 ? 1 : 0; b1.style.transform = "translateX(-50%) scale(" + pop(u - 0.05, 0.08) + ")";
    b2.style.opacity = u > 0.4 ? 1 : 0; b2.style.transform = "translateX(-50%) scale(" + pop(u - 0.4, 0.1) + ")";
    set(r.querySelector(".l2"), ease((u - 0.75) / 0.3), 24); set(r.querySelector(".l3"), ease((u - 0.95) / 0.3), 24);
  }
};
</script></body></html>'''

def timeline(name):
    segs, t = [], 0.0
    for s in REELS[name]:
        s = json.loads(json.dumps(s))
        def seq(items, keys):
            a, out = 0.0, []
            for it in items:
                d = dict(zip(keys, it)); d.setdefault("c", "w"); d["a"] = a; d["b"] = a + d["sec"]; a += d["sec"]; out.append(d)
            return out, a
        if s["type"] == "words": s["words"], s["dur"] = seq(s["words"], ["text", "sec", "c"])
        elif s["type"] == "clock": s["times"], s["dur"] = seq(s["times"], ["text", "ap", "sec", "c"])
        elif s["type"] in ("clip", "still"):
            s["caps"], _ = seq(s["caps"], ["text", "sec", "c"]); s.setdefault("speed", 1.0)
            if s["type"] == "clip": s["frames"] = json.load(open(D + "/clips/%s/meta.json" % s["clip"]))["frames"]
            else: s["src"] = "../../ig/shots2/%s.png" % s["img"]
        elif s["type"] == "taps": s["dur"] = len(s["steps"]) * s["per"] + s["hold"]
        elif s["type"] == "strike": s["dur"] = len(s["items"]) * s["per"] + 0.15 + len(s["items"]) * 0.11 + 0.6
        s["t0"] = t; s["t1"] = t + s["dur"]; t += s["dur"]; segs.append(s)
    return {"segs": segs, "fps": FPS, "dur": t}

async def build(name, only=None):
    tl = timeline(name)
    os.makedirs(D + "/html", exist_ok=True)
    path = D + "/html/%s.html" % name
    open(path, "w").write(PAGE.replace("__TL__", json.dumps(tl)))
    fr = D + "/frames/" + name
    shutil.rmtree(fr, ignore_errors=True); os.makedirs(fr, exist_ok=True)
    n = int(round(tl["dur"] * FPS))
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
        await pg.goto("file://" + path); await pg.wait_for_timeout(300)
        await pg.evaluate("() => Promise.all(['800 100px Unb', '800 100px BigS', '800 100px Arch', '600 100px Arch', '700 100px Arch'].map(f => document.fonts.load(f)))")
        await pg.evaluate("() => document.fonts.ready"); await pg.wait_for_timeout(200)
        for i in (range(n) if only is None else only):
            await pg.evaluate("(t) => window.render(t)", i / FPS)
            await pg.screenshot(path=fr + "/f%04d.jpg" % i, type="jpeg", quality=93)
        await br.close()
    if only is not None: return fr, tl["dur"]
    os.makedirs(D + "/out/video", exist_ok=True)
    out = D + "/out/video/Reel-%s.mp4" % name
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", fr + "/f%04d.jpg",
                    "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
                    "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", "-r", str(FPS), out], check=True)
    return out, tl["dur"]

def preview_times(tl):
    ts = []
    for s in tl["segs"]:
        if s["type"] == "words": ts += [s["t0"] + (w["a"] + w["b"]) / 2 for w in s["words"]]
        elif s["type"] == "clock": ts += [s["t0"] + (x["a"] + x["b"]) / 2 for x in s["times"]]
        elif s["type"] in ("clip", "still"): ts += [s["t0"] + 0.2] + [s["t0"] + (c["a"] + c["b"]) / 2 for c in s["caps"]]
        else: ts += [s["t0"] + s["dur"] * k for k in (0.25, 0.6, 0.9)]
    return sorted(set(int(t * FPS) for t in ts))

if __name__ == "__main__":
    for nm in sys.argv[1:] or list(REELS):
        if nm.startswith("preview:"):
            nm = nm.split(":", 1)[1]
            fr, dur = asyncio.run(build(nm, preview_times(timeline(nm))))
            print("preview", nm, "%.1fs" % dur, fr)
        else:
            out, dur = asyncio.run(build(nm)); print("built", out, "%.1fs" % dur)
