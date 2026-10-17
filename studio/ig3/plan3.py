# The bot's schedule for week 3 (plan.json inside the content pack): what goes out when, with captions and alt text.
import os, json, importlib.util
D = os.path.dirname(os.path.abspath(__file__))
def load(n):
    spec = importlib.util.spec_from_file_location(n, D + "/%s.py" % n); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
cap, kit = load("captions3"), load("kit3")
C = {p[0]: p for p in cap.POSTS}
STK = dict(cap.STORIES)
DAYS = {"Mon": "2026-10-19", "Tue": "2026-10-20", "Wed": "2026-10-21", "Thu": "2026-10-22", "Fri": "2026-10-23", "Sat": "2026-10-24", "Sun": "2026-10-25"}
def post(n, day, time, typ, title, **kw):
    d = dict(id="w3-%d" % n, at="%s %s" % (DAYS[day], time), type=typ, title=title, caption=C[n][4], alt=C[n][5]); d.update(kw); return d
leak_alts = ["Cover: 7 places deals go to die. None of them is your lead list."] + \
    ["Leak %d of 7: %s %s The fix: %s" % (i + 1, l[0], l[1], l[2]) for i, l in enumerate(kit.LEAKS)] + \
    ["Plug the leaks. VPEX: follow-ups that book themselves, pacing that protects your number, a live view of your floor. Comment DEMO."]
math_alts = ["One missed callback a day. Do the math. Example numbers.", "10 reps on your floor.", "Times 1 callback each, every day, that nobody makes. 10 a day.",
             "Times 20 workdays in a month. 200 a month.", "200 people who asked you to call back, every month. Multiply by your close rate and average deal.",
             "Every callback, back in front of the rep, on time. Comment DEMO for a live demo office."]
items = [
    post(19, "Mon", "12:30", "reel", "Reel G: He said call me back at 2", video="1-Reels/Reel-G-Callback.mp4", cover="1-Reels/Cover-19-Reel-G.jpg"),
    post(20, "Tue", "12:30", "carousel", "Carousel: 7 places deals go to die", images=["2-Posts/Post-20-Leaks-slide%d.jpg" % i for i in range(1, 10)], alts=leak_alts),
    post(21, "Wed", "12:30", "reel", "Reel H: Spam Likely", video="1-Reels/Reel-H-SpamLikely.mp4", cover="1-Reels/Cover-21-Reel-H.jpg"),
    post(22, "Thu", "12:00", "image", "Post: Two reps. One lead.", image="2-Posts/Post-22-TwoReps.jpg"),
    post(23, "Thu", "18:30", "reel", "Reel I: It's 5 PM", video="1-Reels/Reel-I-FivePM.mp4", cover="1-Reels/Cover-23-Reel-I.jpg"),
    post(24, "Fri", "12:30", "carousel", "Carousel: Do the math", images=["2-Posts/Post-24-Math-slide%d.jpg" % i for i in range(1, 7)], alts=math_alts),
    post(25, "Sat", "11:00", "reel", "Reel J: 11 taps", video="1-Reels/Reel-J-Taps.mp4", cover="1-Reels/Cover-25-Reel-J.jpg"),
    post(26, "Sun", "12:00", "image", "Post: Your best rep quit.", image="2-Posts/Post-26-RepQuit.jpg"),
    post(27, "Sun", "18:30", "reel", "Reel K: Every floor leaks", video="1-Reels/Reel-K-EveryLeak.mp4", cover="1-Reels/Cover-27-Reel-K.jpg"),
]
for day in DAYS:
    for k, time in ((1, "09:00"), (2, "17:00")):
        stem = "Story-%s-%d" % (day, k); note = STK[stem]
        manual = note.lower().startswith(("poll", "question", "quiz"))
        d = dict(id="w3-%s" % stem.lower(), at="%s %s" % (DAYS[day], time), type="story", title="%s story %d" % (day, k), image="3-Stories/%s.jpg" % stem)
        if manual: d.update(manual=True, note="Post 3-Stories/%s.jpg from the Week 3 pack and add the sticker. %s" % (stem, note))
        items.append(d)
items.sort(key=lambda x: x["at"])
plan = {"name": "VPEX Instagram, week 3: Every floor leaks", "timezone": "America/New_York",
        "notes": "Times are New York time. Sticker stories (polls, questions, quizzes) are posted by hand; the bot sends a reminder.", "items": items}
if __name__ == "__main__":
    out = "/mnt/user-data/outputs/VPEX-Instagram-Week-3/plan.json"
    json.dump(plan, open(out, "w"), indent=1, ensure_ascii=False)
    print(len(items), "items;", sum(1 for i in items if i.get("manual")), "by hand ->", out)
