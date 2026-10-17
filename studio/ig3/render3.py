# Render week-3 boards (kit3.B) to PNG/JPG, plus story-size versions of the feed posts and a grid preview.
# usage: render3.py [stem-prefix ...] | render3.py --stories-versions | render3.py --grid
import sys, os, re, importlib.util
from playwright.sync_api import sync_playwright
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("kit3", D + "/kit3.py"); kit3 = importlib.util.module_from_spec(spec); spec.loader.exec_module(kit3)
FONTS = '''<style>
@font-face { font-family: Arch; src: url(../../deck/fonts/archivo.ttf); font-weight: 100 900; font-stretch: 62% 125%; }
@font-face { font-family: BigS; src: url(../../deck/fonts/bigshoulders.ttf); font-weight: 100 900; }
@font-face { font-family: Unb; src: url(../../deck/fonts/unbounded.ttf); font-weight: 200 900; }
body { margin: 0; -webkit-font-smoothing: antialiased; }
</style>'''
def shot_path(name):
    if os.path.exists(D + "/stills/%s.png" % name): return "../stills/%s.png" % name
    if os.path.exists(D + "/../ig/shots2/%s.png" % name): return "../../ig/shots2/%s.png" % name
    return "../../ig/shots/%s.png" % name
def page(html): return re.sub(r"\{IMG:([a-z_0-9]+)\}", lambda m: shot_path(m.group(1)), html)
OUT = D + "/out"
def shoot(br, stem, w, h, body, png):
    path = D + "/html/%s.html" % stem
    open(path, "w").write("<!doctype html><html><head><meta charset='utf-8'>" + FONTS + "</head><body>" + body + "</body></html>")
    pg = br.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
    pg.goto("file://" + path); pg.wait_for_timeout(250)
    pg.evaluate("() => Promise.all(['800 100px Unb', '800 100px BigS', '800 100px Arch', '600 100px Arch'].map(f => document.fonts.load(f)))")
    pg.evaluate("() => document.fonts.ready"); pg.wait_for_timeout(120)
    pg.screenshot(path=png, clip={"x": 0, "y": 0, "width": w, "height": h}); pg.close()

if __name__ == "__main__":
    args = sys.argv[1:]
    for d in ("png", "jpg", "story_versions"): os.makedirs(OUT + "/" + d, exist_ok=True)
    os.makedirs(D + "/html", exist_ok=True)
    with sync_playwright() as p:
        br = p.chromium.launch()
        if "--story-versions" in args:
            for stem, title, w, h, html in kit3.B:
                if h != 1350: continue
                bg = re.search(r"background: (#[0-9A-Fa-f]{6})", html).group(1)
                body = page(html).replace(">Swipe<", ">vpexdialer.com<").replace(">Link in bio<", ">vpexdialer.com<")
                body = '<div style="width: 1080px; height: 1920px; background: %s; display: flex; align-items: center; justify-content: center">%s</div>' % (bg, body)
                png = OUT + "/story_versions/%s.png" % stem
                shoot(br, "sv_" + stem, 1080, 1920, body, png)
                Image.open(png).convert("RGB").save(OUT + "/story_versions/Story-%s.jpg" % stem, quality=93, subsampling=0); os.remove(png)
                print("story version", stem)
        else:
            for stem, title, w, h, html in kit3.B:
                if args and not any(stem.startswith(a) for a in args): continue
                png = OUT + "/png/%s.png" % stem
                shoot(br, stem, w, h, page(html), png)
                Image.open(png).convert("RGB").save(OUT + "/jpg/%s.jpg" % stem, quality=93, subsampling=0)
                print("rendered", stem)
        br.close()
