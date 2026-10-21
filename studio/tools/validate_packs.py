# Checks content packs the way the bot reads them: every file present, ids unique, caption/alt limits, media formats for
# the new pack, and no two posts at the same minute. Packs with "format": 2 in plan.json (week 5 on) also need: tags on every
# feed post and thread (hook from the list, topic, cta), a valid "go", 5 hashtags at most (Instagram's limit), Threads text that
# fits 500 characters, and every day exactly at the bot's daily ceilings (instagram/limits.json, else the bot's defaults; since
# Oct 22 2026: 2 feed posts, 3 stories, 1 Threads-only post), so nothing planned is skipped. Format-1 packs: 3 feed + 5 stories.
# Trial Reels (hook tests shown to non-followers first) don't count toward the feed posts.
# usage: python3 -I studio/tools/validate_packs.py CONTENT_DIR NEW_PACK_NAME FIRST_DAY LAST_DAY
#   e.g. python3 -I studio/tools/validate_packs.py /tmp/check VPEX-Instagram-Week-5 2026-10-27 2026-11-02
# (CONTENT_DIR = a folder with copies of instagram/*.zip plus the new zip)
import sys, os, json, re, io, subprocess, collections, importlib.util, tempfile
BOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../instagram-bot/bot.py")
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("bot", BOT); bot = importlib.util.module_from_spec(spec); spec.loader.exec_module(bot)
bot.CONTENT_DIR = sys.argv[1]; NEW = sys.argv[2]; FIRST, LAST = sys.argv[3], sys.argv[4]
from PIL import Image
packs = bot.load_packs(); items = bot.all_items(packs, platform=None)
print("packs:", [p.name for p in packs], "items:", len(items))
ids = collections.Counter(it["id"] for _, _, it in items)
dups = [k for k, v in ids.items() if v > 1]; print("duplicate ids:", dups or "none")
prob = []
NY = bot.ZoneInfo("America/New_York")
FMT2 = any(p.name == NEW and int(p.plan.get("format") or 1) >= 2 for p in packs)
days = collections.defaultdict(lambda: {"feed": [], "story": [], "thread": [], "trial": []}); minutes = collections.Counter()
CTAS = ("bio", "comment", "save", "share", "question", "none")
for t, pk, it in items:
    local = t.astimezone(NY); d = local.strftime("%Y-%m-%d")
    kind = "thread" if it["type"] == "thread" else ("trial" if it.get("trial") else ("story" if it["type"] == "story" else "feed"))
    if kind in ("feed", "story"): minutes[local.strftime("%Y-%m-%d %H:%M")] += 1
    days[d][kind].append((local.strftime("%H:%M"), it["id"]))
    if pk.name == NEW and FMT2 and it["type"] != "story":
        tg = bot.item_tags(it)
        if tg.get("hook") not in bot.HOOKS: prob.append((it["id"], "tags.hook must be one of " + "/".join(bot.HOOKS), tg.get("hook")))
        if not tg.get("topic"): prob.append((it["id"], "tags.topic missing"))
        if tg.get("cta") not in CTAS: prob.append((it["id"], "tags.cta must be one of " + "/".join(CTAS), tg.get("cta")))
        if tg.get("ind") and tg["ind"] not in bot.INDS: prob.append((it["id"], "tags.ind", tg["ind"]))
        if it.get("go") and bot.item_go(it) != it["go"]: prob.append((it["id"], "go must be home, trial or demo:<industry>", it["go"]))
        if len(re.findall(r"(?<!\w)#\w+", it.get("caption", ""))) > 5: prob.append((it["id"], "more than 5 hashtags"))
        if "threads" in bot.platforms(it):
            tt = bot.threads_text(it)
            raw = it["threads_text"].replace("{link}", bot.site_link(it, "threads")) if it.get("threads_text") else tt
            if len(raw) > 500 or (it["type"] == "thread" and not it.get("threads_text")): prob.append((it["id"], "Threads text over 500 characters (with the link) or missing", len(raw)))
            if bot.LEGAL_RE.search(it.get("caption", "")) and not bot.LEGAL_RE.search(tt): prob.append((it["id"], "Threads text lost the legal line"))
        if it.get("trial") and it["type"] != "reel": prob.append((it["id"], "only Reels can be trial Reels"))
    mm = bot.missing_media(pk, it)
    if mm: prob.append((it["id"], "missing", mm))
    cap = it.get("caption", "")
    if len(cap) > 2200 or len(re.findall(r"#\w+", cap)) > 30: prob.append((it["id"], "caption too long"))
    for a in [it.get("alt", "")] + list(it.get("alts") or []):
        if a and len(a) > 1000: prob.append((it["id"], "alt too long"))
    if pk.name == NEW:
        for k in ("image", "cover"):
            if it.get(k):
                im = Image.open(io.BytesIO(pk.read(it[k]))); r = im.size
                want = (1080, 1920) if (it["type"] == "story" or k == "cover") else (1080, 1350)
                if im.format != "JPEG" or r != want: prob.append((it["id"], k, im.format, r))
        for f in it.get("images") or []:
            im = Image.open(io.BytesIO(pk.read(f)))
            if im.format != "JPEG" or im.size != (1080, 1350): prob.append((it["id"], f, im.format, im.size))
        if it["type"] == "carousel" and len(it["images"]) != len(it["alts"]): prob.append((it["id"], "alts count"))
        if it.get("video"):
            tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False); tmp.write(pk.read(it["video"])); tmp.close()
            o = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name:format=duration", "-of", "json", tmp.name], capture_output=True, text=True).stdout
            j = json.loads(o); cs = [s["codec_name"] for s in j["streams"]]; du = float(j["format"]["duration"])
            if cs != ["h264", "aac"] or not 3 <= du <= 90: prob.append((it["id"], "video", cs, du))
            os.remove(tmp.name)
print("problems:", prob or "none")
clash = [k for k, v in minutes.items() if v > 1 and FIRST <= k[:10] <= LAST]; print("same-minute clashes:", clash or "none")
CAPS = bot.limits()["caps"]
WANT = (CAPS["instagram"]["feed"], CAPS["instagram"]["story"], CAPS["threads"].get("thread", 0)) if FMT2 else (3, 5, None)
print("each day needs: feed %d, stories %d" % WANT[:2] + (", Threads-only %d" % WANT[2] if FMT2 else ""))
def day_ok(d):
    return (len(days[d]["feed"]), len(days[d]["story"])) == WANT[:2] and (not FMT2 or len(days[d]["thread"]) == WANT[2])
for d in sorted(days):
    if FIRST <= d <= LAST:
        f, s, th, tr = days[d]["feed"], days[d]["story"], days[d]["thread"], days[d]["trial"]
        ok = day_ok(d)
        print(d, "feed %d stories %d threads %d trial %d" % (len(f), len(s), len(th), len(tr)), "OK" if ok else "<<", " ".join(sorted(x[0] for x in f + s)))
bad = dups or prob or clash or any(not day_ok(d) for d in days if FIRST <= d <= LAST)
print("RESULT:", "FAIL" if bad else "PASS"); sys.exit(1 if bad else 0)
