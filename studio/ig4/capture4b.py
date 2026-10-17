# Bridge-pack screenshots (3x, 390x844 layout), demo offices only (fictional leads, 555 numbers):
# the industry prompts in the Qualify sheet, each industry's pipeline words, and a deal's closing checklist.
import os
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
D = os.path.dirname(os.path.abspath(__file__))
OUT = D + "/stills/"
BASE = "http://localhost:8793/"
def vis(pg, sel): return bool(pg.query_selector(sel)) and pg.eval_on_selector(sel, "e => e.checkVisibility()")

def office(br, ind, scheme="light"):
    c = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True, timezone_id="America/New_York", color_scheme=scheme)
    c.route("**/gstatic.com/**", lambda r: r.abort()); c.route("**/fonts.googleapis.com/**", lambda r: r.abort())
    pg = c.new_page(); pg.clock.install(time=datetime(2026, 10, 20, 15, 0, tzinfo=timezone.utc))
    pg.goto(BASE + "#mockbench"); pg.wait_for_timeout(500); pg.evaluate("() => localStorage.setItem('dovetail_demo', '1')")
    pg.goto(BASE + "#demo-" + ind); pg.wait_for_timeout(600); pg.reload(); pg.wait_for_timeout(3500)
    pg.add_style_tag(content=".demo-pill{display:none!important}"); pg.wait_for_timeout(300)
    return c, pg

def qualify(br, ind, k, v, name):
    c, pg = office(br, ind)
    pg.click(".qf-row"); pg.wait_for_timeout(700)
    sel = '#featModalBody .qf-opt[data-qf-k="%s"][data-qf-v="%s"]' % (k, v)
    b = pg.query_selector(sel)
    if b and "on" not in (b.get_attribute("class") or ""): b.click(); pg.wait_for_timeout(500)
    note = pg.query_selector("#featModalBody .qf-note")
    if note: note.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    pg.screenshot(path=OUT + name + ".png")
    bb = note.bounding_box() if note else None
    print(name, "box", [round(v) for v in (bb["x"], bb["y"], bb["width"], bb["height"])] if bb else None)
    c.close()

with sync_playwright() as p:
    br = p.chromium.launch()
    qualify(br, "insurance", "product", "Medicare", "q_medicare")
    qualify(br, "solar", "owner", "No", "q_solar_owner")
    qualify(br, "realestate", "agent", "Yes", "q_re_agent")
    for ind in ["insurance", "realestate", "mca", "auto", "solar"]:
        c, pg = office(br, ind, "dark")
        pg.click('[data-view="pipeline"]'); pg.wait_for_timeout(1400)
        pg.screenshot(path=OUT + "pipe_" + ind + ".png")
        heads = pg.evaluate("() => [...document.querySelectorAll('.pipe-col h3, .pl-col h3, .pipe-head, [class*=stage] h3')].slice(0, 8).map(e => e.innerText.replace(/\\n/g, ' '))")
        print("pipe_" + ind, heads)
        # a deal's closing checklist (Vault record)
        pg.click('[data-view="vault"]'); pg.wait_for_timeout(1000)
        rec = pg.query_selector("#vaultList .vault-row, .vault-row, [data-vault-id]")
        if rec:
            rec.click(); pg.wait_for_timeout(900)
            row = pg.query_selector("[data-vi-edit]")
            if row: row.click(); pg.wait_for_timeout(900)
            st = pg.query_selector(".vi-steps")
            if st: st.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
            pg.screenshot(path=OUT + "steps_" + ind + ".png")
            bb = st.bounding_box() if st else None
            print("steps_" + ind, "box", [round(v) for v in (bb["x"], bb["y"], bb["width"], bb["height"])] if bb else None)
        c.close()
    br.close()
