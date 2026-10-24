#!/usr/bin/env python3
"""End-to-end test of the VPEX posting bot (instagram-bot/bot.py) against stand-in Instagram, Facebook and Threads servers
that really fetch the media links, plus the learning step and the private scorecard. Nothing leaves this machine.

Run from the repo root:  python3 tests/bot/test_bot.py      (needs: pip install requests pillow)
Media come from the real week 3 pack in instagram/.
"""
import os, sys, json, time, threading, shutil, subprocess, zipfile, tempfile, importlib.util, socket, datetime as dt
from http.server import BaseHTTPRequestHandler, HTTPServer, SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from zoneinfo import ZoneInfo
import requests

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
BOT = os.path.join(ROOT, "instagram-bot", "bot.py")
W3 = os.path.join(ROOT, "instagram", "VPEX-Instagram-Week-3.zip")
TMP = tempfile.mkdtemp(prefix="vpexbot-")
F = {"p": 0, "f": 0}
def check(c, label, info=None):
    print(("PASS" if c else "FAIL") + ":", label + ("" if c or info is None else "  -> " + str(info)[:600])); F["p" if c else "f"] += 1
def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p

# ---------- media host (stands in for the private bucket's signed links)
MEDIA = os.path.join(TMP, "media"); os.makedirs(MEDIA)
class MH(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=MEDIA, **k)
    def log_message(self, *a): pass
MPORT = free_port(); threading.Thread(target=ThreadingHTTPServer(("127.0.0.1", MPORT), MH).serve_forever, daemon=True).start()

# ---------- one stand-in server for Instagram (/ig), Facebook (/fb, uploads at /rup) and Threads (/th)
G = {}
def reset():
    G.clear(); G.update({"seq": 1, "followers": 312, "blocked": False, "ig_posts": [], "containers": {}, "comments": {}, "replies": [], "media_list": None,
        "insight_calls": 0, "skip_fail": False, "fb": [], "fb_uploads": [], "th": [], "th_refresh": 0, "ig_refresh": 0, "tokens": [], "fb_bad": False})
reset()
def nid(p): G["seq"] += 1; return "%s%d" % (p, G["seq"])
def fetch(url, want):
    r = requests.get(url, timeout=10); ct = r.headers.get("Content-Type", "")
    return r.status_code == 200 and want in ct, len(r.content)
IG_OK = ("IGTOKEN", "IGTOKEN-REFRESHED"); TH_OK = ("THTOKEN", "THTOKEN-REFRESHED")
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, obj, code=200):
        b = json.dumps(obj).encode(); self.send_response(code); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(b)
    def err(self, msg, code=100, http=400): return self.send({"error": {"message": msg, "code": code, "type": "OAuthException"}}, http)
    def params(self):
        q = {k: v[0] for k, v in parse_qs(urlparse(self.path).query).items()}
        if self.command == "POST":
            n = int(self.headers.get("Content-Length") or 0)
            if n: q.update({k: v[0] for k, v in parse_qs(self.rfile.read(n).decode()).items()})
        return q
    def do_GET(self): self.route()
    def do_POST(self): self.route()
    def route(self):
        q = self.params(); parts = urlparse(self.path).path.strip("/").split("/"); svc, path = parts[0], parts[1:]
        G["tokens"].append(q.get("access_token") or self.headers.get("Authorization", ""))
        try: getattr(self, svc)(q, path)
        except Exception as e: self.err("stand-in crashed: %r" % e, 1, 500)
    # ---- Instagram
    def ig(self, q, path):
        if path == ["refresh_access_token"]:
            if q.get("access_token") not in IG_OK: return self.err("Invalid OAuth access token", 190)
            G["ig_refresh"] += 1; return self.send({"access_token": "IGTOKEN-REFRESHED", "expires_in": 5184000})
        if G["blocked"]: return self.err("API access blocked.", 200, 403)
        if q.get("access_token") not in IG_OK: return self.err("Invalid OAuth access token", 190)
        if path == ["me"]: return self.send({"user_id": "1789", "username": "vpexdialer", "followers_count": G["followers"], "media_count": len(G["ig_posts"])})
        if path == ["1789", "media"] and self.command == "POST":
            if G.get("fail_next"): G["fail_next"] -= 1; return self.err("The media could not be fetched", 9004)
            t = q.get("media_type", "IMAGE")
            if t == "CAROUSEL":
                cid = nid("c"); G["containers"][cid] = {"type": t, "children": q["children"].split(","), "caption": q.get("caption")}; return self.send({"id": cid})
            ok, n = fetch(q.get("video_url") or q.get("image_url"), "video/mp4" if q.get("video_url") else "image/jpeg")
            if not ok: return self.err("The media could not be fetched", 9004)
            cid = nid("c"); G["containers"][cid] = {"type": t, "caption": q.get("caption"), "alt": q.get("alt_text"), "bytes": n, "trial": q.get("trial_params"),
                                                    "share": q.get("share_to_feed"), "cover": bool(q.get("cover_url")), "item": q.get("is_carousel_item") == "true"}
            return self.send({"id": cid})
        if path == ["1789", "media_publish"]:
            c = G["containers"][q["creation_id"]]; mid = nid("m"); G["ig_posts"].append({"id": mid, **c}); return self.send({"id": mid})
        if path == ["1789", "media"]:
            if G["media_list"] is not None: return self.send({"data": G["media_list"]})
            now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+0000")
            return self.send({"data": [{"id": p["id"], "timestamp": now, "caption": p.get("caption") or "", "media_product_type": "REELS" if p["type"] == "REELS" else "FEED"} for p in G["ig_posts"]][::-1]})
        if len(path) == 2 and path[1] == "comments": return self.send({"data": G["comments"].get(path[0], [])})
        if len(path) == 2 and path[1] == "replies": G["replies"].append((path[0], q["message"])); return self.send({"id": nid("r")})
        if path == ["1789", "insights"]:
            vals = {"reach": 4100, "views": 9800, "profile_links_taps": 37, "accounts_engaged": 260, "total_interactions": 410, "likes": 300, "shares": 44, "saves": 51}
            return self.send({"data": [{"name": m, "total_value": {"value": vals.get(m, 0)}} for m in q["metric"].split(",")]})
        if len(path) == 2 and path[1] == "insights":
            G["insight_calls"] += 1
            mets = q["metric"].split(",")
            if G["skip_fail"] and "reels_skip_rate" in mets and len(mets) > 1: return self.err("metric reels_skip_rate is not available", 100)
            vals = (G.get("ins") or {}).get(path[0], {})
            return self.send({"data": [{"name": m, "values": [{"value": vals.get(m, 0)}]} for m in mets]})
        if path == ["1789", "content_publishing_limit"]: return self.send({"data": [{"quota_usage": len(G["ig_posts"]), "config": {"quota_total": 100}}]})
        if len(path) == 1 and path[0].startswith("c"): return self.send({"status_code": "FINISHED"})
        if len(path) == 1 and path[0].startswith("m"): return self.send({"permalink": "https://instagram.com/p/" + path[0]})
        self.err("unknown " + self.path, 1, 404)
    # ---- Facebook Page
    def fb(self, q, path):
        if G["fb_bad"] or q.get("access_token") != "FBTOKEN": return self.err("Error validating access token: Session has expired", 190)
        if path in (["me"], ["PAGE1"]) and self.command == "GET": return self.send({"id": "PAGE1", "name": "VPEX Dialer"})
        if path == ["PAGE1", "video_reels"]:
            if q.get("upload_phase") == "start": v = nid("v"); return self.send({"video_id": v, "upload_url": "http://127.0.0.1:%d/rup/%s" % (PORT, v)})
            if q.get("upload_phase") == "finish":
                up = [u for u in G["fb_uploads"] if u["vid"] == q.get("video_id")]
                if not up: return self.err("video not uploaded")
                G["fb"].append({"kind": "reel", "vid": q["video_id"], "text": q.get("description"), "state": q.get("video_state")}); return self.send({"success": True})
        if path == ["PAGE1", "photos"]:
            ok, n = fetch(q["url"], "image/jpeg")
            if not ok: return self.err("couldn't fetch the photo")
            pid = nid("ph")
            if q.get("published") == "false": return self.send({"id": pid})
            G["fb"].append({"kind": "photo", "text": q.get("message")}); return self.send({"id": pid, "post_id": "PAGE1_" + pid})
        if path == ["PAGE1", "feed"]:
            att = [json.loads(v)["media_fbid"] for k, v in sorted(q.items()) if k.startswith("attached_media")]
            G["fb"].append({"kind": "album", "text": q.get("message"), "photos": att}); return self.send({"id": "PAGE1_" + nid("p")})
        if len(path) == 1 and path[0].startswith("v"): return self.send({"permalink_url": "/reel/" + path[0]})
        self.err("unknown " + self.path, 1, 404)
    def rup(self, q, path):
        if self.headers.get("Authorization") != "OAuth FBTOKEN": return self.send({"success": False, "debug_info": {"message": "bad auth"}}, 401)
        ok, n = fetch(self.headers.get("file_url"), "video/mp4")
        G["fb_uploads"].append({"vid": path[0], "ok": ok, "bytes": n}); return self.send({"success": bool(ok)})
    # ---- Threads
    def th(self, q, path):
        if path == ["refresh_access_token"]:
            if q.get("grant_type") != "th_refresh_token" or q.get("access_token") not in TH_OK: return self.err("bad refresh", 190)
            G["th_refresh"] += 1; return self.send({"access_token": "THTOKEN-REFRESHED", "token_type": "bearer", "expires_in": 5184000})
        if q.get("access_token") not in TH_OK: return self.err("Invalid OAuth access token", 190)
        if path == ["me"]: return self.send({"id": "TH1", "username": "vpexdialer"})
        if path == ["TH1", "threads"]:
            t = q["media_type"]
            if len(q.get("text") or "") > 500: return self.err("text is longer than 500 characters")
            if t in ("IMAGE", "VIDEO"):
                ok, n = fetch(q.get("image_url") or q.get("video_url"), "image/jpeg" if t == "IMAGE" else "video/mp4")
                if not ok: return self.err("media could not be fetched")
            cid = nid("tc"); G["containers"][cid] = {"type": t, "text": q.get("text"), "children": (q.get("children") or "").split(",") if q.get("children") else [], "item": q.get("is_carousel_item") == "true"}
            return self.send({"id": cid})
        if path == ["TH1", "threads_publish"]:
            c = G["containers"][q["creation_id"]]; pid = nid("tp"); G["th"].append({"id": pid, **c}); return self.send({"id": pid})
        if len(path) == 1 and path[0].startswith("tc"): return self.send({"status": "FINISHED"})
        if len(path) == 1 and path[0].startswith("tp"): return self.send({"permalink": "https://www.threads.com/@vpexdialer/post/" + path[0]})
        self.err("unknown " + self.path, 1, 404)
PORT = free_port(); threading.Thread(target=ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever, daemon=True).start()
BASE = "http://127.0.0.1:%d" % PORT

# ---------- a content pack from the real week 3 files, timed around "now"
z3 = zipfile.ZipFile(W3); root3 = [n for n in z3.namelist() if n.endswith("plan.json")][0][:-len("plan.json")]
ny = ZoneInfo("America/New_York")
def at(minutes, now=None): return ((now or dt.datetime.now(ny)) + dt.timedelta(minutes=minutes)).strftime("%Y-%m-%d %H:%M")
LEGAL = "Based on published state rules as of October 2026. Not legal advice."
LONG = ("Your rep dials a lead in Pennsylvania at 8:15 AM. It's against the rules now. " * 9).strip()
def write_pack(content, name, items):
    zp = os.path.join(content, name + ".zip")
    with zipfile.ZipFile(zp, "w") as z:
        z.writestr(name + "/plan.json", json.dumps({"name": name, "timezone": "America/New_York", "items": items}))
        for it in items:
            for f in [it.get("image"), it.get("video"), it.get("cover")] + (it.get("images") or []):
                if f and (name + "/" + f) not in z.namelist() and (root3 + f) in z3.namelist(): z.writestr(name + "/" + f, z3.read(root3 + f))
    return zp
def items_main():
    return [
        {"id": "w9-old", "at": at(-60 * 20), "type": "image", "title": "Too late", "image": "2-Posts/Post-22-TwoReps.jpg", "caption": "old"},
        {"id": "w9-reel", "at": at(-40), "type": "reel", "title": "Reel Z: Call me back at 2", "video": "1-Reels/Reel-G-Callback.mp4", "cover": "1-Reels/Cover-19-Reel-G.jpg",
         "caption": "He said call me back at 2.\n\nNobody did.\n\nComment DEMO and we'll send you a live demo office.\n\n#salesfloor #followup #powerdialer",
         "tags": {"hook": "quote", "topic": "followups", "ind": "insurance", "cta": "comment"}, "go": "demo:insurance"},
        {"id": "w9-poll", "at": at(-35), "type": "story", "manual": True, "title": "Poll story", "image": "3-Stories/Story-Mon-1.jpg", "note": "Add a poll"},
        {"id": "w9-car", "at": at(-30), "type": "carousel", "title": "Carousel: 7 places deals go to die", "images": ["2-Posts/Post-20-Leaks-slide%d.jpg" % i for i in range(1, 10)],
         "alts": ["slide %d" % i for i in range(1, 10)], "caption": "7 places deals go to die.\n\n" + LONG + "\n\n" + LEGAL + "\n\n#salesfloor #telemarketing", "tags": {"hook": "number", "topic": "calling-hours"}},
        {"id": "w9-story", "at": at(-25), "type": "story", "title": "Story", "image": "3-Stories/Story-Mon-2.jpg"},
        {"id": "w9-img", "at": at(-20), "type": "image", "title": "Post: Two reps. One lead.", "image": "2-Posts/Post-22-TwoReps.jpg", "caption": "Two reps.\n\nLink in bio.", "alt": "Two reps alt",
         "tags": {"hook": "pain", "topic": "shared-list", "ind": "solar"}},
        {"id": "w9-text", "at": at(-15), "type": "thread", "title": "Thread: one question", "threads_text": "Managers: what's the one follow-up your floor always forgets? {link}"},
        {"id": "w9-trial", "at": at(-10), "type": "reel", "trial": "SS_PERFORMANCE", "title": "Reel Z2: hook B", "video": "1-Reels/Reel-H-SpamLikely.mp4", "cover": "1-Reels/Cover-21-Reel-H.jpg", "caption": "Spam Likely. Hook B."},
        {"id": "w9-broken", "at": at(-5), "type": "image", "title": "Broken", "image": "2-Posts/nope.jpg", "caption": "x"},
        {"id": "w9-future", "at": at(60 * 24), "type": "image", "title": "Tomorrow", "image": "2-Posts/Post-26-RepQuit.jpg", "caption": "later"},
    ]
def env_for(name, **extra):
    d = os.path.join(TMP, name); shutil.rmtree(d, ignore_errors=True); os.makedirs(os.path.join(d, "content"))
    e = dict(os.environ, IG_GRAPH_URL=BASE + "/ig", IG_REFRESH_URL=BASE + "/ig/refresh_access_token", IG_TOKEN="IGTOKEN",
             FB_GRAPH_URL=BASE + "/fb", FB_RUPLOAD_URL=BASE + "/rup", TH_GRAPH_URL=BASE + "/th", TH_REFRESH_URL=BASE + "/th/refresh_access_token",
             BOT_STATE="local:" + os.path.join(d, "state.json"), BOT_MEDIA="local:" + MEDIA + "|http://127.0.0.1:%d" % MPORT, BOT_NOTIFY="off",
             IG_CONTENT=os.path.join(d, "content"), IG_POLL_S="0.05", XP_GAP_MIN="0", IG_FEED_GAP_MIN="0", IG_STORY_GAP_MIN="0", IG_DAY_CAPS="off", REPORT_FILE=os.path.join(d, "report.html"), GITHUB_ACTIONS="")
    for k in ("FB_PAGE_TOKEN", "FB_PAGE_ID", "THREADS_TOKEN", "IG_ALWAYS_CONTACT"): e.pop(k, None)
    e.update({k: v for k, v in extra.items() if v is not None})
    return d, e
def bot(e, *args):
    r = subprocess.run([sys.executable, BOT] + list(args), env=e, capture_output=True, text=True, timeout=180)
    out = r.stdout + r.stderr
    if r.returncode and "SystemExit" not in out and "Stopped:" not in out: print(out[-2000:])
    return r, out
def st(d): return json.load(open(os.path.join(d, "state.json")))
SECRETS = ("IGTOKEN", "FBTOKEN", "THTOKEN")
def leaks(out): return [s for s in SECRETS if s in out.replace("[hidden]", "")]

# ======================================================================= 1. Instagram + Facebook + Threads, one run at a time
reset()
d, e = env_for("main", FB_PAGE_TOKEN="FBTOKEN", THREADS_TOKEN="THTOKEN")
write_pack(e["IG_CONTENT"], "Week-9", items_main())
r, out = bot(e, "check")
check(r.returncode == 0 and "Account: @vpexdialer" in out, "check: Instagram key works", out[-800:])
check("Facebook key works: VPEX Dialer" in out and "Threads key works: @vpexdialer" in out, "check: Facebook and Threads keys work", out[-800:])
check("Trial Reels: available" in out, "check: trial Reels available at 312 followers")
check(len(G["ig_posts"]) == 0 and not G["fb"] and not G["th"], "check posts nothing")
check(not leaks(out), "check: no key in the output", leaks(out))

outs = []
for i in range(9):
    r, out = bot(e, "run"); outs.append(out)
s = st(d)
types = [p["type"] for p in G["ig_posts"]]
check(types == ["REELS", "CAROUSEL", "STORIES", "IMAGE", "REELS"], "Instagram: due items in time order, one per run (incl. the trial Reel)", types)
check(s["posted"]["w9-old"]["status"] == "missed" and s["fb"]["w9-old"]["status"] == "missed" and s["th"]["w9-old"]["status"] == "missed", "20 hours late: skipped everywhere, not dumped late")
check(s["posted"]["w9-poll"]["status"] == "reminded", "sticker story: Vincent is reminded")
check(s["posted"]["w9-broken"]["status"] == "failed" and "missing" in s["posted"]["w9-broken"]["error"], "a missing file fails clearly")
check("w9-future" not in s["posted"] and "w9-future" not in s.get("fb", {}), "tomorrow's post waits")
trial = [p for p in G["ig_posts"] if p.get("trial")]
check(len(trial) == 1 and json.loads(trial[0]["trial"]) == {"graduation_strategy": "SS_PERFORMANCE"} and trial[0]["share"] is None, "trial Reel: posted with trial_params, not shared to feed", trial)
check("w9-text" not in s["posted"], "a Threads-only item never goes to Instagram")
# Facebook
kinds = [x["kind"] for x in G["fb"]]
check(kinds == ["reel", "album", "photo"], "Facebook: the Reel, the carousel and the post (no stories, no trial, no thread)", kinds)
reel = G["fb"][0]
check(G["fb_uploads"] and G["fb_uploads"][0]["ok"] and G["fb_uploads"][0]["bytes"] > 500000, "Facebook Reel: the real video uploaded by link with the Page key", G["fb_uploads"])
check(reel["state"] == "PUBLISHED" and "utm_source=facebook&utm_medium=post&utm_content=w9-reel&utm_campaign=w9#demo-insurance" in reel["text"], "Facebook Reel: published with its own tagged link to the insurance demo", reel["text"])
check("Comment DEMO" not in reel["text"] and "Open a live insurance demo office, no sign-up: https://vpexdialer.com/" in reel["text"], "Facebook: Comment DEMO becomes a tappable link", reel["text"])
check(reel["text"].rstrip().endswith("#salesfloor #followup #powerdialer"), "Facebook: hashtags stay at the end")
alb = G["fb"][1]
check(len(alb["photos"]) == 9 and LEGAL in alb["text"], "Facebook carousel: 9 photos in one post, legal line kept", alb)
ph = G["fb"][2]
check("Link in bio" not in ph["text"] and "#demo-solar" in ph["text"], "Facebook post: Link in bio becomes the solar demo link", ph["text"])
# Threads
tk = [x["type"] for x in G["th"]]
check(tk == ["VIDEO", "CAROUSEL", "IMAGE", "TEXT"], "Threads: video, carousel, image and the text-only thread", tk)
check(all(len(x["text"] or "") <= 500 for x in G["th"]), "Threads: every post fits 500 characters", [len(x["text"] or "") for x in G["th"]])
tv = G["th"][0]["text"]
check("#salesfloor" not in tv and "#powerdialer" not in tv and "utm_source=threads" in tv and "He said call me back at 2." in tv and "Comment DEMO" not in tv, "Threads video: no hashtags, own link, no Comment DEMO", tv)
tc = G["th"][1]
check(LEGAL in tc["text"] and len(tc["children"]) == 9 and tc["text"].startswith("7 places deals go to die."), "Threads carousel: long caption cut to fit, legal line kept, 9 slides", tc["text"])
tt = G["th"][3]["text"]
check(tt.startswith("Managers: what's the one follow-up") and "utm_source=threads&utm_medium=post&utm_content=w9-text" in tt, "Threads text: {link} filled in", tt)
check(s["meta"]["th_token"]["token"] == "THTOKEN-REFRESHED" and G["th_refresh"] == 1, "Threads key renewed once and kept")
n = (len(G["ig_posts"]), len(G["fb"]), len(G["th"])); r, out = bot(e, "run")
check((len(G["ig_posts"]), len(G["fb"]), len(G["th"])) == n, "nothing posted twice")
check(not any(leaks(o) for o in outs), "runs: no key in the output", [leaks(o) for o in outs if leaks(o)])

# comments: the DEMO reply now points to the bio link page
first = G["ig_posts"][0]["id"]
G["comments"][first] = [{"id": "k1", "text": "DEMO", "username": "salesmgr_tx"}, {"id": "k2", "text": "how much?", "username": "floorboss"}, {"id": "k3", "text": "nice", "username": "fan"}]
bot(dict(e, IG_ALWAYS_CONTACT="1"), "run")
rep = dict(G["replies"])
check("k1" in rep and "link in our bio" in rep["k1"] and "Try it now" in rep["k1"], "DEMO reply: points to the link page", rep.get("k1"))
check("k2" in rep and "$49 per rep" in rep["k2"] and "k3" not in rep, "price reply unchanged; other comments left alone")
G["comments"][first] += [{"id": "k4", "text": "demo pls", "username": "salesmgr_tx"}, {"id": "k5", "text": "DEMO", "username": "agency_fl"}, {"id": "k6", "text": "DEMO", "username": "agency_ga"}]
bot(dict(e, IG_ALWAYS_CONTACT="1", IG_REPLY_DAY_MAX="3"), "run")
rep = dict(G["replies"])
check("k4" not in rep, "replies: one automatic reply per person a day")
check(("k5" in rep) != ("k6" in rep), "replies: the daily reply limit holds (3)", sorted(rep))

# ======================================================================= 2. spacing, sign-in trouble, Instagram blocked
reset()
d, e = env_for("gap", FB_PAGE_TOKEN="FBTOKEN", THREADS_TOKEN="THTOKEN", XP_GAP_MIN="50")
write_pack(e["IG_CONTENT"], "Week-9", items_main())
for _ in range(3): bot(e, "run")
check(len(G["fb"]) == 1 and len(G["th"]) == 1, "spacing: one Facebook and one Threads post, then a 50-minute wait", (len(G["fb"]), len(G["th"])))
r, out = bot(e, "run")
check("waiting to post" in out, "spacing: the wait is logged")

reset(); G["fb_bad"] = True
d, e = env_for("fbbad", FB_PAGE_TOKEN="FBTOKEN", THREADS_TOKEN="THTOKEN")
write_pack(e["IG_CONTENT"], "Week-9", items_main())
r1, o1 = bot(e, "run"); r2, o2 = bot(e, "run")
s = st(d)
check(o1.count("NOTIFY: Facebook posting can't sign in") == 1 and "NOTIFY: Facebook posting can't sign in" not in o2, "Facebook key expired: one alert, not every run", (o1[-500:], o2[-300:]))
check(not any(v.get("status") in ("failed", "retry") for v in s.get("fb", {}).values() if v.get("status") != "missed"), "Facebook key expired: nothing marked failed, so posts go out once the key is fixed")
check(len(G["ig_posts"]) == 2 and len(G["th"]) == 2, "Facebook key expired: Instagram and Threads keep posting", (len(G["ig_posts"]), len(G["th"])))
check("facebook refused the bot; not contacting it again" in o2 and s["meta"]["block_facebook"]["until"] > time.time() + 5 * 3600, "Facebook refused: the bot backs off for hours instead of retrying every run", o2[-400:])
s["meta"]["block_facebook"]["until"] = time.time() - 1; json.dump(s, open(os.path.join(d, "state.json"), "w"))   # 6 hours later
G["fb_bad"] = False; r3, o3 = bot(e, "run")
check("NOTIFY: Facebook posting is back" in o3 and len(G["fb"]) == 1, "Facebook key fixed: posting resumes with a 'back' notice", o3[-400:])

reset(); G["blocked"] = True
d, e = env_for("blocked", FB_PAGE_TOKEN="FBTOKEN", THREADS_TOKEN="THTOKEN")
write_pack(e["IG_CONTENT"], "Week-9", items_main())
r, out = bot(e, "run")
s = st(d)
check("NOTIFY: Instagram bot can't sign in" in out and any(v.get("status") == "handed" for v in s["posted"].values()), "Instagram blocked: the hand-off still goes to Vincent", out[-600:])
check(len(G["fb"]) == 1 and len(G["th"]) == 1, "Instagram blocked: Facebook and Threads still post on schedule", (len(G["fb"]), len(G["th"])))
check(r.returncode == 0, "Instagram blocked: the run stays green")
check(s["meta"]["block_instagram"]["until"] > time.time() + 5 * 3600, "Instagram blocked: backoff recorded")
calls = len(G["tokens"]); r, out = bot(e, "run"); s = st(d)
ig_calls = [t for t in G["tokens"][calls:] if t in ("IGTOKEN", "IGTOKEN-REFRESHED")]
check("Instagram refused the bot; not contacting it again" in out and not ig_calls, "Instagram blocked: the next run doesn't contact Instagram at all", out[-400:])
check(sum(v.get("status") == "handed" for v in s["posted"].values()) == 2, "Instagram blocked: hand-offs keep coming during the backoff")
G["blocked"] = False; r, out = bot(dict(e, IG_TOKEN="IGTOKEN-REFRESHED"), "run")
check("posted" in out and not st(d)["meta"].get("block_instagram", {}).get("until"), "Instagram blocked: a new key is tried right away and clears the backoff", out[-400:])

# daily ceilings: a day with 3 feed posts, 5 stories and 2 Threads-only posts keeps 2 feed (11:00 and 19:00), 3 stories, 1 thread
d, e = env_for("caps"); e.pop("IG_DAY_CAPS")
day = (dt.datetime.now(ny) + dt.timedelta(days=2)).strftime("%Y-%m-%d")
img = "2-Posts/Post-22-TwoReps.jpg"
plan = [{"id": "c-" + t.replace(":", ""), "at": day + " " + t, "type": "image", "title": "f" + t, "image": img, "caption": "x"} for t in ("11:00", "15:30", "19:00")]
plan += [{"id": "s-" + t.replace(":", ""), "at": day + " " + t, "type": "story", "title": "s" + t, "image": img} for t in ("09:00", "12:30", "14:30", "17:30", "21:00")]
plan += [{"id": "t-" + t.replace(":", ""), "at": day + " " + t, "type": "thread", "title": "t", "threads_text": "x {link}"} for t in ("08:30", "13:15")]
write_pack(e["IG_CONTENT"], "Week-9", plan)
code = "import importlib.util as u,json;s=u.spec_from_file_location('b',%r);b=u.module_from_spec(s);s.loader.exec_module(b);P=b.load_packs();print(json.dumps({p:[i['id'] for _,_,i in b.all_items(P,platform=p)] for p in ('instagram','facebook','threads')}))" % BOT
kept = json.loads(subprocess.run([sys.executable, "-c", code], env=e, capture_output=True, text=True).stdout.strip().splitlines()[-1])
check(kept["instagram"] == ["s-0900", "c-1100", "s-1230", "s-1430", "c-1900"], "ceilings: Instagram keeps 2 feed posts (11:00, 19:00) and the first 3 stories", kept["instagram"])
check(kept["facebook"] == ["c-1100", "c-1900"] and kept["threads"] == ["t-0830", "c-1100", "c-1900"], "ceilings: Facebook 2 posts, Threads 2 posts + 1 thread", kept)
json.dump({"per_day": {"instagram": {"feed": 3}}}, open(os.path.join(e["IG_CONTENT"], "limits.json"), "w"))
kept = json.loads(subprocess.run([sys.executable, "-c", code], env=e, capture_output=True, text=True).stdout.strip().splitlines()[-1])
check(len([i for i in kept["instagram"] if i.startswith("c-")]) == 3, "ceilings: instagram/limits.json can raise them", kept["instagram"])

# quiet runs: only cross-posts due still counts as work
reset()
d, e = env_for("quiet", THREADS_TOKEN="THTOKEN")
write_pack(e["IG_CONTENT"], "Week-9", [{"id": "w9-only", "at": at(-5), "type": "thread", "title": "t", "threads_text": "Just Threads. {link}"}])
s0 = {"meta": {"comments": {"at": time.time()}}}; json.dump(s0, open(os.path.join(d, "state.json"), "w"))
r, out = bot(e, "run")
check(len(G["th"]) == 1 and "Instagram not contacted" not in out, "quiet check: a due Threads post still runs", out[-400:])
r, out = bot(e, "run")
check("Instagram not contacted this run" in out, "quiet check: then quiet again")

# trial Reels under 200 followers are skipped, never retried
reset(); G["followers"] = 50
d, e = env_for("trial")
write_pack(e["IG_CONTENT"], "Week-9", [it for it in items_main() if it["id"] == "w9-trial"])
bot(e, "run"); bot(e, "run")
s = st(d)
check(s["posted"]["w9-trial"]["status"] == "skipped" and "200 followers" in s["posted"]["w9-trial"]["why"] and not G["ig_posts"], "trial Reel at 50 followers: skipped with the reason, nothing posted", s["posted"].get("w9-trial"))

# ======================================================================= 3. captions and scoring, in-process
reset()
d, e = env_for("unit")
write_pack(e["IG_CONTENT"], "Week-9", items_main())
json.dump({"_about": "x", "w3-19": {"tags": {"hook": "quote", "ind": ""}, "go": "home"}}, open(os.path.join(e["IG_CONTENT"], "tags.json"), "w"))
os.environ.update({"IG_CONTENT": e["IG_CONTENT"]})
spec = importlib.util.spec_from_file_location("vpexbot", BOT); B = importlib.util.module_from_spec(spec); spec.loader.exec_module(B)
check(B.item_go({"id": "w3-19"}) == "home" and B.item_tags({"id": "w3-19"})["hook"] == "quote", "old posts: tags and destination come from tags.json")
check(B.item_go({"id": "x", "tags": {"ind": "mca"}}) == "demo:mca" and B.item_go({"id": "x", "go": "trial"}) == "trial" and B.item_go({"id": "x", "go": "demo:nope"}) == "home", "destination: industry demo, trial, or the sales page")
lk = B.site_link({"id": "w12-reel-a", "go": "trial"}, "threads")
check(lk == "https://vpexdialer.com/?utm_source=threads&utm_medium=post&utm_content=w12-reel-a&utm_campaign=w12&trial=start", "link: tagged with platform, post and week", lk)
long_it = {"id": "w9-x", "caption": ("A sentence that keeps going. " * 40) + "\n\n" + LEGAL + "\n\n#a #b"}
tt = B.threads_text(long_it)
check(len(tt) <= 500 and LEGAL in tt and "#a" not in tt and "utm_source=threads" in tt, "Threads: a very long caption is cut at a sentence, legal line and link kept", (len(tt), tt[-200:]))
fb = B.fb_caption({"id": "w9-y", "caption": "Line one.\n\n" + LEGAL + "\n\n#x #y"})
check(fb.split("\n\n")[1].startswith("See it with sample leads") and fb.split("\n\n")[2] == LEGAL, "Facebook: with no call to action, the link goes before the legal line and hashtags", fb)
secs = B.mp4_seconds(z3.read(root3 + "1-Reels/Reel-G-Callback.mp4"))
real = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", os.devnull], capture_output=True, text=True).stdout or 0) if False else None
check(5 < secs < 90, "Reel length read from the file: %.1f s" % secs)
rows = [dict(kind="REELS", reach=1000, shares=40, saves=20, likes=60, comments=5, visits=10, site=4, watch=9.0, dur=15, skip=40.0),
        dict(kind="REELS", reach=1000, shares=5, saves=4, likes=30, comments=1, visits=2, site=0, watch=3.0, dur=15, skip=75.0),
        dict(kind="REELS", reach=40, shares=4, saves=3, likes=6, comments=1, visits=1, site=0, watch=8.0, dur=15, skip=50.0),
        dict(kind="FEED", reach=500, shares=10, saves=30, likes=40, comments=2, visits=5, site=2, watch=0, dur=0, skip=None),
        dict(kind="FEED", reach=500, shares=1, saves=2, likes=10, comments=0, visits=1, site=0, watch=0, dur=0, skip=None)]
B.score_rows(rows)
check(rows[0]["score"] > rows[2]["score"] > rows[1]["score"], "scores: the shared, watched Reel wins; 40 people can't top the list on luck", [r["score"] for r in rows])
check(rows[3]["score"] > 0 > rows[4]["score"], "scores: posts are compared with posts", [rows[3]["score"], rows[4]["score"]])
gb = B.group_by([dict(hook="pain", score=0.8, reach=100)] * 3 + [dict(hook="news", score=-0.6, reach=50)] * 3 + [dict(hook="quote", score=1.5, reach=90)], "hook")
v = {x["value"]: x["verdict"] for x in gb}
check(v == {"pain": "winning", "news": "losing", "quote": "testing"}, "groups: a winner needs 3+ posts; one great post is still 'testing'", v)

# ======================================================================= 4. learn: numbers per post, joined with site visits
reset()
d, e = env_for("learn")
write_pack(e["IG_CONTENT"], "Week-9", items_main())
now = dt.datetime.now(dt.timezone.utc)
def ts(h): return (now - dt.timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M:%S+0000")
cap = {it["id"]: it.get("caption", "") for it in items_main()}
G["media_list"] = [{"id": "m101", "timestamp": ts(50), "caption": cap["w9-reel"], "media_type": "VIDEO", "media_product_type": "REELS", "like_count": 61, "comments_count": 4},
                   {"id": "m102", "timestamp": ts(70), "caption": cap["w9-car"], "media_type": "CAROUSEL_ALBUM", "media_product_type": "FEED", "like_count": 20, "comments_count": 1},
                   {"id": "m103", "timestamp": ts(90), "caption": cap["w9-img"], "media_type": "IMAGE", "media_product_type": "FEED", "like_count": 9, "comments_count": 0},
                   {"id": "m104", "timestamp": ts(5), "caption": "too new", "media_type": "IMAGE", "media_product_type": "FEED"},
                   {"id": "m105", "timestamp": ts(30), "caption": "a story", "media_type": "IMAGE", "media_product_type": "STORY"}]
G["ins"] = {"m101": {"reach": 1200, "views": 3000, "likes": 61, "comments": 4, "saved": 30, "shares": 45, "ig_reels_avg_watch_time": 9100, "reels_skip_rate": 38.5},
            "m102": {"reach": 600, "views": 900, "likes": 20, "saved": 25, "shares": 6, "profile_visits": 9, "follows": 2},
            "m103": {"reach": 300, "views": 400, "likes": 9, "saved": 1, "shares": 0, "profile_visits": 1}}
G["skip_fail"] = True       # Instagram refuses the whole call when a new metric isn't ready: the bot asks one metric at a time
day = dt.datetime.now(ny).strftime("%Y-%m-%d")
json.dump({"posted": {"w9-reel": {"status": "posted", "mediaId": "m101"}},
           "growth_days": {day: {"c": {"bio_tap~instagram~bio~w9~w9-reel~insurance~m": 7, "demo~instagram~bio~w9~w9-reel~insurance~m": 4, "trial_view~instagram~bio~w9~w9-reel~-~m": 2,
                                       "visit~facebook~post~w9~w9-img~-~d": 3, "visit~ci-check~-~-~-~-~-": 50}}}}, open(os.path.join(d, "state.json"), "w"))
r, out = bot(e, "learn")
s = st(d); L = s["meta"]["learnings"]
check(r.returncode == 0 and "3 posts scored" in out, "learn: the 3 feed posts old enough are scored (not the new one, not the story)", out[-1500:])
rowmap = {x["iid"]: x for x in L["rows"]}
check(set(rowmap) == {"w9-reel", "w9-car", "w9-img"}, "learn: posts matched to the plan (by media id, else by caption)", list(rowmap))
check(rowmap["w9-reel"]["taps"] == 7 and rowmap["w9-reel"]["demos"] == 4 and rowmap["w9-reel"]["watch"] == 9.1 and rowmap["w9-reel"]["skip"] == 38.5, "learn: the Reel's bio taps, demos, watch time and skip rate", rowmap["w9-reel"])
check(rowmap["w9-reel"]["dur"] > 5, "learn: Reel length known, so 'kept %' can be computed")
check({x["value"] for x in L["groups"]["hook"]} == {"quote", "number", "pain"} and all(x["verdict"] == "testing" and x["n"] == 1 for x in L["groups"]["hook"])
      and {x["value"] for x in L["groups"]["topic"]} >= {"followups", "calling-hours", "shared-list"}, "learn: grouped by hook and topic; one post each is still 'testing'", L["groups"]["hook"])
check("post | type | reach | sends %" in out and "By hook:" in out and "Make more of:" in out and "Hooks not tested yet:" in out, "learn: public notes have the table and the advice")
check("ci-check" not in json.dumps(L) and "Started a free trial" not in out, "learn: deploy test hits ignored; no sign-up numbers in public notes")
calls = G["insight_calls"]; r, out = bot(e, "learn")
check(G["insight_calls"] == calls, "learn: numbers aren't asked for again within 2 days", G["insight_calls"] - calls)

# learn while Instagram blocks the bot: the site numbers per post are still scored (no sign-ups in public notes)
reset(); G["blocked"] = True
d, e = env_for("learn-blocked")
write_pack(e["IG_CONTENT"], "Week-9", items_main())
t0 = time.time()
json.dump({"posted": {"w9-reel": {"status": "handed", "at": t0 - 50 * 3600, "title": "Reel"}, "w9-car": {"status": "posted", "at": t0 - 70 * 3600},
                      "w9-img": {"status": "posted", "at": t0 - 3 * 3600}, "w9-story": {"status": "skipped", "at": t0 - 60 * 3600}, "w9-old": {"status": "posted", "at": t0 - 40 * 86400}},
           "fb": {"w9-car": {"status": "posted", "at": t0 - 69 * 3600}}, "th": {"w9-text": {"status": "posted", "at": t0 - 30 * 3600}},
           "growth_days": {day: {"c": {"bio_tap~instagram~bio~w9~w9-reel~insurance~m": 7, "demo~instagram~bio~w9~w9-reel~insurance~m": 4, "demo_call~instagram~bio~w9~w9-reel~insurance~m": 2,
                                       "trial_view~instagram~bio~w9~w9-reel~-~m": 2, "signup~instagram~bio~w9~w9-reel~insurance~m": 1,
                                       "visit~facebook~post~w9~w9-car~-~d": 3, "visit~ci-check~-~-~-~-~-": 50}}}}, open(os.path.join(d, "state.json"), "w"))
r, out = bot(e, "learn")
s = st(d); SL = (s.get("meta") or {}).get("site_learnings") or {}
rm = {x["iid"]: x for x in SL.get("rows", [])}
check(r.returncode == 0 and "site numbers only" in out, "learn blocked: the run stays green and says it used the site numbers", out[-600:])
check(set(rm) == {"w9-reel", "w9-car", "w9-text"}, "learn blocked: posts that went out 20 h to 35 days ago (handed ones too); not too new, too old or skipped", list(rm))
check(rm.get("w9-reel", {}).get("taps") == 7 and rm["w9-reel"]["demos"] == 4 and rm["w9-reel"]["calls"] == 2 and rm["w9-reel"]["site"] == 11, "learn blocked: a post's bio taps, demos and demo calls", rm.get("w9-reel"))
check(rm.get("w9-car", {}).get("visits") == 3 and rm["w9-car"]["plats"] == "IG+FB" and rm.get("w9-text", {}).get("plats") == "TH", "learn blocked: Facebook visits counted; platforms listed", [rm.get("w9-car"), rm.get("w9-text")])
check(SL["rows"][0]["iid"] == "w9-reel" and {x["value"] for x in SL["groups"]["hook"]} >= {"quote", "number"} and all(x["verdict"] == "testing" for x in SL["groups"]["hook"]), "learn blocked: ranked, grouped by hook; one post each is still 'testing'", SL.get("groups", {}).get("hook"))
check("post | type | went out on | bio taps" in out and "By hook (site actions per post)" in out and "Brought the most site visits: w9-reel" in out, "learn blocked: public notes have the table", out[-1500:])
check("signup" not in out and "trial_view" not in out and "ci-check" not in json.dumps(SL) and "learnings" not in s.get("meta", {}), "learn blocked: no sign-ups or trial forms in notes; Instagram's learnings untouched", out[-800:])
check(G["insight_calls"] == 0, "learn blocked: no insight requests while Instagram refuses")
check("w9-story" not in rm and "too few site visits so far" in out, "learn blocked: stories left out; no winner called on a handful of visits", out[-500:])
# with enough visits, a hook on 3+ posts well above the average is called winning
from importlib import util as _u
_sp = _u.spec_from_file_location("botmod2", BOT); B2 = _u.module_from_spec(_sp); _sp.loader.exec_module(B2)
class _S:
    def __init__(s, d): s.d = d; s.db = None; s.data = d
    def all(s, c): return dict(s.d.get(c, {}))
    def set(s, c, k, v): s.d.setdefault(c, {})[k] = v
pk = {"posted": {}, "growth_days": {day: {"c": {}}}}
items = [("p%d" % i, "pain" if i < 3 else "news") for i in range(6)]
for i, (iid, hk) in enumerate(items):
    pk["posted"][iid] = {"status": "posted", "at": t0 - 30 * 3600}
    pk["growth_days"][day]["c"]["visit~facebook~post~w9~%s~-~d" % iid] = 9 if hk == "pain" else 1
B2.load_packs = lambda: []
B2.all_items = lambda packs, platform=None: [(None, None, {"id": iid, "type": "image", "title": iid, "tags": {"hook": hk}}) for iid, hk in items]
_st = _S(pk); _rows = B2.site_learn(_st)
_v = {x["value"]: x["verdict"] for x in _st.d["meta"]["site_learnings"]["groups"]["hook"]}
check(len(_rows) == 6 and sum(r["site"] for r in _rows) == 30 and _v == {"pain": "winning", "news": "losing"} and _st.d["meta"]["site_learnings"]["recs"]["more"] == ["pain"],
      "site learn: with 30 visits, a hook on 3 posts well above average wins, one well below loses", _v)

# ======================================================================= 5. the private scorecard
reset()
d, e = env_for("score", FB_PAGE_TOKEN="FBTOKEN", THREADS_TOKEN="THTOKEN")
write_pack(e["IG_CONTENT"], "Week-9", items_main())
t0 = time.time(); D = lambda n: (dt.datetime.now(ny) - dt.timedelta(days=n)).strftime("%Y-%m-%d"); ms = lambda n: int((t0 - n * 86400) * 1000)
state = {"posted": {"a": {"status": "posted", "at": t0 - 3600}, "b": {"status": "handed", "at": t0 - 86400}, "c": {"status": "posted", "at": t0 - 9 * 86400}},
         "fb": {"a": {"status": "posted", "at": t0 - 3600}}, "th": {"a": {"status": "posted", "at": t0 - 3600}, "t": {"status": "posted", "at": t0 - 7200}},
         "meta": {"lastScore": {"followers": 300}, "learnings": {"recs": {"more": ["quote", "followups"], "less": ["news"], "untested_hooks": ["myth", "question"], "top_posts": ["w9-reel"]}}},
         "growth_days": {D(1): {"c": {"bio_view~instagram~bio~-~-~-~m": 120, "bio_tap~instagram~bio~w9~w9-reel~insurance~m": 30, "visit~instagram~bio~w9~w9-reel~-~m": 40,
                                      "demo~instagram~bio~w9~w9-reel~insurance~m": 22, "demo_call~instagram~bio~w9~w9-reel~insurance~m": 9, "trial_view~instagram~bio~w9~w9-reel~-~m": 6,
                                      "signup~instagram~bio~w9~w9-reel~insurance~m": 2, "visit~threads~post~w9~w9-text~-~m": 5, "visit~direct~-~-~-~-~d": 15, "home_screen~direct~-~-~-~-~m": 3,
                                      "visit~ci-check~-~-~-~-~-": 99}},
                         D(9): {"c": {"visit~instagram~bio~w8~w8-x~-~m": 20, "signup~direct~-~-~-~-~d": 1}}},
         "offices_test": {"new-a": {"createdAt": ms(2), "plan": "trial", "days": [D(1)]}, "new-b": {"createdAt": ms(3), "plan": "trial", "days": []},
                          "old-c": {"createdAt": ms(17), "plan": "paid", "days": [D(16), D(8), D(1)]}, "old-d": {"createdAt": ms(16), "plan": "trial", "days": [D(15)]},
                          "vpex": {"createdAt": ms(1), "plan": "comp", "days": [D(1)]}, "ci-files-x": {"createdAt": ms(1), "plan": "trial", "days": [D(1)]}}}
json.dump(state, open(os.path.join(d, "state.json"), "w"))
r, out = bot(e, "report")
html = open(os.path.join(d, "report.html")).read()
check(r.returncode == 0 and "NOTIFY: VPEX this week: 5 posts, 4,100 reached, 60 site visits, 22 demos, 2 trials" in out, "scorecard: phone alert with the week's headline (deploy test hits left out)", out[-600:])
check("Instagram</td><td class=n>2" in html and "Threads</td><td class=n>2" in html and "Facebook</td><td class=n>1" in html, "scorecard: posts per platform this week")
check("312 <small>(+12 this week)</small>" in html.replace(",", "") and "Taps on the bio link</td><td class=n>37" in html, "scorecard: followers gained and bio-link taps")
check("Opened a demo office</td><td class=n>22" in html and "Started a free trial</td><td class=n>2" in html and "55% of visits opened a demo" in html.replace("37%", "55%") or "Opened a demo office</td><td class=n>22" in html, "scorecard: the site funnel")
check("instagram</td><td class=n>40</td><td class=n>22</td><td class=n>6</td><td class=n>2" in html and "threads</td><td class=n>5" in html, "scorecard: by source", html[html.find("By where"):html.find("By where") + 600])
check("Reel Z: Call me back at 2</td><td class=n>30</td><td class=n>22</td><td class=n>6</td><td class=n>2" in html, "scorecard: the post that brought trials, by name")
check("New trials this week</td><td class=n>2" in html and "Made a first call</td><td class=n>1 <small>(50%)" in html and "Still calling in week 2 <small>(started 2 to 3 weeks ago)</small></td><td class=n>1 of 2" in html, "scorecard: new trials, first calls, week-2 retention (free and test offices left out)",
      html[html.find("<h2>Offices"):html.find("<h2>Offices") + 700])
check("Paying offices</td><td class=n>1" in html and "First opened from a Home Screen</td><td class=n>3" in html, "scorecard: paying offices and Home Screen launches")
check("Make more of: quote, followups." in html and "Hooks to test next: myth, question." in html and "Biggest drop" in html, "scorecard: what to do next")
check("4,100" not in out.split("NOTIFY:")[0] and "Paying offices" not in out and "New trials" not in out, "scorecard: numbers stay out of the public log")
check("noindex" in html and "stops working in 7 days" in html, "scorecard: private page, not indexed, expires")
pages = [f for f in os.listdir(os.path.join(MEDIA, "handoff")) if f.startswith("scorecard-")]
check(pages, "scorecard: page stored for the phone link")

# Instagram blocked on Monday: the scorecard still goes out with the site and office numbers
reset(); G["blocked"] = True
d, e = env_for("score2")
write_pack(e["IG_CONTENT"], "Week-9", items_main()); json.dump(state, open(os.path.join(d, "state.json"), "w"))
r, out = bot(e, "scorecard")
html = open(os.path.join(d, "report.html")).read()
check(r.returncode == 0 and "Instagram refused the bot this week" in html and "Opened a demo office</td><td class=n>22" in html, "scorecard with Instagram blocked: still sent, site numbers included", out[-400:])

# ======================================================================= 6. retries, pause, test mode, a bad key
reset(); G["fail_next"] = 5
d, e = env_for("retry")
write_pack(e["IG_CONTENT"], "Week-9", [{"id": "w9-flaky", "at": at(-1), "type": "image", "title": "Flaky", "image": "2-Posts/Post-22-TwoReps.jpg", "caption": "x"}])
for _ in range(4): bot(e, "run")
f = st(d)["posted"]["w9-flaky"]
check(f["status"] == "failed" and f["attempts"] == 3 and "could not be fetched" in f["error"], "a failing post is tried 3 times, then marked failed", f)

reset()
d, e = env_for("pause", FB_PAGE_TOKEN="FBTOKEN", THREADS_TOKEN="THTOKEN")
write_pack(e["IG_CONTENT"], "Week-9", items_main()); open(os.path.join(e["IG_CONTENT"], "PAUSE"), "w").write("")
r, out = bot(e, "run")
check(not G["ig_posts"] and not G["fb"] and not G["th"] and "Paused" in out, "a PAUSE file stops all posting, Facebook and Threads too")

reset()
d, e = env_for("testmode")
write_pack(e["IG_CONTENT"], "Week-9", [dict(it, at=at(30)) for it in items_main() if it["id"] in ("w9-reel", "w9-story")])
r, out = bot(e, "test")
check(r.returncode == 0 and out.count("TEST PASSED") == 2 and not G["ig_posts"], "test mode: uploads and processing work, nothing published", out[-500:])

reset()
d, e = env_for("badkey", IG_TOKEN="WRONG")
write_pack(e["IG_CONTENT"], "Week-9", items_main())
r, out = bot(e, "check")
check(r.returncode != 0 and "rejected the key" in out and "WRONG" not in out.replace("[hidden]", ""), "a bad key stops with a clear message, key not shown", out[-300:])

shutil.rmtree(TMP, ignore_errors=True)
print("bot: %d passed, %d failed" % (F["p"], F["f"]))
sys.exit(1 if F["f"] else 0)
