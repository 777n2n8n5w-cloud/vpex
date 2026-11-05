# Week-7 app screenshots (3x, 390x844 layout) from demo offices only: fictional leads, 555 numbers.
# Leads in California at 9:05 AM Eastern (6:05 their time), Connecticut, Pennsylvania and Rhode Island after their evening
# cutoff, Florida/Maryland/Oklahoma/Oregon with 3 calls in 24 hours, the Medicare Qualify note, the no-answer text,
# the Team scoreboard and Sales coach, and the admin Reports / Account & data rows.
# usage: python3 capture6.py [name ...]   (needs the app at http://localhost:8793/, see tools/setup.sh)
import os, sys, json
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
D = os.path.dirname(os.path.abspath(__file__))
OUT = D + "/stills/"
BASE = "http://localhost:8793/"
U = lambda *a: datetime(*a, tzinfo=timezone.utc)
TUE = U(2026, 11, 10, 16, 5)          # Tue Nov 10, 11:05 AM New York (EST)
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

@job
def states(br):
    for nm, st, when in (("ca_early", "CA", U(2026, 11, 10, 14, 5)),        # Tue Nov 10, 9:05 AM Eastern = 6:05 AM Pacific
                         ("ca_eleven", "CA", U(2026, 11, 10, 16, 5)),       # 11:05 AM Eastern = 8:05 AM Pacific
                         ("ri_late", "RI", U(2026, 11, 10, 23, 10)),        # 6:10 PM Eastern
                         ("pa_late", "PA", U(2026, 11, 11, 0, 10)),         # 7:10 PM Eastern
                         ("ct_late", "CT", U(2026, 11, 11, 1, 5)),          # 8:05 PM Eastern
                         ("ny_late", "NY", U(2026, 11, 11, 1, 5))):         # 8:05 PM Eastern, federal window still open
        c, pg = office(br, when=when, prep=set_state(st)); shot(pg, nm); box(pg, ".lead-where", "where")
        print("  ", nm, pg.inner_text(".lead-where") if pg.query_selector(".lead-where") else ""); c.close()

@job
def max3(br):
    calls = ["2026-11-10T14:05:00.000Z", "2026-11-10T16:40:00.000Z", "2026-11-10T18:50:00.000Z"]   # 9:05, 11:40, 1:50 Eastern
    for st in ("FL", "MD", "OK", "OR"):
        c, pg = office(br, when=U(2026, 11, 10, 19, 10), prep=set_state(st, calls, "2026-11-10")); shot(pg, "cap_" + st.lower()); box(pg, ".lead-where", "where")
        print("  ", st, pg.inner_text(".lead-where") if pg.query_selector(".lead-where") else "", "|", (pg.query_selector(".next-move") and pg.inner_text(".next-move")) or ""); c.close()

@job
def medicare(br):
    c, pg = office(br)
    pg.click(".qf-row"); pg.wait_for_timeout(700)
    b = pg.query_selector('#featModalBody .qf-opt[data-qf-k="product"][data-qf-v="Medicare"]')
    if b and "on" not in (b.get_attribute("class") or ""): b.click(); pg.wait_for_timeout(500)
    note = pg.query_selector("#featModalBody .qf-note")
    if note: note.scroll_into_view_if_needed(); pg.wait_for_timeout(300); print("  ", note.inner_text())
    shot(pg, "q_medicare"); box(pg, "#featModalBody .qf-note", "note"); c.close()

@job
def noanswer(br):
    c, pg = office(br)
    pg.evaluate("() => { const b = document.querySelector('.out-btn[data-outcome=\\'noanswer\\']') || [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'No answer'); if (b) b.click(); }")
    pg.wait_for_timeout(1500)
    shot(pg, "noanswer_text"); box(pg, "#textPrompt", "prompt")
    print("  ", pg.inner_text("#textPrompt")[:300].replace("\n", " | ") if pg.query_selector("#textPrompt") else "no prompt"); c.close()

@job
def team(br):
    c, pg = office(br, when=U(2026, 11, 12, 21, 30)); hub(pg, "hubScore"); shot(pg, "score_thu")
    pg.evaluate("() => { const el = [...document.querySelectorAll('.modal-overlay.show *')].find(e => e.children.length === 0 && /^Team$/.test(e.textContent.trim())); if (el) el.scrollIntoView({block: 'start'}); }")
    pg.wait_for_timeout(400); shot(pg, "score_thu_reps"); c.close()
    c, pg = office(br, when=U(2026, 11, 12, 21, 30)); hub(pg, "hubCoach"); shot(pg, "coach_thu"); c.close()

@job
def data(br):
    c, pg = office(br); hub(pg, None)
    pg.evaluate("() => { const b = [...document.querySelectorAll('[data-hub-cat]')].find(x => /Account/.test(x.textContent)); if (b) b.click(); }"); pg.wait_for_timeout(900)
    shot(pg, "hub_data"); box(pg, "#hubExport", "export"); box(pg, "#hubBackup", "backup"); box(pg, "#hubReport", "report"); c.close()

@job
def redial(br):
    c, pg = office(br, when=U(2026, 11, 10, 16, 5))
    b = [x for x in pg.query_selector_all("button") if x.is_visible() and x.inner_text().strip() == "No answer"]
    if b: b[0].click(); pg.wait_for_timeout(1200)
    pg.evaluate("() => document.querySelectorAll('.modal-overlay.show, #textPrompt').forEach(m => { m.classList.remove('show'); })"); pg.wait_for_timeout(300)
    print("   (redial needs the lead back: see redial_guard in ig/shots2)"); c.close()

if __name__ == "__main__":
    want = sys.argv[1:] or list(JOBS)
    with sync_playwright() as p:
        br = p.chromium.launch()
        for w in want:
            try: JOBS[w](br)
            except Exception as e: print("!!", w, str(e)[:300])
        br.close()
