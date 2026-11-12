# Week-8 pack for the bot (format 2), Tue Nov 17 - Mon Nov 23, 2026, at the safe cadence in instagram/limits.json:
# each day 2 feed posts (11:00 and 19:00, also to the Facebook Page and Threads), 3 Instagram stories (09:00 sticker story by
# hand, 12:30 share of the 11:00 post, 20:30 share of the 19:00 post) and 1 Threads-only post at 08:30. New York time.
# usage: PACK_OUT=/tmp/VPEX-Instagram-Week-8 python3 make_pack8.py
import os, json, shutil, zipfile, importlib.util
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("PACK_OUT", "/tmp/VPEX-Instagram-Week-8")
NAME = "VPEX-Instagram-Week-8"
DEMO = "Comment DEMO and we’ll send you a live demo office."
BIO = "Tap the link in our bio, then this post."
SHARE = "Send this to your manager."
LEGAL = "Based on published state rules as of November 2026. Not legal advice."
MED = "Based on the CMS final rule for 2027, as of November 2026. Not legal advice. Follow your carriers’ guidelines."
SAVE = "Save this"
DAYS = ["2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"]
def T(hook, topic, cta, ind="", series=""): return {"hook": hook, "topic": topic, "ind": ind, "cta": cta, "series": series}

# (day index, time, type, key, title, source, caption, tags, go)
FEED = [
 (0, "11:00", "reel", "ar", "Reel AR: 9 AM. Who can you call?", "AR-NineWho",
  f"""Calling hours by time zone: who your floor can call at 9 AM Eastern.

9 AM in New York is 6 AM in California, two hours before the 8 AM start of the federal calling window.

Tap the clock in VPEX and you get the time in every US zone, whether calling hours are open there, and how many of your leads are waiting. When the West opens, one tap calls them.

Save this for tomorrow’s first call.

{LEGAL}

#callinghours #coldcalling #telemarketing #salesfloor #powerdialer""", T("pov", "calling-hours", "save", "", "rule-watch"), "home"),
 (0, "19:00", "carousel", "hours", "Carousel: Calling hours, every state. One carousel.", "W8-Hours-%d:5",
  f"""Telemarketing calling hours by state, all on one carousel (November 2026).

Everywhere: 8 AM to 9 PM, the lead’s time. 20 states on VPEX’s list are stricter: later starts (Kentucky 10 AM; Connecticut, Michigan, Minnesota, Nevada, New Mexico, Pennsylvania, Rhode Island, South Dakota and Texas 9 AM), earlier ends (Rhode Island 6 PM, Pennsylvania 7 PM, 12 states 8 PM), no Sunday calls in six, no holiday calls in four, and a 3-calls-in-24-hours limit in four.

VPEX checks each lead’s state before they come up.

Save this and pin it where your floor can see it.

{LEGAL}

#callinghours #telemarketing #callcenter #salesfloor #powerdialer""", T("reference", "calling-hours", "save", "", "rule-watch"), "home"),
 (1, "11:00", "reel", "as", "Reel AS: Just text me a time.", "AS-TextATime",
  f"""Booking links for sales reps: when a lead says “just text me a time.”

Phone tag starts the second you hang up. In VPEX, send a booking link instead: the lead taps it, picks a time inside your hours and their state’s calling hours, and it lands in your Tasks.

{BIO}

#salesrep #appointmentsetting #coldcalling #salesfloor #powerdialer""", T("quote", "booking", "bio"), "home"),
 (1, "19:00", "carousel", "brush", "Carousel: 6 brush-offs your floor hears every day", "W8-Brush-%d:5",
  f"""Sales objections and rebuttals for call centers: the 6 brush-offs your floor hears every day.

“I already have coverage.” “It’s too expensive.” “I need to think about it.” “Just mail me something.” “I’m not interested.” “I’ll ask my kids first.”

In VPEX every one has an answer on the rep’s screen, mid-call, one tap away, and you edit them for your floor. And “just text me a time” gets a booking link.

{SHARE}

#salesobjections #coldcalling #insuranceagent #callcenter #powerdialer""", T("reference", "objections", "share", "", ""), "home"),
 (2, "11:00", "reel", "at", "Reel AT: Same lead. Wrong hour.", "AT-WrongHour",
  f"""Best time to call sales leads: same lead, wrong hour.

Voicemail again? Maybe it’s the hour, not the lead.

VPEX’s Answer times show when your own leads pick up, by their local hour, and “Best time to answer” puts whoever is likeliest to pick up right now first. It re-ranks after every call. (The numbers in the video are from a demo office.)

{SHARE}

#salesmanager #coldcalling #callcenter #salesfloor #powerdialer""", T("contrast", "answer-times", "share"), "home"),
 (2, "19:00", "carousel", "first", "Carousel: Who should your reps call first?", "W8-First-%d:5",
  f"""Lead prioritization for sales floors: who your reps should call first.

1. The times they picked. Booking links land in Tasks and come up first.
2. Follow-ups due now. One tap calls them in order.
3. Whoever’s likeliest to pick up right now, ranked by your own leads’ answer times.
And skip anyone outside their state’s calling hours: VPEX holds them until calls are allowed.

Save this for tomorrow’s first dial.

{LEGAL}

#salesmanager #leadmanagement #callcenter #salesfloor #powerdialer""", T("reference", "lead-order", "save"), "home"),
 (3, "11:00", "reel", "au", "Reel AU: Friday, 4 PM. Who's on the phone?", "AU-FloorTV",
  f"""A live sales leaderboard for the TV on your call center wall.

Friday, 4 PM. Who’s on the phone?

VPEX’s Floor TV puts today’s numbers on the wall: calls, conversations, interested, appointments, the leaderboard and every call as it lands. For admins and managers, on any screen with a browser.

{SHARE}

#salesleaderboard #salesmanager #callcenter #salesfloor #powerdialer""", T("pov", "manager-view", "share", "", ""), "home"),
 (3, "19:00", "image", "price", "Post: $49 a rep. What's in it?", "W8-Price",
  f"""Power dialer pricing: $49 per rep a month, and what that includes.

The dialer on every rep’s own phone, follow-ups that schedule themselves, calling hours checked by state, one shared list with no double-dials, the scoreboard, contests, Sales coach and Floor TV, booking links and ready-to-send texts.

7 days free first, no card.

{BIO}

#powerdialer #salesteam #smallbusiness #callcenter #salesfloor""", T("offer", "price", "bio"), "trial"),
 (4, "11:00", "reel", "av", "Reel AV: Rep POV: my closer is out today.", "AV-Closer",
  f"""Appointment setter to closer handoff, from the rep’s point of view.

My closer is out today. She said yes. Now what?

In VPEX: hand it off with the closer, the time and a note. The lead moves with its full history, I keep credit for the appointment, and one tap texts her a confirmation.

{DEMO}

#appointmentsetter #solarsales #salesrep #salesfloor #powerdialer""", T("story", "handoff", "comment", "", "rep-pov"), "home"),
 (4, "19:00", "image", "math", "Post: Floor math, picking who to call next", "W8-Math",
  f"""Sales floor productivity, example math: the time reps spend picking who to call next.

Example: an 8-rep floor, 15 minutes each a day, 5 days a week. 8 × 15 × 5 = 600 minutes, 10 hours a week of not dialing.

In VPEX the next lead is already up, ranked by who’s likeliest to answer.

Save this for your next floor meeting.

#salesproductivity #salesmanager #callcenter #salesfloor #powerdialer""", T("math", "speed", "save", "", "floor-math"), "home"),
 (5, "11:00", "reel", "aw", "Reel AW: Number on a sticky note?", "AW-Manual",
  f"""Manual dial in a power dialer: call a number that isn’t on your list.

Number on a sticky note? Turn on Manual dial in VPEX, type it in and call. For a new number, it reminds you of the 8 AM to 9 PM window in their time. No second app.

{DEMO}

#salesrep #coldcalling #callcenter #salesfloor #powerdialer""", T("feature", "manual-dial", "comment"), "home"),
 (5, "19:00", "image", "callback", "Post: Call me back tomorrow at 10", "W8-Callback",
  f"""Sales callback tracking: where “call me back tomorrow at 10” goes on your floor.

On a sticky note, it’s lost by lunch. In VPEX it’s logged as a callback and on the rep’s Tasks for 10:00 AM.

{SHARE}

#followup #salesrep #callcenter #salesfloor #powerdialer""", T("contrast", "callbacks", "share"), "home"),
 (6, "11:00", "reel", "ax", "Reel AX: Monday. Dialing by lunch.", "AX-ByLunch",
  f"""Set up a power dialer for your sales team this morning.

1. Create your office, no card.
2. Upload your list as is: Excel, CSV, text or contacts.
3. Send reps the office link. They sign in on their own phones.

7 days free. Then $49 per rep per month.

{BIO}

#powerdialer #salesteam #salesfloor #callcenter #salesmanager""", T("offer", "trial", "bio"), "trial"),
 (6, "19:00", "carousel", "thanks", "Carousel: Thanksgiving, no sales calls in 4 states", "W8-Thanks-%d:5",
  f"""Thanksgiving telemarketing rules: no sales calls on Thursday in Alabama, Louisiana, Pennsylvania and Rhode Island.

Those four states on VPEX’s list ban sales calls on federal holidays, and Thursday, November 26 is Thanksgiving.
• Wednesday: VPEX puts a heads-up on the Dial tab, so you call those leads while you still can.
• Thursday: they’re held all day.
• Friday isn’t a federal holiday, so VPEX uses each state’s usual hours.

Save this for Wednesday’s huddle.

{LEGAL}

#thanksgiving #telemarketing #callinghours #salesfloor #powerdialer""", T("reference", "calling-hours", "save", "", "rule-watch"), "home"),
]
THREADS_TEXT = {   # written by hand where the automatic Threads version wouldn't read well
 "ar": "9 AM in New York is 6 AM in California, two hours before the federal calling window opens.\n\nTap the clock in VPEX: every US zone, whether calling hours are open there, and one tap to call the ones that are.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
 "hours": "Calling hours, every state: 8 AM to 9 PM, the lead’s time, except 20 stricter states. Kentucky starts at 10. Rhode Island ends at 6, Pennsylvania at 7, 12 states at 8. Six have no Sunday calls, four no holiday calls.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
 "brush": "6 brush-offs your floor hears every day: I already have coverage. Too expensive. Need to think about it. Just mail me something. Not interested. I’ll ask my kids first.\n\nIn VPEX each one has an answer on the rep’s screen, mid-call: {link}",
 "first": "Who should your reps call first? The times leads picked, then follow-ups due now, then whoever’s likeliest to pick up right now. Skip anyone outside their state’s hours.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
 "math": "Example math: an 8-rep floor where each rep spends 15 minutes a day picking who to call next. 8 × 15 × 5 days = 600 minutes, 10 hours a week of not dialing.\n\nIn VPEX the next lead is already up: {link}",
 "thanks": "Thursday is Thanksgiving. No sales calls that day in Alabama, Louisiana, Pennsylvania or Rhode Island (the lead’s state). VPEX warns you Wednesday and holds those leads Thursday. Friday, the usual hours.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
 "ax": "Monday, dialing by lunch: create your office (no card), upload your list as is, send reps the office link. They sign in on their own phones.\n\n7 days free, then $49 per rep per month: {link}",
 "price": "$49 a rep a month in VPEX: the dialer on every rep’s phone, follow-ups that schedule themselves, calling hours by state, a shared list, scoreboard, contests, Sales coach, Floor TV and booking links.\n\n7 days free, no card: {link}",
}
REEL_ALT = {
 "ar": "A clock reads 9:00 AM. Text: 9 AM. Who can you call? Then VPEX's time sheet in a demo office at 9:05 AM Eastern: Eastern and Central in calling hours, Mountain and Pacific too early with leads waiting. Text: 11 AM Eastern, the West opens. At 11:05 every zone is open, with a Call 9 button for Pacific.",
 "as": "Text: Just text me a time. Phone tag starts now? Here's the fix. Then VPEX's Send a booking link sheet in a demo office, with the text and link card the lead gets. Text: It lands in your Tasks.",
 "at": "Text: Same lead. Wrong hour. Voicemail again. Here's the fix. Then VPEX's Answer times in a demo office, answer rate by the lead's local hour, and the Sort sheet set to Best time to answer.",
 "au": "A clock reads 4:00 PM. Text: Friday, 4 PM. Who's on the phone? Then VPEX's Floor TV in a demo office: calls, conversations, interested and appointments today, the most-calls leaderboard and the latest calls. Text: Put it on the wall.",
 "av": "Text: Rep POV: my closer is out today. She said yes. Now what? Then VPEX's Hand off to a closer sheet in a solar demo office, with closer, appointment time and a note, then the offer to text the lead a confirmation.",
 "aw": "Text: Number on a sticky note? Here's the fix. Then VPEX's Manual dial keypad in a demo office with (732) 555-0142 typed in and a reminder to check it's 8 AM to 9 PM for them. Text: No second app.",
 "ax": "Text: Monday. Dialing by lunch. A list: 1, office, no card; 2, list, as is; 3, reps, own phones. Then VPEX's Add leads sheet: upload a file, paste a list or add one. Text: 7 days free. Then $49 a rep.",
}
ALT = {
 "W8-Hours-1": "Calling hours, every state. One carousel. Everywhere: 8 AM to 9 PM, the lead's time. 20 states on VPEX's list are stricter: later starts and earlier ends, no Sunday calls, no calls on holidays.",
 "W8-Hours-2": "Stricter states A to M, the lead's time: AL 8 AM to 8 PM, no Sundays, no holidays. CT 9 AM to 8 PM. FL 8 AM to 8 PM, 3 calls in 24 hours. KY 10 AM to 9 PM. LA 8 AM to 8 PM, no Sundays, no holidays. MA 8 AM to 8 PM. MD 8 AM to 8 PM, 3 calls in 24 hours. MI 9 AM to 9 PM. MN 9 AM to 9 PM. MS 8 AM to 8 PM, no Sundays.",
 "W8-Hours-3": "Stricter states N to W: NM 9 AM to 9 PM. NV 9 AM to 8 PM. OK 8 AM to 8 PM, 3 calls in 24 hours. OR 8 AM to 8 PM, 3 calls in 24 hours. PA 9 AM to 7 PM, no Sundays, no holidays. RI 9 AM to 6 PM, Saturdays 10 to 5, no Sundays, no holidays. SD 9 AM to 9 PM, no Sundays. TX 9 AM to 9 PM, Sundays noon to 9 PM. WA 8 AM to 8 PM. WY 8 AM to 8 PM.",
 "W8-Hours-4": "VPEX checks each lead's state before they come up. A lead card in a demo office at 8:05 PM: outside CT calling hours, 9 AM to 8 PM.",
 "W8-Hours-5": "Pin it where your floor can see it. Pennsylvania's 9 AM to 7 PM started October 18, 2026. Save this.",
 "W8-Brush-1": "6 brush-offs your floor hears every day: I already have coverage. It's too expensive. I need to think about it. Just mail me something. I'm not interested. I'll ask my kids first.",
 "W8-Brush-2": "Every one has an answer on the rep's screen. VPEX's Call script in an insurance demo office, Rebuttals tab listing the six brush-offs.",
 "W8-Brush-3": "Just mail me something. VPEX's answer opens: I can do that. So it's useful, can I ask two quick questions? Then what you get is priced for you.",
 "W8-Brush-4": "Text me a time? Send a link. VPEX's Send a booking link sheet with the text and link card the lead gets.",
 "W8-Brush-5": "Your scripts and answers, your words. Edit them for your floor in VPEX. Send this to your manager.",
 "W8-First-1": "Who should your reps call first? 1, the times they picked. 2, follow-ups due now. 3, whoever's likeliest to pick up right now. Not anyone outside their state's hours.",
 "W8-First-2": "A booked time beats a cold dial. VPEX's booking link sheet. Booking links land in Tasks, and booked times come up first.",
 "W8-First-3": "Late follow-ups get a red button, not a sticky note. VPEX's Dial tab with Start 1 follow-up and Call 3 late follow-ups buttons.",
 "W8-First-4": "Sort by best time to answer. VPEX's Sort your leads sheet: ranked by when your own leads actually pick up, by the day and hour where they are.",
 "W8-First-5": "And skip anyone outside their state's hours; VPEX holds them until calls are allowed. Save this for tomorrow's first dial.",
 "W8-Price": "$49 a rep. What's in it? The dialer on every rep's own phone, follow-ups that schedule themselves, calling hours checked by state, one shared list with no double-dials, scoreboard, contests, Sales coach and Floor TV, booking links and ready-to-send texts. 7 days free first, no card.",
 "W8-Math": "Floor math, an example: 15 minutes a day picking who to call next. 8 reps times 15 minutes times 5 days equals 10 hours a week, 600 minutes of not dialing. In VPEX the next lead is already up, ranked by who's likeliest to answer.",
 "W8-Callback": "Call me back tomorrow at 10. A yellow sticky note reads Call Mark back tmrw 10, lost by lunch. In VPEX it's logged as a callback: Callback set Tomorrow 10:00 AM.",
 "W8-Thanks-1": "Thursday, November 26. Thanksgiving: no sales calls in 4 states: Alabama, Louisiana, Pennsylvania, Rhode Island.",
 "W8-Thanks-2": "Wednesday, the day before: VPEX tells you first. A heads-up on the Dial tab: Thu is Thanksgiving, call your 90 leads in PA today.",
 "W8-Thanks-3": "Thursday: those leads are held all day. A Pennsylvania lead at 10:05 AM: holiday, no sales calls in PA today.",
 "W8-Thanks-4": "Friday: back to the usual hours. Black Friday isn't a federal holiday, so VPEX uses each state's usual hours: PA 9 AM to 7 PM, RI 9 AM to 6 PM, AL and LA 8 AM to 8 PM, others 8 AM to 9 PM.",
 "W8-Thanks-5": "Calling those states this week? Keep this for Wednesday's huddle. Save this.",
}
THREADS = [
 (0, "t-west", "Floor owners: what time does your floor start calling the West Coast?\n\nIf you start at 9 Eastern, it’s 6 AM in California. The federal window opens at 8, their time.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
  T("question", "calling-hours", "question", "", "rule-watch"), "home"),
 (1, "t-book", "Rule of the week (a habit, not a law): when a lead says “text me a time,” send times, not “whenever works.”\n\nVPEX’s booking link offers only times inside your hours and their state’s calling hours: {link}",
  T("rule", "booking", "none"), "home"),
 (2, "t-answers", "Managers: what hour do your leads actually pick up?\n\nVPEX learns it from your own calls, by each lead’s local hour, and puts the likeliest pickups first: {link}",
  T("question", "answer-times", "question"), "home"),
 (3, "t-tv", "The scoreboard in a spreadsheet nobody opens vs. the scoreboard on the wall everybody sees.\n\nVPEX’s Floor TV: today’s calls, conversations and leaderboard on any screen: {link}",
  T("contrast", "manager-view", "none"), "home"),
 (4, "t-ri", "Rule of the week: Rhode Island’s Saturday calling hours are 10 AM to 5 PM, the lead’s time. Weekdays 9 AM to 6 PM, no Sundays, no holidays.\n\nVPEX checks each lead’s state before they come up.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
  T("rule", "calling-hours", "none", "", "rule-watch"), "home"),
 (5, "t-friday", "Floor owners: is your floor dialing the day after Thanksgiving?\n\nIt isn’t a federal holiday, so VPEX uses each state’s usual hours that day.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
  T("question", "calling-hours", "question"), "home"),
 (6, "t-trial", "Short week? Start the trial today and your reps are dialing before Thanksgiving: create your office, upload your list, send reps the link.\n\n7 days free, no card: {link}",
  T("offer", "trial", "none"), "trial"),
]
STICKER = [
 ("Tue", "Quiz: 9 AM Eastern in Denver", "Add a Quiz sticker: 6 AM / 7 AM / 8 AM, with 7 AM as the right answer."),
 ("Wed", "Question: the brush-off you hear most", "Add a Question sticker: “The brush-off we hear most”."),
 ("Thu", "Poll: when do your leads pick up?", "Add a Poll sticker: Morning / Late afternoon."),
 ("Fri", "Poll: a scoreboard on your floor's wall?", "Add a Poll sticker: Yes / Not yet."),
 ("Sat", "Quiz: Saturday hours in Rhode Island", "Add a Quiz sticker: 10 AM–5 PM / 9 AM–6 PM / No calls, with 10 AM–5 PM as the right answer."),
 ("Sun", "Slider: ready for Thanksgiving week?", "Add an Emoji slider sticker with 🦃."),
 ("Mon", "Poll: dialing Black Friday?", "Add a Poll sticker: Yes / No."),
]

def jpg(src, dst):
    im = Image.open(src).convert("RGB"); im.save(dst, quality=92, subsampling=0, optimize=True)

if __name__ == "__main__":
    shutil.rmtree(OUT, ignore_errors=True)
    for d in ("1-Reels", "2-Posts", "3-Stories", "4-Story-versions"): os.makedirs(OUT + "/" + d)
    items = []
    for di, (dayname, title, note) in enumerate(STICKER):
        f = "W8-Story-%s-1.jpg" % dayname; jpg(D + "/out/jpg/" + f, OUT + "/3-Stories/" + f)
        items.append({"id": "w8-story-%s" % dayname.lower(), "at": DAYS[di] + " 09:00", "type": "story", "title": "%s 9 AM · %s" % (dayname, title),
                      "image": "3-Stories/" + f, "manual": True, "note": "Post 3-Stories/%s from the Week 8 pack and add the sticker. %s" % (f, note)})
    for di, key, text, tags, go in THREADS:
        items.append({"id": "w8-" + key, "at": DAYS[di] + " 08:30", "type": "thread", "title": "Threads: " + text.split("\n")[0][:60], "threads_text": text, "tags": tags, "go": go})
    for di, hm, typ, key, title, src, cap, tags, go in FEED:
        when = DAYS[di] + " " + hm
        it = {"id": "w8-" + key, "at": when, "type": typ, "title": title, "caption": cap, "tags": tags, "go": go}
        if key in THREADS_TEXT: it["threads_text"] = THREADS_TEXT[key]
        share = {"id": "w8-" + key + "-share", "at": DAYS[di] + (" 12:30" if hm == "11:00" else " 20:30"), "type": "story", "title": "Story share: " + title}
        if typ == "reel":
            cv = key.upper()
            shutil.copyfile(D + "/out/video/Reel-%s-sound.mp4" % src, OUT + "/1-Reels/Reel-%s.mp4" % src)
            jpg(D + "/out/jpg/W8-Cover-%s.jpg" % cv, OUT + "/1-Reels/Cover-%s.jpg" % cv)
            it.update(video="1-Reels/Reel-%s.mp4" % src, cover="1-Reels/Cover-%s.jpg" % cv, alt=REEL_ALT[key])
            share["video"] = it["video"]
        elif typ == "image":
            jpg(D + "/out/jpg/%s.jpg" % src, OUT + "/2-Posts/%s.jpg" % src)
            it.update(image="2-Posts/%s.jpg" % src, alt=ALT[src]); first = src
        else:
            pat, n = src.split(":"); n = int(n); imgs, alts = [], []
            for i in range(1, n + 1):
                stem = pat % i; jpg(D + "/out/jpg/%s.jpg" % stem, OUT + "/2-Posts/%s.jpg" % stem)
                imgs.append("2-Posts/%s.jpg" % stem); alts.append(ALT[stem])
            it.update(images=imgs, alts=alts); first = pat % 1
        if typ != "reel":
            f = "Story-%s.jpg" % first
            jpg(D + "/out/story_versions/" + f, OUT + "/4-Story-versions/" + f); share["image"] = "4-Story-versions/" + f
        items += [it, share]
    items.sort(key=lambda x: x["at"])
    plan = {"format": 2, "name": "VPEX Instagram, week 8: Right lead, right hour", "timezone": "America/New_York",
            "notes": "Times are New York time (EST). Safe cadence (instagram/limits.json): each day 2 feed posts at 11:00 and 19:00 (also to the Facebook Page and Threads), stories at 09:00 (sticker, by hand), 12:30 and 20:30, and 1 Threads-only post at 08:30.",
            "items": items}
    json.dump(plan, open(OUT + "/plan.json", "w"), indent=1, ensure_ascii=False)
    lines = ["VPEX Instagram, week 8: Right lead, right hour", "Posted by the bot, New York time. Only the 9 AM sticker stories are posted by hand.", ""]
    for it in items: lines.append("%s  %-8s %s" % (it["at"], it["type"] + ("*" if it.get("manual") else ""), it["title"]))
    lines += ["", "Captions", ""]
    for it in items:
        if it["type"] == "thread": lines += ["== " + it["title"] + " (" + it["at"] + ")", it["threads_text"], ""]
        elif it["type"] != "story": lines += ["== " + it["title"] + " (" + it["at"] + ")", it["caption"], ""]
    open(OUT + "/Week-8-Posting-Plan.txt", "w").write("\n".join(lines))
    z = OUT + ".zip"
    if os.path.exists(z): os.remove(z)
    with zipfile.ZipFile(z, "w", zipfile.ZIP_STORED) as zf:
        for root, _, files in os.walk(OUT):
            for f in sorted(files):
                p = os.path.join(root, f); zf.write(p, NAME + "/" + os.path.relpath(p, OUT))
    print(len(items), "items:", sum(1 for i in items if i["type"] in ("reel", "image", "carousel")), "feed,", sum(1 for i in items if i["type"] == "story"), "stories,",
          sum(1 for i in items if i["type"] == "thread"), "Threads-only")
    print("zip %.1f MB" % (os.path.getsize(z) / 1e6))
