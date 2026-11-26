# Week-10 app screenshots (3x, 390x844 layout) from demo offices only: fictional leads, 555 numbers.
# Rebuttals (real estate, auto, MCA, insurance, solar), the live rep tracker (Live, Needs you, one rep), the Calendar tab, the
# follow-up sheet on Christmas Eve, the Dial list at 9:15 PM Eastern, and the auto office's lead card, script and pipeline.
# usage: python3 capture10.py [name ...]   (needs the app at http://localhost:8793/, see tools/setup.sh)
import os, sys, json
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
D = os.path.dirname(os.path.abspath(__file__))
OUT = D + "/stills/"
BASE = "http://localhost:8793/"
U = lambda *a: datetime(*a, tzinfo=timezone.utc)
TUE = U(2026, 11, 17, 16, 5)          # Tue Nov 17, 11:05 AM New York (EST)
HIDE = "#toast{display:none!important}.demo-pill{display:none!important}"

def office(br, ind="insurance", when=TUE, theme=None, prep=None, fonts=False, scheme="light"):
    c = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True, timezone_id="America/New_York", color_scheme=scheme)
    c.route("**/gstatic.com/**", lambda r: r.abort())
    if not fonts: c.route("**/fonts.googleapis.com/**", lambda r: r.abort())
    pg = c.new_page(); pg.clock.install(time=when)
    pg.goto(BASE + "#mockbench"); pg.wait_for_timeout(500); pg.evaluate("() => localStorage.setItem('dovetail_demo', '1')")
    if theme: pg.evaluate("t => localStorage.setItem('dovetail_dialer_theme_v1', t)", theme)
    pg.goto(BASE + "#demo-" + ind); pg.wait_for_timeout(600); pg.reload(); pg.wait_for_timeout(3500)
    if prep: pg.evaluate(prep); pg.reload(); pg.wait_for_timeout(3500)
    pg.add_style_tag(content=HIDE); pg.wait_for_timeout(400)
    return c, pg

def hub(pg, row):
    pg.click("#menuBtn"); pg.wait_for_timeout(600)
    pg.click('[data-set-cat="admin"]'); pg.wait_for_timeout(800)
    if row: pg.evaluate("id => document.getElementById(id).click()", row); pg.wait_for_timeout(1500)

def box(pg, sel, name):
    e = pg.query_selector(sel)
    bb = e.bounding_box() if e else None
    print("  ", name, sel, [round(v) for v in (bb["x"], bb["y"], bb["width"], bb["height"])] if bb else None)

def shot(pg, name):
    pg.add_style_tag(content=HIDE); pg.wait_for_timeout(200)
    pg.screenshot(path=OUT + name + ".png"); print(name)

def set_state(st, calls=None, day=None):
    """Every lead in one state; optionally log calls today on Anthony Ross (the lead that's up first)."""
    return """() => { const fs = JSON.parse(localStorage.getItem('__mockfs')); const st = %s, calls = %s, day = %s;
      let first = null;
      for (const k in fs) { if (k.indexOf('leadChunks/') !== 0) continue; const L = fs[k].leads || {};
        for (const id in L) { const l = L[id]; l.st = st; l.notes = String(l.notes || '').replace(/\\|\\s*[A-Z]{2}\\s*$/, '') + ' | ' + st; if (l.name === 'Anthony Ross') first = id; } }
      if (calls && first) { const k = 'callDays/' + day; fs[k] = fs[k] || { calls: {} }; fs[k].calls = fs[k].calls || {};
        calls.forEach((ts, i) => { fs[k].calls['w7c' + i] = { id: 'w7c' + i, leadId: first, name: 'Anthony Ross', outcomeKey: i === 2 ? 'voicemail' : 'noanswer', outcome: i === 2 ? 'Voicemail' : 'No answer', attempt: i + 1, timestamp: ts, by: { uid: 'dAdm', name: 'You' }, talk: 20 }; }); }
      localStorage.setItem('__mockfs', JSON.stringify(fs)); }""" % (json.dumps(st), json.dumps(calls), json.dumps(day))

JOBS = {}
def job(f): JOBS[f.__name__] = f; return f
def first_id(pg): return pg.evaluate("() => { const fs = JSON.parse(localStorage.getItem('__mockfs')); for (const k in fs) { if (k.indexOf('leadChunks/') !== 0) continue; const L = fs[k].leads || {}; for (const id in L) if (L[id].name === 'Anthony Ross') return id; } return null; }")
def tap_attr(pg, attr, val):
    pg.evaluate("([a, v]) => { const b = document.createElement('button'); b.setAttribute(a, v); document.body.appendChild(b); b.click(); b.remove(); }", [attr, val])

def where(pg):
    print("  ", pg.inner_text(".lead-where") if pg.query_selector(".lead-where") else "")

def rebut(br, ind, q, name, when=U(2026, 12, 1, 16, 5), opened=True):
    c, pg = office(br, ind, when)
    b = [x for x in pg.query_selector_all("button") if x.is_visible() and x.inner_text().strip().startswith("Rebuttals")]
    b[0].click(); pg.wait_for_timeout(1200)
    if q: pg.get_by_text(q).last.click(); pg.wait_for_timeout(900)
    shot(pg, name); c.close()

@job
def objs(br):
    rebut(br, "realestate", "How did you get my number?", "rb_re_number")
    rebut(br, "auto", "Just send me your best price.", "rb_auto_price")
    rebut(br, "auto", "I need to talk to my spouse.", "rb_auto_spouse")
    rebut(br, "insurance", "I'll ask my kids first.", "rb_ins_kids")
    rebut(br, "solar", "I need to talk to my spouse.", "rb_sol_spouse")
    rebut(br, "mca", "I need to talk to my partner.", "rb_mca_partner")
    rebut(br, "mca", None, "rb_mca_list")
    rebut(br, "mca", "Just send me some info.", "rb_mca_info")
    rebut(br, "solar", "I'm not interested.", "rb_sol_notint")

@job
def track(br):
    c, pg = office(br, when=U(2026, 12, 2, 19, 5)); hub(pg, "hubTrack"); pg.wait_for_timeout(1500); shot(pg, "track_live")
    b = [x for x in pg.query_selector_all("button") if x.is_visible() and x.inner_text().strip().startswith("Needs you")]
    if b: b[0].click(); pg.wait_for_timeout(1000); shot(pg, "track_needs")
    r = pg.get_by_text("Mia Chen").first
    r.click(); pg.wait_for_timeout(1200); shot(pg, "track_rep"); c.close()

@job
def tv(br):
    c, pg = office(br, when=U(2026, 12, 4, 19, 5)); hub(pg, "hubTv"); pg.wait_for_timeout(2500); shot(pg, "tv"); c.close()

@job
def cal(br):
    c, pg = office(br, when=U(2026, 12, 3, 16, 5))
    b = [x for x in pg.query_selector_all("button") if x.is_visible() and x.inner_text().strip() == "Calendar"]
    b[0].click(); pg.wait_for_timeout(1500); shot(pg, "cal_month")
    pg.mouse.wheel(0, 700); pg.wait_for_timeout(800); shot(pg, "cal_today"); c.close()

@job
def xmasfu(br):
    c, pg = office(br, when=U(2026, 12, 24, 16, 5), prep=set_state("NY"))
    pg.evaluate("() => document.getElementById('callBtn').click()"); pg.wait_for_timeout(1200)
    pg.evaluate("() => { const b = document.querySelector('[data-outcome=\"interested\"]'); b && b.click(); }"); pg.wait_for_timeout(1500); shot(pg, "fu_xmas")
    box(pg, ".fu-days", "days"); print("  ", pg.inner_text(".fu-days") if pg.query_selector(".fu-days") else ""); c.close()

@job
def late(br):
    c, pg = office(br, when=U(2026, 12, 5, 2, 15)); shot(pg, "dial_0915"); where(pg)
    b = [x for x in pg.query_selector_all("button") if x.is_visible() and x.inner_text().strip().startswith("Eastern")]
    print("  ", [x.inner_text().replace("\n", " ") for x in pg.query_selector_all("button") if x.is_visible() and any(k in x.inner_text() for k in ("All", "Callable", "Eastern", "Central", "Mountain", "Pacific"))][:8])
    c.close()

@job
def auto(br):
    c, pg = office(br, "auto", U(2026, 12, 6, 17, 5)); shot(pg, "auto_dial"); where(pg)
    hub(pg, "hubScript"); shot(pg, "auto_script"); c.close()
    c, pg = office(br, "auto", U(2026, 12, 6, 17, 5))
    b = [x for x in pg.query_selector_all("button,a") if x.is_visible() and x.inner_text().strip() == "Pipeline"]
    if b: b[0].click(); pg.wait_for_timeout(1500); shot(pg, "auto_pipe")
    c.close()

if __name__ == "__main__":
    want = sys.argv[1:] or list(JOBS)
    with sync_playwright() as p:
        br = p.chromium.launch()
        for w in want:
            try: JOBS[w](br)
            except Exception as e: print("!!", w, str(e)[:300])
        br.close()
