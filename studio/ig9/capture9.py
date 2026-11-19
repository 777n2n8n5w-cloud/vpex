# Week-9 app screenshots (3x, 390x844 layout) from demo offices only: fictional leads, 555 numbers.
# The header clock's time-across-the-US sheet (9:05 and 11:05 AM Eastern), the booking-link sheet, the follow-up sheet's
# best-time chips, Floor TV, the Thanksgiving heads-up for Pennsylvania leads, and Manual dial with a pasted number.
# usage: python3 capture8.py [name ...]   (needs the app at http://localhost:8793/, see tools/setup.sh)
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

@job
def cb(br):
    c, pg = office(br, when=U(2026, 11, 24, 16, 5), prep=set_state("PA"))
    pg.evaluate("() => document.getElementById('callBtn').click()"); pg.wait_for_timeout(1200)
    pg.evaluate("() => { const b = document.querySelector('[data-outcome=\"callback\"]'); b && b.click(); }"); pg.wait_for_timeout(1500); shot(pg, "cb_sheet")
    box(pg, ".fu-later", "later"); box(pg, "#fuTitle", "title"); print("  ", pg.inner_text(".fu-later") if pg.query_selector(".fu-later") else ""); c.close()

@job
def pad(br):
    c, pg = office(br, when=U(2026, 11, 25, 16, 5))
    pg.evaluate("() => document.getElementById('callBtn').click()"); pg.wait_for_timeout(1500)
    pg.add_style_tag(content=".demo-pill{display:none!important}")
    pg.evaluate("() => document.getElementById('skipBtn').click()"); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT + "pad_toast.png"); print("pad_toast"); box(pg, "#toast", "toast"); box(pg, "#outcomesRow", "row"); c.close()

@job
def sun(br):
    for nm, st, when in (("sun_pa", "PA", U(2026, 11, 29, 16, 5)), ("sun_tx", "TX", U(2026, 11, 29, 16, 5)), ("sun_tx1", "TX", U(2026, 11, 29, 18, 5))):
        c, pg = office(br, when=when, prep=set_state(st)); shot(pg, nm); box(pg, ".lead-where", "where"); where(pg); c.close()

@job
def xmas(br):
    c, pg = office(br, when=U(2026, 12, 24, 15, 5), prep=set_state("PA")); shot(pg, "xmas_thu"); box(pg, '[data-need="hol"]', "pill")
    print("  ", pg.inner_text('[data-need="hol"]') if pg.query_selector('[data-need="hol"]') else "no pill"); c.close()
    c, pg = office(br, when=U(2026, 12, 25, 15, 5), prep=set_state("PA")); shot(pg, "xmas_fri"); box(pg, ".lead-where", "where"); where(pg); c.close()

@job
def mon(br):
    c, pg = office(br, when=U(2026, 11, 30, 14, 5)); shot(pg, "mon_dial"); c.close()

@job
def rest(br):
    c, pg = office(br); hub(pg, "hubFollow"); shot(pg, "fu_rules"); box(pg, "#fuTriesHint", "hint")
    print("  ", pg.inner_text("#fuTriesHint") if pg.query_selector("#fuTriesHint") else "no hint"); c.close()

@job
def score(br):
    c, pg = office(br, when=U(2026, 11, 26, 20, 5)); hub(pg, "hubScore"); shot(pg, "score_new"); c.close()

@job
def texts(br):
    c, pg = office(br, when=U(2026, 11, 29, 16, 5))
    pg.evaluate("() => document.getElementById('callBtn').click()"); pg.wait_for_timeout(1200)
    pg.evaluate("() => { const b = document.querySelector('[data-outcome=\"noanswer\"]'); b && b.click(); }"); pg.wait_for_timeout(1500); shot(pg, "na_after")
    e = pg.query_selector_all("[data-text-lead]"); print("   text links", len(e), [x.get_attribute("data-text-kind") for x in e][:6])
    c.close()

@job
def re(br):
    c, pg = office(br, "realestate", U(2026, 11, 24, 16, 5)); shot(pg, "re_dial"); where(pg)
    hub(pg, "hubScript"); shot(pg, "re_script"); c.close()
    c, pg = office(br, "realestate", U(2026, 11, 24, 16, 5))
    b = [x for x in pg.query_selector_all("button") if x.is_visible() and x.inner_text().strip().startswith("Rebuttals")]
    if b: b[0].click(); pg.wait_for_timeout(1200); shot(pg, "re_rebut")
    c.close()
    c, pg = office(br, "realestate", U(2026, 11, 24, 16, 5))
    b = [x for x in pg.query_selector_all("button,a") if x.is_visible() and x.inner_text().strip() == "Pipeline"]
    if b: b[0].click(); pg.wait_for_timeout(1500); shot(pg, "re_pipe")
    c.close()

if __name__ == "__main__":
    want = sys.argv[1:] or list(JOBS)
    with sync_playwright() as p:
        br = p.chromium.launch()
        for w in want:
            try: JOBS[w](br)
            except Exception as e: print("!!", w, str(e)[:300])
        br.close()
