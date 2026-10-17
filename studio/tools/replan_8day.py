# One-off (Oct 17, 2026): Vincent moved Instagram to 8 a day, 3 feed posts and 5 stories.
# Re-times what's left of weeks 3 and 4 from Sat Oct 17 and adds a story share of each day's first two feed posts.
# Daily slots (New York): 09:00 sticker story (by hand) · 11:00 feed · 12:30 story share · 14:30 story
#                         · 15:30 feed · 17:30 story share · 19:00 feed · 21:00 story
# Fri Oct 23 19:00 and Sat Oct 24 - Mon Oct 26 are left for the bridge pack (week 4b).
# usage: python3 replan_8day.py WEEK3_DIR WEEK4_DIR STORY_VERSIONS_DIR
import sys, os, json, shutil
W3, W4, SV = sys.argv[1:4]
p3, p4 = json.load(open(W3 + "/plan.json")), json.load(open(W4 + "/plan.json"))
I3, I4 = {i["id"]: i for i in p3["items"]}, {i["id"]: i for i in p4["items"]}
def get(i): return I3.get(i) or I4[i]

DAYS = ["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]
FEED = [["w3-23", "w3-24", "w3-22"], ["w3-25", "w3-26", "w3-27"], ["w4-l", "w4-pa", "w4-hours"], ["w4-m", "w4-qs", "w4-n"],
        ["w4-o", "w4-buzz", "w4-p"], ["w4-day", "w4-q", "w4-price"], ["w4-r", "w4-checks"]]
STICKER = ["w3-story-mon-1", "w3-story-tue-1", "w4-story-fri-1", "w3-story-wed-1", "w3-story-thu-1", "w3-story-fri-1", "w4-story-sun-1"]
ORIG = [("w3-story-mon-2", "w3-story-tue-2"), ("w3-story-wed-2", "w3-story-thu-2"), ("w4-story-wed-3", "w3-story-fri-2"), ("w4-story-thu-2", "w4-story-thu-3"),
        ("w4-story-wed-2", "w4-story-sun-3"), ("w4-story-sat-3", "w4-story-sun-2"), ("w4-story-fri-2", "w4-story-mon-2")]
LATER = {  # stories kept for the bridge days (re-timed when the bridge pack is built)
    "w3-story-sun-1": "2026-10-24 09:00", "w4-story-sat-1": "2026-10-25 09:00", "w4-story-mon-1": "2026-10-26 09:00",
    "w3-story-sat-1": "2026-10-24 14:30", "w3-story-sat-2": "2026-10-24 21:00", "w3-story-sun-2": "2026-10-25 14:30",
    "w4-story-fri-3": "2026-10-25 21:00", "w4-story-sat-2": "2026-10-26 14:30", "w4-story-mon-3": "2026-10-26 21:00"}
# story version (image) of a post, by plan id; Reels are shared as the Reel video itself
SHARE_IMG = {"w3-24": ("w3", "4-Story-ad-versions/Story-ad-24-Math-slide1.jpg"), "w3-26": ("w3", "4-Story-ad-versions/Story-ad-26-RepQuit.jpg"),
             "w3-22": ("w3", "4-Story-ad-versions/Story-ad-22-TwoReps.jpg"),
             "w4-pa": ("w4", "Story-W4-PA.jpg"), "w4-hours": ("w4", "Story-W4-Hours-1.jpg"), "w4-qs": ("w4", "Story-W4-Qs-1.jpg"), "w4-buzz": ("w4", "Story-W4-Buzz.jpg"),
             "w4-day": ("w4", "Story-W4-Day-1.jpg"), "w4-price": ("w4", "Story-W4-Price.jpg"), "w4-checks": ("w4", "Story-W4-Checks-1.jpg")}
os.makedirs(W4 + "/4-Story-versions", exist_ok=True)
new3, new4 = [], []
for d, day in enumerate(DAYS):
    for slot, iid in zip(("11:00", "15:30", "19:00"), FEED[d]): get(iid)["at"] = "%s %s" % (day, slot)
    if not (d == 0 and get(STICKER[d]).get("at", "").startswith(day)): get(STICKER[d])["at"] = day + " 09:00"
    get(ORIG[d][0])["at"] = day + " 14:30"; get(ORIG[d][1])["at"] = day + " 21:00"
    for slot, iid in zip(("12:30", "17:30"), FEED[d][:2]):
        src = get(iid); wk = "w3" if iid in I3 else "w4"
        sh = {"id": iid + "-share", "at": "%s %s" % (day, slot), "type": "story", "title": "Story share: " + src["title"]}
        if src["type"] == "reel": sh["video"] = src["video"]
        else:
            pk, f = SHARE_IMG[iid]
            if pk == "w4":
                shutil.copyfile(os.path.join(SV, f), W4 + "/4-Story-versions/" + f); f = "4-Story-versions/" + f
            sh["image"] = f
        (new3 if wk == "w3" else new4).append(sh)
for iid, at in LATER.items(): get(iid)["at"] = at
p3["items"] += new3; p4["items"] += new4
for p in (p3, p4): p["items"].sort(key=lambda x: x["at"])
p3["notes"] = p4["notes"] = "Times are New York time. 8 a day from Oct 17: feed at 11:00, 15:30 and 19:00; stories at 09:00 (sticker, by hand), 12:30, 14:30, 17:30 and 21:00."
json.dump(p3, open(W3 + "/plan.json", "w"), indent=1, ensure_ascii=False)
json.dump(p4, open(W4 + "/plan.json", "w"), indent=1, ensure_ascii=False)
print("week 3:", len(p3["items"]), "items · week 4:", len(p4["items"]), "items")
