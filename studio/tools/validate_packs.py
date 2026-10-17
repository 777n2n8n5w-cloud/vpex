# Checks content packs the way the bot reads them: every file present, ids unique, caption/alt limits, media formats for
# the new pack, and exactly 3 feed posts plus 5 stories every day with no two at the same minute.
# usage: python3 -I studio/tools/validate_packs.py CONTENT_DIR NEW_PACK_NAME FIRST_DAY LAST_DAY
#   e.g. python3 -I studio/tools/validate_packs.py /tmp/check VPEX-Instagram-Week-5 2026-10-27 2026-11-02
# (CONTENT_DIR = a folder with copies of instagram/*.zip plus the new zip)
import sys, os, json, re, io, subprocess, collections, importlib.util, tempfile
BOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../instagram-bot/bot.py")
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("bot", BOT); bot = importlib.util.module_from_spec(spec); spec.loader.exec_module(bot)
bot.CONTENT_DIR = sys.argv[1]; NEW = sys.argv[2]; FIRST, LAST = sys.argv[3], sys.argv[4]
from PIL import Image
packs = bot.load_packs(); items = bot.all_items(packs)
print("packs:", [p.name for p in packs], "items:", len(items))
ids = collections.Counter(it["id"] for _, _, it in items)
dups = [k for k, v in ids.items() if v > 1]; print("duplicate ids:", dups or "none")
prob = []
NY = bot.ZoneInfo("America/New_York")
days = collections.defaultdict(lambda: {"feed": [], "story": []}); minutes = collections.Counter()
for t, pk, it in items:
    local = t.astimezone(NY); d = local.strftime("%Y-%m-%d"); minutes[local.strftime("%Y-%m-%d %H:%M")] += 1
    days[d]["story" if it["type"] == "story" else "feed"].append((local.strftime("%H:%M"), it["id"]))
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
for d in sorted(days):
    if FIRST <= d <= LAST:
        f, s = days[d]["feed"], days[d]["story"]
        print(d, "feed %d stories %d" % (len(f), len(s)), "OK" if (len(f), len(s)) == (3, 5) else "<<", " ".join(sorted(x[0] for x in f + s)))
bad = dups or prob or clash or any((len(days[d]["feed"]), len(days[d]["story"])) != (3, 5) for d in days if FIRST <= d <= LAST)
print("RESULT:", "FAIL" if bad else "PASS"); sys.exit(1 if bad else 0)
