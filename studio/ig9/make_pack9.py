# Week-9 pack for the bot (format 2), Tue Nov 24 - Mon Nov 30, 2026, at the safe cadence in instagram/limits.json:
# each day 2 feed posts (11:00 and 19:00, also to the Facebook Page and Threads), 3 Instagram stories (09:00 sticker story by
# hand, 12:30 share of the 11:00 post, 20:30 share of the 19:00 post) and 1 Threads-only post at 08:30. New York time.
# usage: PACK_OUT=/tmp/VPEX-Instagram-Week-9 python3 make_pack9.py
import os, json, shutil, zipfile, importlib.util
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("PACK_OUT", "/tmp/VPEX-Instagram-Week-9")
NAME = "VPEX-Instagram-Week-9"
DEMO = "Comment DEMO and we’ll send you a live demo office."
BIO = "Tap the link in our bio, then this post."
SHARE = "Send this to your manager."
LEGAL = "Based on published state rules as of November 2026. Not legal advice."
MED = "Based on the CMS final rule for 2027, as of November 2026. Not legal advice. Follow your carriers’ guidelines."
SAVE = "Save this"
DAYS = ["2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29", "2026-11-30"]
def T(hook, topic, cta, ind="", series=""): return {"hook": hook, "topic": topic, "ind": ind, "cta": cta, "series": series}

# (day index, time, type, key, title, source, caption, tags, go)
FEED = [
 (0, "11:00", "reel", "ay", "Reel AY: Call me after the holidays.", "AY-AfterHolidays",
  f"""Sales callback scheduling: what your reps do with “call me after the holidays.”

On a sticky note, it’s gone by January. In VPEX, log Callback later and pick In 30, 60 or 90 days. It lands on the rep’s Tasks at the right time of day, and if that day is one their state bans sales calls (like Christmas in Pennsylvania), VPEX picks the next day they can be called. (Demo office, Pennsylvania lead.)

{SHARE}

{LEGAL}

#salesrep #followup #callcenter #salesfloor #powerdialer""", T("quote", "callbacks", "share"), "home"),
 (0, "19:00", "carousel", "re", "Carousel: Built for real estate floors", "W9-RE-%d:5",
  f"""Power dialer for real estate agents calling expireds and FSBOs.

VPEX’s real estate demo office, as is:
• A script that opens on the listing: “I saw your home was listed for sale.”
• Answers to six seller brush-offs, mid-call, one tap: “I’m going to sell it myself.” “Your commission is too high.” “I’ll relist with my old agent.”
• Every seller’s notes, local time and best hour to call on the lead card.

Open the real estate demo office, no sign-up. {SHARE}

#realestateagent #expiredlistings #fsbo #realestatecoldcalling #powerdialer""", T("identity", "industry-fit", "share", "realestate", "built-for"), "demo:realestate"),
 (1, "11:00", "reel", "az", "Reel AZ: 9:30 in Kentucky? Too early.", "AZ-Kentucky",
  f"""Kentucky telemarketing calling hours: 10 AM to 9 PM, the lead’s time.

At 9:30 AM a Kentucky lead is still off limits, even though the federal window opened at 8. VPEX checks each lead’s state before they come up and holds them until 10. At 10:02 they’re open, and VPEX marks it a prime hour for them.

Save this for your Kentucky leads.

{LEGAL}

#callinghours #telemarketing #coldcalling #salesfloor #powerdialer""", T("rule", "calling-hours", "save", "", "rule-watch"), "home"),
 (1, "19:00", "image", "honest", "Post: 212 calls today. Were they all calls?", "W9-Honest",
  f"""Call center metrics you can trust: “calls today” should mean calls.

In VPEX a dialed call needs its real outcome before the rep moves on: Interested, Not interested, Voicemail, No answer, Bad number or Callback later. Skip doesn’t log anything, so Call + Skip can’t pad the count, and the scoreboard shows what really happened.

{BIO}

#salesmanager #callcenter #salesmetrics #salesfloor #powerdialer""", T("contrast", "honest-numbers", "bio", "", ""), "home"),
 (2, "11:00", "reel", "ba", "Reel BA: What your floor is thankful for", "BA-Thankful",
  f"""Happy Thanksgiving to every sales floor.

This year we’re thankful for leads who pick up, callbacks that actually happen, the 3 PM coffee and Friday at 5. And a scoreboard the whole floor can see. (Numbers in the video are from a demo office.)

Send this to your floor.

#thanksgiving #salesfloor #salesteam #callcenter #salesrep""", T("identity", "floor-life", "share"), "home"),
 (2, "19:00", "image", "remote", "Post: Half your floor dials from home?", "W9-Remote",
  f"""Remote sales team tracking: half your floor dials from home?

VPEX’s Team scoreboard puts in-office and remote reps side by side: calls, leads contacted, conversations, follow-up calls, appointments and interested, per rep. Same list, same rules, same leaderboard, wherever they sit. (Demo office numbers.)

{DEMO}

#remotesales #salesmanager #callcenter #salesfloor #powerdialer""", T("contrast", "remote-team", "comment"), "home"),
 (3, "11:00", "reel", "bb", "Reel BB: No Black Friday sale.", "BB-NoSale",
  f"""Power dialer pricing with no Black Friday games: $49 per rep a month, every day of the year.

7 days free first, no card to start. Your list goes in as is (Excel, CSV, text or contacts), and reps sign in on their own phones. Start today, dial Monday.

{BIO}

#powerdialer #salesteam #smallbusiness #callcenter #salesfloor""", T("offer", "trial", "bio"), "trial"),
 (3, "19:00", "carousel", "next", "Carousel: No answer. Now what?", "W9-Next-%d:5",
  f"""What to do when a sales lead doesn’t answer: your floor’s next 3 moves.

1. Text them before the next dial. Log No answer and VPEX offers a quick text, written with the rep’s name and your company.
2. Try again on a schedule. You set the tries (example: 4 over 4 business days), each inside the lead’s calling hours.
3. Let them rest. After the last try the lead comes back in 60–90 days for a fresh try. Nobody has to remember it.

Save this for your next floor meeting.

#coldcalling #followup #salesrep #callcenter #powerdialer""", T("reference", "no-answer", "save"), "home"),
 (4, "11:00", "reel", "bc", "Reel BC: Saturday, 9:30 AM. Who can you call?", "BC-Saturday",
  f"""Saturday calling hours for sales floors: who you can call at 9:30 AM Eastern.

Eastern and Central leads are open. Mountain and Pacific are still too early (the federal window opens at 8, their time). And Rhode Island’s Saturday hours are 10 AM to 5 PM, so VPEX holds those leads until 10.

Save this for Saturday shifts.

{LEGAL}

#callinghours #telemarketing #coldcalling #salesfloor #powerdialer""", T("pov", "calling-hours", "save", "", "rule-watch"), "home"),
 (4, "19:00", "image", "math", "Post: Floor math, January callbacks", "W9-Math",
  f"""Sales floor math, an example: how many “call me after the holidays” callbacks land in January.

Example: a 10-rep floor, 4 of those a rep a week, 5 weeks to New Year’s. 10 × 4 × 5 = 200 callbacks due in January.

On sticky notes, most of them never happen. In VPEX it’s one tap: In 30, 60 or 90 days, on the right rep’s Tasks.

Save this for your next floor meeting.

#salesmanager #followup #callcenter #salesfloor #powerdialer""", T("math", "callbacks", "save", "", "floor-math"), "home"),
 (5, "11:00", "reel", "bd", "Reel BD: Sunday. Who can you call?", "BD-Sunday",
  f"""Sunday telemarketing rules by state: who your floor can call today.

No sales calls on Sundays in Alabama, Louisiana, Mississippi, Pennsylvania, Rhode Island or South Dakota. Texas allows them from noon to 9 PM, the lead’s time. VPEX checks each lead’s state before they come up and holds the rest.

Send this to your weekend shift.

{LEGAL}

#callinghours #telemarketing #coldcalling #salesfloor #powerdialer""", T("pov", "calling-hours", "share", "", "rule-watch"), "home"),
 (5, "19:00", "image", "price", "Post: No Black Friday sale. $49 a rep, every day.", "W9-Price",
  f"""Power dialer cost: $49 per rep a month. No Black Friday sale, no Cyber Monday sale, the same price every day.

7 days free first, no card. Your list goes in as is. Cancel any time.

{BIO}

#powerdialer #salesteam #smallbusiness #callcenter #salesfloor""", T("offer", "price", "bio"), "trial"),
 (6, "11:00", "reel", "be", "Reel BE: Monday after Thanksgiving. Follow-ups first.", "BE-Monday",
  f"""Monday after Thanksgiving: who your sales reps should call first.

The follow-ups they promised. VPEX puts late follow-ups on a red button on the Dial tab, and one tap calls them in order. Then the new leads.

{DEMO}

#salesrep #followup #callcenter #salesfloor #powerdialer""", T("pov", "followups", "comment"), "home"),
 (6, "19:00", "carousel", "dec", "Carousel: December calling days", "W9-Dec-%d:5",
  f"""December telemarketing holidays: Christmas Day and New Year’s Day both fall on a Friday.

No sales calls those days in Alabama, Louisiana, Pennsylvania and Rhode Island (the lead’s state), and none on Sundays in Alabama, Louisiana, Mississippi, Pennsylvania, Rhode Island and South Dakota. Texas Sundays: noon to 9 PM.
• Thursday, Dec 24 and Thursday, Dec 31: VPEX puts a heads-up on the Dial tab, so you call those leads while you still can.
• Friday: they’re held all day.

Save this for your December huddles.

{LEGAL}

#callinghours #telemarketing #callcenter #salesfloor #powerdialer""", T("reference", "calling-hours", "save", "", "rule-watch"), "home"),
]
THREADS_TEXT = {
 "ay": "“Call me after the holidays.” In VPEX that’s one tap: In 30, 60 or 90 days, on the rep’s Tasks. If the day is one their state bans sales calls, it picks the next day they can be called.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
 "re": "A power dialer for real estate agents: a script that opens on the listing, answers to “your commission is too high” and “I’ll sell it myself” mid-call, and every seller called inside their state’s hours.\n\nOpen the real estate demo office, no sign-up: {link}",
 "az": "Kentucky’s calling hours are 10 AM to 9 PM, the lead’s time. At 9:30 a Kentucky lead is still off limits. VPEX holds them until 10.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
 "next": "No answer? 1. Text them before the next dial. 2. Try again on a schedule you set, inside their calling hours. 3. After the last try, the lead rests and comes back in 60–90 days. VPEX does all three: {link}",
 "bc": "Saturday, 9:30 AM Eastern: Eastern and Central leads are open, the West is still too early, and Rhode Island’s Saturday hours start at 10. VPEX holds them till then.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
 "bd": "Sunday: no sales calls in Alabama, Louisiana, Mississippi, Pennsylvania, Rhode Island or South Dakota. Texas: noon to 9 PM, the lead’s time. VPEX holds the rest.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
 "dec": "Christmas Day and New Year’s Day are both Fridays. No sales calls those days in Alabama, Louisiana, Pennsylvania or Rhode Island. VPEX warns you the Thursday before and holds those leads Friday.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
 "math": "Example math: a 10-rep floor, 4 “call me after the holidays” a rep a week, 5 weeks to New Year’s. 10 × 4 × 5 = 200 callbacks due in January.\n\nIn VPEX each one is a tap: In 30, 60 or 90 days, on the right rep’s Tasks: {link}",
}
REEL_ALT = {
 "ay": "Text: Call me after the holidays. On a sticky note? Here's the fix. Then VPEX's follow-up sheet in a demo office for a Pennsylvania lead, with Callback later logged and buttons In 30 days Dec 26, In 60 days Jan 25, In 90 days Feb 23. Text: Christmas? It picks Dec 26.",
 "az": "A clock reads 9:30 AM. Text: 9:30 in Kentucky? Too early. Then a VPEX lead card in a demo office: KY, 9:30 AM, outside KY calling hours, 10 AM to 9 PM. At 10:02 AM the same lead shows prime hour.",
 "ba": "Text: What your floor is thankful for. A list: leads who pick up, callbacks that happen, the 3 PM coffee, Friday at 5. Then VPEX's Team scoreboard in a demo office, in office vs remote. Text: Send this to your floor. Happy Thanksgiving.",
 "bb": "Text: No Black Friday sale. Same price. Every day. A list: $49 a rep a month, 7 days free, card not needed. Then VPEX's Add leads sheet: upload a file, paste a list or add one. Text: Link in bio.",
 "bc": "A clock reads 9:30 AM. Text: Saturday. Who can you call? Then VPEX's time sheet in a demo office on Saturday at 9:30 AM Eastern: Eastern and Central in calling hours, Mountain and Pacific too early. Then a Rhode Island lead card: outside RI calling hours, 10 AM to 5 PM.",
 "bd": "Text: Sunday. Who can you call? Then VPEX lead cards in a demo office on Sunday: a Pennsylvania lead, no sales calls on Sundays in PA; a Texas lead at 10:05 AM, outside TX calling hours, 12 PM to 9 PM. Text: AL, LA, MS, PA, RI, SD: no Sundays.",
 "be": "Text: Monday after Thanksgiving. Who do you call first? Then VPEX's Dial tab in a demo office with a red Call 4 late follow-ups button. Text: Then the new leads. Comment DEMO.",
}
ALT = {
 "W9-RE-1": "Built for your floor, real estate. A power dialer for real estate agents calling expireds and FSBOs: a script that opens on the listing, answers to the brush-offs agents hear, every lead in their own state's hours.",
 "W9-RE-2": "The script, your words: I saw your home was listed for sale. VPEX's Call script and rebuttals sheet in a real estate demo office, with the Opener and Why you're calling steps.",
 "W9-RE-3": "Your commission is too high. VPEX's Rebuttals tab in a real estate demo office: I'm going to sell it myself. We're not selling anymore. I'll relist with my old agent. Your commission is too high.",
 "W9-RE-4": "Every seller's story, and when they pick up. A VPEX lead card in a real estate demo office: local time, best Wed 4 to 5 PM, notes: inherited the house, wants it sold before winter.",
 "W9-RE-5": "Open the real estate demo office. No sign-up. Sample sellers, real VPEX. Send this to your team lead.",
 "W9-Honest": "212 calls today. Were they all calls? In VPEX a dialed call needs its real outcome before the rep moves on; Skip doesn't log anything, so Call plus Skip can't pad the count. The outcome buttons: Interested, Not interested, Voicemail, No answer, Bad number, Callback later.",
 "W9-Remote": "Half your floor dials from home? Same scoreboard. VPEX's Team scoreboard in a demo office, In office vs Remote: calls, leads contacted, conversations, follow-up calls, appointments set, notes written and interested, per rep.",
 "W9-Next-1": "No answer. Now what? 1, text them before the next dial. 2, try again on a schedule, not a whim. 3, let them rest, then bring them back.",
 "W9-Next-2": "One tap: a quick text, ready to send. VPEX's Text Anthony a quick note card after No answer, with Not now and Send text buttons.",
 "W9-Next-3": "You set the tries; VPEX spaces them. VPEX's Follow-up rules: No answer, tries before parking a lead, set to 4: 4 tries over 4 business days, then the lead rests and comes back in 60 to 90 days.",
 "W9-Next-4": "Not dead. Resting. After the last try, the lead rests and comes back in 60 to 90 days for a fresh try. Nobody has to remember it.",
 "W9-Next-5": "Text. Retry. Rest. Return. Your no-answers, handled the same way on every rep's phone. Save this.",
 "W9-Math": "Floor math, an example: Call me after the holidays. 10 reps times 4 a week times 5 weeks to New Year's equals 200 callbacks due in January. In VPEX: one tap, In 30, 60 or 90 days, on the right rep's Tasks.",
 "W9-Price": "No Black Friday sale. No Cyber Monday sale. $49 a rep a month, every day of the year. 7 days free first, no card. Your list goes in as is. Cancel any time.",
 "W9-Dec-1": "December 2026, the lead's state. Two Friday holidays: Friday Dec 25, Christmas Day; Friday Jan 1, New Year's Day. No sales calls those days in Alabama, Louisiana, Pennsylvania and Rhode Island.",
 "W9-Dec-2": "Thursday, Dec 24, the day before: VPEX tells you Thursday. A heads-up on the Dial tab: Fri is Christmas Day, call your 90 leads in PA today. Same on Thursday, Dec 31.",
 "W9-Dec-3": "Friday, Dec 25: those leads are held all day. A Pennsylvania lead in a demo office at 10:05 AM: holiday, no sales calls in PA today.",
 "W9-Dec-4": "And every Sunday: no sales calls in AL, LA, MS, PA, RI and SD. TX: noon to 9 PM on Sundays.",
 "W9-Dec-5": "Plan December's calling days now. Keep this for your December huddles. Save this.",
}
THREADS = [
 (0, "t-holidays", "Floor owners: where does “call me after the holidays” go on your floor? A sticky note, a spreadsheet, a rep’s memory?\n\nIn VPEX it’s one tap: In 30, 60 or 90 days, on that rep’s Tasks: {link}",
  T("question", "callbacks", "question"), "home"),
 (1, "t-ky", "Rule of the week: Kentucky’s calling hours start at 10 AM, the lead’s time, not 8. A 9:30 dial to Kentucky is too early.\n\nVPEX checks each lead’s state before they come up.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
  T("rule", "calling-hours", "none", "", "rule-watch"), "home"),
 (2, "t-thanks", "Happy Thanksgiving to every rep who dialed through a short week, and every manager who kept the board moving.\n\nEnjoy the day off. The leads will be there Friday: {link}",
  T("identity", "floor-life", "none"), "home"),
 (3, "t-sale", "No Black Friday sale here. VPEX is $49 a rep a month every day, and the 7-day trial needs no card.\n\nStart it today and your reps are dialing Monday: {link}",
  T("contrast", "price", "none"), "trial"),
 (4, "t-remote", "Floor owners: how many of your reps dial from home now? And do they show up on the same scoreboard as the ones in the office?\n\nVPEX puts them side by side: {link}",
  T("question", "remote-team", "question"), "home"),
 (5, "t-tx", "Rule of the week: in Texas, Sunday sales calls are allowed only from noon to 9 PM, the lead’s time. Weekdays and Saturdays, 9 AM to 9 PM.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
  T("rule", "calling-hours", "none", "", "rule-watch"), "home"),
 (6, "t-dec", "December heads-up: Christmas Day and New Year’s Day are both Fridays. No sales calls either day in Alabama, Louisiana, Pennsylvania or Rhode Island.\n\nBased on published state rules as of November 2026. Not legal advice.\n\n{link}",
  T("news", "calling-hours", "none", "", "rule-watch"), "home"),
]
STICKER = [
 ("Tue", "Poll: call me after the holidays", "Add a Poll sticker: It gets a date / It gets lost."),
 ("Wed", "Quiz: Kentucky's calling hours", "Add a Quiz sticker: 8 AM / 9 AM / 10 AM, with 10 AM as the right answer."),
 ("Thu", "Question: what's your floor thankful for?", "Add a Question sticker: “Our floor is thankful for…”."),
 ("Fri", "Poll: dialing today?", "Add a Poll sticker: Dialing / Day off."),
 ("Sat", "Quiz: Rhode Island at 9:30 Saturday", "Add a Quiz sticker: Yes / Not till 10, with Not till 10 as the right answer."),
 ("Sun", "Quiz: Sunday calls from noon", "Add a Quiz sticker: Texas / Pennsylvania / Alabama, with Texas as the right answer."),
 ("Mon", "Slider: ready for December?", "Add an Emoji slider sticker with 🎄."),
]

def jpg(src, dst):
    im = Image.open(src).convert("RGB"); im.save(dst, quality=92, subsampling=0, optimize=True)

if __name__ == "__main__":
    shutil.rmtree(OUT, ignore_errors=True)
    for d in ("1-Reels", "2-Posts", "3-Stories", "4-Story-versions"): os.makedirs(OUT + "/" + d)
    items = []
    for di, (dayname, title, note) in enumerate(STICKER):
        f = "W9-Story-%s-1.jpg" % dayname; jpg(D + "/out/jpg/" + f, OUT + "/3-Stories/" + f)
        items.append({"id": "w9-story-%s" % dayname.lower(), "at": DAYS[di] + " 09:00", "type": "story", "title": "%s 9 AM · %s" % (dayname, title),
                      "image": "3-Stories/" + f, "manual": True, "note": "Post 3-Stories/%s from the Week 9 pack and add the sticker. %s" % (f, note)})
    for di, key, text, tags, go in THREADS:
        items.append({"id": "w9-" + key, "at": DAYS[di] + " 08:30", "type": "thread", "title": "Threads: " + text.split("\n")[0][:60], "threads_text": text, "tags": tags, "go": go})
    for di, hm, typ, key, title, src, cap, tags, go in FEED:
        when = DAYS[di] + " " + hm
        it = {"id": "w9-" + key, "at": when, "type": typ, "title": title, "caption": cap, "tags": tags, "go": go}
        if key in THREADS_TEXT: it["threads_text"] = THREADS_TEXT[key]
        share = {"id": "w9-" + key + "-share", "at": DAYS[di] + (" 12:30" if hm == "11:00" else " 20:30"), "type": "story", "title": "Story share: " + title}
        if typ == "reel":
            cv = key.upper()
            shutil.copyfile(D + "/out/video/Reel-%s-sound.mp4" % src, OUT + "/1-Reels/Reel-%s.mp4" % src)
            jpg(D + "/out/jpg/W9-Cover-%s.jpg" % cv, OUT + "/1-Reels/Cover-%s.jpg" % cv)
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
    plan = {"format": 2, "name": "VPEX Instagram, week 9: Before December", "timezone": "America/New_York",
            "notes": "Times are New York time (EST). Safe cadence (instagram/limits.json): each day 2 feed posts at 11:00 and 19:00 (also to the Facebook Page and Threads), stories at 09:00 (sticker, by hand), 12:30 and 20:30, and 1 Threads-only post at 08:30.",
            "items": items}
    json.dump(plan, open(OUT + "/plan.json", "w"), indent=1, ensure_ascii=False)
    lines = ["VPEX Instagram, week 9: Before December", "Posted by the bot, New York time. Only the 9 AM sticker stories are posted by hand.", ""]
    for it in items: lines.append("%s  %-8s %s" % (it["at"], it["type"] + ("*" if it.get("manual") else ""), it["title"]))
    lines += ["", "Captions", ""]
    for it in items:
        if it["type"] == "thread": lines += ["== " + it["title"] + " (" + it["at"] + ")", it["threads_text"], ""]
        elif it["type"] != "story": lines += ["== " + it["title"] + " (" + it["at"] + ")", it["caption"], ""]
    open(OUT + "/Week-9-Posting-Plan.txt", "w").write("\n".join(lines))
    z = OUT + ".zip"
    if os.path.exists(z): os.remove(z)
    with zipfile.ZipFile(z, "w", zipfile.ZIP_STORED) as zf:
        for root, _, files in os.walk(OUT):
            for f in sorted(files):
                p = os.path.join(root, f); zf.write(p, NAME + "/" + os.path.relpath(p, OUT))
    print(len(items), "items:", sum(1 for i in items if i["type"] in ("reel", "image", "carousel")), "feed,", sum(1 for i in items if i["type"] == "story"), "stories,",
          sum(1 for i in items if i["type"] == "thread"), "Threads-only")
    print("zip %.1f MB" % (os.path.getsize(z) / 1e6))
