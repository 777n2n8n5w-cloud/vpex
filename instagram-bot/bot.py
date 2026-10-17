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
import os, sys, json, time, re, hashlib, zipfile, io, datetime as dt, mimetypes, traceback
from zoneinfo import ZoneInfo
import requests

GRAPH = os.environ.get("IG_GRAPH_URL", "https://graph.instagram.com/" + os.environ.get("IG_API_VERSION", "v23.0")).rstrip("/")
REFRESH_URL = os.environ.get("IG_REFRESH_URL", "https://graph.instagram.com/refresh_access_token")
PROJECT = os.environ.get("PROJECT", "dovetail-f863c")
OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "vincent@dovetail-f863c.firebaseapp.com")
CONTENT_DIR = os.environ.get("IG_CONTENT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "instagram"))
FEED_GRACE_H = float(os.environ.get("IG_FEED_GRACE_H", "12"))   # a feed post more than this late is skipped, not dumped late
STORY_GRACE_H = float(os.environ.get("IG_STORY_GRACE_H", "3"))
MAX_ATTEMPTS = 3
SITE = "vpexdialer.com"

def log(*a): print(*a, flush=True)
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
    def url(self, pack, rel):
        key = pack.name + "/" + rel
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
            u = blob.generate_signed_url(version="v4", expiration=dt.timedelta(hours=6), method="GET")
        self.cache[key] = u
        return u

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
                if attempt == 2: raise IGError("network: " + str(e))
                time.sleep(5); continue
            try: j = r.json()
            except ValueError: j = {"error": {"message": r.text[:300]}}
            if r.status_code >= 500 and attempt < 2: time.sleep(5); continue
            if "error" in j:
                e = j["error"]; raise IGError(e.get("message", "error"), e.get("code"), e.get("error_subcode"))
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

def post_item(ig, media, pk, it):
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
    h = hashlib.sha256(sec.encode()).hexdigest()[:16]
    rec = state.get("meta", "token")
    tok = rec["token"] if rec and rec.get("from") == h and rec.get("token") else sec
    age = time.time() - ((rec or {}).get("refreshedAt") or 0)
    if not rec or rec.get("from") != h or age > 6 * 86400:
        try:
            r = requests.get(REFRESH_URL, params={"grant_type": "ig_refresh_token", "access_token": tok}, timeout=30).json()
            if r.get("access_token"):
                tok = r["access_token"]; log("Instagram key refreshed; good for", int(r.get("expires_in", 0) / 86400), "days")
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
        if rec.get("status") in ("posted", "missed", "reminded"): continue
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
        try:
            log("posting", iid, "(" + it["type"] + ")")
            mid, link = post_item(ig, media, pk, it)
            state.set("posted", iid, {"status": "posted", "at": time.time(), "mediaId": mid, "permalink": link, "title": it.get("title", iid)})
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

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "run"
    state = State(os.environ.get("BOT_STATE", "firestore"))
    note = Notify(os.environ.get("BOT_NOTIFY", "live"))
    ig = IG(get_token(state))
    try:
        ig.me()
    except IGError as e:
        note.send("Instagram bot can't sign in", "Instagram said: " + str(e)[:140] + ". The key may need renewing.")
        raise SystemExit("Instagram rejected the key: " + str(e))
    if mode == "check": return check(state, ig)
    if mode == "report": return report(state, note, ig)
    media = Media(os.environ.get("BOT_MEDIA", "gcs"))
    run(state, media, note, ig)

if __name__ == "__main__":
    main()
