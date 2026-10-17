# Real VPEX footage for the week-3 Reels: scripted taps in a demo office (fictional leads, 555 numbers),
# captured with Chrome's screencast at 3x, then resampled to a steady 30 fps frame folder.
# usage: rec.py CLIP [CLIP...]
import sys, os, json, base64, asyncio, shutil, subprocess
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__))
BASE = "http://localhost:8793/"
FPS = 30
SCALE = int(os.environ.get("REC_SCALE", "2"))      # 2x frames for motion (fast capture), 3x for stills
Q = int(os.environ.get("REC_Q", "88"))
CLIPDIR = os.environ.get("REC_DIR", "clips")
FONT_CSS = "@font-face{font-family:'Archivo';src:url(http://localhost:8793/__fonts/archivo.ttf) format('truetype');font-weight:100 900;font-stretch:62% 125%;}"
TAP_JS = r"""
(() => {
  const add = (x, y) => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:' + (x - 26) + 'px;top:' + (y - 26) + 'px;width:52px;height:52px;border-radius:50%;' +
      'background:rgba(232,185,74,.42);border:3px solid #E8B94A;z-index:2147483647;pointer-events:none;' +
      'transition:transform .5s cubic-bezier(.2,.8,.2,1),opacity .5s ease-out;box-sizing:border-box';
    document.documentElement.appendChild(d);
    requestAnimationFrame(() => requestAnimationFrame(() => { d.style.transform = 'scale(1.7)'; d.style.opacity = '0'; }));
    setTimeout(() => d.remove(), 700);
  };
  document.addEventListener('touchstart', e => { for (const t of e.touches) add(t.clientX, t.clientY); }, true);
  window.__tapAt = add;
})();
"""
# Steps: ("wait", ms) · ("tap", css) · ("tapif", css) · ("js", code) · ("type", css, text) · ("smooth", css, toY, ms) · ("view", name)
CLIPS = {
  "call_interested": {"ind": "insurance", "scheme": "light", "steps": [
      ("wait", 900), ("nohref",), ("tap", "#callBtn"), ("wait", 900), ("tapif", "#infoModal.show .gate-call"), ("wait", 700),
      ("tap", '[data-outcome="interested"]'), ("wait", 2300), ("tapif", "#tpLater"), ("wait", 1600)]},
  "fast_flow": {"ind": "insurance", "scheme": "light", "steps": [
      ("wait", 700), ("nohref",), ("tap", "#callBtn"), ("wait", 650), ("tapif", "#infoModal.show .gate-call"), ("wait", 450),
      ("tap", '[data-outcome="noanswer"]'), ("wait", 900), ("tapif", "#tpLater"), ("wait", 700), ("tapif", "#nextLeadBtn"), ("wait", 700),
      ("nohref",), ("tap", "#callBtn"), ("wait", 650), ("tapif", "#infoModal.show .gate-call"), ("wait", 450),
      ("tap", '[data-outcome="voicemail"]'), ("wait", 900), ("tapif", "#tpLater"), ("wait", 700), ("tapif", "#nextLeadBtn"), ("wait", 700),
      ("nohref",), ("tap", "#callBtn"), ("wait", 650), ("tapif", "#infoModal.show .gate-call"), ("wait", 450),
      ("tap", '[data-outcome="interested"]'), ("wait", 1800), ("tapif", "#tpLater"), ("wait", 1200)]},
  "followups_run": {"ind": "insurance", "scheme": "light", "steps": [
      ("wait", 1000), ("tap", '[data-need="overdue"]'), ("wait", 2200)]},
  "redial_guard": {"ind": "insurance", "scheme": "dark", "steps": [
      ("wait", 500), ("nohref",), ("tap", "#callBtn"), ("wait", 600), ("tapif", "#infoModal.show .gate-call"), ("wait", 400),
      ("tap", '[data-outcome="voicemail"]'), ("wait", 800), ("tapif", "#tpLater"), ("wait", 500), ("tapif", "#nextLeadBtn"), ("wait", 600),
      ("cut",), ("wait", 300), ("tap", "#prevBtn, .prev-pill"), ("wait", 900), ("js", "() => { const a = document.querySelector('#mainArea a.call-btn'); if (a) { a.removeAttribute('href'); a.removeAttribute('target'); } }"),
      ("tap", "#mainArea a.call-btn"), ("wait", 2800)]},
  "scoreboard": {"ind": "insurance", "scheme": "dark", "steps": [
      ("wait", 700), ("tap", "#adminBtn"), ("wait", 700), ("tap", '[data-hub-cat="team"]'), ("wait", 600), ("tap", "#hubScore"), ("wait", 1200),
      ("smooth", "#featModal .modal, #featModal", 700, 2200), ("wait", 900)]},
  "team_on_lead": {"ind": "insurance", "scheme": "light", "pre": """() => { const fs = JSON.parse(localStorage.getItem('__mockfs')); const want = {'Mark Walsh': ['dR1', 'Jordan Lee'], 'Sophia West': ['dR3', 'Mia Chen'], 'William Brooks': ['dR2', 'Sam Ortiz']};
      for (const k in fs) { if (k.indexOf('leadChunks/') === -1) continue; const L = fs[k].leads || {}; for (const id in L) { const w = want[L[id].name]; if (w) L[id].claim = { uid: w[0], name: w[1], at: Date.now() + 600000 }; } }
      localStorage.setItem('__mockfs', JSON.stringify(fs)); }""", "steps": [
      ("wait", 700), ("tap", "#adminBtn"), ("wait", 700), ("tap", '[data-hub-cat="team"]'), ("wait", 600), ("tap", "#hubTeam"), ("wait", 1600),
      ("smooth", "#featModal .modal, #featModal", 360, 1500), ("wait", 900)]},
  "qualify": {"ind": "solar", "scheme": "dark", "steps": [
      ("wait", 900), ("tap", ".qf-row"), ("wait", 900),
      ("tap", '#featModalBody .qf-opt[data-qf-k="roof"][data-qf-v="10–20 yr"]'), ("wait", 450),
      ("tap", '#featModalBody .qf-opt[data-qf-k="shade"][data-qf-v="None"]'), ("wait", 450),
      ("tap", '#featModalBody .qf-opt[data-qf-k="credit"][data-qf-v="Yes"]'), ("wait", 450),
      ("tap", '#featModalBody .qf-opt[data-qf-k="owners"][data-qf-v="Yes"]'), ("wait", 700),
      ("tap", "#qfDone"), ("wait", 1600)]},
  "pipeline": {"ind": "mca", "scheme": "dark", "steps": [
      ("wait", 600), ("tap", '[data-view="pipeline"]'), ("wait", 1400), ("smooth", "window", 900, 2400), ("wait", 800)]},
  "recap": {"ind": "insurance", "scheme": "light", "steps": [
      ("wait", 600), ("tap", "#adminBtn"), ("wait", 700), ("tap", '[data-hub-cat="team"]'), ("wait", 600), ("tap", "#hubScore"), ("wait", 2400)]},
}

async def retina_html(route):
    resp = await route.fetch(); body = await resp.text()
    old = 'content="width=device-width, initial-scale=1, viewport-fit=cover"'
    assert old in body
    await route.fulfill(response=resp, body=body.replace(old, 'content="width=390, initial-scale=%d, minimum-scale=%d, maximum-scale=%d, viewport-fit=cover"' % (SCALE, SCALE, SCALE)))

async def main(names):
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for name in names:
            cfg = CLIPS[name]
            # a 1170x2532 window showing the 390-wide phone layout at 3x: true retina frames (screencast ignores device scale factor)
            ctx = await br.new_context(viewport={"width": 390 * SCALE, "height": 844 * SCALE}, screen={"width": 390 * SCALE, "height": 844 * SCALE}, device_scale_factor=1, is_mobile=True, has_touch=True, color_scheme=cfg["scheme"])
            await ctx.route("http://localhost:8793/", retina_html)
            await ctx.route("**/gstatic.com/**", lambda r: r.abort())
            await ctx.route("**/fonts.googleapis.com/**", lambda r: r.fulfill(status=200, content_type="text/css", body=FONT_CSS))
            await ctx.add_init_script(TAP_JS)
            pg = await ctx.new_page()
            await pg.goto(BASE + "#mockbench"); await pg.wait_for_timeout(500)
            await pg.evaluate("() => localStorage.setItem('dovetail_demo', '1')")
            await pg.goto(BASE + "#demo-" + cfg["ind"]); await pg.wait_for_timeout(600); await pg.reload()
            await pg.wait_for_selector("#leadStageSelect", timeout=15000); await pg.wait_for_timeout(1200)
            if cfg.get("pre"):
                await pg.evaluate(cfg["pre"]); await pg.reload(); await pg.wait_for_selector("#leadStageSelect", timeout=15000); await pg.wait_for_timeout(1500)
            await pg.add_style_tag(content=".demo-pill{display:none!important}")   # footage reads as a real office
            await pg.wait_for_timeout(300)
            cdp = await ctx.new_cdp_session(pg)
            frames = []; segs = [0]
            def on_frame(params):
                frames.append((params["metadata"]["timestamp"], params["data"]))
                asyncio.ensure_future(cdp.send("Page.screencastFrameAck", {"sessionId": params["sessionId"]}))
            cdp.on("Page.screencastFrame", on_frame)
            await cdp.send("Page.startScreencast", {"format": "jpeg", "quality": Q, "maxWidth": 390 * SCALE, "maxHeight": 844 * SCALE, "everyNthFrame": 1})
            await pg.wait_for_timeout(300)
            for st in cfg["steps"]:
                k = st[0]
                if k == "wait": await pg.wait_for_timeout(st[1])
                elif k == "nohref": await pg.evaluate("() => { const a = document.getElementById('callBtn'); if (a) { a.removeAttribute('href'); a.removeAttribute('target'); } }")
                elif k == "cut": segs.append(len(frames))
                elif k in ("tap", "tapif"):
                    el = await pg.query_selector(st[1])
                    vis = el and await el.is_visible()
                    if not vis:
                        if k == "tap": print("  missing", st[1])
                        continue
                    await el.scroll_into_view_if_needed()
                    b = await el.bounding_box()
                    await pg.touchscreen.tap(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2)
                elif k == "type": await pg.fill(st[1], st[2])
                elif k == "js": await pg.evaluate(st[1])
                elif k == "smooth":
                    await pg.evaluate("""([sel, y, ms]) => { const el = sel === 'window' ? document.scrollingElement : [...document.querySelectorAll(sel)].find(e => e.scrollHeight > e.clientHeight + 5) || document.scrollingElement;
                        const y0 = el.scrollTop, t0 = performance.now(); const step = (now) => { const k = Math.min(1, (now - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; el.scrollTop = y0 + (y - y0) * e; if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }""", [st[1], st[2], st[3]])
                    await pg.wait_for_timeout(st[3])
            await cdp.send("Page.stopScreencast")
            await ctx.close()
            # resample to a steady 30 fps (each output frame shows the latest captured frame)
            out = D + "/" + CLIPDIR + "/" + name; shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
            raw = out + "_raw"; shutil.rmtree(raw, ignore_errors=True); os.makedirs(raw)
            for i, (ts, data) in enumerate(frames): open(raw + "/r%05d.jpg" % i, "wb").write(base64.b64decode(data))
            t0 = frames[0][0]; dur = frames[-1][0] - t0 + 0.3
            n = int(dur * FPS); j = 0
            for i in range(n):
                t = t0 + i / FPS
                while j + 1 < len(frames) and frames[j + 1][0] <= t: j += 1
                shutil.copyfile(raw + "/r%05d.jpg" % j, out + "/f%04d.jpg" % i)
            json.dump({"frames": n, "fps": FPS, "dur": n / FPS, "raw": len(frames)}, open(out + "/meta.json", "w"))
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", out + "/f%04d.jpg", "-vf", "scale=390:-2", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/" + CLIPDIR + "/%s_preview.mp4" % name], check=True)
            shutil.rmtree(raw)
            print(name, "frames", n, "raw", len(frames), "dur %.1fs" % (n / FPS))
        await br.close()

if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:] or list(CLIPS)))
