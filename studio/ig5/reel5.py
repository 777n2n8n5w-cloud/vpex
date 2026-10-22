# Week-5 Reels ("Run the floor from your phone"), built on the week-3/4 engine: pattern-interrupt edits. One big word at a time, hard cuts, then real VPEX footage
# (screen recordings from a demo office, fictional leads and 555 numbers) in a large phone that pans to the action.
# 1080x1920, 30 fps, H.264, silent track. usage: reel5.py NAME [NAME...]  |  reel5.py preview:NAME
import sys, os, json, subprocess, shutil, asyncio
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__))
FPS = 30

# Segments: words [[text, sec, color]], clock, spam, taps, strike, clip/still (caps + cam keys), end.
# Colors: w white, g gold, r problem red, m muted.  cam: [[u, cssY, zoom, cssX?]] = "be here by u" (0.45 s moves)
END = {"type": "end", "dur": 2.8}
def end(b1="COMMENT", b2="DEMO", l2="We&rsquo;ll send you a live demo office.", l3="7 days free. Link in bio."):
    return {"type": "end", "dur": 2.8, "b1": b1, "b2": b2, "l2": l2, "l3": l3}
FIX = {"type": "words", "words": [["HERE’S", .38], ["THE FIX.", .62, "g"]]}
REELS = {
  "W-WhoNeedsHelp": [
    {"type": "words", "words": [["ONE REP", .45], ["IS STRUGGLING.", .65, "r"], ["WHICH", .35], ["ONE?", .65, "g"]]},
    {"type": "words", "words": [["YOU’LL FIND OUT", .5], ["FRIDAY.", .7, "r"]]},
    FIX,
    {"type": "still", "img": "coach", "dur": 2.9, "caps": [["Sales coach: the last 14 days of calls.", 1.5], ["Who’s behind, and why.", 1.4, "g"]], "cam": [[0, 420, 1.0], [1.3, 470, 1.25]]},
    {"type": "still", "img": "coach_sam", "dur": 3.0, "caps": [["Interested lead, no next step?", 1.4], ["Flagged, by rep.", 1.6, "g"]], "cam": [[0, 470, 1.0], [1.0, 505, 1.5]]},
    end()],
  "X-JustMailMe": [
    {"type": "words", "words": [["“JUST MAIL", .5], ["ME", .3], ["SOMETHING.”", .75, "r"]]},
    {"type": "words", "words": [["YOUR NEW REP:", .5], ["“UH…", .4], ["SURE.”", .65, "r"]]},
    {"type": "words", "words": [["CALL", .3], ["OVER.", .6, "m"]]},
    FIX,
    {"type": "still", "img": "rebut_list", "dur": 2.4, "caps": [["Rebuttals, on the Dial screen.", 2.4]], "cam": [[0, 560, 1.0]]},
    {"type": "still", "img": "rebut_mail", "dur": 3.4, "caps": [["Tap the objection.", 1.2], ["The answer is right there.", 2.2, "g"]], "cam": [[0, 560, 1.0], [1.0, 590, 1.45]]},
    end()],
  "Y-WrongHour": [
    {"type": "words", "words": [["CALLING", .4], ["AT THE", .32], ["WRONG HOUR?", .75, "r"]]},
    {"type": "words", "words": [["MOST FLOORS", .45], ["NEVER CHECK.", .7, "r"]]},
    FIX,
    {"type": "still", "img": "answers", "dur": 3.2, "caps": [["Answer rate by the lead’s own hour.", 1.6], ["From your team’s own calls.", 1.6, "g"]], "cam": [[0, 620, 1.0], [1.5, 685, 1.35]]},
    {"type": "still", "img": "prime_hour", "dur": 2.9, "caps": [["Each lead’s best hour, starred.", 1.4], ["Smart order uses it.", 1.5, "g"]], "cam": [[0, 470, 1.0], [0.9, 509, 2.0, 170]]},
    end(b1="SEND", b2="THIS", l2="to your manager. Your floor&rsquo;s best hours, counted.", l3="7 days free. Link in bio.")],
  "Z-Friday5PM": [
    {"type": "clock", "times": [["5:00", "PM", 0.9, "g"]]},
    {"type": "words", "words": [["FRIDAY.", .45], ["HOW’D", .35], ["WE DO?", .7, "g"]]},
    {"type": "words", "words": [["NO SPREADSHEET.", .55], ["NO GUESSING.", .65, "r"]]},
    {"type": "words", "words": [["ONE", .3], ["TAP.", .6, "g"]]},
    {"type": "still", "img": "report", "dur": 2.9, "caps": [["This week vs. last week.", 1.3], ["Calls, conversations, interested.", 1.6, "g"]], "cam": [[0, 420, 1.0], [1.1, 300, 1.35]]},
    {"type": "still", "img": "report_reps", "dur": 2.9, "caps": [["By rep.", 1.0], ["Share it, or save it as a PDF.", 1.9, "g"]], "cam": [[0, 360, 1.25], [1.5, 420, 1.0]]},
    end(b1="SEND", b2="THIS", l2="to your manager. Friday&rsquo;s report, in one tap.", l3="7 days free. Link in bio.")],
  "AA-ListPaid": [
    {"type": "words", "words": [["YOU PAID", .45], ["FOR THE LIST.", .6], ["DID IT", .35], ["PAY?", .7, "r"]]},
    {"type": "words", "words": [["DIALS", .35], ["AREN’T", .35], ["DEALS.", .7, "r"]]},
    FIX,
    {"type": "still", "img": "roi", "dur": 3.6, "caps": [["Every list, side by side.", 1.4], ["Interested per 100 dials. Dollars per lead.", 2.2, "g"]], "cam": [[0, 600, 1.0], [1.2, 660, 1.6]]},
    end()],
  "AB-YesThenNothing": [
    {"type": "words", "words": [["SHE SAID", .4], ["YES.", .55, "g"], ["THEN", .3], ["NOBODY", .4], ["CALLED.", .7, "r"]]},
    {"type": "words", "words": [["THE FOLLOW-UP", .5], ["SLIPPED.", .7, "r"]]},
    FIX,
    {"type": "still", "img": "needs_you", "dur": 2.7, "caps": [["Late follow-ups? First thing in Admin controls.", 2.7]], "cam": [[0, 420, 1.0], [0.9, 300, 1.45]]},
    {"type": "still", "img": "overdue", "dur": 3.2, "caps": [["Closest to closing first.", 1.4], ["Or move it to a rep who can call today.", 1.8, "g"]], "cam": [[0, 560, 1.0], [1.3, 640, 1.3]]},
    end(b1="SEND", b2="THIS", l2="to your manager. No yes left without a next step.", l3="7 days free. Link in bio.")],
  "AC-HalloweenLook": [
    {"type": "words", "words": [["YOUR REPS", .45], ["STARE AT IT", .5], ["ALL DAY.", .7, "g"]]},
    {"type": "still", "img": "theme_default", "dur": 0.9, "caps": [["86 looks.", 0.9]], "cam": [[0, 470, 1.0]]},
    {"type": "still", "img": "theme_neonnoir", "dur": 0.6, "caps": [["86 looks.", 0.6]], "cam": [[0, 470, 1.0]]},
    {"type": "still", "img": "theme_oldmoney", "dur": 0.6, "caps": [["86 looks.", 0.6]], "cam": [[0, 470, 1.0]]},
    {"type": "still", "img": "theme_gameday", "dur": 0.6, "caps": [["86 looks.", 0.6]], "cam": [[0, 470, 1.0]]},
    {"type": "still", "img": "theme_synthwave", "dur": 0.6, "caps": [["86 looks.", 0.6]], "cam": [[0, 470, 1.0]]},
    {"type": "still", "img": "theme_halloween", "dur": 2.4, "caps": [["Today: Halloween.", 2.4, "g"]], "cam": [[0, 470, 1.0], [1.0, 520, 1.25]]},
    {"type": "words", "words": [["EACH REP", .45], ["PICKS", .35], ["THEIR OWN.", .75, "g"]]},
    end(b1="LINK", b2="IN BIO", l2="Tap the link in our bio, then this post.", l3="7 days free. No card to start.")],
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
#Llock .cap { position: absolute; left: 70px; right: 70px; top: 300px; text-align: center; font-family: Arch; font-weight: 800; font-stretch: 112%; font-size: 84px; line-height: 1.02; color: #FFFFFF; letter-spacing: -0.025em; }
#lockcard { position: absolute; left: 160px; width: 760px; top: 520px; height: 1300px; border-radius: 96px; padding: 20px; box-sizing: border-box; background: #2A3272; box-shadow: 0 70px 130px -40px rgba(0,0,0,.85); }
#lockscr { position: relative; width: 100%; height: 100%; border-radius: 78px; overflow: hidden; background: radial-gradient(120% 80% at 30% 10%, #2B3A8C 0%, #141B4A 45%, #070A1E 100%); }
#lockscr .dt { position: absolute; left: 0; right: 0; top: 120px; text-align: center; font-family: Arch; font-weight: 600; font-size: 38px; color: #C7CBE4; }
#lockscr .tm { position: absolute; left: 0; right: 0; top: 180px; text-align: center; font-family: BigS; font-weight: 800; font-size: 260px; line-height: .85; color: #F4F5F9; }
#lockscr .tm span { font-size: 90px; margin-left: 12px; }
#lnote { position: absolute; left: 30px; right: 30px; top: 520px; box-sizing: border-box; padding: 30px 32px; border-radius: 44px; background: rgba(244,245,249,.94); display: flex; gap: 26px; box-shadow: 0 30px 70px -30px rgba(0,0,0,.7); }
#lnote .ic { flex: none; width: 84px; height: 84px; border-radius: 22px; background: #0E1433; display: flex; align-items: center; justify-content: center; font-family: Unb; font-weight: 800; font-size: 46px; color: #E8B94A; box-shadow: inset 0 0 0 2px rgba(232,185,74,.35); }
#lnote .ap { display: flex; justify-content: space-between; font-family: Arch; font-weight: 600; font-size: 30px; color: #4A5274; }
#lnote .t { font-family: Arch; font-weight: 750; font-size: 44px; line-height: 1.15; color: #131A3E; margin-top: 6px; }
#lnote .b { font-family: Arch; font-weight: 500; font-size: 38px; line-height: 1.3; color: #2B3358; margin-top: 6px; }
#Llist .ti { position: absolute; left: 90px; right: 90px; top: 500px; font-family: Arch; font-weight: 700; font-size: 52px; color: #8A93B8; }
#rows { position: absolute; left: 90px; right: 90px; top: 610px; }
#rows .r { display: flex; justify-content: space-between; align-items: baseline; gap: 30px; padding: 40px 0; border-top: 2px solid rgba(199,203,228,.16); }
#rows .l { font-family: Arch; font-weight: 800; font-stretch: 110%; font-size: 82px; line-height: 1; color: #FFFFFF; letter-spacing: -0.02em; white-space: nowrap; }
#rows .v { font-family: Arch; font-weight: 750; font-size: 66px; line-height: 1; white-space: nowrap; }
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
<div class="layer" id="Llock"><div class="cap"></div><div id="lockcard"><div id="lockscr"><div class="dt"></div><div class="tm"></div>
  <div id="lnote"><div class="ic">V</div><div style="flex: 1; min-width: 0"><div class="ap"><span>VPEX</span><span>now</span></div><div class="t"></div><div class="b"></div></div></div></div></div></div>
<div class="layer" id="Llist"><div class="ti"></div><div id="rows"></div></div>
<div class="layer" id="Lend"><div class="wm">VPEX</div><div class="big" id="eb1" style="top: 640px; color: #FFFFFF">COMMENT</div><div class="big" id="eb2" style="top: 840px; color: #E8B94A">DEMO</div>
  <div class="l2">We&rsquo;ll send you a live demo office.</div><div class="l3">7 days free. Link in bio.</div></div>
</div><script>
const T = __TL__;
const COL = { w: "#FFFFFF", g: "#E8B94A", r: "#FF6B5E", m: "#8A93B8" };
const $ = id => document.getElementById(id);
const layers = ["Lword", "Lclock", "Lmedia", "Lspam", "Ltaps", "Lstrike", "Llock", "Llist", "Lend"];
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
    if (seg.type === "clip") { const fi = Math.min(seg.frames - 1, Math.floor((seg.in + u * seg.speed) * T.fps)); await setImg("../../ig3/clips/" + seg.clip + "/f" + String(fi).padStart(4, "0") + ".jpg"); }
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
  } else if (seg.type === "lock") {
    show("Llock");
    const L = $("Llock"), card = $("lockcard"), rise = ease(u / 0.4);
    L.querySelector(".cap").textContent = seg.cap; L.querySelector(".cap").style.opacity = ease((u - 0.15) / 0.25);
    card.style.transform = "translateY(" + (1 - rise) * 1400 + "px)";
    const tm = seg.times.filter(x => u >= x[2]).pop() || seg.times[0];
    L.querySelector(".dt").textContent = seg.date; L.querySelector(".tm").innerHTML = tm[0] + "<span>" + tm[1] + "</span>";
    const n = $("lnote"), a = ease((u - seg.noteAt) / 0.35);
    n.querySelector(".t").textContent = seg.note[0]; n.querySelector(".b").textContent = seg.note[1];
    n.style.opacity = a; n.style.transform = "translateY(" + (1 - a) * -120 + "px) scale(" + (0.94 + 0.06 * a) + ")";
  } else if (seg.type === "list") {
    show("Llist");
    const L = $("Llist"), box = $("rows");
    L.querySelector(".ti").textContent = seg.title;
    if (box.dataset.built !== String(seg.t0)) { box.dataset.fit = ""; box.innerHTML = seg.rows.map(r => '<div class="r"><span class="l">' + r[0] + '</span><span class="v" style="color:' + COL[r[2] || "w"] + '">' + r[1] + '</span></div>').join(""); box.dataset.built = String(seg.t0); }
    [...box.children].forEach((el, i) => { const a = ease((u - i * seg.per) / 0.18); el.style.opacity = a; el.style.transform = "translateX(" + (1 - a) * 50 + "px)"; });
    // shrink long rows to fit
    if (!box.dataset.fit) {   // one size for every row: the biggest that fits the longest
      let s = 92; const rs = [...box.children], set = v => rs.forEach(r => { r.firstChild.style.fontSize = v + "px"; r.lastChild.style.fontSize = Math.round(v * 0.8) + "px"; });
      set(s); while (s > 44 && rs.some(r => r.scrollWidth > 905)) { s -= 2; set(s); }
      box.dataset.fit = 1;
    }
  } else if (seg.type === "end") {
    show("Lend");
    const r = $("Lend"), set = (el, a, dy) => { el.style.opacity = a; el.style.transform = "translateY(" + (1 - a) * dy + "px)"; };
    const b1 = $("eb1"), b2 = $("eb2");
    if (!r.dataset.set) { b1.textContent = seg.b1 || "COMMENT"; b2.textContent = seg.b2 || "DEMO"; r.querySelector(".l2").innerHTML = seg.l2 || ""; r.querySelector(".l3").innerHTML = seg.l3 || ""; r.dataset.set = 1; }
    b1.style.fontSize = Math.min(fitOne(b1, seg.b1 || "COMMENT", 230, 950), fitOne(b2, seg.b2 || "DEMO", 230, 950)) + "px"; b2.style.fontSize = b1.style.fontSize;
    set(r.querySelector(".wm"), ease(u / 0.3), 30);
    b1.style.opacity = u > 0.05 ? 1 : 0; b1.style.transform = "translateX(-50%) scale(" + pop(u - 0.05, 0.08) + ")";
    b2.style.opacity = u > 0.4 ? 1 : 0; b2.style.transform = "translateX(-50%) scale(" + pop(u - 0.4, 0.1) + ")";
    set(r.querySelector(".l2"), ease((u - 0.75) / 0.3), 24); set(r.querySelector(".l3"), ease((u - 0.95) / 0.3), 24);
  }
};
</script></body></html>'''

def still_src(name):
    for rel in ("stills/%s.png", "../ig4/stills/%s.png", "../ig3/stills/%s.png", "../ig/shots2/%s.png"):
        if os.path.exists(os.path.join(D, rel % name)): return "../" + rel % name
    raise FileNotFoundError(name)

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
            if s["type"] == "clip": s["frames"] = json.load(open(D + "/../ig3/clips/%s/meta.json" % s["clip"]))["frames"]
            else: s["src"] = still_src(s["img"])
        elif s["type"] == "taps": s["dur"] = len(s["steps"]) * s["per"] + s["hold"]
        elif s["type"] == "list": s["dur"] = len(s["rows"]) * s["per"] + s["hold"]
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
