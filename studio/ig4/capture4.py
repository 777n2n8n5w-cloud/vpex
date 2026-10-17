# Week-4 app screenshots (3x, 390x844 layout) from a demo office: fictional leads, 555 numbers.
# State calling hours (PA Sunday / PA evening / FL 8 PM / FL 3-call limit), a normal lead, and the handoff confirmation text.
import os, json
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
D = os.path.dirname(os.path.abspath(__file__))
OUT = D + "/stills/"
BASE = "http://localhost:8793/"
def vis(pg, sel): return bool(pg.query_selector(sel)) and pg.eval_on_selector(sel, "e => e.checkVisibility()")

def office(br, ind, when, scheme="light", prep=None):
    c = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True, timezone_id="America/New_York", color_scheme=scheme)
    c.route("**/gstatic.com/**", lambda r: r.abort()); c.route("**/fonts.googleapis.com/**", lambda r: r.abort())
    pg = c.new_page(); pg.clock.install(time=when)
    pg.goto(BASE + "#mockbench"); pg.wait_for_timeout(500); pg.evaluate("() => localStorage.setItem('dovetail_demo', '1')")
    pg.goto(BASE + "#demo-" + ind); pg.wait_for_timeout(600); pg.reload(); pg.wait_for_timeout(3500)
    if prep:
        pg.evaluate(prep); pg.reload(); pg.wait_for_timeout(3500)
    pg.add_style_tag(content=".demo-pill{display:none!important}")
    pg.wait_for_timeout(400)
    return c, pg

def set_state(st, calls_for_first=None, day=None):
    """Every lead lives in one state; optionally log calls today on the lead that's up first."""
    return """() => { const fs = JSON.parse(localStorage.getItem('__mockfs')); const st = %s, calls = %s, day = %s;
      let first = null;
      for (const k in fs) { if (k.indexOf('leadChunks/') !== 0) continue; const L = fs[k].leads || {};
        for (const id in L) { const l = L[id]; l.st = st; l.notes = String(l.notes || '').replace(/\\|\\s*[A-Z]{2}\\s*$/, '') + ' | ' + st; if (l.name === 'Anthony Ross') first = id; } }
      if (calls && first) { const k = 'callDays/' + day; fs[k] = fs[k] || { calls: {} }; fs[k].calls = fs[k].calls || {};
        calls.forEach((ts, i) => { fs[k].calls['w4c' + i] = { id: 'w4c' + i, leadId: first, name: 'Anthony Ross', outcomeKey: i === 2 ? 'voicemail' : 'noanswer', outcome: i === 2 ? 'Voicemail' : 'No answer', attempt: i + 1, timestamp: ts, by: { uid: 'dAdm', name: 'You' }, talk: 20 }; }); }
      localStorage.setItem('__mockfs', JSON.stringify(fs)); }""" % (json.dumps(st), json.dumps(calls_for_first), json.dumps(day))

def shot(pg, name):
    pg.screenshot(path=OUT + name + ".png")
    print(name, "|", (pg.query_selector(".lead-where") and pg.inner_text(".lead-where")) or "", "|", (pg.query_selector(".next-move") and pg.inner_text(".next-move")) or "")

with sync_playwright() as p:
    br = p.chromium.launch()
    U = lambda *a: datetime(*a, tzinfo=timezone.utc)
    # 1. Pennsylvania, Sunday Oct 25, 10:30 AM: no sales calls on Sundays
    c, pg = office(br, "insurance", U(2026, 10, 25, 14, 30), prep=set_state("PA")); shot(pg, "pa_sunday"); c.close()
    # 2. Pennsylvania, Tuesday Oct 20, 7:20 PM: outside 9 AM-7 PM
    c, pg = office(br, "insurance", U(2026, 10, 20, 23, 20), prep=set_state("PA")); shot(pg, "pa_evening"); c.close()
    # 3. Florida, Tuesday 8:10 PM: outside 8 AM-8 PM
    c, pg = office(br, "insurance", U(2026, 10, 21, 0, 10), prep=set_state("FL")); shot(pg, "fl_late"); c.close()
    # 4. Florida, Tuesday 2:10 PM, third call already made today: 3-call limit
    calls = ["2026-10-20T13:05:00.000Z", "2026-10-20T15:40:00.000Z", "2026-10-20T17:50:00.000Z"]
    c, pg = office(br, "insurance", U(2026, 10, 20, 18, 10), prep=set_state("FL", calls, "2026-10-20")); shot(pg, "fl_cap"); c.close()
    # 5. New York, Tuesday 11:00 AM: good to call (for contrast)
    c, pg = office(br, "insurance", U(2026, 10, 20, 15, 0), prep=set_state("NY")); shot(pg, "ny_ok"); c.close()
    # 6. Solar: hand the lead to Sam, then the confirmation text is offered
    mk = """() => { const fs = JSON.parse(localStorage.getItem('__mockfs')); for (const k in fs) if (/(^|\\/)members\\/dR2$/.test(k)) fs[k].closer = true; localStorage.setItem('__mockfs', JSON.stringify(fs)); }"""
    c, pg = office(br, "solar", U(2026, 10, 20, 15, 0), prep=mk)
    pg.evaluate("() => document.querySelector('.lead-name[data-open-lead]').click()"); pg.wait_for_timeout(600)
    pg.screenshot(path=OUT + "profile_handoff.png")
    pg.click("#leadModalBody [data-handoff]"); pg.wait_for_timeout(500)
    pg.fill("#hoAt", "2026-10-21T14:30"); pg.fill("#hoNote", "Wants to see the battery option"); pg.wait_for_timeout(200)
    pg.screenshot(path=OUT + "handoff_sheet4.png")
    pg.click("#hoGo"); pg.wait_for_timeout(900)
    pg.screenshot(path=OUT + "confirm_text.png"); print("confirm_text |", pg.inner_text("#textPrompt")[:160].replace("\n", " / "))
    c.close()
    br.close()
