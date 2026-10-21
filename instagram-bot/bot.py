#!/usr/bin/env python3
"""VPEX Instagram bot.

Runs on GitHub every 15 minutes (see .github/workflows/vpex-instagram.yml):
  run       post whatever the plan says is due on Instagram, and the same feed posts on the Facebook Page and Threads
            (when their keys are saved); answer DEMO and price comments; remind Vincent about sticker stories
  learn     daily: every post's numbers (reach, sends, saves, watch time, skips) plus the site visits, demos and trial
            forms each post brought in, scored and grouped by hook, topic, industry, format and call to action
  scorecard Monday (also "report"): posts per platform, reach, the site funnel by source and post, sign-ups, offices that
            made a first call and offices still calling in week 2; sent to Vincent's phone as a private page
  check     test the keys and show the account, the plan and what's next (changes nothing)

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
FEED_GAP_MIN = float(os.environ.get("IG_FEED_GAP_MIN", "180"))
STORY_GAP_MIN = float(os.environ.get("IG_STORY_GAP_MIN", "90"))
MAX_ATTEMPTS = 3
SITE = "vpexdialer.com"
# Facebook Page and Threads: the same feed posts, posted by the same plan. Each is on only when its key is saved.
FB_GRAPH = os.environ.get("FB_GRAPH_URL", "https://graph.facebook.com/v23.0").rstrip("/")
FB_RUPLOAD = os.environ.get("FB_RUPLOAD_URL", "https://rupload.facebook.com/video-upload/v23.0").rstrip("/")
TH_GRAPH = os.environ.get("TH_GRAPH_URL", "https://graph.threads.net/v1.0").rstrip("/")
TH_REFRESH_URL = os.environ.get("TH_REFRESH_URL", "https://graph.threads.net/refresh_access_token")
XP_GAP_MIN = float(os.environ.get("XP_GAP_MIN", "120"))           # at least this long between two posts on the same platform
TRIAL_MIN_FOLLOWERS = int(os.environ.get("IG_TRIAL_MIN_FOLLOWERS", "200"))   # Instagram's minimum for trial Reels
# Account safety. On Oct 21 2026 Meta blocked the whole app (Instagram, then Facebook and Threads) after weeks of ~16 posts a
# day plus stories and auto-replies from a new account. So: hard daily ceilings per platform, whatever the plan holds (extra
# items are skipped, keeping the best time slots); after a refusal, no more calls to that platform for BLOCK_BACKOFF_H hours
# (a new key saved in GitHub is tried right away); and a daily cap on automatic comment replies.
# Tune the ceilings in instagram/limits.json; IG_DAY_CAPS=off turns them off (tests only).
DAY_CAPS = {"instagram": {"feed": 2, "story": 3}, "facebook": {"feed": 2}, "threads": {"feed": 2, "thread": 1}}
PREFERRED_TIMES = ["11:00", "19:00"]       # when a day holds more than the ceiling, these slots are kept first
BLOCK_BACKOFF_H = float(os.environ.get("BLOCK_BACKOFF_H", "6"))
REPLY_DAY_MAX = int(os.environ.get("IG_REPLY_DAY_MAX", "8"))
NY = ZoneInfo("America/New_York")

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
class SoftStop(Exception):
    """A run that did all it could while Instagram blocks the bot or can't be reached: logged as a warning, the run stays green.
    A red run every 15 minutes only buries real failures (and GitHub emails each one); Vincent gets the phone alert instead."""

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

IG_TYPES = ("reel", "image", "carousel", "story")
FEED_TYPES = ("reel", "image", "carousel")
DONE = ("posted", "missed", "reminded", "handed", "skipped")
def platforms(it):
    """Where an item goes. Feed posts: Instagram, Facebook and Threads unless the item says otherwise ("platforms": [...]);
    stories: Instagram only; "thread" items (text, or text with an image): Threads only."""
    if it.get("platforms"): return [p for p in it["platforms"] if p in ("instagram", "facebook", "threads")]
    if it.get("type") == "thread": return ["threads"]
    if it.get("type") == "story" or it.get("trial"): return ["instagram"]
    return ["instagram", "facebook", "threads"]

def all_items(packs, platform="instagram"):
    out = []
    for pk in packs:
        for it in pk.plan.get("items", []):
            if platform and platform not in platforms(it): continue
            if platform == "instagram" and it.get("type") not in IG_TYPES: continue
            try: out.append((item_time(pk, it), pk, it))
            except Exception as e: log("bad item in", pk.name, it.get("id"), e)
    out.sort(key=lambda x: x[0])
    return apply_caps(out, platform) if platform else out

def kind_of(it): return "story" if it.get("type") == "story" else "thread" if it.get("type") == "thread" else "feed"
_LIM = {}
def limits():
    if "_" not in _LIM:
        caps = json.loads(json.dumps(DAY_CAPS)); pref = list(PREFERRED_TIMES)
        path = os.path.join(CONTENT_DIR, "limits.json")
        if os.path.exists(path):
            try:
                j = json.load(open(path))
                for plat, c in (j.get("per_day") or {}).items(): caps.setdefault(plat, {}).update({k: int(v) for k, v in c.items()})
                pref = list(j.get("preferred_times") or pref)
            except Exception as e: log("limits.json ignored:", e)
        _LIM.update({"_": True, "caps": caps, "pref": pref})
    return _LIM
CAPPED = {}
def apply_caps(out, platform):
    """At most the day's ceiling of each kind (feed, story, thread) per platform, by New York date. Preferred time slots
    are kept first, then the earliest. The same plan always gives the same answer, so a skipped item stays skipped."""
    if os.environ.get("IG_DAY_CAPS", "").lower() == "off": return out
    L = limits(); caps = L["caps"].get(platform) or {}; pref = L["pref"]
    groups = {}
    for x in out: groups.setdefault((x[0].astimezone(NY).date(), kind_of(x[2])), []).append(x)
    drop = set()
    for (day, kind), xs in groups.items():
        cap = caps.get(kind)
        if cap is None or len(xs) <= cap: continue
        def rank(x):
            hm = x[0].astimezone(NY).strftime("%H:%M")
            return (pref.index(hm) if hm in pref else len(pref), x[0])
        for x in sorted(xs, key=rank)[cap:]: drop.add(id(x[2]))
    CAPPED[platform] = [x[2]["id"] for x in out if id(x[2]) in drop]
    return [x for x in out if id(x[2]) not in drop]

# ---------------------------------------------------------------- backing off after a refusal
def _khash(secret): return hashlib.sha256((secret or "").encode()).hexdigest()[:16]
BLOCK_ENV = {"instagram": "IG_TOKEN", "facebook": "FB_PAGE_TOKEN", "threads": "THREADS_TOKEN"}
def in_backoff(state, plat):
    """The refusal record for a platform still waiting out its backoff, else None. A different key saved since ends it."""
    b = state.get("meta", "block_" + plat) or {}
    if not b.get("until") or time.time() >= b["until"]: return None
    if b.get("key") and b["key"] != _khash(os.environ.get(BLOCK_ENV[plat], "").strip()): return None
    return b
def note_block(state, plat, why):
    prev = state.get("meta", "block_" + plat) or {}
    state.set("meta", "block_" + plat, {"until": time.time() + BLOCK_BACKOFF_H * 3600, "why": scrub(why)[:160],
              "since": prev.get("since") or time.time(), "key": _khash(os.environ.get(BLOCK_ENV[plat], "").strip())})
def clear_block(state, plat):
    if (state.get("meta", "block_" + plat) or {}).get("until"): state.set("meta", "block_" + plat, {})

def missing_media(pk, it):
    need = [it.get(k) for k in ("image", "video", "cover") if it.get(k)] + list(it.get("images") or [])
    return [m for m in need if not pk.exists(m)]

# ---------------------------------------------------------------- Instagram
class IGError(Exception):
    def __init__(self, msg, code=None, sub=None): super().__init__(msg); self.code = code; self.sub = sub
class NotEligible(Exception):
    """A post this account can't make yet (a trial Reel under Instagram's follower minimum): skipped, never retried."""

class IG:
    def __init__(self, token): self.token = token; self.user_id = None; self.username = None; self.followers = 0
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
        self.user_id = str(j.get("user_id") or j.get("id")); self.username = j.get("username"); self.followers = int(j.get("followers_count") or 0)
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
        if it.get("trial"):                         # a trial Reel: shown to non-followers first, to test a hook before followers see it
            if ig.followers < TRIAL_MIN_FOLLOWERS: raise NotEligible("trial Reels need %d followers (now %d)" % (TRIAL_MIN_FOLLOWERS, ig.followers))
            strat = it["trial"] if it["trial"] in ("MANUAL", "SS_PERFORMANCE") else "SS_PERFORMANCE"
            p["trial_params"] = json.dumps({"graduation_strategy": strat}); p.pop("share_to_feed", None)
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
     "@{u} here you go: tap the link in our bio, then your industry under “Try it now.” A demo office opens with sample leads, no sign-up. 7 days free when you’re ready."),
    (re.compile(r"\b(price|pricing|cost|how much)\b", re.I), "price",
     "@{u} $49 per rep, per month. Reps use their own phones, so there’s nothing else to buy. 7 days free, no card to start: {site}"),
]
def answer_comments(ig, state, cfg):
    done = 0
    since = now_utc() - dt.timedelta(days=7)
    fresh = now_utc() - dt.timedelta(days=3)
    day_ago = time.time() - 86400
    recent = [v for v in state.all("replied").values() if (v.get("at") or 0) > day_ago and v.get("reply")]
    sent, people = len(recent), {(v.get("user") or "").lower() for v in recent}
    media = ig.call("GET", ig.user_id + "/media", fields="id,timestamp", limit=25).get("data", [])
    for m in media:
        try:
            if dt.datetime.fromisoformat(m["timestamp"].replace("+0000", "+00:00")) < since: continue
        except Exception: pass
        comments = ig.call("GET", m["id"] + "/comments", fields="id,text,username,timestamp", limit=50).get("data", [])
        for c in comments:
            if not c.get("id") or (c.get("username") or "").lower() == (ig.username or "").lower(): continue
            if state.get("replied", c["id"]): continue
            try:
                if dt.datetime.fromisoformat(c["timestamp"].replace("+0000", "+00:00")) < fresh: continue
            except Exception: pass
            kind = None
            for rx, k, tpl in KEYWORDS:
                if rx.search(c.get("text") or ""): kind, text = k, tpl.format(u=c.get("username") or "there", site=SITE); break
            if not kind: continue
            who = (c.get("username") or "").lower()
            if sent >= REPLY_DAY_MAX:
                log("reply limit reached (%d today); %s's comment waits" % (REPLY_DAY_MAX, c.get("username"))); return done
            if who and who in people:
                state.set("replied", c["id"], {"at": time.time(), "kind": kind, "user": c.get("username"), "media": m["id"], "skipped": "already answered them today"}); continue
            rec = {"at": time.time(), "kind": kind, "user": c.get("username"), "media": m["id"]}
            try:
                rec["reply"] = ig.call("POST", c["id"] + "/replies", message=text)["id"]
            except IGError as e:
                rec["error"] = str(e)
            state.set("replied", c["id"], rec)
            done += 1
            if rec.get("reply"): sent += 1; people.add(who)
            log("answered", kind, "comment from", c.get("username"), "->", rec.get("reply") or rec.get("error"))
    return done


# ---------------------------------------------------------------- where each post points, and its tags
INDS = ("insurance", "realestate", "mca", "auto", "solar")
IND_NAME = {"insurance": "insurance", "realestate": "real estate", "mca": "business funding", "auto": "auto", "solar": "solar"}
def campaign(iid):
    m = re.match(r"^(w\d+[a-z]?)(-|$)", iid or ""); return m.group(1) if m else ""
_SIDE = {}
def side(iid):
    """Tags for posts planned before plan.json carried them (instagram/tags.json)."""
    if "_" not in _SIDE:
        _SIDE["_"] = True
        try: _SIDE.update({k: v for k, v in json.load(open(os.path.join(CONTENT_DIR, "tags.json"))).items() if not k.startswith("_")})
        except Exception: pass
    return _SIDE.get(iid) or {}
def item_tags(it):
    t = dict(side(it["id"]).get("tags") or {}); t.update(it.get("tags") or {}); return t
def item_go(it):
    g = it.get("go") or side(it["id"]).get("go") or ""
    if g in ("home", "trial") or (g.startswith("demo:") and g[5:] in INDS): return g
    ind = item_tags(it).get("ind") or ""
    return "demo:" + ind if ind in INDS else "home"
def site_link(it, source, medium="post"):
    """The post's own link to vpexdialer.com: tagged with the platform and the post, so its visits, demos and sign-ups count for it."""
    q = "utm_source=%s&utm_medium=%s&utm_content=%s" % (source, medium, it["id"])
    if campaign(it["id"]): q += "&utm_campaign=" + campaign(it["id"])
    g = item_go(it)
    if g == "trial": q += "&trial=start"
    return "https://" + SITE + "/?" + q + ("#demo-" + g[5:] if g.startswith("demo:") else "")

# ---------------------------------------------------------------- captions for Facebook and Threads
LEGAL_RE = re.compile(r"Not legal advice|Based on (published state rules|the CMS)", re.I)
CTA_RE = re.compile(r"\bcomment demo\b|\blink in (our )?bio\b|\btap the link\b", re.I)
TAGS_ONLY_RE = re.compile(r"^(\s*#[\w]+)+\s*$")
def _try_line(it, link):
    g = item_go(it)
    if g.startswith("demo:"): return "Open a live %s demo office, no sign-up: %s" % (IND_NAME[g[5:]], link)
    if g == "trial": return "7 days free, no card to start: " + link
    return "See it with sample leads, no sign-up: " + link
def fb_caption(it):
    """Facebook links are tappable, so "Comment DEMO" and "Link in bio" become the post's own link."""
    link = site_link(it, "facebook")
    if it.get("fb_caption"): return it["fb_caption"].replace("{link}", link)
    paras = re.split(r"\n\s*\n", (it.get("caption") or "").strip())
    out, placed = [], False
    for p in paras:
        if CTA_RE.search(p) and not LEGAL_RE.search(p):
            if not placed: out.append(_try_line(it, link)); placed = True
            continue
        out.append(p)
    if not placed:
        k = len(out)
        while k > 0 and (TAGS_ONLY_RE.match(out[k - 1]) or LEGAL_RE.search(out[k - 1])): k -= 1
        out.insert(k, _try_line(it, link))
    return "\n\n".join(out)
def _cut(text, n):
    if len(text) <= n: return text
    t = text[:n]; k = max(t.rfind(". "), t.rfind("? "), t.rfind("! "))
    return (t[:k + 1] if k > n * 0.5 else t.rstrip()[: n - 1].rstrip() + "…")
def threads_text(it):
    """Threads allows 500 characters: the opening paragraphs that fit, any legal line, and the post's own link. No hashtags."""
    link = site_link(it, "threads")
    if it.get("threads_text"): return _cut(it["threads_text"].replace("{link}", link), 500)
    paras = [p.strip() for p in re.split(r"\n\s*\n", (it.get("caption") or "").strip()) if p.strip()]
    paras = [re.sub(r"(?<!\w)#\w+", "", p).strip() if not LEGAL_RE.search(p) else p for p in paras if not TAGS_ONLY_RE.match(p)]
    legal = [p for p in paras if LEGAL_RE.search(p)]
    body = [p for p in paras if p and p not in legal and not CTA_RE.search(p)]
    tail = "\n\n".join(legal + [_try_line(it, link)])
    budget = 500 - len(tail) - 2
    out = ""
    for p in body:
        cand = (out + "\n\n" + p) if out else p
        if len(cand) <= budget: out = cand
        else:
            room = budget - (len(out) + 2 if out else 0)
            if room >= 80 or not out:
                part = _cut(p, room)
                if part.endswith("…") and out: break      # half a sentence reads worse than none
                out = (out + "\n\n" + part) if out else part
            break
    return ((out + "\n\n") if out else "") + tail

# ---------------------------------------------------------------- Facebook Page and Threads: same plan, same spacing rules
def api_call(base, token, method, path, files=None, **params):
    """One Graph API call for Facebook or Threads. Errors come back as IGError with Meta's message (never the key)."""
    url = path if path.startswith("http") else base + "/" + path.lstrip("/")
    params["access_token"] = token
    for attempt in range(3):
        try:
            r = requests.request(method, url, params=params if method == "GET" else None, data=params if method != "GET" else None, timeout=90)
        except requests.RequestException as e:
            if attempt == 2: raise IGError("network: " + scrub(e))
            time.sleep(5); continue
        try: j = r.json()
        except ValueError: j = {"error": {"message": r.text[:300]}}
        if r.status_code >= 500 and attempt < 2: time.sleep(5); continue
        if isinstance(j, dict) and "error" in j:
            e = j["error"] if isinstance(j["error"], dict) else {"message": str(j["error"])}
            extra = " ".join(x for x in (e.get("error_user_title"), e.get("error_user_msg")) if x)
            raise IGError(scrub(e.get("message", "error")) + (" (" + extra + ")" if extra else ""), e.get("code"), e.get("error_subcode"))
        return j

class FB:
    name = "Facebook"
    def __init__(self, token, page_id=""): self.token = token; self.page_id = page_id; self.title = ""
    def call(self, method, path, **p): return api_call(FB_GRAPH, self.token, method, path, **p)
    def me(self):
        j = self.call("GET", self.page_id or "me", fields="id,name")
        self.page_id = str(j.get("id") or self.page_id); self.title = j.get("name", ""); return j
    def post(self, media, pk, it):
        t, msg = it["type"], fb_caption(it)
        if t == "reel":
            st = self.call("POST", self.page_id + "/video_reels", upload_phase="start")
            vid = str(st["video_id"]); up = st.get("upload_url") or (FB_RUPLOAD + "/" + vid)
            try:
                r = requests.post(up, headers={"Authorization": "OAuth " + self.token, "file_url": media.url(pk, it["video"])}, timeout=180)
                j = r.json()
            except Exception as e: raise IGError("Facebook couldn't take the video: " + scrub(e)[:200])
            if not j.get("success"): raise IGError("Facebook couldn't take the video: " + scrub(json.dumps(j))[:200])
            self.call("POST", self.page_id + "/video_reels", upload_phase="finish", video_id=vid, video_state="PUBLISHED", description=msg)
            link = ""
            try: link = self.call("GET", vid, fields="permalink_url").get("permalink_url", "")
            except IGError: pass
            return vid, ("https://www.facebook.com" + link) if link.startswith("/") else link
        if t == "image":
            j = self.call("POST", self.page_id + "/photos", url=media.url(pk, it["image"]), message=msg)
            return str(j.get("post_id") or j.get("id")), ""
        if t == "carousel":
            ids = [self.call("POST", self.page_id + "/photos", url=media.url(pk, img), published="false")["id"] for img in it["images"][:10]]
            p = {"message": msg}
            for i, fid in enumerate(ids): p["attached_media[%d]" % i] = json.dumps({"media_fbid": fid})
            return str(self.call("POST", self.page_id + "/feed", **p)["id"]), ""
        raise IGError("Facebook can't post a " + t)

class TH:
    name = "Threads"
    def __init__(self, token): self.token = token; self.user_id = None; self.username = ""
    def call(self, method, path, **p): return api_call(TH_GRAPH, self.token, method, path, **p)
    def me(self):
        j = self.call("GET", "me", fields="id,username"); self.user_id = str(j["id"]); self.username = j.get("username", ""); return j
    def wait(self, cid, limit_s=300):
        t0 = time.time()
        while True:
            j = self.call("GET", cid, fields="status,error_message")
            st = j.get("status")
            if st in ("FINISHED", "PUBLISHED"): return
            if st in ("ERROR", "EXPIRED"): raise IGError("Threads couldn't process the media (%s %s)" % (st, j.get("error_message") or ""))
            if time.time() - t0 > limit_s: raise IGError("Threads took too long processing the media")
            time.sleep(float(os.environ.get("IG_POLL_S", "10")))
    def create(self, **p): return str(self.call("POST", self.user_id + "/threads", **p)["id"])
    def post(self, media, pk, it):
        t, text = it["type"], threads_text(it)
        if t == "reel": cid = self.create(media_type="VIDEO", video_url=media.url(pk, it["video"]), text=text)
        elif t == "image" or (t == "thread" and it.get("image")): cid = self.create(media_type="IMAGE", image_url=media.url(pk, it["image"]), text=text)
        elif t == "carousel":
            kids = [self.create(media_type="IMAGE", image_url=media.url(pk, img), is_carousel_item="true") for img in it["images"][:20]]
            for k in kids: self.wait(k, 180)
            cid = self.create(media_type="CAROUSEL", children=",".join(kids), text=text)
        elif t == "thread": cid = self.create(media_type="TEXT", text=text)
        else: raise IGError("Threads can't post a " + t)
        self.wait(cid)
        pid = str(self.call("POST", self.user_id + "/threads_publish", creation_id=cid)["id"])
        link = ""
        try: link = self.call("GET", pid, fields="permalink").get("permalink", "")
        except IGError: pass
        return pid, link

def fresh_key(state, env, slot, refresh):
    """Keys that expire (Threads: 60 days) are renewed weekly by the bot and kept in its state, like the Instagram key."""
    sec = os.environ.get(env, "").strip(); keep_secret(sec)
    h = hashlib.sha256(sec.encode()).hexdigest()[:16]
    rec = state.get("meta", slot) or {}
    tok = rec["token"] if rec.get("from") == h and rec.get("token") else sec
    keep_secret(tok)
    if refresh and (rec.get("from") != h or time.time() - (rec.get("refreshedAt") or 0) > 6 * 86400):
        try:
            r = requests.get(refresh[0], params={"grant_type": refresh[1], "access_token": tok}, timeout=30).json()
            if r.get("access_token"): tok = r["access_token"]; keep_secret(tok); log(env, "renewed; good for", int(r.get("expires_in", 0) / 86400), "days")
            else: log(env, "renewal skipped:", scrub((r.get("error") or {}).get("message", r)))
        except Exception as e: log(env, "renewal failed:", scrub(e))
        state.set("meta", slot, {"token": tok, "from": h, "refreshedAt": time.time()})
    return tok

def xp_platforms(state):
    out = []
    if os.environ.get("FB_PAGE_TOKEN", "").strip():
        out.append(("facebook", "fb", lambda: FB(fresh_key(state, "FB_PAGE_TOKEN", "fb_token", None), os.environ.get("FB_PAGE_ID", "").strip())))
    if os.environ.get("THREADS_TOKEN", "").strip():
        out.append(("threads", "th", lambda: TH(fresh_key(state, "THREADS_TOKEN", "th_token", (TH_REFRESH_URL, "th_refresh_token")))))
    return out

def xp_due(state, coll, plat, now):
    for when, pk, it in all_items(load_packs(), platform=plat):
        if when <= now and (state.get(coll, it["id"]) or {}).get("status") not in ("posted", "missed", "skipped", "failed"): return True
    return False

def crosspost(state, media, note):
    """Post due feed posts (and Threads-only items) to the Facebook Page and Threads: one per platform per run,
    at least XP_GAP_MIN apart, skipped (not dumped late) after the same grace as Instagram."""
    if os.path.exists(os.path.join(CONTENT_DIR, "PAUSE")) or os.environ.get("IG_PAUSED", "").lower() == "true": return
    now = now_utc()
    for plat, coll, make in xp_platforms(state):
        client, signed = None, False
        b = in_backoff(state, plat)
        if b:
            log(plat, "refused the bot; not contacting it again until", dt.datetime.fromtimestamp(b["until"], NY).strftime("%I:%M %p").lstrip("0")); continue
        for when, pk, it in all_items(load_packs(), platform=plat):
            iid = it["id"]; rec = state.get(coll, iid) or {}
            if when > now or rec.get("status") in ("posted", "missed", "skipped", "failed"): continue
            late_h = (now - when).total_seconds() / 3600
            if late_h > FEED_GRACE_H:
                state.set(coll, iid, {"status": "missed", "at": time.time(), "lateHours": round(late_h, 1)}); log(plat, "missed (too late now):", iid); continue
            if missing_media(pk, it):
                state.set(coll, iid, {"status": "failed", "attempts": MAX_ATTEMPTS, "error": "missing files"}); continue
            last = state.get("meta", "last_" + coll) or {}
            since = (time.time() - (last.get("at") or 0)) / 60
            if since < XP_GAP_MIN: log("waiting to post", iid, "on", plat, "- the last one went up %d minutes ago" % since); break
            tries = rec.get("attempts", 0)
            try:
                if not signed:
                    client = client or make(); client.me(); signed = True
                    al = state.get("meta", coll + "_alert") or {}
                    clear_block(state, plat)
                    if al.get("msg"): state.set("meta", coll + "_alert", {}); note.send(client.name + " posting is back", client.name + " accepted the key again.")
                log("posting", iid, "on", plat, "(" + it["type"] + ")")
                pid, link = client.post(media, pk, it)
                state.set(coll, iid, {"status": "posted", "at": time.time(), "postId": pid, "permalink": link, "title": it.get("title", iid)})
                state.set("meta", "last_" + coll, {"at": time.time()})
                log("posted", iid, "on", plat, link)
            except IGError as e:
                detail = str(e)
                if not signed:                      # couldn't sign in: one alert (again after 12 hours), nothing marked failed
                    al = state.get("meta", coll + "_alert") or {}
                    if not detail.startswith("network:") and (al.get("msg") != detail[:120] or time.time() - (al.get("at") or 0) > 12 * 3600):
                        note.send(plat.title() + " posting can't sign in", plat.title() + " said: " + detail[:100] + ". Its posts are skipped until that's fixed; the bot tries again every %d hours." % BLOCK_BACKOFF_H)
                        state.set("meta", coll + "_alert", {"msg": detail[:120], "at": time.time()})
                    if not detail.startswith("network:"): note_block(state, plat, detail)
                    log(plat, "can't sign in:", detail); break
                tries += 1
                state.set(coll, iid, {"status": "failed" if tries >= MAX_ATTEMPTS else "retry", "attempts": tries, "error": detail[:300], "at": time.time()})
                log("couldn't post", iid, "on", plat, "->", detail)
                if tries >= MAX_ATTEMPTS: note.send("Couldn't post on " + plat.title() + ": " + it.get("title", iid)[:50], detail[:150])
            break

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
        if rec.get("status") in DONE: continue
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
            log("posting", iid, "(" + it["type"] + (", trial" if it.get("trial") else "") + ")")
            mid, link = post_item(ig, media, pk, it)
            state.set("posted", iid, {"status": "posted", "at": time.time(), "mediaId": mid, "permalink": link, "title": it.get("title", iid)})
            last[kind] = time.time(); state.set("meta", "last_post", last)
            log("posted", iid, link)
            if it["type"] != "story": note.send("Posted: " + it.get("title", iid), "It's live on Instagram. Tap to see it.", link or "https://www.instagram.com/")
        except NotEligible as e:
            state.set("posted", iid, {"status": "skipped", "at": time.time(), "why": str(e), "title": it.get("title", iid)})
            log("skipped", iid, "->", e); continue
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

# ---------------------------------------------------------------- learn: score every post, then group by what it tried
REEL_METRICS = ["reach", "views", "likes", "comments", "saved", "shares", "total_interactions", "ig_reels_avg_watch_time", "reels_skip_rate"]
FEED_METRICS = ["reach", "views", "likes", "comments", "saved", "shares", "total_interactions", "follows", "profile_visits"]
HOOKS = ["pain", "quote", "number", "news", "question", "pov", "contrast", "myth", "story", "math", "reference", "identity", "offer", "feature", "rule"]
LEARN_MAX_CALLS = int(os.environ.get("IG_LEARN_MAX", "40"))      # insight requests per run, to keep traffic to Instagram low

def _val(x):
    v = None
    if x.get("values"): v = (x["values"][0] or {}).get("value")
    if v is None: v = (x.get("total_value") or {}).get("value")
    return v or 0

def media_insights(ig, mid, kind):
    mets = REEL_METRICS if kind == "REELS" else FEED_METRICS
    try:
        return {x["name"]: _val(x) for x in ig.call("GET", mid + "/insights", metric=",".join(mets)).get("data", []) if x.get("name")}
    except IGError:
        out = {}
        for m in mets:                                # one metric Instagram won't give (new ones are "in development") shouldn't sink the rest
            try:
                d = ig.call("GET", mid + "/insights", metric=m).get("data", [])
                if d: out[m] = _val(d[0])
            except IGError: pass
        return out

def mp4_seconds(data):
    """Length of an MP4 from its movie header (no ffprobe on the runner)."""
    i = data.find(b"mvhd")
    if i < 0: return 0
    v = data[i + 4]
    if v == 1: ts, du = int.from_bytes(data[i + 24:i + 28], "big"), int.from_bytes(data[i + 28:i + 36], "big")
    else: ts, du = int.from_bytes(data[i + 16:i + 20], "big"), int.from_bytes(data[i + 20:i + 24], "big")
    return round(du / ts, 2) if ts else 0

def growth_counts(state, days):
    """The site's anonymous funnel counts (functions/ "hit"), one dict per counter: e, s, m, c, n, i, d, day, count."""
    start = (now_utc() - dt.timedelta(days=days)).astimezone(ZoneInfo("America/New_York")).strftime("%Y-%m-%d")
    docs = []
    if state.db is None:
        docs = [(k, v) for k, v in (state.data.get("growth_days") or {}).items() if k >= start]
    else:
        from google.cloud import firestore
        col = state.db.collection("growth").document("days").collection("items")
        docs = [(d.id, d.to_dict() or {}) for d in col.where(filter=firestore.FieldFilter("day", ">=", start)).stream()]
    out = []
    for day, d in docs:
        for k, n in (d.get("c") or {}).items():
            p = k.split("~") + [""] * 7
            f = lambda x: "" if x in ("-", None) else x
            if p[1] == "ci-check": continue                       # the deploy's own test hits
            out.append({"e": p[0], "s": p[1], "m": f(p[2]), "c": f(p[3]), "n": f(p[4]), "i": f(p[5]), "d": f(p[6]), "day": day, "count": int(n or 0)})
    return out

def _z(vals):
    xs = [v for v in vals if v is not None]
    if len(xs) < 2: return [0.0 if v is not None else None for v in vals]
    m = sum(xs) / len(xs); sd = (sum((x - m) ** 2 for x in xs) / len(xs)) ** 0.5
    return [((v - m) / sd if sd else 0.0) if v is not None else None for v in vals]

def score_rows(rows):
    """One score per post, compared with posts of the same kind (Reels with Reels, posts and carousels together).
    Rates are shrunk toward the group's average so a post seen by 40 people can't top the list on luck.
    Weights follow what Instagram says matters most (watch time, sends, likes) plus what matters to VPEX (site visits)."""
    A = 300.0
    feats = [("sends", "shares", 3), ("saves", "saves", 2), ("likes", "likes", 1), ("comments", "comments", 1), ("visits", "visits", 1), ("site", "site", 2)]
    for kind in ("REELS", "FEED"):
        g = [r for r in rows if (r["kind"] == "REELS") == (kind == "REELS") and r["reach"] > 0]
        if not g: continue
        tr = sum(r["reach"] for r in g)
        cols = {}
        for name, key, w in feats:
            p0 = sum(r[key] for r in g) / tr if tr else 0
            cols[name] = (w, _z([(r[key] + A * p0) / (r["reach"] + A) for r in g]))
        if kind == "REELS":
            cols["kept"] = (3, _z([min(1.0, r["watch"] / r["dur"]) if r["dur"] and r["watch"] else None for r in g]))
            cols["noskip"] = (2, _z([1 - r["skip"] / 100.0 if r["skip"] is not None else None for r in g]))
        for i, r in enumerate(g):
            num = den = 0.0
            for name, (w, zs) in cols.items():
                if zs[i] is not None: num += w * zs[i]; den += w
            r["score"] = round(num / den, 2) if den else 0.0
    return rows

def group_by(rows, key):
    out = {}
    for r in rows:
        k = r.get(key) or "untagged"
        out.setdefault(k, []).append(r)
    res = []
    for k, g in out.items():
        sc = [r["score"] for r in g if r.get("score") is not None]
        avg = sum(sc) / len(sc) if sc else 0
        verdict = "winning" if len(g) >= 3 and avg >= 0.3 else ("losing" if len(g) >= 3 and avg <= -0.3 else "testing")
        res.append({"key": key, "value": k, "n": len(g), "score": round(avg, 2), "reach": round(sum(r["reach"] for r in g) / len(g)), "verdict": verdict})
    res.sort(key=lambda x: -x["score"])
    return res

def learn(state, ig):
    acct = ig.me()
    plan = {it["id"]: (when, pk, it) for when, pk, it in all_items(load_packs(), platform=None)}
    by_mid = {}
    for iid, rec in state.all("posted").items():
        for k in ("mediaId", "media"):
            if rec.get(k): by_mid[str(rec[k])] = iid
    by_cap = {_norm(it.get("caption"))[:40]: iid for iid, (_, _, it) in plan.items() if it.get("caption")}
    media, url = [], ig.user_id + "/media"
    params = dict(fields="id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count", limit=50)
    for _ in range(2):                                   # the last 100 posts at most
        j = ig.call("GET", url, **params); media += j.get("data", [])
        nxt = (j.get("paging") or {}).get("next")
        if not nxt: break
        url, params = nxt, {}
    snaps, calls, now = state.all("media"), 0, time.time()
    rows = []
    for m in media:
        try: ts = dt.datetime.fromisoformat(m["timestamp"].replace("+0000", "+00:00"))
        except Exception: continue
        age_h = (now_utc() - ts).total_seconds() / 3600
        if age_h > 60 * 24: continue
        kind = "REELS" if (m.get("media_product_type") or "").upper() in ("REELS", "CLIPS") else "FEED"
        if (m.get("media_product_type") or "").upper() == "STORY": continue
        snap = snaps.get(m["id"]) or {}
        since = (now - (snap.get("at") or 0)) / 3600
        need = age_h >= 20 and (not snap or (age_h < 8 * 24 and since > 44) or (age_h < 35 * 24 and since > 7 * 24))
        if need and calls < LEARN_MAX_CALLS:
            calls += 1
            snap = {"at": now, "ageH": round(age_h, 1), "m": media_insights(ig, m["id"], kind)}
            state.set("media", m["id"], snap)
        if not snap: continue
        iid = by_mid.get(m["id"]) or by_cap.get(_norm(m.get("caption"))[:40]) or ""
        when, pk, it = plan.get(iid, (None, None, {}))
        tags = item_tags(it) if it else {}
        mm = snap.get("m") or {}
        dur = 0
        if it and it.get("video") and pk is not None:
            try: dur = mp4_seconds(pk.read(it["video"]))
            except Exception: dur = 0
        local = ts.astimezone(ZoneInfo("America/New_York"))
        rows.append({"mid": m["id"], "iid": iid, "kind": kind, "type": (it.get("type") if it else "") or ("reel" if kind == "REELS" else (m.get("media_type") or "").lower().replace("carousel_album", "carousel")),
                     "title": (it.get("title") if it else "") or (m.get("caption") or "").strip().split("\n")[0][:60],
                     "when": local.strftime("%a %b %d"), "slot": (it.get("at") or "")[11:16] if it else local.strftime("%H:00"), "day": local.strftime("%a"), "ts": ts.timestamp(),
                     "reach": int(mm.get("reach") or 0), "views": int(mm.get("views") or 0), "likes": int(mm.get("likes") or m.get("like_count") or 0),
                     "comments": int(mm.get("comments") or m.get("comments_count") or 0), "saves": int(mm.get("saved") or 0), "shares": int(mm.get("shares") or 0),
                     "visits": int(mm.get("profile_visits") or 0), "follows": int(mm.get("follows") or 0),
                     "watch": round((mm.get("ig_reels_avg_watch_time") or 0) / 1000.0, 1), "skip": mm.get("reels_skip_rate") if "reels_skip_rate" in mm else None, "dur": dur,
                     "hook": tags.get("hook", ""), "topic": tags.get("topic", ""), "ind": tags.get("ind", "") or ("all" if it else ""), "cta": tags.get("cta", ""),
                     "series": tags.get("series", ""), "trial": bool(it.get("trial")) if it else False, "site": 0, "taps": 0, "demos": 0, "trials": 0})
    # what each post brought to the site: bio taps on its tile, visits from its Facebook/Threads link, demos and trial forms
    try: g = growth_counts(state, 62)
    except Exception as e: g = []; log("couldn't read the site counts:", scrub(e)[:200])
    by_post = {}
    for h in g:
        if not h["n"]: continue
        b = by_post.setdefault(h["n"], {"bio_tap": 0, "visit": 0, "demo": 0, "trial_view": 0})
        if h["e"] in b: b[h["e"]] += h["count"]
    for r in rows:
        b = by_post.get(r["iid"]) or {}
        r["taps"], r["demos"], r["trials"] = b.get("bio_tap", 0), b.get("demo", 0), b.get("trial_view", 0)
        r["site"] = r["taps"] + b.get("visit", 0) + r["demos"]
    score_rows(rows)
    rows.sort(key=lambda r: -(r.get("score") or 0))
    groups = {k: group_by(rows, k) for k in ("hook", "topic", "type", "cta", "slot", "ind", "series")}
    def pick(k, verdicts): return [x["value"] for x in groups[k] if x["verdict"] in verdicts and x["value"] not in ("untagged", "")]
    tested = {x["value"] for x in groups["hook"] if x["n"] >= 2}
    best_type = max(groups["type"], key=lambda x: x["reach"])["value"] if groups["type"] else ""
    recs = {"more": pick("hook", ("winning",))[:3] + pick("topic", ("winning",))[:3], "less": pick("hook", ("losing",))[:2] + pick("topic", ("losing",))[:2],
            "untested_hooks": [h for h in HOOKS if h not in tested][:5], "widest_reach_format": best_type,
            "best_slot": groups["slot"][0]["value"] if groups["slot"] else "", "top_posts": [r["iid"] or r["title"] for r in rows[:3]]}
    state.set("meta", "learnings", {"at": time.time(), "followers": acct.get("followers_count"), "groups": groups, "recs": recs,
                                    "rows": [{k: r[k] for k in ("iid", "title", "kind", "type", "reach", "shares", "saves", "likes", "watch", "dur", "skip", "taps", "demos", "score", "hook", "topic", "slot")} for r in rows[:60]]})
    pct = lambda a, b: ("%.1f" % (100.0 * a / b)) if b else "-"
    log("@%s: %s followers. %d posts scored (%d insight requests this run)." % (acct.get("username"), acct.get("followers_count"), len(rows), calls))
    log("post | type | reach | sends % | saves % | likes % | watch s | kept % | skip % | site taps | demos | score | hook / topic")
    for r in rows:
        kept = pct(min(r["watch"], r["dur"]), r["dur"]) if r["kind"] == "REELS" and r["dur"] else "-"
        log("%s | %s | %d | %s | %s | %s | %s | %s | %s | %d | %d | %+.2f | %s / %s" % ((r["iid"] or r["title"])[:28], r["type"][:8], r["reach"], pct(r["shares"], r["reach"]), pct(r["saves"], r["reach"]),
            pct(r["likes"], r["reach"]), r["watch"] if r["kind"] == "REELS" else "-", kept, ("%.0f" % r["skip"]) if r["skip"] is not None else "-", r["taps"], r["demos"], r.get("score") or 0, r["hook"] or "?", r["topic"] or "?"))
    for k, title in (("hook", "By hook"), ("topic", "By topic"), ("type", "By format"), ("cta", "By call to action"), ("slot", "By time"), ("ind", "By industry")):
        log("%s: %s" % (title, "; ".join("%s %+.2f (n=%d, reach %d, %s)" % (x["value"], x["score"], x["n"], x["reach"], x["verdict"]) for x in groups[k])))
    log("Make more of: " + (", ".join(recs["more"]) or "nothing proven yet (needs 3+ posts of a kind)"))
    log("Make less of: " + (", ".join(recs["less"]) or "nothing proven yet"))
    log("Hooks not tested yet: " + ", ".join(recs["untested_hooks"]))
    log("Widest reach format: %s. Best time slot so far: %s." % (recs["widest_reach_format"] or "-", recs["best_slot"] or "-"))
    return rows

# ---------------------------------------------------------------- scorecard: the whole funnel, privately, every Monday
def office_stats(state, now_ms):
    """Trial offices from the app's database: when each was created and the days it made calls. Counts only.
    VPEX's own free offices (plan "comp") and the deploy's test offices (ci-...) are left out."""
    offices = []
    if state.db is None:
        src = state.data.get("offices_test") or {}
        for slug, o in src.items(): offices.append((slug, o.get("createdAt") or 0, o.get("plan", "trial"), set(o.get("days") or [])))
    else:
        for d in state.db.collection("offices").stream():
            o = d.to_dict() or {}
            if o.get("plan") == "comp" or d.id.startswith("ci-"): continue
            try: days = {x.id[2:] for x in d.reference.collection("callDays").list_documents(page_size=1000) if x.id.startswith("n_")}
            except Exception: days = set()
            offices.append((d.id, o.get("createdAt") or 0, o.get("plan", "trial"), days))
    offices = [x for x in offices if x[2] != "comp" and not x[0].startswith("ci-")]
    ny = ZoneInfo("America/New_York")
    def day(ms): return dt.datetime.fromtimestamp(ms / 1000, ny).strftime("%Y-%m-%d")
    wk, d7 = now_ms - 7 * 86400000, day(now_ms - 7 * 86400000)
    new = [o for o in offices if o[1] >= wk]
    cohort = [o for o in offices if now_ms - 21 * 86400000 <= o[1] < now_ms - 14 * 86400000]
    def w2(o): a, b = day(o[1] + 7 * 86400000), day(o[1] + 14 * 86400000); return any(a <= x < b for x in o[3])
    return {"total": len(offices), "new": len(new), "new_called": sum(1 for o in new if o[3]), "cohort": len(cohort), "cohort_w2": sum(1 for o in cohort if w2(o)),
            "active": sum(1 for o in offices if any(x >= d7 for x in o[3])), "paid": sum(1 for o in offices if o[2] == "paid")}

ACCOUNT_METRICS = ["reach", "views", "profile_links_taps", "accounts_engaged", "total_interactions", "likes", "shares", "saves"]
def account_insights(ig, since, until):
    p = dict(period="day", metric_type="total_value", since=int(since.timestamp()), until=int(until.timestamp()))
    try: return {x["name"]: _val(x) for x in ig.call("GET", ig.user_id + "/insights", metric=",".join(ACCOUNT_METRICS), **p).get("data", []) if x.get("name")}
    except IGError:
        out = {}
        for m in ACCOUNT_METRICS:
            try:
                d = ig.call("GET", ig.user_id + "/insights", metric=m, **p).get("data", [])
                if d: out[m] = _val(d[0])
            except IGError: pass
        return out

FUNNEL = [("bio_view", "Saw the link page"), ("bio_tap", "Tapped a post or button there"), ("visit", "Opened the sales page or a demo"), ("demo", "Opened a demo office"),
          ("demo_call", "Logged a call in the demo"), ("trial_view", "Opened the trial form"), ("signup", "Started a free trial")]
def scorecard(state, note, ig, media):
    now = now_utc(); wk = now - dt.timedelta(days=7); pw = now - dt.timedelta(days=14)
    def posted(coll, a, b): return sum(1 for v in state.all(coll).values() if v.get("status") in ("posted", "handed") and a.timestamp() <= (v.get("at") or 0) < b.timestamp())
    posts = {"Instagram": posted("posted", wk, now), "Facebook": posted("fb", wk, now), "Threads": posted("th", wk, now)}
    prev_posts = {"Instagram": posted("posted", pw, wk), "Facebook": posted("fb", pw, wk), "Threads": posted("th", pw, wk)}
    acct, ins, ins_prev = {}, {}, {}
    if ig:
        acct = ig.me(); ins = account_insights(ig, wk, now); ins_prev = account_insights(ig, pw, wk)
    last = state.get("meta", "lastScore") or {}
    followers = acct.get("followers_count")
    gained = (followers - last["followers"]) if followers is not None and last.get("followers") is not None else None
    try: g = growth_counts(state, 16)
    except Exception as e: g = []; log("couldn't read the site counts:", scrub(e)[:200])
    ny = ZoneInfo("America/New_York")
    d7 = wk.astimezone(ny).strftime("%Y-%m-%d"); d14 = pw.astimezone(ny).strftime("%Y-%m-%d")
    cur = [h for h in g if h["day"] >= d7]; old = [h for h in g if d14 <= h["day"] < d7]
    def tot(hs, e, **f): return sum(h["count"] for h in hs if h["e"] == e and all(h[k] == v for k, v in f.items()))
    funnel = [(lbl, tot(cur, e), tot(old, e)) for e, lbl in FUNNEL]
    sources = sorted({h["s"] for h in cur if h["e"] in ("visit", "demo", "signup")})
    by_src = sorted([(s_, tot(cur, "visit", s=s_), tot(cur, "demo", s=s_), tot(cur, "trial_view", s=s_), tot(cur, "signup", s=s_)) for s_ in sources], key=lambda x: -(x[1] + x[2]))
    posts_site = {}
    for h in cur:
        if h["n"] and not h["n"].startswith("bio-"):
            b = posts_site.setdefault(h["n"], [0, 0, 0, 0])
            k = {"bio_tap": 0, "demo": 1, "trial_view": 2, "signup": 3}.get(h["e"])
            if k is not None: b[k] += h["count"]
    top_site = sorted(posts_site.items(), key=lambda kv: -(kv[1][3] * 100 + kv[1][2] * 10 + kv[1][1] * 3 + kv[1][0]))[:6]
    titles = {it["id"]: it.get("title", it["id"]) for _, _, it in all_items(load_packs(), platform=None)}
    home = tot(cur, "home_screen")
    try: off = office_stats(state, int(now.timestamp() * 1000))
    except Exception as e: off = None; log("couldn't read offices:", scrub(e)[:200])
    lrn = state.get("meta", "learnings") or {}
    drop = None                                 # where people drop off most, among steps with at least 10 people
    for (a, na, _), (b, nb, _) in zip(funnel[2:], funnel[3:]):
        if na >= 10 and (drop is None or nb / na < drop[2]): drop = (a, b, nb / na)
    def delta(a, b): return "" if not b and not a else (" <small>(%s%d)</small>" % ("+" if a - b >= 0 else "", a - b))
    E = esc
    sec = ["<h2>Posting this week</h2><table>" + "".join("<tr><td>%s</td><td class=n>%d%s</td><td class=s>%.1f a day</td></tr>" % (k, v, delta(v, prev_posts[k]), v / 7.0) for k, v in posts.items()) + "</table>"]
    if ig:
        names = [("Followers", None), ("Accounts reached", "reach"), ("Views", "views"), ("Taps on the bio link", "profile_links_taps"), ("Accounts that engaged", "accounts_engaged"),
                 ("Likes, comments, saves, shares", "total_interactions"), ("Shares (sends)", "shares"), ("Saves", "saves")]
        tr = ""
        for lbl, key in names:
            if key is None:
                if followers is None: continue
                tr += "<tr><td>Followers</td><td class=n>%s%s</td></tr>" % (f"{int(followers):,}", (" <small>(%s%d this week)</small>" % ("+" if gained >= 0 else "", gained)) if gained is not None else "")
                continue
            if ins.get(key) is None: continue
            tr += "<tr><td>%s</td><td class=n>%s%s</td></tr>" % (lbl, f"{int(ins[key]):,}", delta(int(ins[key]), int(ins_prev[key])) if ins_prev.get(key) is not None else "")
        er = (100.0 * ins.get("total_interactions", 0) / ins["reach"]) if ins.get("reach") else None
        sec.append("<h2>Instagram (@%s)</h2><table>%s</table>%s" % (E(acct.get("username", "")), tr, ("<p class=s>Engagement: %.1f%% of accounts reached liked, commented, saved or shared.</p>" % er) if er is not None else ""))
    else:
        sec.append("<h2>Instagram</h2><p class=s>Instagram refused the bot this week, so its numbers are missing.</p>")
    fr = "".join("<tr><td>%s</td><td class=n>%s%s</td></tr>" % (E(lbl), f"{n:,}", delta(n, o)) for lbl, n, o in funnel)
    vis, dem, trv, sup = funnel[2][1], funnel[3][1], funnel[5][1], funnel[6][1]
    conv = []
    if vis: conv.append("%.0f%% of visits opened a demo" % (100.0 * dem / vis))
    if dem: conv.append("%.0f%% of demos opened the trial form" % (100.0 * trv / dem))
    if trv: conv.append("%.0f%% of trial forms became a trial" % (100.0 * sup / trv))
    if vis: conv.append("%.1f%% of visits became a trial" % (100.0 * sup / vis))
    sec.append("<h2>vpexdialer.com this week</h2><table>%s</table><p class=s>%s</p>" % (fr, (E(". ".join(conv)) + ".") if conv else "No visits counted yet."))
    if by_src:
        sec.append("<h3>By where they came from</h3><table><tr><th></th><th>Visits</th><th>Demos</th><th>Trial form</th><th>Trials</th></tr>" +
                   "".join("<tr><td>%s</td><td class=n>%d</td><td class=n>%d</td><td class=n>%d</td><td class=n>%d</td></tr>" % (E(s_), a, b, c, d) for s_, a, b, c, d in by_src) + "</table>")
    if top_site:
        sec.append("<h3>Posts that sent people to the site</h3><table><tr><th></th><th>Taps</th><th>Demos</th><th>Trial form</th><th>Trials</th></tr>" +
                   "".join("<tr><td>%s</td><td class=n>%d</td><td class=n>%d</td><td class=n>%d</td><td class=n>%d</td></tr>" % (E(titles.get(k, k)[:46]), v[0], v[1], v[2], v[3]) for k, v in top_site) + "</table>")
    if off:
        sec.append("<h2>Offices</h2><table>" +
                   "<tr><td>New trials this week</td><td class=n>%d</td></tr>" % off["new"] +
                   "<tr><td>Made a first call</td><td class=n>%d%s</td></tr>" % (off["new_called"], (" <small>(%d%%)</small>" % (100 * off["new_called"] / off["new"])) if off["new"] else "") +
                   "<tr><td>Still calling in week 2 <small>(started 2 to 3 weeks ago)</small></td><td class=n>%d of %d</td></tr>" % (off["cohort_w2"], off["cohort"]) +
                   "<tr><td>Offices that called this week</td><td class=n>%d</td></tr>" % off["active"] +
                   "<tr><td>Paying offices</td><td class=n>%d</td></tr>" % off["paid"] +
                   "<tr><td>First opened from a Home Screen</td><td class=n>%d</td></tr>" % home + "</table>")
    nxt = []
    if drop: nxt.append("Biggest drop: %s, then %s (only %.0f%% go on). Fix that step first." % (drop[0].lower(), drop[1].lower(), drop[2] * 100))
    r = lrn.get("recs") or {}
    if r.get("more"): nxt.append("Make more of: " + ", ".join(r["more"]) + ".")
    if r.get("less"): nxt.append("Make less of: " + ", ".join(r["less"]) + ".")
    if r.get("untested_hooks"): nxt.append("Hooks to test next: " + ", ".join(r["untested_hooks"][:3]) + ".")
    tops = [titles.get(x, x) for x in (r.get("top_posts") or [])]
    if tops: nxt.append("Best posts by score: " + "; ".join(tops) + ".")
    sec.append("<h2>What to do next</h2><ul>" + "".join("<li>%s</li>" % E(x) for x in nxt or ["Keep posting; there isn't enough data yet to call a winner."]) + "</ul>")
    when = now.astimezone(ny).strftime("%b %-d")
    html = ("<!doctype html><html><head><meta charset=utf-8><meta name=viewport content='width=device-width, initial-scale=1'><meta name=robots content=noindex><title>VPEX scorecard, week ending %s</title>"
            "<style>body{margin:0;background:#0D1224;color:#EDF0FB;font:16px/1.45 -apple-system,system-ui,sans-serif}main{max-width:640px;margin:0 auto;padding:22px 16px 60px}"
            ".wm{color:#E8B94A;font-weight:800;letter-spacing:.04em}h1{font-size:26px;line-height:1.15;margin:8px 0 2px}h2{font-size:19px;margin:28px 0 8px;color:#FFC94D}h3{font-size:16px;margin:18px 0 6px}"
            "table{width:100%%;border-collapse:collapse}td,th{padding:8px 4px;border-bottom:1px solid #283258;text-align:left;vertical-align:top}th{color:#A2AACB;font-weight:600;font-size:13px}"
            ".n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:650}small,.s{color:#A2AACB}.s{font-size:14px}li{margin:6px 0}</style></head>"
            "<body><main><div class=wm>VPEX</div><h1>Scorecard, week ending %s</h1><p class=s>Private link for Vincent; it stops working in 7 days. Counts from the site are anonymous.</p>%s</main></body></html>") % (when, when, "".join(sec))
    state.set("meta", "lastScore", {"followers": followers, "at": time.time()})
    url = media.page("scorecard-" + now.strftime("%Y%m%d"), html, hours=24 * 7) if media else ""
    open(os.environ.get("REPORT_FILE", "report.html"), "w").write(html)
    head = "%d posts" % sum(posts.values()) + (", %s reached" % f"{int(ins['reach']):,}" if ins.get("reach") else "") + ", %d site visits, %d demos, %d trials" % (vis, dem, sup)
    note.send("VPEX this week: " + head, "Tap for the scorecard: what worked, where people drop off, what to do next.", url or "https://" + SITE + "/")
    log("Scorecard ready and sent to Vincent's phone as a private page (numbers stay out of this public log).")
    return html

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
    L = limits()
    if os.environ.get("IG_DAY_CAPS", "").lower() != "off":
        log("Daily ceilings:", "; ".join("%s %s" % (p, ", ".join("%d %s" % (v, k) for k, v in c.items())) for p, c in L["caps"].items()),
            "| kept first:", ", ".join(L["pref"]))
        for plat in ("instagram", "facebook", "threads"):
            all_items(packs, platform=plat)
            if CAPPED.get(plat): log("  %s: %d items in the loaded packs are over the ceilings and skipped" % (plat.title(), len(CAPPED[plat])))
    log("Trial Reels: %s" % ("available" if ig.followers >= TRIAL_MIN_FOLLOWERS else "not yet (Instagram needs %d followers; trial items are skipped until then)" % TRIAL_MIN_FOLLOWERS))
    plats = xp_platforms(state)
    if not plats: log("Facebook Page and Threads: off (no FB_PAGE_TOKEN or THREADS_TOKEN saved).")
    for plat, coll, make in plats:
        try:
            c = make(); c.me()
            log("%s key works: %s" % (c.name, getattr(c, "title", "") or "@" + getattr(c, "username", "")))
        except IGError as e:
            log("%s key doesn't work: %s" % (plat.title(), e)); continue
        its = all_items(packs, platform=plat); counts = {}
        for when, pk, it in its: st = (state.get(coll, it["id"]) or {}).get("status", "waiting"); counts[st] = counts.get(st, 0) + 1
        log("  %s plan: %d items (%s)" % (plat.title(), len(its), ", ".join("%d %s" % (v, k) for k, v in sorted(counts.items()))))

# A test post that never goes live: the next feed post and the next story go through every step of posting (upload,
# Instagram fetching and processing the media) except the final publish. Unpublished drafts expire on their own.
def test(state, media, note, ig):
    now = now_utc(); picked = {}
    for when, pk, it in all_items(load_packs()):
        if when < now - dt.timedelta(hours=1) or it.get("manual") or it.get("trial"): continue
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

# Keep traffic to Instagram low and steady (Meta locks developer accounts over unusual traffic, and blocked this app on Oct 21 2026): a scheduled run only
# contacts Instagram when something is due, or to check comments at most every 2 hours.
COMMENT_EVERY_MIN = float(os.environ.get("IG_COMMENT_EVERY_MIN", "120"))
def quiet_run(state):
    if os.environ.get("IG_ALWAYS_CONTACT") == "1": return False
    now = now_utc()
    for when, pk, it in all_items(load_packs()):
        if when <= now and (state.get("posted", it["id"]) or {}).get("status") not in DONE + ("failed",): return False
    for plat, coll, _ in xp_platforms(state):
        if not in_backoff(state, plat) and xp_due(state, coll, plat, now): return False
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
    want = os.environ.get("IG_ITEM", "").strip().lower()
    if want:   # a plan id, or words from the title ("Reel I")
        found = [it["id"] for _, _, it in all_items(load_packs()) if it["id"].lower() == want or (it.get("title") or "").lower().startswith(want)]
        if not found: raise SystemExit("No post matches " + repr(want) + ".")
        iid = found[0]
    else:
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
        if when > now or rec.get("status") in DONE + ("failed",) or it.get("posted_by_hand"): continue
        if it.get("trial"): state.set("posted", iid, {"status": "skipped", "at": time.time(), "why": "trial Reels aren't handed off"}); continue
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
    raise SoftStop("Instagram is blocking the bot (%s). %s" % (why, ("Sent \"%s\" to Vincent to post by hand." % sent) if sent else "Nothing to hand off this run."))

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "run"
    if mode == "report": mode = "scorecard"            # the Monday report is now the private scorecard
    state = State(os.environ.get("BOT_STATE", "firestore"))
    if mode == "diagnose": return diagnose(state)
    if mode == "run" and quiet_run(state): return
    note = Notify(os.environ.get("BOT_NOTIFY", "live"))
    if mode == "resend": return resend(state, Media(os.environ.get("BOT_MEDIA", "gcs")), note)
    media = Media(os.environ.get("BOT_MEDIA", "gcs")) if mode in ("run", "test", "scorecard") else None
    try:
        b = in_backoff(state, "instagram") if mode == "run" else None
        if b:                                           # refused recently: don't knock again yet, but posts still go to the phone
            log("Instagram refused the bot; not contacting it again until", dt.datetime.fromtimestamp(b["until"], NY).strftime("%I:%M %p").lstrip("0") + ".")
            return handoff(state, media, note, b.get("why") or "refused")
        ig = IG(get_token(state))
        try:
            ig.me()
        except IGError as e:
            if str(e).startswith("network:"):          # Instagram or the network had a blip: try again next run, no alert
                raise SoftStop("Couldn't reach Instagram this time (it tries again on the next run): " + str(e)[:300])
            detail = str(e).rstrip(".") + (" [code %s%s]" % (e.code, "/" + str(e.sub) if e.sub else "") if e.code else "")
            last = state.get("meta", "signin_alert") or {}
            if last.get("msg") != detail or time.time() - (last.get("at") or 0) > 12 * 3600:   # alert once, not every 15 minutes
                note.send("Instagram bot can't sign in", "Instagram said: " + detail[:110] + ". Until it's fixed, the bot sends you each post ready to post by hand.")
                state.set("meta", "signin_alert", {"msg": detail, "at": time.time()})
            note_block(state, "instagram", detail)
            if mode == "run": return handoff(state, media, note, detail)
            if mode in ("scorecard", "learn"):       # these can't read Instagram's numbers while it refuses: a warning, not a red run
                if mode == "scorecard": scorecard(state, note, None, media)
                raise SoftStop("Instagram is refusing the bot (%s); %s." % (detail, "the scorecard went out without Instagram's numbers" if mode == "scorecard" else "learning waits for tomorrow"))
            raise SystemExit("Instagram rejected the key: " + detail)
        clear_block(state, "instagram")
        if (state.get("meta", "signin_alert") or {}).get("msg"):
            state.set("meta", "signin_alert", {}); note.send("Instagram bot is back", "Instagram accepted the key again. Posting picks up on the next run.")
            log("Instagram accepted the key again.")
        if mode == "check": return check(state, ig)
        if mode == "inventory": return inventory(state, ig, mark=False)
        if mode == "insights": return insights(state, ig)
        if mode == "learn": return learn(state, ig)
        if mode == "sync": return inventory(state, ig, mark=True)
        if mode == "scorecard": return scorecard(state, note, ig, media)
        if mode == "test": return test(state, media, note, ig)
        run(state, media, note, ig)
    finally:
        if mode == "run":                               # Facebook and Threads post on schedule even while Instagram is blocked
            try: crosspost(state, media, note)
            except Exception as e: log("cross-posting stopped:", scrub(e)[:300])

if __name__ == "__main__":
    _mode = sys.argv[1] if len(sys.argv) > 1 else "run"
    try:
        main()
    except SoftStop as e:
        log("Stopped: " + str(e))
        if os.environ.get("GITHUB_ACTIONS") == "true": print("::warning title=Instagram bot::" + gh_enc(scrub(str(e))), flush=True)
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
