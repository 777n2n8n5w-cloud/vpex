# Week-6 pack for the bot (format 2), Tue Nov 3 - Mon Nov 9, 2026, at the safe cadence in instagram/limits.json:
# each day 2 feed posts (11:00 and 19:00, also to the Facebook Page and Threads), 3 Instagram stories (09:00 sticker story by
# hand, 12:30 share of the 11:00 post, 20:30 share of the 19:00 post) and 1 Threads-only post at 08:30. New York time.
# usage: PACK_OUT=/tmp/VPEX-Instagram-Week-6 python3 make_pack6.py
import os, json, shutil, zipfile, importlib.util
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("PACK_OUT", "/tmp/VPEX-Instagram-Week-6")
NAME = "VPEX-Instagram-Week-6"
DEMO = "Comment DEMO and we’ll send you a live demo office."
BIO = "Tap the link in our bio, then this post."
SHARE = "Send this to your manager."
LEGAL = "Based on published state rules as of November 2026. Not legal advice."
DAYS = ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09"]
def T(hook, topic, cta, ind="", series=""): return {"hook": hook, "topic": topic, "ind": ind, "cta": cta, "series": series}

# (day index, time, type, key, title, source, caption, tags, go)
FEED = [
 (0, "11:00", "reel", "ad", "Reel AD: Slow Tuesday? Start a contest.", "AD-Contest",
  f"""Sales contest ideas for call center managers: run one from your phone.

Slow Tuesday? Start a contest.

In VPEX, pick what wins (most conversations, calls, interested or appointments set), today or for the rest of the week, and add a prize. Live standings show up on every rep’s dial screen.

{BIO}

#salescontest #salesmanager #callcenter #salesfloor #powerdialer""", T("pov", "contest", "bio"), "home"),
 (0, "19:00", "carousel", "solar", "Carousel: Built for solar floors", "W6-Solar-%d:5",
  f"""Power dialer for solar sales floors and appointment setters.

Built for your floor:
• Qualify while you talk: owns the home, electric bill, utility, roof age, shade, credit
• “My roof is old.” The rebuttal opens from the Dial screen, mid-call
• List ROI: door knocks vs. web leads, which lists sign homeowners

{SHARE}

#solarsales #solar #appointmentsetting #salesfloor #powerdialer""", T("identity", "industry-fit", "share", "solar", "built-for"), "demo:solar"),
 (1, "11:00", "image", "office", "Post: In office vs. remote. Same numbers?", "W6-Office",
  f"""Managing a remote sales team and an office floor on one scoreboard.

In office vs. remote. Same numbers?

VPEX’s Team scoreboard puts the reps in your office next to the ones dialing from home: calls, leads contacted, conversations, follow-up calls, appointments set and interested, with a per-rep average for each.

{SHARE}

#remotesales #salesmanager #callcenter #salesfloor #powerdialer""", T("contrast", "remote-team", "share"), "home"),
 (1, "19:00", "reel", "ae", "Reel AE: 8:15 AM. Can you call Connecticut?", "AE-EightFifteen",
  f"""Telemarketing calling hours by state: some start at 9, Kentucky at 10.

8:15 AM. Can you call a lead in Connecticut? Not yet. Connecticut’s sales calls start at 9, the lead’s time. So do Michigan, Pennsylvania and Texas on weekdays. Kentucky starts at 10.

VPEX shows every lead’s local time and checks their state’s calling hours before anyone dials.

Save this for Monday’s first call.

{LEGAL}

#callinghours #telemarketing #coldcalling #salesfloor #powerdialer""", T("reference", "calling-hours", "save", "", "rule-watch"), "home"),
 (2, "11:00", "reel", "af", "Reel AF: Who's winning today?", "AF-WhosWinning",
  f"""Sales leaderboard for your team, live on your phone.

Who’s winning today? If you have to ask, you’re finding out too late.

VPEX’s Team scoreboard shows every rep today: calls, reached, interested, follow-ups and time on calls, with reps in the office next to the ones working remote.

{DEMO}

#salesleaderboard #salesmanager #callcenter #salesfloor #powerdialer""", T("question", "scoreboard", "comment"), "home"),
 (2, "19:00", "carousel", "rules", "Carousel: How many times do you call a no-answer?", "W6-Rules-%d:5",
  f"""Sales follow-up rules: how many times to call a lead who never answers.

Most floors never decide, so every rep decides differently. In VPEX you set it once for the whole team:
1. No answer: 4 tries over 4 business days, then the lead rests and comes back in 60–90 days (or pick 3, 6 or 10)
2. Interested, but stuck: after 3 follow-ups with no stage change, the lead is parked so reps move on
3. Due follow-ups come up closest to closing first, and a callback time the lead asked for is always kept

Save this for your next team meeting.

#followup #salesprocess #salesmanager #salesfloor #powerdialer""", T("reference", "followup-rules", "save"), "home"),
 (3, "11:00", "image", "myth", "Post: Myth: you need desks, headsets and an IT guy", "W6-Myth",
  f"""Power dialer for small sales teams: no desks, headsets or IT needed.

Myth: a power dialer needs desks, headsets and an IT guy.

With VPEX, reps dial from their own phones, and you run the floor from yours: scoreboard, coach, contests. A free trial takes two minutes, no card.

{DEMO}

#smallbusiness #salesteam #salesfloor #callcenter #powerdialer""", T("myth", "setup", "comment"), "trial"),
 (3, "19:00", "reel", "ag", "Reel AG: Two reps. One lead.", "AG-TwoReps",
  f"""Stop two sales reps from calling the same lead.

Two reps. One lead. Two pitches, two prices, and then he stops picking up.

In VPEX, a lead a rep opens is held for them, everyone else’s queue skips it, and you can see who’s on what.

{SHARE}

#salesteam #salesmanager #callcenter #salesfloor #powerdialer""", T("pain", "shared-list", "share"), "home"),
 (4, "11:00", "reel", "ah", "Reel AH: Your number got flagged. Again.", "AH-Flagged",
  f"""Why your sales calls show up as Spam Likely, and one habit to fix.

Your number got flagged. Again. Rapid-fire dialing is one of the habits that gets numbers flagged.

VPEX’s Call pacing sets the daily calls per phone and spaces out bursts (by default, more than 20 calls in 15 minutes). Normal calling isn’t affected.

{DEMO}

#spamlikely #coldcalling #callcenter #salesfloor #powerdialer""", T("pain", "spam", "comment"), "home"),
 (4, "19:00", "carousel", "sunday", "Carousel: Calling leads tomorrow? Sunday rules", "W6-Sunday-%d:5",
  f"""Can you make sales calls on Sunday? Check the lead’s state first.

No sales calls on Sundays in Alabama, Louisiana, Mississippi, Pennsylvania, Rhode Island and South Dakota. Texas: Sundays noon to 9 PM, the lead’s time.

VPEX shows every lead’s local time and checks their state’s calling hours, Sundays and holidays included, before anyone dials.

Save this for Sunday morning.

{LEGAL}

#callinghours #telemarketing #salesfloor #callcenter #powerdialer""", T("reference", "calling-hours", "save", "", "rule-watch"), "home"),
 (5, "11:00", "image", "trial", "Post: Day one of your free trial", "W6-Trial",
  f"""Free power dialer trial for sales teams: what you get on day one.

• The Dial screen, with your script and rebuttals
• Calling hours checked for every lead’s state
• Your own Do Not Call list, team-wide
• Team scoreboard and Sales coach
• Contests on every rep’s screen

7 days free, no card. Then $49 per rep per month.

{BIO}

#powerdialer #salesfloor #salesmanager #callcenter #salesteam""", T("offer", "trial", "bio"), "trial"),
 (5, "19:00", "reel", "ai", "Reel AI: Your best rep quit.", "AI-RepQuit",
  f"""When a sales rep quits, keep the leads with your office.

Your best rep quit. Did their leads leave too?

In VPEX, leads, notes and call history belong to your office. Turn off a login and it’s signed out within seconds.

{SHARE}

#salesmanager #salesteam #smallbusiness #salesfloor #powerdialer""", T("pain", "rep-turnover", "share"), "home"),
 (6, "11:00", "reel", "aj", "Reel AJ: Monday's list came in a mess", "AJ-ListMess",
  f"""Import leads from Excel or CSV into your dialer, duplicates skipped.

Monday’s list came in as a spreadsheet, a CSV and a text.

In VPEX, upload Excel, CSV, text or contacts, paste a list, or add one lead at a time. Numbers already in your list are skipped.

{BIO}

#leadlists #salesmanager #salesfloor #callcenter #powerdialer""", T("pain", "list-import", "bio"), "trial"),
 (6, "19:00", "image", "vets", "Post: Wednesday is Veterans Day. No sales calls in 3 states.", "W6-Vets",
  f"""Calling hours on Veterans Day: three states with no sales calls on legal holidays.

Wednesday, November 11 is Veterans Day. Alabama, Louisiana and Rhode Island don’t allow sales calls on legal holidays.

VPEX knows the holidays and flags those leads before anyone dials.

{SHARE}

{LEGAL}

#veteransday #callinghours #telemarketing #salesfloor #powerdialer""", T("news", "calling-hours", "share", "", "rule-watch"), "home"),
]
THREADS_TEXT = {   # written by hand where the automatic Threads version wouldn't read well
 "solar": "Built for solar floors: qualify while you talk (owns the home, bill, roof age, shade), the “my roof is old” rebuttal on the Dial screen, and List ROI that shows which lists sign homeowners.\n\nOpen the solar demo office, no sign-up: {link}",
 "rules": "How many times do you call a lead who never answers? Most floors never decide.\n\nIn VPEX you set it once: 4 tries over 4 business days, then the lead rests 60–90 days. Interested but stuck after 3 follow-ups? Parked, so reps move on. Closest to closing comes up first.\n\n{link}",
 "sunday": "Calling leads tomorrow? No sales calls on Sundays in Alabama, Louisiana, Mississippi, Pennsylvania, Rhode Island and South Dakota. Texas: noon to 9 PM, their time.\n\nVPEX checks each lead’s state before anyone dials.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
 "vets": "Wednesday is Veterans Day. Alabama, Louisiana and Rhode Island don’t allow sales calls on legal holidays.\n\nVPEX knows the holidays and flags those leads before anyone dials.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
 "ae": "8:15 AM. Can you call a lead in Connecticut? Not yet: sales calls there start at 9, their time. Michigan, Pennsylvania and Texas too on weekdays. Kentucky starts at 10.\n\nVPEX checks every lead’s state before anyone dials.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
 "trial": "Day one of a VPEX trial: the Dial screen with your script and rebuttals, calling hours checked for every lead’s state, a team-wide Do Not Call list, the scoreboard and Sales coach, and contests.\n\n7 days free, no card, then $49 per rep per month: {link}",
}
REEL_ALT = {
 "ad": "Text: Slow Tuesday? Start a contest. Then VPEX's Contest setup in a demo office: most conversations, today, prize Lunch on me. Then live standings: Jordan Lee 7, Mia Chen 3, Sam Ortiz 2. Text: Who's buying lunch?",
 "ae": "A clock reads 8:15 AM. Text: Can you call Connecticut? Not yet. 9 AM. A list: no sales calls before 9 AM in Connecticut, Michigan, Pennsylvania and Texas, 10 AM in Kentucky. Then a VPEX lead card flagged: outside CT calling hours, 9 AM to 8 PM.",
 "af": "Text: Who's winning today? If you have to ask. Then VPEX's Team scoreboard in a demo office: each rep's calls, reached, interested and time on calls, then In office vs Remote side by side.",
 "ag": "Text: Two reps. One lead. Two pitches. Two prices. Then he stops picking up. Here's the fix. Then VPEX's Team and access screen in a demo office, showing which lead each rep is on.",
 "ah": "Text: Your number got flagged. Again. A phone screen shows an incoming call labeled Spam Likely. Text: 20 calls in 15 minutes? Here's the fix. Then VPEX's Call pacing settings: daily calls per phone, and seconds between calls during a burst.",
 "ai": "Text: Your best rep quit. Their leads leave too? Here's the fix. Then VPEX's Team and access screen with Turn off buttons, and the Pipeline, with leads kept by the office.",
 "aj": "Text: Monday's list came in a mess. A spreadsheet. A CSV. A text. Here's the fix. Then VPEX's Add leads: upload a file, paste a list, or add one. Excel, CSV, text or contacts. Numbers already in your list are skipped.",
}
ALT = {
 "W6-Solar-1": "Built for solar floors. Homeowners, roofs and utility bills. Qualify while you talk, My roof is old answered, which lists sign homeowners.",
 "W6-Solar-2": "VPEX's Qualify sheet in a demo solar office: owns the home, electric bill a month, utility and roof age, answered with taps.",
 "W6-Solar-3": "The rebuttal for My roof is old, opened in VPEX: the site survey checks the roof first, so you'd know if it needs work before anything else.",
 "W6-Solar-4": "VPEX List ROI in a demo solar office: door knock leads and web leads with calls, conversations, interested per 100 dials and dollars signed.",
 "W6-Solar-5": "Run a solar floor? There's a live solar demo office, no sign-up. Send this to your manager.",
 "W6-Office": "Headline: In office vs. remote. Same numbers? VPEX's Team scoreboard in a demo office compares In office and Remote reps: calls, leads contacted, conversations, follow-up calls, appointments set, notes and interested, per rep.",
 "W6-Rules-1": "How many times do you call a lead who never answers? Most floors never decide. So every rep decides differently.",
 "W6-Rules-2": "VPEX Follow-up rules, no answer: 4 tries over 4 business days, then the lead rests and comes back in 60 to 90 days.",
 "W6-Rules-3": "VPEX Follow-up rules, interested or callback: after 3 follow-up calls with no stage change, the lead is parked so reps move on.",
 "W6-Rules-4": "Due follow-ups come up closest to closing first. A callback time the lead asked for is always kept and comes up first.",
 "W6-Rules-5": "Set it once. It applies to every rep. In VPEX: Admin controls, then Calling rules. Save this for your next team meeting.",
 "W6-Myth": "Myth, crossed out: A power dialer needs desks, headsets and an IT guy. Fact: reps dial from their own phones. You run the floor from yours. A free trial takes two minutes, no card.",
 "W6-Sunday-1": "Calling leads tomorrow? Sunday. Six states on VPEX's list allow no sales calls at all. Texas says wait until noon.",
 "W6-Sunday-2": "No sales calls on Sundays: Alabama, Louisiana, Mississippi, Pennsylvania, Rhode Island, South Dakota. The lead's state, not yours.",
 "W6-Sunday-3": "Texas: Sundays noon to 9 PM, their time. A VPEX lead card flagged at 10 AM Central: outside TX calling hours, 12 PM to 9 PM.",
 "W6-Sunday-4": "VPEX checks the lead's state first. A lead card flagged: no sales calls on Sundays in RI.",
 "W6-Sunday-5": "Calling on weekends? Save this.",
 "W6-Trial": "Day one of your free trial: the Dial screen with your script and rebuttals, calling hours checked for every lead's state, your own Do Not Call list team-wide, Team scoreboard and Sales coach, contests on every rep's screen. 7 days free, no card, then $49 per rep per month.",
 "W6-Vets": "Wednesday, November 11. Veterans Day. No sales calls in 3 states: Alabama, Louisiana, Rhode Island, no sales calls on legal holidays. A VPEX lead card flagged: holiday, no sales calls in AL today.",
}
THREADS = [
 (0, "t-prize", "Floor owners: what prize actually gets your reps dialing harder?\n\nLunch? Cash? Leaving early Friday?\n\nVPEX contests put live standings on every rep’s dial screen. What would you put up? {link}",
  T("question", "contest", "question"), "home"),
 (1, "t-ky", "Rule of the week: it’s 8:30 AM in Louisville. A sales call to that lead has to wait until 10. Kentucky’s window is 10 AM to 9 PM, the lead’s time.\n\nVPEX checks each lead’s state before anyone dials.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
  T("rule", "calling-hours", "none", "", "rule-watch"), "home"),
 (2, "t-board", "A leaderboard isn’t there to shame the bottom rep. It’s there so nobody has to walk the floor at 3 PM asking how everyone’s doing.\n\nVPEX’s scoreboard shows every rep’s day, office or remote: {link}",
  T("contrast", "scoreboard", "none"), "home"),
 (3, "t-tworeps", "Two reps on the same lead in one afternoon is how a prospect hears two prices.\n\nIn VPEX, a lead a rep opens is held for them, and everyone else’s queue skips it: {link}",
  T("pain", "shared-list", "none"), "home"),
 (4, "t-sat", "Weekend question for floor owners: do your reps dial on Saturdays?\n\nIf you call Rhode Island, Saturday hours there are 10 AM to 5 PM, and Sundays are off.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
  T("question", "calling-hours", "question"), "home"),
 (5, "t-sunday", "Sunday night on a lot of floors: somebody cleans up a spreadsheet so Monday starts on time.\n\nIn VPEX you upload Excel, CSV, text or contacts, and numbers already in your list are skipped: {link}",
  T("pov", "list-import", "none"), "trial"),
 (6, "t-order", "Monday question: on your floor, who decides which lead gets called first? The rep, the list order, or nobody?\n\nIn VPEX, due follow-ups come up closest to closing first: {link}",
  T("question", "followup-rules", "question"), "home"),
]
STICKER = [
 ("Tue", "Poll: contest this week?", "Add a Poll sticker: Yes / Not yet."),
 ("Wed", "Quiz: 8:15 AM in Connecticut", "Add a Quiz sticker: Yes / No, with No as the right answer."),
 ("Thu", "Question: first number you check", "Add a Question sticker: “The first number I check”."),
 ("Fri", "Poll: where do your reps dial from?", "Add a Poll sticker with 3 options: Office / Home / Both."),
 ("Sat", "Quiz: Sunday calls after noon", "Add a Quiz sticker: Texas / Pennsylvania / Rhode Island, with Texas as the right answer."),
 ("Sun", "Slider: Monday's list ready?", "Add an Emoji slider sticker with 🔥."),
 ("Mon", "Quiz: Veterans Day states", "Add a Quiz sticker: 1 / 3 / 5, with 3 as the right answer."),
]

def jpg(src, dst):
    im = Image.open(src).convert("RGB"); im.save(dst, quality=92, subsampling=0, optimize=True)

if __name__ == "__main__":
    shutil.rmtree(OUT, ignore_errors=True)
    for d in ("1-Reels", "2-Posts", "3-Stories", "4-Story-versions"): os.makedirs(OUT + "/" + d)
    items = []
    for di, (dayname, title, note) in enumerate(STICKER):
        f = "W6-Story-%s-1.jpg" % dayname; jpg(D + "/out/jpg/" + f, OUT + "/3-Stories/" + f)
        items.append({"id": "w6-story-%s" % dayname.lower(), "at": DAYS[di] + " 09:00", "type": "story", "title": "%s 9 AM · %s" % (dayname, title),
                      "image": "3-Stories/" + f, "manual": True, "note": "Post 3-Stories/%s from the Week 6 pack and add the sticker. %s" % (f, note)})
    for di, key, text, tags, go in THREADS:
        items.append({"id": "w6-" + key, "at": DAYS[di] + " 08:30", "type": "thread", "title": "Threads: " + text.split("\n")[0][:60], "threads_text": text, "tags": tags, "go": go})
    for di, hm, typ, key, title, src, cap, tags, go in FEED:
        when = DAYS[di] + " " + hm
        it = {"id": "w6-" + key, "at": when, "type": typ, "title": title, "caption": cap, "tags": tags, "go": go}
        if key in THREADS_TEXT: it["threads_text"] = THREADS_TEXT[key]
        share = {"id": "w6-" + key + "-share", "at": DAYS[di] + (" 12:30" if hm == "11:00" else " 20:30"), "type": "story", "title": "Story share: " + title}
        if typ == "reel":
            cv = key.upper()
            shutil.copyfile(D + "/out/video/Reel-%s-sound.mp4" % src, OUT + "/1-Reels/Reel-%s.mp4" % src)
            jpg(D + "/out/jpg/W6-Cover-%s.jpg" % cv, OUT + "/1-Reels/Cover-%s.jpg" % cv)
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
    plan = {"format": 2, "name": "VPEX Instagram, week 6: The rules your floor runs on", "timezone": "America/New_York",
            "notes": "Times are New York time (EST). Safe cadence (instagram/limits.json): each day 2 feed posts at 11:00 and 19:00 (also to the Facebook Page and Threads), stories at 09:00 (sticker, by hand), 12:30 and 20:30, and 1 Threads-only post at 08:30.",
            "items": items}
    json.dump(plan, open(OUT + "/plan.json", "w"), indent=1, ensure_ascii=False)
    lines = ["VPEX Instagram, week 6: The rules your floor runs on", "Posted by the bot, New York time. Only the 9 AM sticker stories are posted by hand.", ""]
    for it in items: lines.append("%s  %-8s %s" % (it["at"], it["type"] + ("*" if it.get("manual") else ""), it["title"]))
    lines += ["", "Captions", ""]
    for it in items:
        if it["type"] == "thread": lines += ["== " + it["title"] + " (" + it["at"] + ")", it["threads_text"], ""]
        elif it["type"] != "story": lines += ["== " + it["title"] + " (" + it["at"] + ")", it["caption"], ""]
    open(OUT + "/Week-6-Posting-Plan.txt", "w").write("\n".join(lines))
    z = OUT + ".zip"
    if os.path.exists(z): os.remove(z)
    with zipfile.ZipFile(z, "w", zipfile.ZIP_STORED) as zf:
        for root, _, files in os.walk(OUT):
            for f in sorted(files):
                p = os.path.join(root, f); zf.write(p, NAME + "/" + os.path.relpath(p, OUT))
    print(len(items), "items:", sum(1 for i in items if i["type"] in ("reel", "image", "carousel")), "feed,", sum(1 for i in items if i["type"] == "story"), "stories,",
          sum(1 for i in items if i["type"] == "thread"), "Threads-only")
    print("zip %.1f MB" % (os.path.getsize(z) / 1e6))
