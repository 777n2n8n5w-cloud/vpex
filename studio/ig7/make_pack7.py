# Week-7 pack for the bot (format 2), Tue Nov 10 - Mon Nov 16, 2026, at the safe cadence in instagram/limits.json:
# each day 2 feed posts (11:00 and 19:00, also to the Facebook Page and Threads), 3 Instagram stories (09:00 sticker story by
# hand, 12:30 share of the 11:00 post, 20:30 share of the 19:00 post) and 1 Threads-only post at 08:30. New York time.
# usage: PACK_OUT=/tmp/VPEX-Instagram-Week-7 python3 make_pack6.py
import os, json, shutil, zipfile, importlib.util
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("PACK_OUT", "/tmp/VPEX-Instagram-Week-7")
NAME = "VPEX-Instagram-Week-7"
DEMO = "Comment DEMO and we’ll send you a live demo office."
BIO = "Tap the link in our bio, then this post."
SHARE = "Send this to your manager."
LEGAL = "Based on published state rules as of November 2026. Not legal advice."
MED = "Based on the CMS final rule for 2027, as of November 2026. Not legal advice. Follow your carriers’ guidelines."
SAVE = "Save this"
DAYS = ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"]
def T(hook, topic, cta, ind="", series=""): return {"hook": hook, "topic": topic, "ind": ind, "cta": cta, "series": series}

# (day index, time, type, key, title, source, caption, tags, go)
FEED = [
 (0, "11:00", "reel", "ak", "Reel AK: Your 9 AM is their 6 AM.", "AK-NineSix",
  f"""Calling West Coast leads from the East Coast: your 9 AM is their 6 AM.

Your floor starts at 9 Eastern. In California it’s 6 AM, two hours before the 8 AM start of the federal calling window. Mountain time: 7 AM.

VPEX shows every lead’s local time and flags anyone outside their state’s calling hours before a rep dials. East first, West after 11.

Save this for tomorrow’s first call.

{LEGAL}

#callinghours #coldcalling #telemarketing #salesfloor #powerdialer""", T("pov", "calling-hours", "save", "", "rule-watch"), "home"),
 (0, "19:00", "carousel", "last", "Carousel: 7:45 PM. Who can you still call?", "W7-Last-%d:5",
  f"""Telemarketing calling hours by state: when the last sales call of the night has to end.

The federal window closes at 9 PM, the lead’s time. 14 states on VPEX’s list close earlier:
• 6 PM: Rhode Island (weekdays)
• 7 PM: Pennsylvania
• 8 PM: Alabama, Connecticut, Florida, Louisiana, Maryland, Massachusetts, Mississippi, Nevada, Oklahoma, Oregon, Washington, Wyoming

VPEX checks each lead’s state before anyone dials.

Save this for your evening shift.

{LEGAL}

#callinghours #telemarketing #salesfloor #callcenter #powerdialer""", T("reference", "calling-hours", "save", "", "rule-watch"), "home"),
 (1, "11:00", "reel", "al", "Reel AL: Most calls. Fewest conversations?", "AL-CallsTalks",
  f"""Sales coaching for call center managers: calls aren’t conversations.

Most calls. Fewest conversations? Busy isn’t productive.

VPEX’s Team scoreboard shows calls and leads reached for every rep, and the Sales coach shows who needs help and with what: overdue follow-ups, interested leads with no next step, the hours each rep connects best.

{SHARE}

#salescoaching #salesmanager #callcenter #salesfloor #powerdialer""", T("contrast", "coaching", "share"), "home"),
 (1, "19:00", "image", "math", "Post: Example math, a 6-rep floor", "W7-Math",
  f"""Power dialer pricing for a small sales team, example math.

What does a power dialer cost a 6-rep floor? Example: 6 reps × $49 = $294 a month. One price, everything included: the dialer and follow-ups, the shared list and live scoreboard, contests and the Sales coach.

Every active login counts as a rep, and you can add or turn off reps any time. 7 days free first, no card.

{BIO}

#powerdialer #salesteam #smallbusiness #salesfloor #callcenter""", T("math", "price", "bio", "", "floor-math"), "trial"),
 (2, "11:00", "reel", "am", "Reel AM: Called him 11 minutes ago?", "AM-Redial",
  f"""Why your sales calls get labeled Spam Likely: calling back too soon.

Called him 11 minutes ago? Calling the same person again that soon is one of the habits that get numbers labeled spam.

VPEX asks before a rep calls someone back within 2 hours. Callbacks the lead asked for, and interested leads, go straight through.

{DEMO}

#spamlikely #coldcalling #callcenter #salesfloor #powerdialer""", T("pain", "spam", "comment"), "home"),
 (2, "19:00", "carousel", "aep", "Carousel: Medicare AEP, 3 checks before every call", "W7-AEP-%d:5",
  f"""Medicare AEP for insurance call centers: 3 checks before every call.

AEP runs through December 7.
1. Is it a calling hour in the lead’s state? 9 AM in New York is 6 AM in California.
2. Is the Scope of Appointment on record? The 48-hour wait is gone for 2027; the Scope of Appointment isn’t.
3. Did they ask not to be called? VPEX blocks the number for your whole office. It doesn’t check the National Do Not Call Registry, so scrub new lists against it first.

Save this for your next team huddle.

{MED}
{LEGAL}

#medicare #insuranceagent #finalexpense #callcenter #powerdialer""", T("reference", "medicare", "save", "insurance", "rule-watch"), "demo:insurance"),
 (3, "11:00", "reel", "an", "Reel AN: Rep POV: my first 10 minutes", "AN-RepPOV",
  f"""A power dialer from a sales rep’s point of view: the first 10 minutes.

9:00 AM. Tap to call. No answer? One tap, and the next lead is up. Interested? The follow-up sets itself and the thank-you text is ready to send.

Less tapping. More talking.

{BIO}

#salesrep #coldcalling #insuranceagent #salesfloor #powerdialer""", T("story", "rep-day", "bio", "", "rep-pov"), "home"),
 (3, "19:00", "carousel", "three", "Carousel: 3 calls in 24 hours", "W7-Three-%d:5",
  f"""Call frequency limits by state: Florida, Maryland, Oklahoma and Oregon.

Third call to the same lead today? In these four states on VPEX’s list, that’s the limit: at most 3 sales calls to one person in 24 hours, counted across your whole floor.

VPEX counts the calls and shows when the next one is allowed, so reps skip that lead and move on.

Save this for whoever builds your call lists.

{LEGAL}

#telemarketing #callinghours #coldcalling #salesfloor #powerdialer""", T("reference", "calling-hours", "save", "", "rule-watch"), "home"),
 (4, "11:00", "reel", "ao", "Reel AO: Myth: you can't manage a remote floor.", "AO-MythRemote",
  f"""Managing a remote sales team: you just need to see it.

Myth: you can’t manage a remote floor. Fact: you just can’t see it.

VPEX’s Team scoreboard puts office and remote reps side by side every day, and contests show up on every rep’s dial screen, wherever they dial from.

{SHARE}

#remotesales #salesmanager #callcenter #salesfloor #powerdialer""", T("myth", "remote-team", "share"), "home"),
 (4, "19:00", "carousel", "buy", "Carousel: Picking a dialer? Ask these 5 first.", "W7-Buy-%d:5",
  f"""How to choose a power dialer for your sales floor: 5 questions to ask first.

1. Does it check each lead’s state calling hours before the call?
2. Can two reps grab the same lead?
3. Can you see remote reps next to the office?
4. Can reps dial from their own phones?
5. What does it cost per rep?

VPEX’s answers: yes, no (a lead a rep opens is held for them), yes, yes, and $49 per rep a month with 7 days free, no card.

Send this to whoever picks your dialer.

{LEGAL}

#powerdialer #salesmanager #callcenter #salesfloor #salesteam""", T("reference", "buying-guide", "share"), "home"),
 (5, "11:00", "reel", "ap", "Reel AP: No answer. Now what?", "AP-NoAnswer",
  f"""What to do when a sales lead doesn’t answer: log it, text, try again.

No answer. Now what? Most reps just hang up.

In VPEX, log it in one tap and a short text is ready to send. Then the follow-up rules take over: 4 tries over 4 business days, then the lead rests and comes back.

{BIO}

#followup #coldcalling #salesrep #salesfloor #powerdialer""", T("question", "no-answer", "bio"), "home"),
 (5, "19:00", "image", "data", "Post: Switching dialers? Your call history", "W7-Data",
  f"""Switching power dialers: can you take your call history with you?

In VPEX it’s two taps in Admin controls: export every call as a CSV, or download a full backup with your leads, calls and follow-ups in one file.

{SHARE}

#salesmanager #callcenter #salesfloor #smallbusiness #powerdialer""", T("question", "data-ownership", "share"), "home"),
 (6, "11:00", "reel", "aq", "Reel AQ: Monday 8:30. Last week, before coffee.", "AQ-Monday",
  f"""Weekly sales report for managers, on your phone every Monday.

Monday, 8:30 AM: VPEX sends admins and managers last week in one notification. Calls and the change from the week before, conversations, interested and the top caller. (The numbers in the video are an example.)

No spreadsheet, no walking the floor.

{DEMO}

#salesmanager #salesreport #callcenter #salesfloor #powerdialer""", T("pov", "weekly-push", "comment", "", ""), "home"),
 (6, "19:00", "image", "trial", "Post: Start tonight. Your floor dials tomorrow.", "W7-Trial",
  f"""Set up a power dialer for your sales team tonight.

1. Create your office: about two minutes, no card.
2. Upload your list: Excel, CSV, text or contacts.
3. Send reps the office link. They sign in on their own phones.

7 days free. Then $49 per rep per month.

{BIO}

#powerdialer #salesteam #salesfloor #callcenter #salesmanager""", T("offer", "trial", "bio"), "trial"),
]
THREADS_TEXT = {   # written by hand where the automatic Threads version wouldn't read well
 "last": "7:45 PM. Who can you still call? The federal window closes at 9 PM, the lead’s time. Rhode Island closes at 6 on weekdays, Pennsylvania at 7, and 12 more states at 8.\n\nVPEX checks each lead’s state before anyone dials.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
 "ak": "Your floor starts at 9 Eastern. In California it’s 6 AM, two hours before the federal calling window opens.\n\nVPEX shows each lead’s local time and flags anyone outside their state’s hours. East first, West after 11.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
 "aep": "Medicare AEP runs through December 7. Three checks before every call: is it a calling hour in their state, is the Scope of Appointment on record, and did they ask not to be called?\n\nBased on the CMS final rule for 2027, as of November 2026. Not legal advice. Follow your carriers’ guidelines. Based on published state rules as of November 2026. Not legal advice.\n\nInsurance demo office: {link}",
 "three": "Third call to the same lead today? In Florida, Maryland, Oklahoma and Oregon, that’s the limit: 3 sales calls to one person in 24 hours, across your whole floor.\n\nVPEX counts them and says when it’s OK again.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
 "buy": "Picking a dialer? Ask 5 things first: does it check each lead’s state, can two reps grab the same lead, can you see remote reps, can reps use their own phones, and what does it cost per rep?\n\nVPEX: yes, no, yes, yes, $49 per rep a month.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
 "math": "Example math: a 6-rep floor on VPEX is 6 × $49 = $294 a month. One price, everything included: dialer, follow-ups, shared list, scoreboard, contests and the Sales coach.\n\n7 days free, no card: {link}",
 "trial": "Start tonight, dial tomorrow: create your office (about two minutes, no card), upload your list, send reps the office link. They sign in on their own phones.\n\n7 days free, then $49 per rep per month: {link}",
}
REEL_ALT = {
 "ak": "A clock reads 9:00 AM. Text: Your 9 AM is their 6 AM. A list: your 9 AM Eastern is 8 AM Central, 7 AM Mountain, 6 AM Pacific. Then a VPEX lead card in a demo office flagged: CA, 6:05 AM PST, outside 8 AM to 9 PM. Text: East first. West after 11.",
 "al": "Text: Most calls. Fewest conversations? Busy isn't productive. Then VPEX's Team scoreboard in a demo office with calls and leads reached per rep, then the Sales coach listing overdue follow-ups and each rep's best hours.",
 "am": "Text: Called him 11 minutes ago? A phone screen shows an incoming call labeled Spam Likely. Text: Calling back this soon? Here's the fix. Then VPEX asks: Call Anthony again? Anthony was called 11 minutes ago.",
 "an": "A clock reads 9:00 AM. Text: Rep POV: my first 10 minutes. Then VPEX in a demo office: tap to call, log no answer, the next lead comes up; an interested lead gets a follow-up and a ready thank-you text. Text: Less tapping. More talking.",
 "ao": "Text: Myth: you can't manage a remote floor. Fact: you just can't see it. Here's the fix. Then VPEX's Team scoreboard comparing in office and remote reps, and a contest's live standings on a rep's screen.",
 "ap": "Text: No answer. Now what? Most reps just hang up. Here's the fix. Then VPEX after logging No answer: a short text ready to send. Then the Follow-up rules: 4 tries over 4 business days, then the lead rests.",
 "aq": "Text: Monday. 8:30 AM. A phone lock screen with a VPEX notification, example numbers: Your floor last week, 412 calls up 9% from the week before, 61 conversations, 9 interested, top caller Jordan. Then the Team scoreboard in a demo office.",
}
ALT = {
 "W7-Last-1": "7:45 PM. Who can you still call? The federal window closes at 9 PM, the lead's time. 14 states on VPEX's list close earlier: 6 PM Rhode Island, 7 PM Pennsylvania, 8 PM 12 more states.",
 "W7-Last-2": "Rhode Island: 6 PM. Pennsylvania: 7 PM. A VPEX lead card in a demo office flagged at 7:10 PM: outside PA calling hours, 9 AM to 7 PM.",
 "W7-Last-3": "12 states close at 8 PM: Alabama, Louisiana, Connecticut, Maryland, Florida, Massachusetts, Mississippi, Nevada, Oklahoma, Oregon, Washington, Wyoming. Everyone else: 9 PM.",
 "W7-Last-4": "8:05 PM in Connecticut? Flagged. A VPEX lead card: outside CT calling hours, 9 AM to 8 PM.",
 "W7-Last-5": "Dialing past 7? Keep this where your evening shift can find it. Save this.",
 "W7-Math": "Floor math, an example: what does a power dialer cost a 6-rep floor? 6 times $49 equals $294 a month. Every rep on their own phone, scoreboard, coach and contests included, 7 days free first, no card.",
 "W7-AEP-1": "Medicare AEP ends December 7. 3 checks before every Medicare call: is it a calling hour in their state, is the Scope of Appointment on record, did they ask not to be called.",
 "W7-AEP-2": "9 AM in New York is 6 AM in California. A VPEX lead card flagged: CA, 6:05 AM PST, outside 8 AM to 9 PM.",
 "W7-AEP-3": "The 48-hour wait is gone. The Scope of Appointment isn't. VPEX's Qualify note: Medicare Advantage or Part D, get the Scope of Appointment on record, signed or recorded on the call, before the sales meeting.",
 "W7-AEP-4": "Take me off your list means every rep. A VPEX lead marked On the Do Not Call list. VPEX doesn't check the National Do Not Call Registry; scrub new lists first.",
 "W7-AEP-5": "Running an insurance floor this AEP? There's a live insurance demo office, no sign-up. Save this for your next team huddle.",
 "W7-Three-1": "Third call to the same lead today? 3 in 24. In four states on VPEX's list, that's the limit.",
 "W7-Three-2": "At most 3 sales calls in 24 hours: Florida, Maryland, Oklahoma, Oregon, each 8 AM to 8 PM. Counted per person across your whole floor.",
 "W7-Three-3": "VPEX counts the calls: a Florida lead flagged, 3 calls in 24 hours is FL's limit, next after 9:05 AM tomorrow.",
 "W7-Three-4": "Maryland and Oregon leads flagged the same way: 3 calls in 24 hours is the state's limit. Reps skip it and move on.",
 "W7-Three-5": "Calling Florida, Maryland, Oklahoma or Oregon? Keep this for whoever builds your call lists. Save this.",
 "W7-Buy-1": "Picking a dialer? Ask these 5 first: does it check each lead's state, can two reps grab the same lead, can you see remote reps, can reps use their own phones, what does it cost per rep.",
 "W7-Buy-2": "Question 1: calling hours, checked before the call. A VPEX lead card flagged: outside CT calling hours, 9 AM to 8 PM.",
 "W7-Buy-3": "Question 2: in VPEX, a lead a rep opens is held for them. VPEX's Team and access screen. Everyone else's queue skips it.",
 "W7-Buy-4": "Questions 3 and 4: office and remote, one scoreboard, and every rep dials from their own phone. VPEX's In office vs Remote table.",
 "W7-Buy-5": "Question 5: VPEX is $49 per rep a month, 7 days free, no card. Send this to whoever picks your dialer.",
 "W7-Data": "Switching dialers tomorrow? Could you take your call history? VPEX's Account and data menu: Export call log, a CSV of every call, and Full backup, leads, calls and follow-ups in one file.",
 "W7-Trial": "Start tonight. Your floor dials tomorrow. 1, create your office, about two minutes, no card. 2, upload your list. 3, send reps the office link; they sign in on their own phones. 7 days free, then $49 per rep per month.",
}
THREADS = [
 (0, "t-lastcall", "Floor owners: what time does your last call of the night go out?\n\nIf your leads are in Pennsylvania, it’s 7 PM their time now. Rhode Island: 6 PM on weekdays. Connecticut and Florida: 8.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
  T("question", "calling-hours", "question", "", "rule-watch"), "home"),
 (1, "t-nv", "Rule of the week: Nevada and Connecticut are 9 AM to 8 PM, the lead’s time. That’s an hour shorter on both ends than the federal 8 AM to 9 PM.\n\nVPEX checks each lead’s state before anyone dials.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
  T("rule", "calling-hours", "none", "", "rule-watch"), "home"),
 (2, "t-aep", "Insurance floor owners: AEP runs through December 7. What’s slowing your Medicare appointments down right now: no-shows, the Scope of Appointment, or calls at the wrong hour?\n\nBased on the CMS final rule for 2027, as of November 2026. Not legal advice. Follow your carriers’ guidelines.\n\n{link}",
  T("question", "medicare", "question", "insurance"), "demo:insurance"),
 (3, "t-prize", "Before you hand out Friday’s prize: the rep with the most calls isn’t always the one with the most conversations.\n\nVPEX’s scoreboard shows both, for every rep: {link}",
  T("contrast", "coaching", "none"), "home"),
 (4, "t-remote", "Floor owners with reps at home: what’s the one thing you wish you could see from the office?\n\nIn VPEX, office and remote reps sit side by side on one scoreboard: {link}",
  T("question", "remote-team", "question"), "home"),
 (5, "t-redial", "Rule of the week (a habit, not a law): don’t call the same lead back within 2 hours unless they asked you to. Quick redials are one of the habits that get numbers labeled spam.\n\nVPEX asks before a rep calls back that soon: {link}",
  T("rule", "spam", "none"), "home"),
 (6, "t-week", "New in VPEX: every Monday at 8:30, admins and managers get last week in one notification. Calls and the change from the week before, conversations, interested and the top caller.\n\n{link}",
  T("feature", "weekly-push", "none"), "home"),
]
STICKER = [
 ("Tue", "Poll: West Coast before noon?", "Add a Poll sticker: Yes / No."),
 ("Wed", "Quiz: last call in Pennsylvania", "Add a Quiz sticker: 7 PM / 8 PM / 9 PM, with 7 PM as the right answer."),
 ("Thu", "Question: AEP headache", "Add a Question sticker: “My biggest AEP headache”."),
 ("Fri", "Quiz: Florida's call limit", "Add a Quiz sticker: 3 / 5 / No limit, with 3 as the right answer."),
 ("Sat", "Slider: every rep follows the hours?", "Add an Emoji slider sticker with 😬."),
 ("Sun", "Poll: could you export your call history?", "Add a Poll sticker: Yes / Not sure."),
 ("Mon", "Poll: did you beat last week?", "Add a Poll sticker: Yes / Not yet."),
]

def jpg(src, dst):
    im = Image.open(src).convert("RGB"); im.save(dst, quality=92, subsampling=0, optimize=True)

if __name__ == "__main__":
    shutil.rmtree(OUT, ignore_errors=True)
    for d in ("1-Reels", "2-Posts", "3-Stories", "4-Story-versions"): os.makedirs(OUT + "/" + d)
    items = []
    for di, (dayname, title, note) in enumerate(STICKER):
        f = "W7-Story-%s-1.jpg" % dayname; jpg(D + "/out/jpg/" + f, OUT + "/3-Stories/" + f)
        items.append({"id": "w7-story-%s" % dayname.lower(), "at": DAYS[di] + " 09:00", "type": "story", "title": "%s 9 AM · %s" % (dayname, title),
                      "image": "3-Stories/" + f, "manual": True, "note": "Post 3-Stories/%s from the Week 7 pack and add the sticker. %s" % (f, note)})
    for di, key, text, tags, go in THREADS:
        items.append({"id": "w7-" + key, "at": DAYS[di] + " 08:30", "type": "thread", "title": "Threads: " + text.split("\n")[0][:60], "threads_text": text, "tags": tags, "go": go})
    for di, hm, typ, key, title, src, cap, tags, go in FEED:
        when = DAYS[di] + " " + hm
        it = {"id": "w7-" + key, "at": when, "type": typ, "title": title, "caption": cap, "tags": tags, "go": go}
        if key in THREADS_TEXT: it["threads_text"] = THREADS_TEXT[key]
        share = {"id": "w7-" + key + "-share", "at": DAYS[di] + (" 12:30" if hm == "11:00" else " 20:30"), "type": "story", "title": "Story share: " + title}
        if typ == "reel":
            cv = key.upper()
            shutil.copyfile(D + "/out/video/Reel-%s-sound.mp4" % src, OUT + "/1-Reels/Reel-%s.mp4" % src)
            jpg(D + "/out/jpg/W7-Cover-%s.jpg" % cv, OUT + "/1-Reels/Cover-%s.jpg" % cv)
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
    plan = {"format": 2, "name": "VPEX Instagram, week 7: Know the clock, know the floor", "timezone": "America/New_York",
            "notes": "Times are New York time (EST). Safe cadence (instagram/limits.json): each day 2 feed posts at 11:00 and 19:00 (also to the Facebook Page and Threads), stories at 09:00 (sticker, by hand), 12:30 and 20:30, and 1 Threads-only post at 08:30.",
            "items": items}
    json.dump(plan, open(OUT + "/plan.json", "w"), indent=1, ensure_ascii=False)
    lines = ["VPEX Instagram, week 7: Know the clock, know the floor", "Posted by the bot, New York time. Only the 9 AM sticker stories are posted by hand.", ""]
    for it in items: lines.append("%s  %-8s %s" % (it["at"], it["type"] + ("*" if it.get("manual") else ""), it["title"]))
    lines += ["", "Captions", ""]
    for it in items:
        if it["type"] == "thread": lines += ["== " + it["title"] + " (" + it["at"] + ")", it["threads_text"], ""]
        elif it["type"] != "story": lines += ["== " + it["title"] + " (" + it["at"] + ")", it["caption"], ""]
    open(OUT + "/Week-7-Posting-Plan.txt", "w").write("\n".join(lines))
    z = OUT + ".zip"
    if os.path.exists(z): os.remove(z)
    with zipfile.ZipFile(z, "w", zipfile.ZIP_STORED) as zf:
        for root, _, files in os.walk(OUT):
            for f in sorted(files):
                p = os.path.join(root, f); zf.write(p, NAME + "/" + os.path.relpath(p, OUT))
    print(len(items), "items:", sum(1 for i in items if i["type"] in ("reel", "image", "carousel")), "feed,", sum(1 for i in items if i["type"] == "story"), "stories,",
          sum(1 for i in items if i["type"] == "thread"), "Threads-only")
    print("zip %.1f MB" % (os.path.getsize(z) / 1e6))
