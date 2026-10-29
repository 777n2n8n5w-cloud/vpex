# Week-6 app screenshots (3x, 390x844 layout) from demo offices only: fictional leads, 555 numbers.
# Contest setup and the live contest bar, Team scoreboard (today, office vs remote), Call pacing, Follow-up rules, Add leads,
# the Sort menu, parked leads with Revive, the solar office, and leads in Connecticut (8:15 AM), Rhode Island and Texas (Sunday)
# and Alabama (Veterans Day) with VPEX's calling-hours check.
# usage: python3 capture6.py [name ...]   (needs the app at http://localhost:8793/, see tools/setup.sh)
import os, sys, json
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
D = os.path.dirname(os.path.abspath(__file__))
OUT = D + "/stills/"
BASE = "http://localhost:8793/"
U = lambda *a: datetime(*a, tzinfo=timezone.utc)
TUE = U(2026, 11, 3, 16, 5)           # Tue Nov 3, 11:05 AM New York (EST)
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

def set_state(st):
    """Every lead in one state (for the clocks-fall-back screens)."""
    return """() => { const fs = JSON.parse(localStorage.getItem('__mockfs')); const st = %s;
      for (const k in fs) { if (k.indexOf('leadChunks/') !== 0) continue; const L = fs[k].leads || {};
        for (const id in L) { const l = L[id]; l.st = st; l.notes = String(l.notes || '').replace(/\\|\\s*[A-Z]{2}\\s*$/, '') + ' | ' + st; } }
      localStorage.setItem('__mockfs', JSON.stringify(fs)); }""" % json.dumps(st)

JOBS = {}
def job(f): JOBS[f.__name__] = f; return f

@job
def contest(br):
    c, pg = office(br); hub(pg, "hubContest")
    m = pg.query_selector("#featModal") or pg
    sels = pg.query_selector_all(".modal-overlay.show select")
    if len(sels) > 1: sels[0].select_option(index=0); sels[1].select_option(index=0)
    inp = pg.query_selector(".modal-overlay.show input[type=text], .modal-overlay.show input:not([type])")
    if inp: inp.fill("Lunch on me")
    pg.wait_for_timeout(300); shot(pg, "contest_setup")
    b = [x for x in pg.query_selector_all(".modal-overlay.show button") if x.is_visible() and "Start contest" in x.inner_text()]
    if b: b[0].click(); pg.wait_for_timeout(1500)
    shot(pg, "contest_after")
    pg.evaluate("() => document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'))"); pg.wait_for_timeout(600)
    shot(pg, "contest_bar"); box(pg, ".contest-bar", "bar")
    hub(pg, "hubContest"); shot(pg, "contest_board"); c.close()

@job
def score(br):
    c, pg = office(br, when=U(2026, 11, 5, 21, 30)); hub(pg, "hubScore"); shot(pg, "score_today")
    pg.evaluate("() => { const el = [...document.querySelectorAll('.modal-overlay.show *')].find(e => e.children.length === 0 && /^Team$/.test(e.textContent.trim())); if (el) el.scrollIntoView({block: 'start'}); }")
    pg.wait_for_timeout(400); shot(pg, "score_reps"); c.close()

@job
def rules(br):
    for row, nm in (("hubPacing", "pacing"), ("hubFollow", "follow_rules"), ("hubLeads", "add_leads")):
        c, pg = office(br); hub(pg, row); shot(pg, nm); c.close()
    c, pg = office(br); pg.click("text=Paste list"); pg.wait_for_timeout(300); shot(pg, "paste_list") if False else None; c.close()

@job
def sort(br):
    c, pg = office(br, when=U(2026, 11, 9, 14, 5)); shot(pg, "dial_monday")
    b = pg.query_selector("text=Sort")
    if b: b.click(); pg.wait_for_timeout(900)
    shot(pg, "sort_menu"); print("  ", pg.inner_text(".modal-overlay.show")[:400].replace("\n", " | ") if pg.query_selector(".modal-overlay.show") else ""); c.close()

@job
def revive(br):
    c, pg = office(br); pg.click("text=Pipeline"); pg.wait_for_timeout(1200); shot(pg, "pipeline_tab")
    r = pg.query_selector("text=Revive")
    if r: r.scroll_into_view_if_needed(); pg.wait_for_timeout(300); shot(pg, "revive"); box(pg, "text=Revive", "revive")
    else: print("  no Revive on screen")
    c.close()

@job
def solar(br):
    c, pg = office(br, "solar"); shot(pg, "dial_solar"); hub(pg, "hubRoi"); shot(pg, "roi_solar"); c.close()
    c, pg = office(br, "solar"); pg.click('[data-sc-open="rebut"]'); pg.wait_for_timeout(1000); shot(pg, "rebut_solar")
    print("  ", pg.inner_text(".modal-overlay.show")[:700].replace("\n", " | ") if pg.query_selector(".modal-overlay.show") else ""); c.close()

@job
def states(br):
    for nm, st, when in (("ct_early", "CT", U(2026, 11, 4, 13, 15)),        # Wed Nov 4, 8:15 AM Eastern
                         ("ct_nine", "CT", U(2026, 11, 4, 14, 5)),          # 9:05 AM Eastern
                         ("ri_sunday", "RI", U(2026, 11, 8, 16, 0)),        # Sun Nov 8, 11 AM Eastern
                         ("tx_sunday_am", "TX", U(2026, 11, 8, 16, 0)),     # 10 AM Central
                         ("al_holiday", "AL", U(2026, 11, 11, 16, 0)),      # Wed Nov 11 (Veterans Day), 10 AM Central
                         ("al_tuesday", "AL", U(2026, 11, 10, 16, 0))):
        c, pg = office(br, when=when, prep=set_state(st)); shot(pg, nm); box(pg, ".lead-where", "where")
        print("  ", nm, pg.inner_text(".lead-where") if pg.query_selector(".lead-where") else ""); c.close()

@job
def contest2(br):
    c, pg = office(br); hub(pg, "hubContest")
    pg.select_option("#ctMetric", index=0); pg.fill("#ctPrize", "Lunch on me"); pg.wait_for_timeout(300)
    pg.click("#ctGo"); pg.wait_for_timeout(1500)
    pg.evaluate("() => document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'))"); pg.wait_for_timeout(500)
    ch = pg.query_selector("text=/🏆/")
    if ch: box(pg, "text=/🏆/", "chip"); ch.click(); pg.wait_for_timeout(1200)
    shot(pg, "contest_live")
    print("  ", pg.inner_text(".modal-overlay.show")[:500].replace("\n", " | ") if pg.query_selector(".modal-overlay.show") else "no board"); c.close()

@job
def solar_roof(br):
    c, pg = office(br, "solar"); pg.click('[data-sc-open="rebut"]'); pg.wait_for_timeout(1000)
    r = pg.query_selector("text=My roof is old")
    if r: r.click(); pg.wait_for_timeout(800); r.scroll_into_view_if_needed(); pg.wait_for_timeout(300); box(pg, "text=My roof is old", "q")
    shot(pg, "rebut_roof"); print("  ", pg.inner_text(".modal-overlay.show")[:600].replace("\n", " | ")); c.close()

if __name__ == "__main__":
    want = sys.argv[1:] or list(JOBS)
    with sync_playwright() as p:
        br = p.chromium.launch()
        for w in want:
            try: JOBS[w](br)
            except Exception as e: print("!!", w, str(e)[:300])
        br.close()
