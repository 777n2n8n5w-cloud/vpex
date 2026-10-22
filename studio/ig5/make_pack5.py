# Week-5 pack for the bot (format 2), Tue Oct 27 - Mon Nov 2, 2026, at the safe cadence in instagram/limits.json:
# each day 2 feed posts (11:00 and 19:00, also to the Facebook Page and Threads), 3 Instagram stories (09:00 sticker story by
# hand, 12:30 share of the 11:00 post, 20:30 share of the 19:00 post) and 1 Threads-only post at 08:30. New York time.
# usage: PACK_OUT=/tmp/VPEX-Instagram-Week-5 python3 make_pack5.py
import os, json, shutil, zipfile, importlib.util
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("PACK_OUT", "/tmp/VPEX-Instagram-Week-5")
NAME = "VPEX-Instagram-Week-5"
DEMO = "Comment DEMO and we’ll send you a live demo office."
BIO = "Tap the link in our bio, then this post."
SHARE = "Send this to your manager."
LEGAL = "Based on published state rules as of October 2026. Not legal advice."
DAYS = ["2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]
def T(hook, topic, cta, ind="", series=""): return {"hook": hook, "topic": topic, "ind": ind, "cta": cta, "series": series}

# (day index, time, type, key, title, source, caption, tags, go)
FEED = [
 (0, "11:00", "reel", "w", "Reel W: One rep is struggling. Which one?", "W-WhoNeedsHelp",
  f"""Sales coaching for call center managers: which rep needs help today?

One rep is struggling. Most managers find out Friday.

VPEX’s Sales coach reads your team’s last 14 days of calls and tells you who’s behind and why: an interested lead with no next step, overdue follow-ups, the hour each rep connects best. Only you see it.

{DEMO}

#salesmanager #callcenter #salescoaching #salesfloor #powerdialer""", T("pov", "manager-view", "comment"), "home"),
 (0, "19:00", "carousel", "dnc", "Carousel: Take me off your list", "W5-DNC-%d:5",
  f"""Do Not Call list for your whole sales team, not just one rep.

“Take me off your list.” He told one rep. Two days later, another rep called him from the same list.

In VPEX, the rep who hears it taps Do not call. The number is blocked for everyone on the team right away: no calls, no texts, and it’s skipped on the next list you upload.

{SHARE}

VPEX keeps your office’s own Do Not Call list. It doesn’t check the National Do Not Call Registry; scrub new lists against it before you upload. Not legal advice.

#donotcall #salesfloor #callcenter #salesmanager #powerdialer""", T("pain", "dnc", "share"), "home"),
 (1, "11:00", "image", "lists", "Post: Two reps dialed the same list all morning", "W5-Lists",
  f"""Lead list management for sales teams: pick who calls each list.

Two reps dialed the same list all morning. Same leads, twice the hang-ups.

In VPEX, you choose who calls each list. Only those reps get its leads in their queue, and leads someone already worked keep their owner and their follow-ups.

{BIO}

#leadlists #salesfloor #salesmanager #callcenter #powerdialer""", T("pain", "shared-list", "bio"), "home"),
 (1, "19:00", "reel", "x", "Reel X: Just mail me something", "X-JustMailMe",
  f"""Insurance rebuttals your new reps can open mid-call.

“Just mail me something.” Your new rep says “uh… sure,” and the call is over.

In VPEX, the script and rebuttals open from the Dial screen. Tap the objection and the answer is right there. You write them once, and every rep’s app updates.

{DEMO}

#insuranceagent #insurancesales #salesrebuttals #salesfloor #powerdialer""", T("quote", "scripts", "comment", "insurance"), "demo:insurance"),
 (2, "11:00", "reel", "y", "Reel Y: Calling at the wrong hour?", "Y-WrongHour",
  f"""Best time to call leads, from your own team’s calls.

Calling at the wrong hour? Most floors never check.

VPEX counts your team’s answer rate by each lead’s own local hour, marks the hour your team reaches people best on every lead, and its Smart order uses it.

{SHARE}

#coldcalling #salesfloor #callcenter #salesmanager #powerdialer""", T("pain", "answer-times", "share"), "home"),
 (2, "19:00", "carousel", "mca", "Carousel: Built for business funding floors", "W5-MCA-%d:5",
  f"""Power dialer for business funding and MCA sales floors.

Built for your floor:
• Your pipeline: New lead → Qualified → App sent → Negotiating → Submitted → Funded → Paid off
• “Just send me some info.” The rebuttal opens from the Dial screen, mid-call
• List ROI: which lead lists actually produce merchants

{DEMO}

#mca #businessfunding #merchantcashadvance #salesfloor #powerdialer""", T("identity", "industry-fit", "comment", "mca", "built-for"), "demo:mca"),
 (3, "11:00", "carousel", "day1", "Carousel: Your new rep's first day", "W5-Day1-%d:5",
  f"""Onboarding new sales reps on a call floor: what they see on day one.

POV: it’s your new rep’s first day.
1. The script opens on the Dial screen, with the lead’s name in it
2. The Qualify sheet: tap the answers, no second call to qualify
3. Every lead’s local time, with calling hours checked before anyone dials
4. My coach: their own numbers, only they see it

Save this for your next new hire.

{LEGAL}

#salestraining #newhire #salesfloor #callcenter #salesmanager""", T("pov", "rep-onboarding", "save", "", "rep-pov"), "home"),
 (3, "19:00", "reel", "z", "Reel Z: Friday 5 PM. How'd we do?", "Z-Friday5PM",
  f"""Weekly sales report for your team, in one tap.

Friday, 5 PM. How’d we do? No spreadsheet, no guessing.

VPEX’s Results report puts this week next to last week: calls, conversations, interested, reach rate and time on the phone, then every rep. Share it, or save it as a PDF.

{SHARE}

#salesreport #salesmanager #callcenter #salesfloor #powerdialer""", T("pov", "manager-view", "share"), "home"),
 (4, "11:00", "reel", "ac", "Reel AC: Today, Halloween (86 looks)", "AC-HalloweenLook",
  f"""A power dialer your reps actually like looking at.

Your reps stare at the Dial screen all day. So each rep picks their own look: 86 of them, light or dark, loud or calm, plus one for every holiday. Today’s is Halloween.

{BIO}

#halloween #salesfloor #salesteam #callcenter #powerdialer""", T("feature", "themes", "bio"), "home"),
 (4, "19:00", "image", "dst", "Post: Clocks fall back tonight. Arizona's don't.", "W5-DST",
  f"""Calling hours after the clocks fall back: Arizona and Hawaii don’t change.

Tonight at 2 AM, most of the US falls back an hour. Arizona and Hawaii stay put. So on Monday, Phoenix is 2 hours behind New York, not 3: a 10 AM Eastern call to Phoenix lands at 8 AM there, not 7.

VPEX shows every lead’s local time and checks it against their state’s calling hours, so nobody does that math on Monday.

Save this for Monday’s first call.

{LEGAL}

#daylightsavingtime #callinghours #salesfloor #callcenter #powerdialer""", T("reference", "calling-hours", "save", "", "rule-watch"), "home"),
 (5, "11:00", "image", "trial", "Post: Set it up Sunday. Dial Monday.", "W5-Trial",
  f"""Free power dialer trial for your sales team: set it up today, dial Monday.

1. Start your free trial. Two minutes, no card.
2. Text your reps the invite link. They pick a username and sign in on their own phones.
3. Load your list and dial. Duplicates and Do Not Call numbers are skipped.

7 days free, then $49 per rep per month.

{BIO}

#powerdialer #salesfloor #salesmanager #callcenter #salesteam""", T("offer", "trial", "bio"), "trial"),
 (5, "19:00", "reel", "aa", "Reel AA: You paid for the list. Did it pay?", "AA-ListPaid",
  f"""Lead list ROI for insurance floors: which lists actually pay?

You paid for the list. Did it pay? Dials aren’t deals.

VPEX’s List ROI puts every list side by side: calls, conversations, interested per 100 dials, dollars applied and dollars per lead.

{DEMO}

#insuranceleads #insuranceagent #leadgeneration #salesfloor #powerdialer""", T("pain", "list-roi", "comment", "insurance"), "demo:insurance"),
 (6, "11:00", "reel", "ab", "Reel AB: She said yes. Then nobody called.", "AB-YesThenNothing",
  f"""Overdue sales follow-ups, caught before the deal goes cold.

She said yes. Then nobody called, and the follow-up slipped.

In VPEX, interested leads more than a day late are the first thing in Admin controls. Call them all, closest to closing first, or move any of them to a rep who can call today.

{SHARE}

#followup #salesmanager #salesfloor #callcenter #powerdialer""", T("pain", "followups", "share"), "home"),
 (6, "19:00", "image", "goals", "Post: New month. Does every rep know their number?", "W5-Goals",
  f"""Monthly sales goals for every rep, with their pace every day.

New month. Does every rep know their number?

In VPEX, set each rep’s targets once: calls, interested and dollars. Each rep sees their own progress and whether they’re on pace in My coach.

Save this for the 1st of every month.

#salesgoals #salesmanager #salesfloor #callcenter #powerdialer""", T("question", "goals", "save"), "home"),
]
THREADS_TEXT = {   # written by hand where the automatic Threads version wouldn't read well
 "dnc": "“Take me off your list.” He told one rep. Two days later, another rep called him from the same list.\n\nIn VPEX, the rep who hears it taps Do not call, and the number is blocked for the whole team: no calls, no texts, skipped on the next upload.\n\nVPEX doesn’t check the National Do Not Call Registry; scrub new lists first. Not legal advice.\n\n{link}",
 "day1": "POV: it’s your new rep’s first day. In VPEX they get the script on the Dial screen, a Qualify sheet they answer with taps, every lead’s local time with calling hours checked, and My coach with their own numbers.\n\nSave it for your next new hire.\n\nBased on published state rules as of October 2026. Not legal advice.\n\n{link}",
 "dst": "Clocks fall back tonight. Arizona and Hawaii don’t. On Monday, a 10 AM Eastern call to Phoenix lands at 8 AM there, not 7.\n\nVPEX shows every lead’s local time and checks their state’s calling hours, so nobody does that math.\n\nBased on published state rules as of October 2026. Not legal advice.\n\n{link}",
 "trial": "Set it up Sunday, dial Monday. Start a free trial in two minutes, no card. Text your reps the invite link. Load your list; duplicates and Do Not Call numbers are skipped.\n\n7 days free, then $49 per rep per month: {link}",
 "mca": "Built for business funding floors: your pipeline from App sent to Funded to Paid off, the “just send me some info” rebuttal on the Dial screen, and List ROI that shows which lists produce merchants.\n\nOpen the business funding demo office, no sign-up: {link}",
}
REEL_ALT = {
 "w": "Text: One rep is struggling. Which one? You'll find out Friday. Here's the fix. Then the VPEX Sales coach in a demo office: team reach and best hours, then a rep's card flagging an interested lead with no next step scheduled.",
 "x": "Text: Just mail me something. Your new rep: uh, sure. Call over. Here's the fix. Then VPEX's rebuttals on the Dial screen in a demo insurance office, with the answer to Just mail me something opened.",
 "y": "Text: Calling at the wrong hour? Most floors never check. Here's the fix. Then VPEX's answer times, the team's answer rate by the lead's local hour in a demo office, and a lead card marked prime hour.",
 "z": "A 5:00 PM clock. Text: Friday. How'd we do? No spreadsheet. No guessing. One tap. Then VPEX's Results report in a demo office: this week vs. last week, then results by rep, with Copy as text and Save as PDF.",
 "ac": "Text: Your reps stare at it all day. Then the VPEX Dial screen flips through looks: default, Neon Noir, Old Money, Game Day, Synthwave, then Halloween. Text: Each rep picks their own.",
 "aa": "Text: You paid for the list. Did it pay? Dials aren't deals. Here's the fix. Then VPEX's List ROI in a demo insurance office: each lead list with calls, conversations, interested per 100 dials and dollars per lead.",
 "ab": "Text: She said yes. Then nobody called. The follow-up slipped. Here's the fix. Then VPEX Admin controls with late follow-ups at the top, and the Overdue follow-ups list with Call all now and Move to another rep.",
}
ALT = {
 "W5-DNC-1": "“Take me off your list.” He told one rep. Two days later, another rep called him from the same list. Who else heard it?",
 "W5-DNC-2": "One tap: Do not call. A VPEX confirmation reads: Anthony Ross asked not to be called? They'll be blocked for everyone on the team. Buttons: Cancel, Do not call.",
 "W5-DNC-3": "Blocked for the whole team, right away. The lead's profile now shows On the Do Not Call list.",
 "W5-DNC-4": "Next list you load? That number is skipped. The VPEX Do Not Call list shows Anthony Ross, marked by your team.",
 "W5-DNC-5": "One no should stop the whole floor. Send this to your manager. VPEX keeps your office's own Do Not Call list; it doesn't check the National Do Not Call Registry. Not legal advice.",
 "W5-Lists": "Headline: Two reps dialed the same list all morning. A VPEX screen asks Who calls Turning 65? with a checkbox for each rep.",
 "W5-MCA-1": "Built for business funding floors. Merchants, advances, renewals.",
 "W5-MCA-2": "Business funding pipeline stages in VPEX: New lead, Qualified, App sent, Negotiating, Submitted, Funded, Paid off.",
 "W5-MCA-3": "The rebuttal for Just send me some info, opened on the VPEX Dial screen: offer to text the one-page application.",
 "W5-MCA-4": "VPEX List ROI in a demo business funding office: UCC leads and Aged leads with calls, conversations, interested per 100 dials and dollars per lead.",
 "W5-MCA-5": "Try the business funding office. Comment DEMO.",
 "W5-Day1-1": "POV: it's your new rep's first day. Four things they see before they ever ask you a question.",
 "W5-Day1-2": "The VPEX call script, opened on the Dial screen with the lead's name filled in.",
 "W5-Day1-3": "The VPEX Qualify sheet for insurance: product, age, coverage and budget, answered with taps.",
 "W5-Day1-4": "A VPEX lead card showing the lead's local time and a star for prime hour.",
 "W5-Day1-5": "VPEX My coach: a rep's own calls, reach and tips, visible only to them. Save this for your next new hire.",
 "W5-DST": "Headline: Clocks fall back tonight. Arizona's don't. At 10 AM New York time last Monday, a Phoenix lead showed 7:00 AM, outside 8 AM to 9 PM. This Monday the same lead shows 8:00 AM local.",
 "W5-Trial": "Set it up Sunday. Dial Monday. 1: Start your free trial, two minutes, no card. 2: Text your reps the invite link. 3: Load your list and dial. 7 days free, then $49 per rep per month.",
 "W5-Goals": "Headline: New month. Does every rep know their number? VPEX Monthly goals for a rep: calls, interested and applied dollars, each with a pace bar.",
}
THREADS = [
 (0, "t-coach", "Managers: when one of your reps is struggling, how long until you notice?\n\nOn most floors it’s Friday, when the numbers come in. By then they’ve lost a week.\n\nWhat do you look at first? Here’s what VPEX’s Sales coach flags: {link}",
  T("question", "manager-view", "question"), "home"),
 (1, "t-dnc", "Rule of the week: when a lead says “take me off your list,” it’s off for the whole team that day, not just for the rep who heard it.\n\nIn VPEX it’s one tap, and the number is blocked for every rep, list and upload. VPEX doesn’t check the National Do Not Call Registry, so scrub new lists first. Not legal advice.\n\n{link}",
  T("rule", "dnc", "none", "", "rule-watch"), "home"),
 (2, "t-hours", "More dials isn’t the plan. Dials at the hour people pick up is.\n\nVPEX counts your team’s answer rate by each lead’s local hour and stars every lead’s best hour.\n\nSee it with sample leads: {link}",
  T("myth", "answer-times", "none"), "home"),
 (3, "t-friday", "Floor owners: what’s the one number you check before you leave on Friday?\n\nCalls? Conversations? Interested? Dollars?\n\nOurs puts all four on one page, by rep: {link}",
  T("question", "manager-view", "question"), "home"),
 (4, "t-dst", "Clocks fall back tonight. Arizona and Hawaii don’t.\n\nSo on Monday, Phoenix is 2 hours behind New York, not 3. A 10 AM Eastern call lands at 8 AM there, not 7.\n\nVPEX shows every lead’s local time and checks their state’s calling hours, so nobody does that math.\n\nBased on published state rules as of October 2026. Not legal advice.\n\n{link}",
  T("news", "calling-hours", "none", "", "rule-watch"), "home"),
 (5, "t-trial", "Sunday-night setup, Monday-morning dialing.\n\nStart a VPEX trial in two minutes, no card. Text your reps the invite link. Paste your list; duplicates and Do Not Call numbers are skipped.\n\n7 days free, then $49 per rep per month: {link}",
  T("offer", "trial", "none"), "trial"),
 (6, "t-yes", "A yes with no next step isn’t a yes. It’s a lead somebody forgets by Thursday.\n\nIn VPEX, an interested lead with no next step gets flagged in the Sales coach, and late follow-ups are the first thing in Admin controls, closest to closing first.\n\n{link}",
  T("contrast", "followups", "none"), "home"),
]
STICKER = [
 ("Tue", "Poll: who needs help?", "Add a Poll sticker: Yes / Not really."),
 ("Wed", "Question: the brush-off", "Add a Question sticker: “The brush-off we hear most”."),
 ("Thu", "Poll: when do they pick up?", "Add a Poll sticker with 3 options: Morning / Afternoon / Evening."),
 ("Fri", "Slider: how was the week?", "Add an Emoji slider sticker with 🔥."),
 ("Sat", "Quiz: Arizona", "Add a Quiz sticker: 1 hour / 2 hours / 3 hours, with 2 hours as the right answer."),
 ("Sun", "Poll: ready for Monday?", "Add a Poll sticker: Loaded / Not yet."),
 ("Mon", "Poll: goals set?", "Add a Poll sticker: Set / Not yet."),
]

def jpg(src, dst):
    im = Image.open(src).convert("RGB"); im.save(dst, quality=92, subsampling=0, optimize=True)

if __name__ == "__main__":
    shutil.rmtree(OUT, ignore_errors=True)
    for d in ("1-Reels", "2-Posts", "3-Stories", "4-Story-versions"): os.makedirs(OUT + "/" + d)
    items = []
    for di, (dayname, title, note) in enumerate(STICKER):
        f = "W5-Story-%s-1.jpg" % dayname; jpg(D + "/out/jpg/" + f, OUT + "/3-Stories/" + f)
        items.append({"id": "w5-story-%s" % dayname.lower(), "at": DAYS[di] + " 09:00", "type": "story", "title": "%s 9 AM · %s" % (dayname, title),
                      "image": "3-Stories/" + f, "manual": True, "note": "Post 3-Stories/%s from the Week 5 pack and add the sticker. %s" % (f, note)})
    for di, key, text, tags, go in THREADS:
        items.append({"id": "w5-" + key, "at": DAYS[di] + " 08:30", "type": "thread", "title": "Threads: " + text.split("\n")[0][:60], "threads_text": text, "tags": tags, "go": go})
    for di, hm, typ, key, title, src, cap, tags, go in FEED:
        when = DAYS[di] + " " + hm
        it = {"id": "w5-" + key, "at": when, "type": typ, "title": title, "caption": cap, "tags": tags, "go": go}
        if key in THREADS_TEXT: it["threads_text"] = THREADS_TEXT[key]
        share = {"id": "w5-" + key + "-share", "at": DAYS[di] + (" 12:30" if hm == "11:00" else " 20:30"), "type": "story", "title": "Story share: " + title}
        if typ == "reel":
            cv = key.upper()
            shutil.copyfile(D + "/out/video/Reel-%s-sound.mp4" % src, OUT + "/1-Reels/Reel-%s.mp4" % src)
            jpg(D + "/out/jpg/W5-Cover-%s.jpg" % cv, OUT + "/1-Reels/Cover-%s.jpg" % cv)
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
    plan = {"format": 2, "name": "VPEX Instagram, week 5: Run the floor from your phone", "timezone": "America/New_York",
            "notes": "Times are New York time (clocks fall back Sun Nov 1). Safe cadence (instagram/limits.json): each day 2 feed posts at 11:00 and 19:00 (also to the Facebook Page and Threads), stories at 09:00 (sticker, by hand), 12:30 and 20:30, and 1 Threads-only post at 08:30.",
            "items": items}
    json.dump(plan, open(OUT + "/plan.json", "w"), indent=1, ensure_ascii=False)
    lines = ["VPEX Instagram, week 5: Run the floor from your phone", "Posted by the bot, New York time. Only the 9 AM sticker stories are posted by hand.", ""]
    for it in items: lines.append("%s  %-8s %s" % (it["at"], it["type"] + ("*" if it.get("manual") else ""), it["title"]))
    lines += ["", "Captions", ""]
    for it in items:
        if it["type"] == "thread": lines += ["== " + it["title"] + " (" + it["at"] + ")", it["threads_text"], ""]
        elif it["type"] != "story": lines += ["== " + it["title"] + " (" + it["at"] + ")", it["caption"], ""]
    open(OUT + "/Week-5-Posting-Plan.txt", "w").write("\n".join(lines))
    z = OUT + ".zip"
    if os.path.exists(z): os.remove(z)
    with zipfile.ZipFile(z, "w", zipfile.ZIP_STORED) as zf:
        for root, _, files in os.walk(OUT):
            for f in sorted(files):
                p = os.path.join(root, f); zf.write(p, NAME + "/" + os.path.relpath(p, OUT))
    print(len(items), "items:", sum(1 for i in items if i["type"] in ("reel", "image", "carousel")), "feed,", sum(1 for i in items if i["type"] == "story"), "stories,",
          sum(1 for i in items if i["type"] == "thread"), "Threads-only")
    print("zip %.1f MB" % (os.path.getsize(z) / 1e6))
