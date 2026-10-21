#!/usr/bin/env python3
"""Builds the tiles for vpexdialer.com/ig, the page the Instagram, Threads and Facebook bio links open.

Every feed post in instagram/*.zip (and pack folders) becomes a tile: a 360x450 preview (the Reel cover, the image, or a
carousel's first slide) and a short label. The page shows a tile once its post time has passed, newest first, so people
who saw a post can tap that same picture. Each tile opens where the post points (its "go": a demo office for one industry,
the sales page, or the trial form) with utm tags naming the post, so visits, demos and sign-ups are counted per post.

Run from the repo root after adding a pack:  python3 studio/tools/build_bio_page.py
Writes ig/feed.json and ig/t/<post id>.jpg (old previews of posts no longer in any pack are removed).
"""
import io, json, os, re, sys, zipfile
from datetime import datetime
from zoneinfo import ZoneInfo
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
CONTENT = os.environ.get("IG_CONTENT", os.path.join(ROOT, "instagram"))
OUT = os.environ.get("BIO_OUT", os.path.join(ROOT, "ig"))
INDS = ("insurance", "realestate", "mca", "auto", "solar")
W, H = 360, 450


def packs():
    for n in sorted(os.listdir(CONTENT)):
        p = os.path.join(CONTENT, n)
        if n.endswith(".zip"):
            z = zipfile.ZipFile(p)
            plan = [x for x in z.namelist() if x.endswith("plan.json") and "__MACOSX" not in x][0]
            root = plan[: -len("plan.json")]
            yield json.loads(z.read(plan)), (lambda rel, z=z, root=root: z.read(root + rel))
        elif os.path.isdir(p) and os.path.exists(os.path.join(p, "plan.json")):
            yield json.load(open(os.path.join(p, "plan.json"))), (lambda rel, p=p: open(os.path.join(p, rel), "rb").read())


def label(it):
    t = it.get("bio_label") or it.get("title") or it["id"]
    t = re.sub(r"^(Reel [A-Z0-9]+|Post|Carousel|Image|Video)\s*:\s*", "", t).strip()
    return t[:70]


def go_for(it, side):
    g = it.get("go") or side.get("go") or ""
    if g == "home" or g == "trial" or (g.startswith("demo:") and g[5:] in INDS): return g
    ind = (it.get("tags") or side.get("tags") or {}).get("ind") or ""
    return "demo:" + ind if ind in INDS else "home"


def thumb(data):
    im = Image.open(io.BytesIO(data)).convert("RGB")
    r = min(im.width / W, im.height / H)                     # fill 4:5, centered
    cw, ch = int(W * r), int(H * r)
    x, y = (im.width - cw) // 2, (im.height - ch) // 2
    im = im.crop((x, y, x + cw, y + ch)).resize((W, H), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, "JPEG", quality=80, optimize=True, progressive=True); return b.getvalue()


def main():
    side = {}
    tp = os.path.join(CONTENT, "tags.json")
    if os.path.exists(tp): side = {k: v for k, v in json.load(open(tp)).items() if not k.startswith("_")}
    os.makedirs(os.path.join(OUT, "t"), exist_ok=True)
    tiles, keep = [], set()
    for plan, read in packs():
        tz = ZoneInfo(plan.get("timezone") or "America/New_York")
        for it in plan.get("items", []):
            if it.get("type") not in ("reel", "image", "carousel") or it.get("trial") or it.get("bio") is False: continue
            src = it.get("cover") or it.get("image") or (it.get("images") or [None])[0]
            if not src: continue
            try: data = read(src)
            except KeyError: print("missing", src, "for", it["id"]); continue
            name = re.sub(r"[^A-Za-z0-9_-]", "_", it["id"]) + ".jpg"
            open(os.path.join(OUT, "t", name), "wb").write(thumb(data)); keep.add(name)
            at = datetime.strptime(it["at"], "%Y-%m-%d %H:%M").replace(tzinfo=ZoneInfo(it.get("timezone") or str(tz)))
            camp = (re.match(r"^(w\d+[a-z]?)", it["id"]) or [None, ""])[1] if re.match(r"^w\d", it["id"]) else ""
            tiles.append({"id": it["id"], "at": at.isoformat(), "t": label(it), "img": "t/" + name, "go": go_for(it, side.get(it["id"], {})), "c": camp,
                          "k": it["type"]})
    for f in os.listdir(os.path.join(OUT, "t")):
        if f not in keep: os.remove(os.path.join(OUT, "t", f))
    tiles.sort(key=lambda t: t["at"], reverse=True)
    json.dump({"built": datetime.now(ZoneInfo("America/New_York")).isoformat(timespec="minutes"), "tiles": tiles},
              open(os.path.join(OUT, "feed.json"), "w"), indent=0, ensure_ascii=False)
    print("ig/feed.json: %d tiles (%s)" % (len(tiles), ", ".join(sorted(set(t["go"] for t in tiles)))))


if __name__ == "__main__":
    sys.exit(main())
