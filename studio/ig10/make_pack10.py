# Week-10 pack for the bot (format 2), Tue Dec 1 - Mon Dec 7, 2026, at the safe cadence in instagram/limits.json:
# each day 2 feed posts (11:00 and 19:00, also to the Facebook Page and Threads), 3 Instagram stories (09:00 sticker story by
# hand, 12:30 share of the 11:00 post, 20:30 share of the 19:00 post) and 1 Threads-only post at 08:30. New York time.
# usage: PACK_OUT=/tmp/VPEX-Instagram-Week-10 python3 make_pack9.py
import os, json, shutil, zipfile, importlib.util
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("PACK_OUT", "/tmp/VPEX-Instagram-Week-10")
NAME = "VPEX-Instagram-Week-10"
DEMO = "Comment DEMO and we’ll send you a live demo office."
BIO = "Tap the link in our bio, then this post."
SHARE = "Send this to your manager."
LEGAL = "Based on published state rules as of November 2026. Not legal advice."
MED = "Based on the CMS final rule for 2027, as of November 2026. Not legal advice. Follow your carriers’ guidelines."
SAVE = "Save this"
DAYS = ["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06", "2026-12-07"]
def T(hook, topic, cta, ind="", series=""): return {"hook": hook, "topic": topic, "ind": ind, "cta": cta, "series": series}

# (day index, time, type, key, title, source, caption, tags, go)
DNC = "VPEX keeps your office’s own Do Not Call list. It doesn’t check the National Do Not Call Registry; scrub new lists against it before you upload."
FEED = [
 (0, "11:00", "reel", "bf", "Reel BF: How did you get my number?", "BF-Number",
  f"""Cold calling objections: what your reps say to “How did you get my number?”

Freezing makes it worse. VPEX’s starter answer opens on the rep’s screen, mid-call: say where the list came from, then offer to mark them do-not-call right now. One tap logs it. (Real estate demo office.)

{DNC}

{SHARE}

#coldcalling #salesrep #objectionhandling #salesfloor #powerdialer""", T("quote", "objections", "share"), "home"),
 (0, "19:00", "carousel", "spouse", "Carousel: I need to talk to my spouse. Every floor's answer", "W10-Spouse-%d:6",
  f"""Sales objection handling: “I need to talk to my spouse,” and how VPEX’s starter scripts answer it on four kinds of floors.

• Insurance: “I’ll ask my kids first.” Set a time when they can be on the call too.
• Solar: book the consultation when both can be there.
• Auto sales: invite them in together.
• Business funding: “I need to talk to my partner.” Get both owners on a quick call.

Same move every time: everyone on the next call. Each answer opens on the rep’s screen with one tap, and admins can rewrite them. (Demo offices.)

{SHARE}

#objectionhandling #salestraining #coldcalling #salesfloor #powerdialer""", T("reference", "objections", "share"), "home"),
 (1, "11:00", "reel", "bg", "Reel BG: Remote reps. Who's dialing?", "BG-Remote",
  f"""Remote sales team management: who’s dialing right now?

In the office you can see it. With reps at home you guess. VPEX’s live rep tracker shows every rep, updating the moment anyone dials: dialing, idle or offline, calls, conversations, appointments, pace, and who has late follow-ups. “Needs you” puts the reps who need a nudge on top. (Demo office.)

{SHARE}

#remotesales #salesmanager #callcenter #salesfloor #powerdialer""", T("contrast", "remote-team", "share"), "home"),
 (1, "19:00", "image", "budget", "Post: Budgeting 2027? Your dialer is one line.", "W10-Budget",
  f"""Power dialer cost for your 2027 budget: $49 per rep a month. That’s the whole price.

An example: 5 reps, $245 a month. 10 reps, $490. 20 reps, $980. 7 days free first, no card.

{BIO}

#salesmanager #powerdialer #smallbusiness #callcenter #salesfloor""", T("offer", "price", "bio"), "trial"),
 (2, "11:00", "reel", "bh", "Reel BH: Just send me your best price.", "BH-BestPrice",
  f"""Auto sales phone objections: “Just send me your best price.”

Then they ghost. VPEX’s auto starter answer opens mid-call: “Happy to. The price depends on your trade and financing, so 10 minutes in person gets you a real number. When could you stop by?” Open the auto demo office, no sign-up.

{BIO}

#carsales #autosales #bdc #carsalesman #powerdialer""", T("quote", "objections", "bio", "auto"), "demo:auto"),
 (2, "19:00", "image", "calendar", "Post: December, on one screen.", "W10-Calendar",
  f"""Sales follow-up calendar for your floor: December on one screen.

New in VPEX: the Calendar tab. Every day shows how many follow-ups, tasks and appointments are due, mine or everyone’s. Tap a day for its agenda by time; today also lists what’s still open from earlier. Call, move or mark done right from it. (Demo office.)

Save this.

#salesmanager #followup #callcenter #salesfloor #powerdialer""", T("feature", "calendar", "save"), "home"),
 (3, "11:00", "reel", "bi", "Reel BI: 9:15 PM. Who can you still call?", "BI-NinePM",
  f"""Evening calling hours: who your floor can still call at 9:15 PM Eastern.

Eastern leads are done for the day (the federal window closes at 9 PM, their time). Central, Mountain and Pacific are still open, unless their state closes earlier. VPEX’s dial list puts the people you can call right now first, so the late shift starts on California, not on a wall of “outside calling hours.” (Demo office.)

Save this for late shifts.

{LEGAL}

#callinghours #telemarketing #coldcalling #salesfloor #powerdialer""", T("pov", "calling-hours", "save", "", "rule-watch"), "home"),
 (3, "19:00", "carousel", "remote", "Carousel: Reps at home? 3 things to check from your phone", "W10-Remote-%d:5",
  f"""Managing remote sales reps: 3 things to check from your phone.

1. Who’s dialing right now. VPEX’s live rep tracker: dialing, idle or offline, updating the moment anyone dials.
2. Who needs you. One tap sorts reps who are idle, haven’t called yet or have late follow-ups to the top.
3. The floor’s day. Floor TV: calls, conversations and the board, on the office TV or on your phone at home.

(Demo office numbers.) Save this for your next remote hire.

#remotesales #salesmanager #remotework #callcenter #powerdialer""", T("reference", "remote-team", "save"), "home"),
 (4, "11:00", "reel", "bj", "Reel BJ: 6 brush-offs. 6 answers.", "BJ-SixAnswers",
  f"""MCA cold calling objections: 6 brush-offs business funding floors hear, 6 answers, one tap each.

“The rates are too high.” “I already have an advance.” “Just send me some info.” In VPEX’s business funding demo office, every one opens an answer on the rep’s screen mid-call. For “send me some info”: the one-page application, texted now, so they see what they qualify for.

Save this.

#mca #businessfunding #merchantcashadvance #coldcalling #powerdialer""", T("number", "objections", "save", "mca"), "demo:mca"),
 (4, "19:00", "image", "myth", "Post: Myth: trying a power dialer means a contract.", "W10-Myth",
  f"""Myth: trying a power dialer means a contract and a long setup.

With VPEX: 7 days free, no card. Your list goes in as is. Reps dial from their own phones. $49 a rep a month after, cancel any time.

{DEMO}

#powerdialer #salesteam #smallbusiness #callcenter #salesfloor""", T("myth", "price", "comment"), "trial"),
 (5, "11:00", "reel", "bk", "Reel BK: Follow up on Christmas?", "BK-Christmas",
  f"""Holiday follow-up scheduling: “Interested” on Christmas Eve, and the follow-up lands… on Christmas?

Not in VPEX. Automatic follow-ups, callbacks and retries now skip Thanksgiving, Christmas and New Year’s Day for every lead. The sheet labels the holiday and books the next workday instead (here, Monday Dec 28 at 10 AM). A rep can still pick it by hand. (Demo office.)

{SHARE}

#followup #salesrep #callcenter #salesfloor #powerdialer""", T("news", "callbacks", "share"), "home"),
 (5, "19:00", "carousel", "auto", "Carousel: Built for auto sales floors", "W10-Auto-%d:5",
  f"""Power dialer for car dealerships and auto sales floors calling internet leads.

VPEX’s auto demo office, as is:
• A script that books the test drive: “Does today after work or Saturday morning work better?”
• Answers to six customer brush-offs, mid-call, one tap: “Just send me your best price.” “I’m just looking.” “The price is too high.”
• Every customer’s notes, local time and best hour to call on the lead card.

Open the auto demo office, no sign-up. {SHARE}

#carsales #autosales #cardealership #bdc #powerdialer""", T("identity", "industry-fit", "share", "auto", "built-for"), "demo:auto"),
 (6, "11:00", "reel", "bl", "Reel BL: 3 weeks left in 2026.", "BL-ThreeWeeks",
  f"""Start a power dialer trial before the year ends: 3 weeks left in 2026.

7 days free today, no card. Your list goes in as is (Excel, CSV, text or contacts), reps sign in on their own phones, and your floor can be on the board by Friday. $49 a rep a month after. (Floor TV numbers are from a demo office.)

{BIO}

#powerdialer #salesteam #smallbusiness #callcenter #salesfloor""", T("offer", "trial", "bio"), "trial"),
 (6, "19:00", "image", "notnow", "Post: Not interested. In solar, or in now?", "W10-NotNow",
  f"""Solar sales objections: “I’m not interested.” In solar, or in now?

VPEX’s solar starter answer: “That’s fair. Is it solar itself, or just the timing?” One question splits a hard no from a timing no, and a timing no gets a callback instead of a dead lead. (Solar demo office.)

{DEMO}

#solarsales #doortodoorsales #coldcalling #salesrep #powerdialer""", T("contrast", "objections", "comment", "solar"), "demo:solar"),
]
THREADS_TEXT = {
 "bf": "“How did you get my number?” Don’t freeze. Say where the list came from, then offer to mark them do-not-call right now. In VPEX that answer opens mid-call.\n\nVPEX keeps your office’s own Do Not Call list; it doesn’t check the National Registry.\n\n{link}",
 "spouse": "“I need to talk to my spouse.” Insurance, solar, auto, business funding: every floor hears it. VPEX’s starter answers all make the same move: get everyone on the next call.\n\n{link}",
 "bg": "In the office you see who’s dialing. Remote, you guess. VPEX’s live rep tracker shows every rep dialing, idle or offline, updating the moment anyone dials: {link}",
 "bi": "9:15 PM Eastern: Eastern leads are done (the federal window closes at 9, their time). Central and the West are still open. VPEX puts the people you can call right now first.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
 "bk": "“Interested” on Christmas Eve, follow-up booked… Christmas Day? Not in VPEX. Automatic follow-ups now skip Thanksgiving, Christmas and New Year’s Day and book the next workday: {link}",
 "auto": "A power dialer for auto sales floors: a script that books the test drive, answers to “just send me your best price” mid-call, and every customer’s best hour on the lead card.\n\nOpen the auto demo office, no sign-up: {link}",
}
REEL_ALT = {
 "bf": "Text: How did you get my number? Your rep freezes. Or says this. Then VPEX's Rebuttals sheet in a real estate demo office, with How did you get my number? open: It came from where your list came from. If you'd rather not hear from me, I'll mark you do-not-call right now. Text: Send this to your floor.",
 "bg": "Text: In the office, you see it. Remote? You guess. Then VPEX's Your reps, live screen in a demo office: 77 calls today, 4 working now, each rep dialing or idle, then the Needs you sort with late follow-ups on top.",
 "bh": "Text: Just send me your best price. Then they ghost. Here's the fix. Then VPEX's Rebuttals sheet in an auto demo office with the answer: Happy to. The price depends on your trade and financing, so 10 minutes in person gets you a real number. When could you stop by? Text: Link in bio.",
 "bi": "A clock reads 9:15 PM. Text: East Coast: closed. The West? Still open. Then VPEX's Dial tab in a demo office on Friday at 9:15 PM Eastern, with Callable now first and a California lead up next at 6:15 PM their time.",
 "bj": "Text: 6 brush-offs. 6 answers. One tap. A list of what business funding floors hear: rates too high, already have one, send me some info. Then VPEX's Rebuttals sheet in a business funding demo office with the answer to Just send me some info.",
 "bk": "Text: Thu, Dec 24. Interested. Follow up tomorrow? That's Christmas. Then VPEX's follow-up sheet in a demo office: the Tomorrow chip is labeled Christmas, and the booking reads Book Mon 28 10 AM.",
 "bl": "Text: 3 weeks left in 2026. A list: today, 7 days free; card not needed; your list goes in as is. Then VPEX's Floor TV in a demo office: calls today, conversations, interested, appointments. Text: Link in bio.",
}
ALT = {
 "W10-Spouse-1": "Brush-offs, every floor: I need to talk to my spouse. Every sales floor hears it. Here's how VPEX's starter scripts answer it: insurance, solar, auto sales, business funding.",
 "W10-Spouse-2": "Insurance: I'll ask my kids first. VPEX's answer in an insurance demo office: That's a good idea. Would it help to set a time when they can be on the call too?",
 "W10-Spouse-3": "Solar: I need to talk to my spouse. VPEX's answer in a solar demo office: Of course. Let's set the consultation for a time when you can both be there.",
 "W10-Spouse-4": "Auto sales: I need to talk to my spouse. VPEX's answer in an auto demo office: Of course. Would it help to come in together? I can set a time that works for both of you.",
 "W10-Spouse-5": "Business funding: I need to talk to my partner. VPEX's answer in a business funding demo office: Makes sense. When could I get you both on a quick call?",
 "W10-Spouse-6": "Same move every time: everyone on the next call. Admins edit the answers; every rep's app updates. Send this to your floor.",
 "W10-Budget": "Budgeting 2027? Your dialer is one line. $49 a rep a month, the whole price. An example: 5 reps $245 a month, 10 reps $490, 20 reps $980. 7 days free first, no card.",
 "W10-Calendar": "New, Calendar tab: December, on one screen. VPEX's December 2026 calendar in a demo office, with the number of follow-ups due on each day and dots for appointments.",
 "W10-Remote-1": "Remote floors: reps at home? 3 things to check from your phone: who's dialing right now, who needs you, the floor's day on one screen.",
 "W10-Remote-2": "Who's dialing right now: dialing, idle or offline, live. VPEX's live rep tracker in a demo office: each rep's calls, talked, interested, appointments and pace.",
 "W10-Remote-3": "Who needs you: idle too long, late follow-ups. VPEX's rep tracker sorted by Needs you, with late follow-ups and idle time on each rep.",
 "W10-Remote-4": "The floor's day, live. VPEX's Floor TV in a demo office: 77 calls today, 22 conversations, 5 interested, 3 appointments, the floor goal and most calls today.",
 "W10-Remote-5": "Same floor, wherever your reps sit. Save this.",
 "W10-Myth": "Myth: trying a power dialer means a contract and a long setup. With VPEX: 7 days free, no card; your list goes in as is; reps dial from their own phones; $49 a rep a month, cancel any time.",
 "W10-Auto-1": "Built for your floor, auto sales: a power dialer for auto sales floors calling internet leads. A script that books the test drive, answers to just send me your best price, every customer's notes and best hour.",
 "W10-Auto-2": "The script: Does today after work or Saturday morning work better? VPEX's Call script in an auto demo office, opening: Hi, this is me with company. You were looking at a vehicle with us.",
 "W10-Auto-3": "Just send me your best price. VPEX's answer in an auto demo office: Happy to. The price depends on your trade and financing, so 10 minutes in person gets you a real number.",
 "W10-Auto-4": "What they want, and when they pick up. A VPEX lead card in an auto demo office: New York, local time, best Monday 4 to 5 PM, notes: wants to keep the payment about the same.",
 "W10-Auto-5": "Open the auto demo office. No sign-up. Sample customers, real VPEX. Send this to your sales manager.",
 "W10-NotNow": "Not interested. In solar, or in now? VPEX's answer in a solar demo office: That's fair. Is it solar itself, or just the timing? One question splits a hard no from a timing no.",
}
THREADS = [
 (0, "t-brush", "Floor owners: what’s the brush-off your reps hear most in December? “Call me after the holidays”? “Send me something”? “Not a good time”?\n\nVPEX puts an answer to each one on the rep’s screen, mid-call: {link}",
  T("question", "objections", "question"), "home"),
 (1, "t-number", "Rule of the week (a habit, not a law): when someone asks “how did you get my number?”, tell them where the list came from, then offer to mark them do-not-call on the spot.\n\nVPEX keeps your office’s own Do Not Call list; it doesn’t check the National Registry.\n\n{link}",
  T("rule", "objections", "none"), "home"),
 (2, "t-remote", "Managers with reps at home: how do you know who’s actually dialing right now? A group chat? A spreadsheet at 5 PM?\n\nVPEX shows every rep live, the moment they dial: {link}",
  T("question", "remote-team", "question"), "home"),
 (3, "t-pa", "Rule of the week: Pennsylvania’s calling hours are 9 AM to 7 PM, the lead’s time, and no sales calls on Sundays or on legal holidays like Christmas Day.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
  T("rule", "calling-hours", "none", "", "rule-watch"), "home"),
 (4, "t-trial", "You shouldn’t need a sales call to try a power dialer. VPEX: 7 days free, no card, your list goes in as is, $49 a rep a month after.\n\nStart today: {link}",
  T("offer", "trial", "none"), "trial"),
 (5, "t-dec", "To every rep dialing through December: the leads who said “after the holidays” will remember who actually called back. Put them on a date, not a sticky note: {link}",
  T("identity", "callbacks", "none"), "home"),
 (6, "t-new", "New in VPEX: automatic follow-ups, callbacks and retries skip Thanksgiving, Christmas and New Year’s Day, and the follow-up sheet labels them. A rep can still pick one by hand: {link}",
  T("news", "callbacks", "none"), "home"),
]
STICKER = [
 ("Tue", "Poll: December on your floor", "Add a Poll sticker: Pushing hard / Coasting to January."),
 ("Wed", "Quiz: How did you get my number?", "Add a Quiz sticker: Hang up / Say where + offer do-not-call / Change the subject, with the middle one as the right answer."),
 ("Thu", "Poll: reps working from home?", "Add a Poll sticker: Some / None / All of them."),
 ("Fri", "Quiz: 9:15 PM Eastern", "Add a Quiz sticker: New York / Chicago / Miami, with Chicago as the right answer (8:15 PM there)."),
 ("Sat", "Question: the brush-off you hear most", "Add a Question sticker: “The brush-off we hear most…”."),
 ("Sun", "Quiz: Christmas Day calls", "Add a Quiz sticker: Pennsylvania / Ohio / Georgia, with Pennsylvania as the right answer."),
 ("Mon", "Slider: ready for 2027?", "Add an Emoji slider sticker with 🚀."),
]

def jpg(src, dst):
    im = Image.open(src).convert("RGB"); im.save(dst, quality=92, subsampling=0, optimize=True)

if __name__ == "__main__":
    shutil.rmtree(OUT, ignore_errors=True)
    for d in ("1-Reels", "2-Posts", "3-Stories", "4-Story-versions"): os.makedirs(OUT + "/" + d)
    items = []
    for di, (dayname, title, note) in enumerate(STICKER):
        f = "W10-Story-%s-1.jpg" % dayname; jpg(D + "/out/jpg/" + f, OUT + "/3-Stories/" + f)
        items.append({"id": "w10-story-%s" % dayname.lower(), "at": DAYS[di] + " 09:00", "type": "story", "title": "%s 9 AM · %s" % (dayname, title),
                      "image": "3-Stories/" + f, "manual": True, "note": "Post 3-Stories/%s from the Week 10 pack and add the sticker. %s" % (f, note)})
    for di, key, text, tags, go in THREADS:
        items.append({"id": "w10-" + key, "at": DAYS[di] + " 08:30", "type": "thread", "title": "Threads: " + text.split("\n")[0][:60], "threads_text": text, "tags": tags, "go": go})
    for di, hm, typ, key, title, src, cap, tags, go in FEED:
        when = DAYS[di] + " " + hm
        it = {"id": "w10-" + key, "at": when, "type": typ, "title": title, "caption": cap, "tags": tags, "go": go}
        if key in THREADS_TEXT: it["threads_text"] = THREADS_TEXT[key]
        share = {"id": "w10-" + key + "-share", "at": DAYS[di] + (" 12:30" if hm == "11:00" else " 20:30"), "type": "story", "title": "Story share: " + title}
        if typ == "reel":
            cv = key.upper()
            shutil.copyfile(D + "/out/video/Reel-%s-sound.mp4" % src, OUT + "/1-Reels/Reel-%s.mp4" % src)
            jpg(D + "/out/jpg/W10-Cover-%s.jpg" % cv, OUT + "/1-Reels/Cover-%s.jpg" % cv)
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
    plan = {"format": 2, "name": "VPEX Instagram, week 10: Brush-offs and remote floors", "timezone": "America/New_York",
            "notes": "Times are New York time (EST). Safe cadence (instagram/limits.json): each day 2 feed posts at 11:00 and 19:00 (also to the Facebook Page and Threads), stories at 09:00 (sticker, by hand), 12:30 and 20:30, and 1 Threads-only post at 08:30.",
            "items": items}
    json.dump(plan, open(OUT + "/plan.json", "w"), indent=1, ensure_ascii=False)
    lines = ["VPEX Instagram, week 10: Brush-offs and remote floors", "Posted by the bot, New York time. Only the 9 AM sticker stories are posted by hand.", ""]
    for it in items: lines.append("%s  %-8s %s" % (it["at"], it["type"] + ("*" if it.get("manual") else ""), it["title"]))
    lines += ["", "Captions", ""]
    for it in items:
        if it["type"] == "thread": lines += ["== " + it["title"] + " (" + it["at"] + ")", it["threads_text"], ""]
        elif it["type"] != "story": lines += ["== " + it["title"] + " (" + it["at"] + ")", it["caption"], ""]
    open(OUT + "/Week-10-Posting-Plan.txt", "w").write("\n".join(lines))
    z = OUT + ".zip"
    if os.path.exists(z): os.remove(z)
    with zipfile.ZipFile(z, "w", zipfile.ZIP_STORED) as zf:
        for root, _, files in os.walk(OUT):
            for f in sorted(files):
                p = os.path.join(root, f); zf.write(p, NAME + "/" + os.path.relpath(p, OUT))
    print(len(items), "items:", sum(1 for i in items if i["type"] in ("reel", "image", "carousel")), "feed,", sum(1 for i in items if i["type"] == "story"), "stories,",
          sum(1 for i in items if i["type"] == "thread"), "Threads-only")
    print("zip %.1f MB" % (os.path.getsize(z) / 1e6))
