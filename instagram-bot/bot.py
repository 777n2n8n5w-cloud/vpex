#!/usr/bin/env python3
"""VPEX Instagram bot.

Runs on GitHub every 15 minutes (see .github/workflows/vpex-instagram.yml):
  run     post whatever the plan says is due, answer DEMO and price comments, remind Vincent about sticker stories
  report  Monday report: reach, saves, shares, follows, what worked; posted as a GitHub issue and sent as a notification
  check   test the Instagram key and show the account, the plan and what's next (changes nothing)

Content lives in content packs under instagram/: a folder or a .zip holding plan.json plus the media it names.
State (what's posted, which comments were answered, the refreshed Instagram key) lives in Firestore under igBot/,
which no app user can read. Media go to Instagram through short-lived private links from a Google Cloud bucket.
"""
import os, sys, json, time, re, hashlib, zipfile, io, datetime as dt, mimetypes, traceback, secrets
from zoneinfo import ZoneInfo
import requests

GRAPH = os.environ.get("IG_GRAPH_URL", "https://graph.instagram.com/" + os.environ.get("IG_API_VERSION", "v23.0")).rstrip("/")
REFRESH_URL = os.environ.get("IG_REFRESH_URL", "https://graph.instagram.com/refresh_access_token")
PROJECT = os.environ.get("PROJECT", "dovetail-f863c")
OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "vincent@dovetail-f863c.firebaseapp.com")
CONTENT_DIR = os.environ.get("IG_CONTENT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "instagram"))
FEED_GRACE_H = float(os.environ.get("IG_FEED_GRACE_H", "12"))   # a feed post more than this late is skipped, not dumped late
STORY_GRACE_H = float(os.environ.get("IG_STORY_GRACE_H", "3"))
# never post in bursts (5 posts in 20 minutes reached 4-8 people each): after an outage, catch up with this much space
FEED_GAP_MIN = float(os.environ.get("IG_FEED_GAP_MIN", "120"))
STORY_GAP_MIN = float(os.environ.get("IG_STORY_GAP_MIN", "60"))
MAX_ATTEMPTS = 3
SITE = "vpexdialer.com"

# Keys never reach the logs (the repo is public): known keys are masked, and any access_token in a URL is hidden.
SECRETS = set()
OUT = []
def scrub(s):
    s = re.sub(r"(access_token=)[^&\s'\"]+", r"\1[hidden]", str(s))
    for t in SECRETS:
        if t and len(t) > 8: s = s.replace(t, "[hidden]")
    return s
def keep_secret(t):
    if not t or t in SECRETS: return
    SECRETS.add(t)
    if os.environ.get("GITHUB_ACTIONS") == "true": print("::add-mask::" + t, flush=True)
def log(*a):
    line = scrub(" ".join(str(x) for x in a)); OUT.append(line); print(line, flush=True)
def gh_enc(s): return s.replace("%", "%25").replace("\r", "").replace("\n", "%0A")
# On GitHub, the run's output is also posted as notes on the run, so it can be read without the full log.
def flush_notes(title):
    if os.environ.get("GITHUB_ACTIONS") != "true" or not OUT: return
    parts, cur = [], ""
    for line in OUT:
        if len(cur) + len(line) + 1 > 5500 and cur: parts.append(cur); cur = ""
        cur += line[:5500] + "\n"
    if cur: parts.append(cur)
    parts = parts[:8]
    for i, p in enumerate(parts): print("::notice title=%s %d of %d::%s" % (title, i + 1, len(parts), gh_enc(p)), flush=True)
def now_utc(): return dt.datetime.now(dt.timezone.utc)

# ---------------------------------------------------------------- state: Firestore (live) or a JSON file (tests)
class State:
    def __init__(self, spec):
        self.spec = spec
        if spec.startswith("local:"):
            self.path = spec[6:]
            self.data = json.load(open(self.path)) if os.path.exists(self.path) else {}
            self.db = None
        else:
            from google.cloud import firestore
            self.db = firestore.Client(project=PROJECT)
    def get(self, coll, key):
        if self.db is None: return self.data.get(coll, {}).get(key)
        s = self.db.collection("igBot").document(coll).collection("items").document(key).get()
        return s.to_dict() if s.exists else None
    def set(self, coll, key, val):
        if self.db is None:
            self.data.setdefault(coll, {})[key] = val; json.dump(self.data, open(self.path, "w"), indent=1); return
        self.db.collection("igBot").document(coll).collection("items").document(key).set(val)
    def all(self, coll):
        if self.db is None: return dict(self.data.get(coll, {}))
        return {d.id: d.to_dict() for d in self.db.collection("igBot").document(coll).collection("items").stream()}

# ---------------------------------------------------------------- media hosting: private bucket + signed links (live) or a local folder (tests)
class Media:
    def __init__(self, spec):
        self.spec = spec; self.cache = {}
        if spec.startswith("local:"):
            self.dir, self.base = spec[6:].split("|", 1)
        else:
            from google.cloud import storage
            self.client = storage.Client(project=PROJECT)
            name = PROJECT + "-vpex-instagram"
            b = self.client.lookup_bucket(name)
            if b is None:
                b = self.client.bucket(name)
                b.iam_configuration.uniform_bucket_level_access_enabled = True
                b.iam_configuration.public_access_prevention = "enforced"
                b.add_lifecycle_delete_rule(age=14)
                b = self.client.create_bucket(b, location="US")
                log("made the media bucket", name)
            self.bucket = b
    def url(self, pack, rel, hours=6):
        key = pack.name + "/" + rel + "|" + str(hours)
        if key in self.cache: return self.cache[key]
        data = pack.read(rel)
        ctype = mimetypes.guess_type(rel)[0] or "application/octet-stream"
        obj = re.sub(r"[^A-Za-z0-9._/-]", "_", key) + "-" + hashlib.sha1(data).hexdigest()[:10] + os.path.splitext(rel)[1]
        if self.spec.startswith("local:"):
            p = os.path.join(self.dir, obj); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, "wb").write(data)
            u = self.base.rstrip("/") + "/" + obj
        else:
            blob = self.bucket.blob(obj)
            if not blob.exists(): blob.upload_from_string(data, content_type=ctype)
            u = blob.generate_signed_url(version="v4", expiration=dt.timedelta(hours=hours), method="GET")
        self.cache[key] = u
        return u
    def page(self, name, html, hours=24):
        obj = "handoff/" + re.sub(r"[^A-Za-z0-9._-]", "_", name) + "-" + hashlib.sha1(html.encode()).hexdigest()[:10] + ".html"
        if self.spec.startswith("local:"):
            p = os.path.join(self.dir, obj); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, "w").write(html)
            return self.base.rstrip("/") + "/" + obj
        blob = self.bucket.blob(obj); blob.upload_from_string(html.encode(), content_type="text/html; charset=utf-8")
        return blob.generate_signed_url(version="v4", expiration=dt.timedelta(hours=hours), method="GET")

# ---------------------------------------------------------------- content packs
class Pack:
    def __init__(self, path):
        self.path = path; self.zip = None
        if path.endswith(".zip"):
            self.zip = zipfile.ZipFile(path)
            names = self.zip.namelist()
            plans = [n for n in names if n.endswith("plan.json") and "__MACOSX" not in n]
            if not plans: raise ValueError("no plan.json in " + path)
            self.root = plans[0][: -len("plan.json")]
            self.plan = json.loads(self.zip.read(plans[0]))
        else:
            self.root = ""
            self.plan = json.load(open(os.path.join(path, "plan.json")))
        self.name = re.sub(r"\.zip$", "", os.path.basename(path.rstrip("/")))
    def read(self, rel):
        if self.zip: return self.zip.read(self.root + rel)
        return open(os.path.join(self.path, rel), "rb").read()
    def exists(self, rel):
        if self.zip: return (self.root + rel) in self.zip.namelist()
        return os.path.exists(os.path.join(self.path, rel))

def load_packs():
    packs = []
    if not os.path.isdir(CONTENT_DIR): return packs
    for n in sorted(os.listdir(CONTENT_DIR)):
        p = os.path.join(CONTENT_DIR, n)
        try:
            if n.endswith(".zip") or (os.path.isdir(p) and os.path.exists(os.path.join(p, "plan.json"))): packs.append(Pack(p))
        except Exception as e: log("skipping", n, "->", e)
    return packs

def item_time(pack, it):
    tz = ZoneInfo(it.get("timezone") or pack.plan.get("timezone") or "America/New_York")
    return dt.datetime.strptime(it["at"], "%Y-%m-%d %H:%M").replace(tzinfo=tz).astimezone(dt.timezone.utc)

def all_items(packs):
    out = []
    for pk in packs:
        for it in pk.plan.get("items", []):
            try: out.append((item_time(pk, it), pk, it))
            except Exception as e: log("bad item in", pk.name, it.get("id"), e)
    out.sort(key=lambda x: x[0])
    return out

def missing_media(pk, it):
    need = [it.get(k) for k in ("image", "video", "cover") if it.get(k)] + list(it.get("images") or [])
    return [m for m in need if not pk.exists(m)]

# ---------------------------------------------------------------- Instagram
class IGError(Exception):
    def __init__(self, msg, code=None, sub=None): super().__init__(msg); self.code = code; self.sub = sub

class IG:
    def __init__(self, token): self.token = token; self.user_id = None; self.username = None
    def call(self, method, path, **params):
        params["access_token"] = self.token
        url = path if path.startswith("http") else GRAPH + "/" + path.lstrip("/")
        for attempt in range(3):
            try:
                r = requests.request(method, url, params=params if method == "GET" else None, data=params if method != "GET" else None, timeout=60)
            except requests.RequestException as e:
                if attempt == 2: raise IGError("network: " + scrub(e))
                time.sleep(5); continue
            try: j = r.json()
            except ValueError: j = {"error": {"message": r.text[:300]}}
            if r.status_code >= 500 and attempt < 2: time.sleep(5); continue
            if "error" in j:
                e = j["error"]; msg = e.get("message", "error")
                extra = " ".join(x for x in (e.get("error_user_title"), e.get("error_user_msg")) if x)   # Instagram's plain-language reason, when it gives one
                raise IGError(msg + (" (" + extra + ")" if extra else ""), e.get("code"), e.get("error_subcode"))
            return j
    def me(self):
        j = self.call("GET", "me", fields="user_id,username,followers_count,media_count")
        self.user_id = str(j.get("user_id") or j.get("id")); self.username = j.get("username")
        return j
    def wait_ready(self, cid, limit_s=300):
        t0 = time.time()
        while True:
            st = self.call("GET", cid, fields="status_code,status").get("status_code")
            if st == "FINISHED": return
            if st in ("ERROR", "EXPIRED"): raise IGError("Instagram couldn't process the media (" + str(st) + ")")
            if time.time() - t0 > limit_s: raise IGError("Instagram took too long processing the media")
            time.sleep(float(os.environ.get("IG_POLL_S", "10")))
    def publish(self, cid):
        self.wait_ready(cid)
        return self.call("POST", self.user_id + "/media_publish", creation_id=cid)["id"]

def post_item(ig, media, pk, it, publish=True):
    t = it["type"]; cap = it.get("caption", "")
    if t == "image":
        p = dict(image_url=media.url(pk, it["image"]), caption=cap)
        if it.get("alt"): p["alt_text"] = it["alt"][:1000]
        cid = ig.call("POST", ig.user_id + "/media", **p)["id"]
    elif t == "carousel":
        kids = []
        alts = it.get("alts") or []
        for i, img in enumerate(it["images"][:10]):
            p = dict(image_url=media.url(pk, img), is_carousel_item="true")
            if i < len(alts) and alts[i]: p["alt_text"] = alts[i][:1000]
            kids.append(ig.call("POST", ig.user_id + "/media", **p)["id"])
        for k in kids: ig.wait_ready(k, 180)
        cid = ig.call("POST", ig.user_id + "/media", media_type="CAROUSEL", children=",".join(kids), caption=cap)["id"]
    elif t == "reel":
        p = dict(media_type="REELS", video_url=media.url(pk, it["video"]), caption=cap, share_to_feed="true")
        if it.get("cover"): p["cover_url"] = media.url(pk, it["cover"])
        cid = ig.call("POST", ig.user_id + "/media", **p)["id"]
    elif t == "story":
        key = "video_url" if it.get("video") else "image_url"
        cid = ig.call("POST", ig.user_id + "/media", media_type="STORIES", **{key: media.url(pk, it.get("video") or it["image"])})["id"]
    else:
        raise IGError("unknown post type " + t)
    if not publish:                                # test mode: Instagram has fetched and processed it; stop before it goes live
        ig.wait_ready(cid); return cid, ""
    mid = ig.publish(cid)
    link = ""
    try: link = ig.call("GET", mid, fields="permalink").get("permalink", "")
    except IGError: pass
    return mid, link

# ---------------------------------------------------------------- notifications to Vincent's phone (through VPEX's own notifications)
class Notify:
    def __init__(self, mode):
        self.mode = mode; self.sent = []; self.uid = None
        if mode == "live":
            try:
                import firebase_admin
                from firebase_admin import auth
                if not firebase_admin._apps: firebase_admin.initialize_app(options={"projectId": PROJECT})
                self.uid = auth.get_user_by_email(OWNER_EMAIL).uid
            except Exception as e:
                log("notifications to the owner are off:", e); self.mode = "off"
    def send(self, title, body, link="https://" + SITE + "/"):
        self.sent.append({"title": title, "body": body, "link": link})
        log("NOTIFY:", title, "|", body)
        if self.mode != "live" or not self.uid: return
        try:
            from firebase_admin import messaging
            from google.cloud import firestore
            toks = [d.to_dict().get("token") for d in firestore.Client(project=PROJECT).collection("pushTokens").where("uid", "==", self.uid).limit(10).stream()]
            msgs = [messaging.Message(token=t, data={"kind": "bot", "link": link},
                    webpush=messaging.WebpushConfig(headers={"Urgency": "normal", "TTL": "86400"},
                        notification=messaging.WebpushNotification(title=title, body=body, icon="https://" + SITE + "/vpex-icon-192.png", tag="vpex-ig"),
                        fcm_options=messaging.WebpushFCMOptions(link=link))) for t in toks if t]
            if msgs: messaging.send_each(msgs)
        except Exception as e:
            log("couldn't send the notification:", e)

# ---------------------------------------------------------------- the Instagram key: start from the secret, keep it fresh
def get_token(state):
    sec = os.environ.get("IG_TOKEN", "").strip()
    if not sec: raise SystemExit("No Instagram key yet. Save it as the repository secret IG_TOKEN.")
    keep_secret(sec)
    h = hashlib.sha256(sec.encode()).hexdigest()[:16]
    rec = state.get("meta", "token")
    tok = rec["token"] if rec and rec.get("from") == h and rec.get("token") else sec
    keep_secret(tok)
    age = time.time() - ((rec or {}).get("refreshedAt") or 0)
    if not rec or rec.get("from") != h or age > 6 * 86400:
        try:
            r = requests.get(REFRESH_URL, params={"grant_type": "ig_refresh_token", "access_token": tok}, timeout=30).json()
            if r.get("access_token"):
                tok = r["access_token"]; keep_secret(tok); log("Instagram key refreshed; good for", int(r.get("expires_in", 0) / 86400), "days")
            else:
                log("key refresh skipped:", (r.get("error") or {}).get("message", r))
        except Exception as e:
            log("key refresh failed:", e)
        state.set("meta", "token", {"token": tok, "from": h, "refreshedAt": time.time()})
    return tok

# ---------------------------------------------------------------- comments
KEYWORDS = [
    (re.compile(r"\bdemo\b", re.I), "demo",
     "@{u} here you go: open {site} and tap “See a demo office first.” Pick your industry and tap around; it’s all sample data. 7 days free when you’re ready."),
    (re.compile(r"\b(price|pricing|cost|how much)\b", re.I), "price",
     "@{u} $49 per rep, per month. Reps use their own phones, so there’s nothing else to buy. 7 days free, no card to start: {site}"),
]
def answer_comments(ig, state, cfg):
    done = 0
    since = now_utc() - dt.timedelta(days=14)
    media = ig.call("GET", ig.user_id + "/media", fields="id,timestamp", limit=25).get("data", [])
    for m in media:
        try:
            if dt.datetime.fromisoformat(m["timestamp"].replace("+0000", "+00:00")) < since: continue
        except Exception: pass
        comments = ig.call("GET", m["id"] + "/comments", fields="id,text,username,timestamp", limit=50).get("data", [])
        for c in comments:
            if not c.get("id") or (c.get("username") or "").lower() == (ig.username or "").lower(): continue
            if state.get("replied", c["id"]): continue
            kind = None
            for rx, k, tpl in KEYWORDS:
                if rx.search(c.get("text") or ""): kind, text = k, tpl.format(u=c.get("username") or "there", site=SITE); break
            if not kind: continue
            rec = {"at": time.time(), "kind": kind, "user": c.get("username"), "media": m["id"]}
            try:
                rec["reply"] = ig.call("POST", c["id"] + "/replies", message=text)["id"]
            except IGError as e:
                rec["error"] = str(e)
            state.set("replied", c["id"], rec)
            done += 1
            log("answered", kind, "comment from", c.get("username"), "->", rec.get("reply") or rec.get("error"))
    return done

# ---------------------------------------------------------------- run
def run(state, media, note, ig):
    packs = load_packs()
    if os.path.exists(os.path.join(CONTENT_DIR, "PAUSE")) or os.environ.get("IG_PAUSED", "").lower() == "true":
        log("Paused (instagram/PAUSE exists). Nothing posted."); return
    items = all_items(packs)
    now = now_utc()
    for when, pk, it in items:
        iid = it["id"]
        if when > now: continue
        rec = state.get("posted", iid) or {}
        if rec.get("status") in ("posted", "missed", "reminded", "handed"): continue
        if it.get("posted_by_hand"):               # Vincent already posted this one himself
            state.set("posted", iid, {"status": "posted", "by": "hand", "at": time.time(), "title": it.get("title", iid)}); continue
        late_h = (now - when).total_seconds() / 3600
        grace = STORY_GRACE_H if it["type"] == "story" else FEED_GRACE_H
        if it.get("manual"):
            note.send("Time to post: " + it.get("title", iid), it.get("note", "Post it from the content pack."), "https://" + SITE + "/")
            state.set("posted", iid, {"status": "reminded", "at": time.time()}); continue
        if late_h > grace:
            state.set("posted", iid, {"status": "missed", "at": time.time(), "lateHours": round(late_h, 1)})
            log("missed (too late to post now):", iid); continue
        miss = missing_media(pk, it)
        if miss:
            state.set("posted", iid, {"status": "failed", "attempts": MAX_ATTEMPTS, "error": "missing files: " + ", ".join(miss)})
            note.send("Instagram bot: files missing", it.get("title", iid) + " needs " + ", ".join(miss)); continue
        tries = rec.get("attempts", 0)
        if tries >= MAX_ATTEMPTS: continue
        kind = "story" if it["type"] == "story" else "feed"
        last = state.get("meta", "last_post") or {}
        since = (time.time() - (last.get(kind) or 0)) / 60
        if since < (STORY_GAP_MIN if kind == "story" else FEED_GAP_MIN):
            log("waiting to post", iid, "- the last %s post went up %d minutes ago" % (kind, since)); continue
        try:
            log("posting", iid, "(" + it["type"] + ")")
            mid, link = post_item(ig, media, pk, it)
            state.set("posted", iid, {"status": "posted", "at": time.time(), "mediaId": mid, "permalink": link, "title": it.get("title", iid)})
            last[kind] = time.time(); state.set("meta", "last_post", last)
            log("posted", iid, link)
            if it["type"] != "story": note.send("Posted: " + it.get("title", iid), "It's live on Instagram. Tap to see it.", link or "https://www.instagram.com/")
        except IGError as e:
            tries += 1
            state.set("posted", iid, {"status": "failed" if tries >= MAX_ATTEMPTS else "retry", "attempts": tries, "error": str(e), "at": time.time()})
            log("couldn't post", iid, "->", e)
            if tries >= MAX_ATTEMPTS: note.send("Instagram bot couldn't post " + it.get("title", iid), str(e)[:150])
        break   # one post per run keeps posts apart and inside Instagram's limits
    try:
        n = answer_comments(ig, state, None)
        if n: log(n, "comments answered")
        state.set("meta", "comments", {"at": time.time()})
    except IGError as e:
        log("comments skipped:", e)

# ---------------------------------------------------------------- weekly report
def report(state, note, ig):
    acct = ig.me()
    end = now_utc(); start = end - dt.timedelta(days=7)
    media = ig.call("GET", ig.user_id + "/media", fields="id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count", limit=30).get("data", [])
    rows = []
    for m in media:
        try: ts = dt.datetime.fromisoformat(m["timestamp"].replace("+0000", "+00:00"))
        except Exception: continue
        if ts < start: continue
        ins = {}
        for metric in ("reach", "views", "saved", "shares", "total_interactions", "follows"):
            try:
                d = ig.call("GET", m["id"] + "/insights", metric=metric).get("data", [])
                if d: ins[metric] = d[0].get("values", [{}])[0].get("value", d[0].get("total_value", {}).get("value", 0)) or 0
            except IGError:
                pass
        title = (m.get("caption") or "").strip().split("\n")[0][:60] or m.get("media_product_type", "Post")
        rows.append({"title": title, "type": m.get("media_product_type") or m.get("media_type"), "link": m.get("permalink", ""),
                     "reach": ins.get("reach", 0), "views": ins.get("views", 0), "saves": ins.get("saved", 0), "shares": ins.get("shares", 0),
                     "likes": m.get("like_count", 0), "comments": m.get("comments_count", 0), "follows": ins.get("follows", 0)})
    prev = state.get("meta", "lastReport") or {}
    followers = acct.get("followers_count", 0)
    gained = followers - prev.get("followers", followers)
    replied = [v for v in state.all("replied").values() if v.get("at", 0) > start.timestamp()]
    rows.sort(key=lambda r: r["reach"], reverse=True)
    total_reach = sum(r["reach"] for r in rows)
    def rate(r): return (r["saves"] + r["shares"]) / r["reach"] if r["reach"] else 0
    best = max(rows, key=rate) if rows else None
    reels = [r for r in rows if (r["type"] or "").upper() in ("REELS", "CLIPS")]
    posts = [r for r in rows if r not in reels]
    lines = ["# Instagram: week ending " + end.astimezone(ZoneInfo("America/New_York")).strftime("%b %-d"), "",
             "@%s · **%s followers** (%s%d this week) · %d posts · %s reached in total" % (acct.get("username", ""), f"{followers:,}", "+" if gained >= 0 else "", gained, len(rows), f"{total_reach:,}"),
             "DEMO and price comments answered: %d" % len(replied), "",
             "| Post | Type | Reached | Views | Saves | Shares | Comments |", "|---|---|---:|---:|---:|---:|---:|"]
    for r in rows:
        t = "[%s](%s)" % (r["title"].replace("|", "/"), r["link"]) if r["link"] else r["title"].replace("|", "/")
        lines.append("| %s | %s | %s | %s | %s | %s | %s |" % (t, (r["type"] or "").title(), f"{r['reach']:,}", f"{r['views']:,}", r["saves"], r["shares"], r["comments"]))
    lines += ["", "## What to make more of"]
    if not rows:
        lines.append("Nothing posted this week.")
    else:
        if best and rate(best) > 0: lines.append("- **%s** got the most saves and shares for its reach (%.1f%%). Make another one in that shape." % (best["title"], rate(best) * 100))
        if reels and posts:
            ra = sum(r["reach"] for r in reels) / len(reels); pa = sum(r["reach"] for r in posts) / len(posts)
            lines.append("- Reels averaged %s reached, posts and carousels %s. %s" % (f"{ra:,.0f}", f"{pa:,.0f}", "Lean on Reels for reach." if ra > pa * 1.3 else "Posts are holding their own; keep the mix."))
        top = rows[0]
        lines.append("- Widest reach: **%s** (%s). Its first line is the hook to reuse." % (top["title"], f"{top['reach']:,}"))
    body = "\n".join(lines)
    state.set("meta", "lastReport", {"followers": followers, "at": time.time(), "reach": total_reach})
    open(os.environ.get("REPORT_FILE", "report.md"), "w").write(body)
    log(body)
    url = "https://www.instagram.com/" + (acct.get("username") or "")
    repo, gh = os.environ.get("GITHUB_REPOSITORY"), os.environ.get("GITHUB_TOKEN")
    if repo and gh:
        try:
            r = requests.post("https://api.github.com/repos/%s/issues" % repo, timeout=30, headers={"Authorization": "Bearer " + gh, "Accept": "application/vnd.github+json"},
                              json={"title": lines[0].lstrip("# "), "body": body})
            url = r.json().get("html_url") or url
            log("report posted:", url)
        except Exception as e:
            log("couldn't post the report on GitHub:", e)
    head = "%s reached this week" % f"{total_reach:,}" + (", +%d followers" % gained if gained > 0 else "")
    note.send("Instagram this week: " + head, ("Top: " + rows[0]["title"] + ". " if rows else "") + "Tap for the full report.", url)
    return body

# ---------------------------------------------------------------- check
def check(state, ig):
    j = ig.me()
    log("Instagram key works. Account: @%s (%s followers, %s posts)" % (j.get("username"), j.get("followers_count"), j.get("media_count")))
    packs = load_packs()
    log("Content packs:", ", ".join(p.name for p in packs) or "none yet (add one to the instagram folder)")
    items = all_items(packs)
    for when, pk, it in items:
        rec = state.get("posted", it["id"]) or {}
        miss = missing_media(pk, it)
        log("  %s  %-8s %-34s %s%s" % (when.astimezone(ZoneInfo("America/New_York")).strftime("%a %b %d %I:%M %p"), it["type"] + ("*" if it.get("manual") else ""), it.get("title", it["id"])[:34],
            rec.get("status", "waiting"), ("  MISSING " + ", ".join(miss)) if miss else ""))
    try:
        lim = ig.call("GET", ig.user_id + "/content_publishing_limit", fields="quota_usage,config").get("data", [{}])[0]
        log("Posts made through the API in the last 24 hours:", lim.get("quota_usage"), "of", (lim.get("config") or {}).get("quota_total"))
    except IGError as e:
        log("couldn't read the posting limit:", e)

# A test post that never goes live: the next feed post and the next story go through every step of posting (upload,
# Instagram fetching and processing the media) except the final publish. Unpublished drafts expire on their own.
def test(state, media, note, ig):
    now = now_utc(); picked = {}
    for when, pk, it in all_items(load_packs()):
        if when < now - dt.timedelta(hours=1) or it.get("manual"): continue
        if (state.get("posted", it["id"]) or {}).get("status") in ("posted", "missed", "reminded", "handed"): continue
        picked.setdefault("story" if it["type"] == "story" else "feed", (when, pk, it))
        if len(picked) == 2: break
    if not picked: raise SystemExit("Nothing coming up to test with.")
    ok, bad = [], []
    for kind in ("feed", "story"):
        if kind not in picked: continue
        when, pk, it = picked[kind]
        name = "%s (%s, due %s)" % (it.get("title", it["id"]), it["type"], when.astimezone(ZoneInfo("America/New_York")).strftime("%a %I:%M %p"))
        miss = missing_media(pk, it)
        if miss: bad.append(name + ": missing " + ", ".join(miss)); log("TEST FAILED:", bad[-1]); continue
        t0 = time.time()
        try:
            post_item(ig, media, pk, it, publish=False)
            ok.append(name); log("TEST PASSED: %s. Uploaded, and Instagram processed it in %d seconds. Not published." % (name, time.time() - t0))
        except IGError as e:
            bad.append(name + ": " + str(e)); log("TEST FAILED:", bad[-1])
    if bad:
        note.send("Instagram bot test failed", bad[0][:150]); raise SystemExit("Test failed: " + "; ".join(bad))
    note.send("Instagram bot test passed", "%d test post%s went through Instagram without going live. Next real post: %s." % (len(ok), "" if len(ok) == 1 else "s", ok[0]))

# Every post's numbers (not just this week), to learn what works. Saved to the bot's state for later weeks too.
def insights(state, ig):
    acct = ig.me()
    media = ig.call("GET", ig.user_id + "/media", fields="id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count", limit=50).get("data", [])
    rows = []
    for m in media:
        ins = {}
        mets = ["reach", "views", "saved", "shares", "total_interactions", "follows", "profile_visits"]
        if (m.get("media_product_type") or "").upper() == "REELS": mets += ["ig_reels_avg_watch_time"]
        for metric in mets:
            try:
                d = ig.call("GET", m["id"] + "/insights", metric=metric).get("data", [])
                if d: ins[metric] = d[0].get("values", [{}])[0].get("value", d[0].get("total_value", {}).get("value", 0)) or 0
            except IGError:
                pass
        ts = m.get("timestamp", "")
        try: local = dt.datetime.fromisoformat(ts.replace("+0000", "+00:00")).astimezone(ZoneInfo("America/New_York"))
        except Exception: local = None
        rows.append({"id": m["id"], "when": local.strftime("%a %b %d %I:%M %p") if local else ts, "hour": local.hour if local else None,
                     "type": (m.get("media_product_type") or m.get("media_type") or "").upper(), "hook": (m.get("caption") or "").strip().split("\n")[0][:70],
                     "reach": ins.get("reach", 0), "views": ins.get("views", 0), "saves": ins.get("saved", 0), "shares": ins.get("shares", 0),
                     "likes": m.get("like_count", 0) or 0, "comments": m.get("comments_count", 0) or 0, "follows": ins.get("follows", 0),
                     "visits": ins.get("profile_visits", 0), "watch_ms": ins.get("ig_reels_avg_watch_time", 0)})
    log("@%s: %s followers, %d posts" % (acct.get("username"), acct.get("followers_count"), len(rows)))
    log("when | type | reach | views | likes | comments | saves | shares | follows | profile visits | avg watch s | hook")
    for r in rows:
        log("%s | %s | %d | %d | %d | %d | %d | %d | %d | %d | %.1f | %s" % (r["when"], r["type"][:6], r["reach"], r["views"], r["likes"], r["comments"], r["saves"], r["shares"], r["follows"], r["visits"], (r["watch_ms"] or 0) / 1000.0, r["hook"]))
    def avg(xs, k): return sum(x[k] for x in xs) / len(xs) if xs else 0
    for t in sorted(set(r["type"] for r in rows)):
        g = [r for r in rows if r["type"] == t]
        log("%s: %d posts, avg reach %.0f, views %.0f, likes %.1f, saves %.1f, shares %.1f" % (t, len(g), avg(g, "reach"), avg(g, "views"), avg(g, "likes"), avg(g, "saves"), avg(g, "shares")))
    state.set("meta", "insights", {"at": time.time(), "followers": acct.get("followers_count"), "rows": rows})
    return rows

def _norm(t): return re.sub(r"[^a-z0-9]+", " ", (t or "").lower()).strip()[:60]

# What's already on the account, matched against the plan, so nothing is posted twice.
def inventory(state, ig, mark=False):
    got = ig.call("GET", ig.user_id + "/media", fields="id,caption,media_type,media_product_type,timestamp,permalink", limit=50).get("data", [])
    log("Last %d posts on @%s:" % (len(got), ig.username))
    for m in got:
        log("  %s  %-8s %s" % (m.get("timestamp", "")[:16].replace("T", " "), (m.get("media_product_type") or m.get("media_type") or "")[:8], (m.get("caption") or "(no caption)").replace("\n", " ")[:70]))
    caps = {_norm(m.get("caption"))[:40]: m for m in got if m.get("caption")}
    items = all_items(load_packs())
    log("Plan items already on Instagram:")
    n = 0
    for when, pk, it in items:
        if it["type"] == "story" or not it.get("caption"): continue
        m = caps.get(_norm(it["caption"])[:40])
        rec = state.get("posted", it["id"]) or {}
        if m:
            n += 1
            log("  ON INSTAGRAM  %-10s %s  (%s)%s" % (it["id"], it.get("title", "")[:40], m.get("timestamp", "")[:10], "" if rec.get("status") == "posted" else (" -> marked posted" if mark else " -> not marked yet")))
            if mark and rec.get("status") != "posted":
                state.set("posted", it["id"], {"status": "posted", "media": m.get("id"), "by": "hand", "at": time.time()})
    log("%d plan feed items found on Instagram." % n)


# Find out why Instagram refuses the key: the same question asked several ways, with Meta's full answer (never the key).
def diagnose(state):
    sec = os.environ.get("IG_TOKEN", "").strip(); keep_secret(sec)
    h = hashlib.sha256(sec.encode()).hexdigest()[:16]
    rec = state.get("meta", "token") or {}
    stored = rec.get("token") if rec.get("from") == h else None
    if stored: keep_secret(stored)
    log("Key in GitHub: %d characters, starts %s. Saved working key: %s, refreshed %s hours ago." % (len(sec), sec[:4] + "...", "same lineage" if stored else "none", round((time.time() - (rec.get("refreshedAt") or 0)) / 3600, 1) if stored else "-"))
    try: log("This runner's internet address:", requests.get("https://api.ipify.org", timeout=10).text[:40])
    except Exception as e: log("couldn't read the runner address:", e)
    def ask(label, url, tok, **params):
        params["access_token"] = tok
        try:
            r = requests.get(url, params=params, timeout=30)
            try: j = r.json()
            except ValueError: j = {"raw": r.text[:200]}
            if "error" in j:
                e = j["error"]; log("%-34s HTTP %s  %s | type=%s code=%s subcode=%s %s trace=%s" % (label, r.status_code, e.get("message"), e.get("type"), e.get("code"), e.get("error_subcode"), (e.get("error_user_title") or "") + " " + (e.get("error_user_msg") or ""), e.get("fbtrace_id")))
            else: log("%-34s HTTP %s  OK %s" % (label, r.status_code, scrub(json.dumps({k: v for k, v in j.items() if k in ("username", "user_id", "id", "expires_in", "account_type")}))))
        except Exception as e: log("%-34s failed: %s" % (label, scrub(e)))
    for name, tok in (("saved key", stored), ("GitHub key", sec)):
        if not tok or (name == "GitHub key" and tok == stored): continue
        ask(name + ": /me v23.0", "https://graph.instagram.com/v23.0/me", tok, fields="user_id,username,account_type")
        ask(name + ": /me v21.0", "https://graph.instagram.com/v21.0/me", tok, fields="user_id,username")
        ask(name + ": /me no version", "https://graph.instagram.com/me", tok, fields="id,username")
        ask(name + ": recent media", "https://graph.instagram.com/v23.0/me/media", tok, fields="id,timestamp", limit="1")
        ask(name + ": refresh", REFRESH_URL, tok, grant_type="ig_refresh_token")

# Keep traffic to Instagram low and steady (Meta locks developer accounts over unusual traffic): a scheduled run only
# contacts Instagram when something is due, or to check comments at most once an hour.
COMMENT_EVERY_MIN = float(os.environ.get("IG_COMMENT_EVERY_MIN", "60"))
def quiet_run(state):
    if os.environ.get("IG_ALWAYS_CONTACT") == "1": return False
    now = now_utc()
    for when, pk, it in all_items(load_packs()):
        if when <= now and (state.get("posted", it["id"]) or {}).get("status") not in ("posted", "missed", "reminded", "failed", "handed"): return False
    ago = (time.time() - ((state.get("meta", "comments") or {}).get("at") or 0)) / 60
    if ago < COMMENT_EVERY_MIN:
        log("Nothing due, and comments were checked %d minutes ago. Instagram not contacted this run." % ago); return True
    return False

# While Instagram refuses the bot, each post still goes out on schedule: Vincent gets a notification that opens a page
# with the media to save and the caption to copy. Same timing and spacing rules as the bot; handed-off posts count as done.
HOW = {"reel": "Open Instagram, tap +, choose Reel, pick the video, paste the caption, Share.",
       "image": "Open Instagram, tap +, choose Post, pick the image, paste the caption, Share.",
       "carousel": "Open Instagram, tap +, choose Post, tap Select multiple, pick the images in order (1 to %d), paste the caption, Share.",
       "story": "Open Instagram, tap +, choose Story, pick it, Share. For a Reel you already posted, you can also open it and tap Share, then Add to story."}
def esc(t): return (t or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
DONE_URL = os.environ.get("IG_DONE_URL", "https://us-central1-" + PROJECT + ".cloudfunctions.net/igDone")
def handoff_page(media, pk, it, when, key=""):
    t = it["type"]; title = it.get("title", it["id"]); slug = re.sub(r"[^A-Za-z0-9]+", "-", it["id"])
    groups, secs = [], []          # each group: files saved together with one button
    def group(label, word, rels, show, btn):
        F = []
        for i, f in enumerate(rels):
            vid = f.lower().endswith(".mp4")
            F.append({"u": media.url(pk, f, hours=48), "n": "VPEX-%s-%s%s%s" % (slug, label.split()[-1].lower(), "-%d" % (i + 1) if len(rels) > 1 else "", os.path.splitext(f)[1]), "t": "video/mp4" if vid else "image/jpeg"})
        gi = len(groups); groups.append(F)
        prev = ""
        for i, f in enumerate(F):
            num = '<div class="n">%d of %d</div>' % (i + 1, len(F)) if len(F) > 1 else ""
            poster = (' poster="%s"' % esc(media.url(pk, it["cover"], hours=48))) if f["t"] == "video/mp4" and it.get("cover") else ""
            prev += num + ('<video src="%s"%s controls playsinline preload="metadata"></video>' % (esc(f["u"]), poster) if f["t"] == "video/mp4" else '<img src="%s" alt="">' % esc(f["u"]))
        secs.append((label, '<button class="btn save" data-g="%d" data-label="%s" disabled>Getting it ready...</button><p class="tip">Opens your share sheet: tap <b>%s</b>.</p>%s' % (gi, esc(btn), word, prev if show else "")))
    cap = it.get("caption", "")
    if t != "story": secs.append(("Copy the caption", '<textarea id="cap" readonly>%s</textarea><button class="btn copy" data-src="cap">Copy caption</button>' % esc(cap)))
    if it.get("video"): group("Save the video", "Save Video", [it["video"]], True, "Save the video")
    if t == "reel" and it.get("cover"): group("Save the cover", "Save Image", [it["cover"]], True, "Save the cover")
    if it.get("image"): group("Save the image", "Save Image", [it["image"]], True, "Save the image")
    if it.get("images"): group("Save the images", "Save %d Images" % len(it["images"]), list(it["images"]), True, "Save all %d images" % len(it["images"]))
    alts = [it["alt"]] if it.get("alt") and t != "reel" else list(it.get("alts") or [])
    if alts and t != "story":
        rows = "".join('<div class="alt"><div class="n">%s</div><textarea id="alt%d" readonly>%s</textarea><button class="btn ghost copy" data-src="alt%d">Copy alt text%s</button></div>' % (
            ("Image %d of %d" % (i + 1, len(alts))) if len(alts) > 1 else "Alt text", i, esc(a), i, (" %d" % (i + 1)) if len(alts) > 1 else "") for i, a in enumerate(alts))
        secs.append(("Optional: alt text", '<p class="tip">Helps people using screen readers. In Instagram, before you share, tap Advanced settings, then Write alt text, and paste.</p>' + rows))
    steps = {"reel": ["Open Instagram, tap +, choose <b>Reel</b>, pick the video.", "Tap Next. Tap <b>Edit cover</b>, then <b>Add from camera roll</b>, and pick the cover.", "Paste the caption. Keep <b>Share to feed</b> on. Tap Share."],
             "image": ["Open Instagram, tap +, choose <b>Post</b>, pick the image.", "Tap Next and paste the caption.", "Tap Share."],
             "carousel": ["Open Instagram, tap +, choose <b>Post</b>, tap <b>Select multiple</b>.", "Pick the images in order, 1 to %d." % len(it.get("images") or []), "Tap Next, paste the caption, tap Share."],
             "story": ["Open Instagram, tap +, choose <b>Story</b>, pick it, tap Share.", "For a Reel you already posted, you can instead open it, tap Share, then <b>Add to story</b>."]}[t]
    secs.append(("Post it", "<ol>" + "".join("<li>%s</li>" % x for x in steps) + "</ol>"))
    if key: secs.append(("Tap Done", '<button class="btn done-btn" id="done">Done, I posted it</button><p class="tip" id="donetip">Tells the bot this one is on Instagram.</p>'))
    body, k = "", 0
    for h, c in secs:
        if h.startswith("Optional"): body += '<h2>%s</h2>%s' % (esc(h), c)
        else: k += 1; body += '<h2>%d. %s</h2>%s' % (k, esc(h), c)
    html = """<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Post now: %(title)s</title>
<style>body{margin:0;background:#0E1433;color:#F4F5F9;font:17px/1.45 -apple-system,system-ui,sans-serif}main{max-width:560px;margin:0 auto;padding:22px 16px 60px}
.wm{color:#E8B94A;font-weight:800;letter-spacing:.04em}h1{font-size:26px;line-height:1.2;margin:10px 0 4px}.due{color:#C7CBE4;margin:0 0 8px}h2{font-size:18px;margin:28px 0 10px;color:#E8B94A}
img,video{display:block;width:100%%;border-radius:14px;background:#000;margin-top:10px}.n{color:#C7CBE4;font-size:14px;margin-top:14px}.tip{color:#C7CBE4;font-size:14px;margin:8px 0 0}
.btn{display:block;width:100%%;box-sizing:border-box;margin-top:10px;padding:15px;border:0;border-radius:12px;background:#E8B94A;color:#131A3E;font:700 17px -apple-system,system-ui,sans-serif;text-align:center}
.btn.ghost{background:transparent;color:#E8B94A;box-shadow:inset 0 0 0 2px #E8B94A;padding:11px;font-size:15px}.btn[disabled]{opacity:.55}
textarea{width:100%%;box-sizing:border-box;min-height:150px;border-radius:12px;border:0;padding:12px;font:15px/1.4 -apple-system,system-ui,sans-serif;background:#F4F5F9;color:#131A3E}.alt textarea{min-height:90px}
ol{padding-left:22px;margin:0}li{margin:6px 0}.done-btn.ok{background:#2EB872;color:#fff;opacity:1}.done{margin-top:28px;color:#C7CBE4;font-size:15px}</style></head>
<body><main><div class="wm">VPEX</div><h1>%(title)s</h1><p class="due">Due %(due)s. Instagram is blocking the bot right now, so this one is ready for you to post.</p>
%(body)s<p class="done">The bot won't post this one again, even if you don't tap Done.</p></main>
<script>
const G = %(groups)s, ready = G.map(() => null);
document.querySelectorAll(".save").forEach(b => {
  const g = +b.dataset.g;
  Promise.all(G[g].map(f => fetch(f.u).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(x => new File([x], f.n, {type: f.t}))))
    .then(x => { ready[g] = x; b.disabled = false; b.textContent = b.dataset.label; })
    .catch(() => { b.disabled = false; b.textContent = "Open it"; b.nextElementSibling.textContent = "Couldn't prepare it here. Open it, then tap the share button and Save."; });
  b.onclick = async () => {
    const files = ready[g];
    if (files && navigator.canShare && navigator.canShare({files})) { try { await navigator.share({files}); } catch (e) {} }
    else location.href = G[g][0].u;
  };
});
const d = document.getElementById("done");
if (d) d.onclick = async () => {
  d.disabled = true; d.textContent = "Saving...";
  try {
    const r = await fetch(%(doneurl)s + "?id=" + encodeURIComponent(%(iid)s) + "&k=" + encodeURIComponent(%(key)s), {method: "POST"});
    if (r.ok) { d.textContent = "Done \u2713"; d.classList.add("ok"); document.getElementById("donetip").textContent = "Marked as posted. Nice work."; }
    else if (r.status === 403) { d.textContent = "Done \u2713"; document.getElementById("donetip").textContent = "This page is out of date, but this post already counts as done."; }
    else throw new Error(r.status);
  } catch (e) { d.disabled = false; d.textContent = "Try again"; document.getElementById("donetip").textContent = "Couldn't reach VPEX. It still counts as done; tap to try again."; }
};
document.querySelectorAll(".copy").forEach(c => c.onclick = () => navigator.clipboard.writeText(document.getElementById(c.dataset.src).value).then(() => { c.textContent = "Copied"; }));
</script></body></html>""" % {"title": esc(title), "due": when.astimezone(ZoneInfo("America/New_York")).strftime("%a %b %d, %I:%M %p").replace(" 0", " "),
        "body": body, "groups": json.dumps(groups).replace("</", "<\\/"), "doneurl": json.dumps(DONE_URL), "iid": json.dumps(it["id"]), "key": json.dumps(key)}
    return media.page(it["id"], html)

# Send the latest handed-off post again (a fresh page and notification), without touching the schedule.
def resend(state, media, note):
    recs = [(v.get("at") or 0, k) for k, v in state.all("posted").items() if v.get("status") == "handed"]
    if not recs: raise SystemExit("Nothing has been handed off yet.")
    iid = max(recs)[1]
    for when, pk, it in all_items(load_packs()):
        if it["id"] == iid:
            rec = state.get("posted", iid) or {}
            if not rec.get("doneKey"): rec["doneKey"] = secrets.token_urlsafe(18); state.set("posted", iid, rec)
            link = handoff_page(media, pk, it, when, rec["doneKey"])
            note.send("Post now: " + it.get("title", iid)[:60], "Here it is again. Tap to open it.", link)
            log("sent again:", it.get("title", iid)); return
    raise SystemExit("Couldn't find " + iid + " in the packs.")

def handoff(state, media, note, why):
    now = now_utc(); last = state.get("meta", "last_post") or {}; sent = None
    for when, pk, it in all_items(load_packs()):
        iid = it["id"]; rec = state.get("posted", iid) or {}
        if when > now or rec.get("status") in ("posted", "missed", "reminded", "handed", "failed") or it.get("posted_by_hand"): continue
        if it.get("manual"):
            note.send("Time to post: " + it.get("title", iid), it.get("note", "Post it from the content pack."), "https://" + SITE + "/")
            state.set("posted", iid, {"status": "reminded", "at": time.time()}); continue
        late_h = (now - when).total_seconds() / 3600
        if late_h > (STORY_GRACE_H if it["type"] == "story" else FEED_GRACE_H):
            state.set("posted", iid, {"status": "missed", "at": time.time(), "lateHours": round(late_h, 1)}); log("missed (too late now):", iid); continue
        kind = "story" if it["type"] == "story" else "feed"
        since = (time.time() - (last.get(kind) or 0)) / 60
        if since < (STORY_GAP_MIN if kind == "story" else FEED_GAP_MIN):
            log("waiting to hand off", iid, "- the last %s post went out %d minutes ago" % (kind, since)); continue
        if missing_media(pk, it): continue
        key = secrets.token_urlsafe(18)
        link = handoff_page(media, pk, it, when, key)
        note.send("Post now: " + it.get("title", iid)[:60], ("Tap to open it, save it and add it to your story." if kind == "story" else "Tap to open it: save, copy the caption, post.") + " Instagram is still blocking the bot.", link)
        state.set("posted", iid, {"status": "handed", "at": time.time(), "title": it.get("title", iid), "doneKey": key})
        last[kind] = time.time(); state.set("meta", "last_post", last); sent = it.get("title", iid)
        break
    raise SystemExit("Instagram is blocking the bot (%s). %s" % (why, ("Sent \"%s\" to Vincent to post by hand." % sent) if sent else "Nothing to hand off this run."))

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "run"
    state = State(os.environ.get("BOT_STATE", "firestore"))
    if mode == "diagnose": return diagnose(state)
    if mode == "run" and quiet_run(state): return
    note = Notify(os.environ.get("BOT_NOTIFY", "live"))
    if mode == "resend": return resend(state, Media(os.environ.get("BOT_MEDIA", "gcs")), note)
    ig = IG(get_token(state))
    try:
        ig.me()
    except IGError as e:
        if str(e).startswith("network:"):          # Instagram or the network had a blip: try again next run, no alert
            raise SystemExit("Couldn't reach Instagram this time (it tries again on the next run): " + str(e)[:300])
        detail = str(e).rstrip(".") + (" [code %s%s]" % (e.code, "/" + str(e.sub) if e.sub else "") if e.code else "")
        last = state.get("meta", "signin_alert") or {}
        if last.get("msg") != detail or time.time() - (last.get("at") or 0) > 12 * 3600:   # alert once, not every 15 minutes
            note.send("Instagram bot can't sign in", "Instagram said: " + detail[:110] + ". Until it's fixed, the bot sends you each post ready to post by hand.")
            state.set("meta", "signin_alert", {"msg": detail, "at": time.time()})
        if mode == "run": return handoff(state, Media(os.environ.get("BOT_MEDIA", "gcs")), note, detail)
        raise SystemExit("Instagram rejected the key: " + detail)
    if (state.get("meta", "signin_alert") or {}).get("msg"):
        state.set("meta", "signin_alert", {}); note.send("Instagram bot is back", "Instagram accepted the key again. Posting picks up on the next run.")
        log("Instagram accepted the key again.")
    if mode == "check": return check(state, ig)
    if mode == "inventory": return inventory(state, ig, mark=False)
    if mode == "insights": return insights(state, ig)
    if mode == "sync": return inventory(state, ig, mark=True)
    if mode == "report": return report(state, note, ig)
    media = Media(os.environ.get("BOT_MEDIA", "gcs"))
    if mode == "test": return test(state, media, note, ig)
    run(state, media, note, ig)

if __name__ == "__main__":
    _mode = sys.argv[1] if len(sys.argv) > 1 else "run"
    try:
        main()
    except SystemExit as e:
        if e.code not in (None, 0) and not isinstance(e.code, int):
            log("Stopped: " + str(e.code))
            if os.environ.get("GITHUB_ACTIONS") == "true": print("::error title=Instagram bot::" + gh_enc(scrub(e.code)), flush=True)
        raise
    except Exception:
        log("Crashed: " + traceback.format_exc()[-1500:])
        raise
    finally:
        flush_notes("Instagram bot (" + _mode + ")")
