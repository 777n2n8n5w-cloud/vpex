#!/usr/bin/env python3
"""The pack validator (studio/tools/validate_packs.py) on a format-2 pack: tags, destinations, hashtags, Threads text,
the daily ceilings, trial Reels not counted. Run from the repo root: python3 tests/bot/test_validate.py"""
import os, sys, json, zipfile, tempfile, subprocess, shutil
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
W3 = zipfile.ZipFile(os.path.join(ROOT, "instagram", "VPEX-Instagram-Week-3.zip"))
R3 = [n for n in W3.namelist() if n.endswith("plan.json")][0][:-len("plan.json")]
F = {"p": 0, "f": 0}
def check(c, label, info=""):
    print(("PASS" if c else "FAIL") + ":", label + ("" if c else "  -> " + str(info)[-900:])); F["p" if c else "f"] += 1
T = {"hook": "pain", "topic": "followups", "ind": "insurance", "cta": "bio"}
def day(d):
    return [
        {"id": "w99-%s-st1" % d, "at": d + " 09:00", "type": "story", "manual": True, "title": "sticker", "image": "3-Stories/Story-Mon-1.jpg", "note": "poll"},
        {"id": "w99-%s-reel" % d, "at": d + " 11:00", "type": "reel", "title": "Reel", "video": "1-Reels/Reel-G-Callback.mp4", "cover": "1-Reels/Cover-19-Reel-G.jpg",
         "caption": "Call me back at 2.\n\n#a #b #c", "tags": T, "go": "demo:insurance"},
        {"id": "w99-%s-st2" % d, "at": d + " 12:30", "type": "story", "title": "share", "video": "1-Reels/Reel-G-Callback.mp4"},
        {"id": "w99-%s-th1" % d, "at": d + " 08:30", "type": "thread", "title": "t1", "threads_text": "What does your floor forget most? {link}", "tags": dict(T, hook="question", cta="question")},
        {"id": "w99-%s-trial" % d, "at": d + " 13:30", "type": "reel", "trial": "SS_PERFORMANCE", "title": "hook B", "video": "1-Reels/Reel-H-SpamLikely.mp4", "cover": "1-Reels/Cover-21-Reel-H.jpg", "caption": "B", "tags": dict(T, hook="question")},
        {"id": "w99-%s-img" % d, "at": d + " 19:00", "type": "carousel", "title": "Car", "images": ["2-Posts/Post-24-Math-slide1.jpg", "2-Posts/Post-24-Math-slide2.jpg"], "alts": ["a", "b"],
         "caption": "Do the math.\n\nBased on published state rules as of October 2026. Not legal advice.", "tags": dict(T, hook="math", cta="save")},
        {"id": "w99-%s-st3" % d, "at": d + " 20:30", "type": "story", "title": "s2", "image": "4-Story-ad-versions/Story-ad-24-Math-slide1.jpg"},
    ]
def run(items, fmt=2):
    d = tempfile.mkdtemp()
    with zipfile.ZipFile(os.path.join(d, "VPEX-Instagram-Week-99.zip"), "w") as z:
        z.writestr("W99/plan.json", json.dumps({"name": "W99", "format": fmt, "timezone": "America/New_York", "items": items}))
        for it in items:
            for f in [it.get("image"), it.get("video"), it.get("cover")] + (it.get("images") or []):
                if f and ("W99/" + f) not in z.namelist(): z.writestr("W99/" + f, W3.read(R3 + f))
    r = subprocess.run([sys.executable, "-I", os.path.join(ROOT, "studio/tools/validate_packs.py"), d, "VPEX-Instagram-Week-99", "2031-01-07", "2031-01-07"], capture_output=True, text=True)
    shutil.rmtree(d); return r.returncode, r.stdout + r.stderr
good = day("2031-01-07")
code, out = run(good)
check(code == 0 and "feed 2 stories 3 threads 1 trial 1 OK" in out and "RESULT: PASS" in out, "a full format-2 day passes (trial Reel not counted)", out)
bad = json.loads(json.dumps(good)); bad[1]["tags"] = {"hook": "vibes", "topic": "", "cta": "maybe"}; bad[1]["go"] = "demo:crypto"
code, out = run(bad)
check(code == 1 and "tags.hook must be" in out and "tags.topic missing" in out and "tags.cta must be" in out and "go must be" in out, "bad tags and destination are caught", out)
bad = json.loads(json.dumps(good)); bad[1]["caption"] += " #d #e #f"
code, out = run(bad); check(code == 1 and "more than 5 hashtags" in out, "6 hashtags are caught", out)
bad = json.loads(json.dumps(good)); bad[3]["threads_text"] = "x" * 520
code, out = run(bad); check(code == 1 and "Threads text" in out, "a thread over 500 characters is caught", out)
bad = [x for x in good if not x["id"].endswith("th1")]
code, out = run(bad); check(code == 1 and "threads 0" in out, "a missing Threads-only post is caught", out)
extra = {"id": "w99-2031-01-07-mid", "at": "2031-01-07 15:30", "type": "image", "title": "P", "image": "2-Posts/Post-22-TwoReps.jpg", "alt": "x", "caption": "x", "tags": T, "go": "home"}
code, out = run(good + [extra]); check(code == 1 and "feed 3" in out, "a day over the daily ceiling (3 feed posts) is caught", out)
old = [x for x in good if x["type"] != "thread"] + [extra] + [dict(x, id=x["id"] + t[:2], at=x["at"][:11] + t) for x, t in ((good[6], "14:30"), (good[6], "21:00"))]
code, out = run(old, fmt=1)
check(code == 0, "older packs (format 1) aren't held to the new rules", out)
print("validate: %d passed, %d failed" % (F["p"], F["f"])); sys.exit(1 if F["f"] else 0)
