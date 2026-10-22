# Week-5 app screenshots (3x, 390x844 layout) from demo offices only: fictional leads, 555 numbers.
# Manager screens (Sales coach, Results report, Answer times, List ROI, Monthly goals, Overdue follow-ups, Lead lists,
# Do Not Call), the rep's Script and Rebuttals, the Halloween look, and an Arizona lead before and after the clocks fall back.
# usage: python3 capture5.py [name ...]   (needs the app at http://localhost:8793/, see tools/setup.sh)
import os, sys, json
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
D = os.path.dirname(os.path.abspath(__file__))
OUT = D + "/stills/"
BASE = "http://localhost:8793/"
U = lambda *a: datetime(*a, tzinfo=timezone.utc)
TUE = U(2026, 10, 27, 15, 5)          # Tue Oct 27, 11:05 AM New York
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
def coach(br):
    c, pg = office(br); hub(pg, "hubCoach"); shot(pg, "coach")
    for i, e in enumerate(pg.query_selector_all("#coachModal .coach-rep, #coachModal [class*=rep]")[:4]): pass
    pg.evaluate("() => { const m = document.querySelector('#coachModal .modal, #coachModal > div'); }")
    # scroll so Sam's card (no next step) sits mid-screen
    pg.evaluate("() => { const el = [...document.querySelectorAll('#coachModal *')].find(e => e.children.length === 0 && /no next step scheduled/.test(e.textContent)); if (el) el.scrollIntoView({block: 'center'}); }")
    pg.wait_for_timeout(400); shot(pg, "coach_sam"); c.close()

@job
def report(br):
    c, pg = office(br, when=U(2026, 10, 30, 21, 0)); hub(pg, "hubReport"); shot(pg, "report")
    pg.evaluate("() => { const el = [...document.querySelectorAll('#featModal *')].find(e => e.children.length === 0 && /^BY REP$/i.test(e.textContent.trim())); if (el) el.scrollIntoView({block: 'start'}); }")
    pg.wait_for_timeout(400); shot(pg, "report_reps"); c.close()

@job
def answers(br):
    c, pg = office(br); hub(pg, "hubAnswers"); shot(pg, "answers"); c.close()
    c, pg = office(br, when=U(2026, 10, 27, 20, 5)); shot(pg, "prime_hour")      # 4:05 PM New York
    box(pg, ".lead-where", "where"); c.close()

@job
def roi(br):
    c, pg = office(br); hub(pg, "hubRoi"); shot(pg, "roi"); c.close()

@job
def goals(br):
    c, pg = office(br); hub(pg, "hubGoals"); shot(pg, "goals"); c.close()

@job
def overdue(br):
    c, pg = office(br); hub(pg, None); shot(pg, "needs_you"); c.close()
    c, pg = office(br); hub(pg, "hubOverdue"); shot(pg, "overdue"); c.close()

@job
def lists(br):
    c, pg = office(br); hub(pg, "hubLists"); shot(pg, "lists")
    b = pg.query_selector_all("#featModal button:has-text('Choose reps')")
    if len(b) > 1: b[1].click(); pg.wait_for_timeout(900); shot(pg, "lists_choose")
    c.close()

@job
def dnc(br):
    c, pg = office(br)
    pg.evaluate("() => { const n = document.querySelector('.lead-name, .dial-name, h2'); }")
    nm = pg.query_selector(".lead-card h2, .lead-name, [data-open-profile]")
    if nm: nm.click(); pg.wait_for_timeout(1200)
    t = pg.query_selector("[data-dnc-toggle]")
    if t:
        t.scroll_into_view_if_needed(); pg.wait_for_timeout(300); shot(pg, "dnc_before")
        t.click(); pg.wait_for_timeout(1200); t = pg.query_selector("[data-dnc-toggle]")
        if t: t.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
        shot(pg, "dnc_after")
        ok = [b for b in pg.query_selector_all("button") if b.is_visible() and b.inner_text().strip() == "Do not call"]
        if ok: ok[-1].click(); pg.wait_for_timeout(1400); shot(pg, "dnc_done"); box(pg, "[data-dnc-toggle]", "toggle")
    else: print("  no profile toggle found"); shot(pg, "dnc_debug")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(500)
    pg.evaluate("() => document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'))")
    hub(pg, "hubDnc"); shot(pg, "dnc_list"); c.close()

@job
def scripts(br):
    c, pg = office(br)
    pg.click('[data-sc-open="rebut"]'); pg.wait_for_timeout(1000)
    r = pg.query_selector("text=“Just mail me something.”") or pg.query_selector("text=Just mail me something")
    if r: r.click(); pg.wait_for_timeout(800); r.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    shot(pg, "rebut_mail"); c.close()
    c, pg = office(br)
    pg.click('[data-sc-open="rebut"]'); pg.wait_for_timeout(1000); shot(pg, "rebut_list"); c.close()
    c, pg = office(br)
    b = pg.query_selector('[data-sc-open="script"]') or pg.query_selector(".sc-bar-b"); b.click(); pg.wait_for_timeout(1000); shot(pg, "script"); c.close()
    c, pg = office(br); shot(pg, "dial_ins"); c.close()

@job
def mca(br):
    c, pg = office(br, "mca"); shot(pg, "dial_mca")
    pg.click('[data-sc-open="rebut"]'); pg.wait_for_timeout(1000); shot(pg, "rebut_mca")
    print("  ", pg.inner_text("#featModal")[:600].replace("\n", " | ") if pg.query_selector("#featModal.show") else "")
    c.close()
    c, pg = office(br, "mca"); hub(pg, "hubRoi"); shot(pg, "roi_mca"); c.close()
    c, pg = office(br, "mca"); hub(pg, "hubAnswers"); shot(pg, "answers_mca"); c.close()

@job
def mca_info(br):
    c, pg = office(br, "mca")
    pg.click('[data-sc-open="rebut"]'); pg.wait_for_timeout(1000)
    r = pg.query_selector("text=Just send me some info")
    if r: r.click(); pg.wait_for_timeout(800); r.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    shot(pg, "rebut_mca_info"); box(pg, "text=Just send me some info", "q"); c.close()

@job
def themes(br):
    for th in ("neonnoir", "oldmoney", "gameday", "synthwave"):
        c, pg = office(br, theme=th, fonts=True); pg.wait_for_timeout(1500); shot(pg, "theme_" + th); c.close()
    c, pg = office(br, fonts=True)
    pg.click("#menuBtn"); pg.wait_for_timeout(700)
    print("  menu:", pg.inner_text("#menuModal")[:500].replace("\n", " | "))
    c.close()
    for th in ("halloween", None):
        c, pg = office(br, theme=th, fonts=True); pg.wait_for_timeout(1500); shot(pg, "theme_" + (th or "default")); c.close()
    c, pg = office(br, fonts=True)
    names = pg.evaluate("() => [...document.querySelectorAll('[data-theme-id], [data-set-theme]')].slice(0, 120).map(e => e.getAttribute('data-theme-id') || e.getAttribute('data-set-theme'))")
    print("  theme buttons:", names[:40]); c.close()

@job
def picker(br):
    c, pg = office(br, fonts=True)
    pg.click("#menuBtn"); pg.wait_for_timeout(700)
    pg.click("text=Look & app"); pg.wait_for_timeout(900)
    s = pg.query_selector("#themeSearch")
    if not s:
        b = pg.query_selector("text=Themes") or pg.query_selector("text=Theme")
        if b: b.click(); pg.wait_for_timeout(900); s = pg.query_selector("#themeSearch")
    shot(pg, "picker")
    if s and s.is_visible():
        s.fill("Halloween"); pg.wait_for_timeout(1200); shot(pg, "picker_halloween")
    c.close()

@job
def dst(br):
    # Arizona doesn't change its clocks. 10:00 AM in New York: Mon Oct 26 (EDT) vs Mon Nov 2 (EST).
    for nm, when in (("dst_before", U(2026, 10, 26, 14, 0)), ("dst_after", U(2026, 11, 2, 15, 0))):
        c, pg = office(br, when=when, prep=set_state("AZ")); shot(pg, nm); box(pg, ".lead-where", "where")
        print("  ", pg.inner_text(".lead-where") if pg.query_selector(".lead-where") else ""); c.close()

@job
def mycoach(br):
    c, pg = office(br)
    pg.click("#menuBtn"); pg.wait_for_timeout(600)
    pg.evaluate("() => { const b = document.getElementById('openCoachBtn'); if (b) b.click(); }"); pg.wait_for_timeout(1500)
    shot(pg, "mycoach"); c.close()

if __name__ == "__main__":
    want = sys.argv[1:] or list(JOBS)
    with sync_playwright() as p:
        br = p.chromium.launch()
        for w in want:
            try: JOBS[w](br)
            except Exception as e: print("!!", w, str(e)[:300])
        br.close()
