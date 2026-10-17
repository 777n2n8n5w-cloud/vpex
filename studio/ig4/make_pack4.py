# Week-4 content pack for the bot: media + plan.json (captions, alt text, times) + a posting plan for Vincent.
# 5 a day from Tue Oct 20 to Mon Oct 26: feed at 12:30 and 6:30 PM, stories at 9 AM (sticker, by hand), 3 PM and 8 PM.
# Tue-Thu 9 AM / Tue 3 and 8 PM stories still come from week 3's pack, so week 4 fills in around them.
import os, json, shutil, zipfile, importlib.util
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("kit4", D + "/kit4.py"); kit4 = importlib.util.module_from_spec(spec); spec.loader.exec_module(kit4)
OUT = os.environ.get("PACK_OUT", "/mnt/user-data/outputs/VPEX-Instagram-Week-4")
TITLES = {b[0]: b[1] for b in kit4.B}
LEGAL = "Based on published state rules as of October 2026. Not legal advice."
DEMO = "Comment DEMO and we'll send you a live demo office."

FEED = [
 ("2026-10-20 12:30", "reel", "L", "Reel L: Pennsylvania changed the rules", "L-PANewRules",
  f"""Pennsylvania changed the rules on October 18.

Sales calls and texts to Pennsylvania consumers: not before 9 AM, not after 7 PM, and not on Sundays.

Your reps won't remember that on every lead. VPEX does: a Pennsylvania lead outside those hours is flagged before anyone dials.

{DEMO}

Exceptions apply (existing customers, written consent). {LEGAL}

#salesfloor #telemarketing #coldcalling #salescompliance #powerdialer"""),
 ("2026-10-20 18:30", "image", "PA", "Post: Pennsylvania, 9 to 7, no Sundays", "W4-PA",
  f"""Save this if your floor calls Pennsylvania.

Starting October 18, 2026: no sales calls before 9 AM or after 7 PM, and none on Sundays. Texts count too.

VPEX shows every lead's local time and flags a Pennsylvania lead outside those hours.

Exceptions apply (existing customers, written consent). {LEGAL}

#salesfloor #telemarketing #pennsylvania #salescompliance #coldcalling"""),
 ("2026-10-21 12:30", "carousel", "Hours", "Carousel: Calling hours, state by state", "W4-Hours-%d:7",
  f"""Calling hours, state by state. Save it.

8 AM to 9 PM is only the federal rule. 20 states are stricter:
• Stop at 8 PM: FL, MD, MA, OK, OR, WA, WY, AL, LA, MS
• Start late: KY at 10 AM; CT, NV, MI, MN, NM and SD at 9 AM
• Pennsylvania: 9 AM to 7 PM, no Sundays (from Oct 18)
• No Sundays: AL, LA, MS, PA, RI, SD. Texas: noon to 9 PM on Sundays
• 3 sales calls per person in 24 hours: FL, MD, OK, OR

VPEX flags any lead outside their state's hours, or over a call limit.

{LEGAL} Check with your compliance advisor.

#salesfloor #telemarketing #coldcalling #salescompliance #salesmanager"""),
 ("2026-10-21 18:30", "reel", "M", "Reel M: 4th call in Florida", "M-FLThreeCalls",
  f"""4th call to the same Florida lead today? That's over the limit.

Florida, Maryland, Oklahoma and Oregon allow 3 sales calls to one person in 24 hours. VPEX counts them and shows when the next call is allowed.

{DEMO}

{LEGAL}

#salesfloor #telemarketing #florida #coldcalling #powerdialer"""),
 ("2026-10-22 12:30", "reel", "N", "Reel N: 3 habits that get you flagged", "N-SpamFlagged",
  f"""Your number, on their screen: Spam Likely.

3 habits that get it flagged:
1. Dialing nonstop
2. Hanging up within seconds
3. Redialing the same person too soon

VPEX paces your calls and asks before anyone redials a lead they just called.

{DEMO}

#spamlikely #coldcalling #salesfloor #salestips #powerdialer"""),
 ("2026-10-22 18:30", "carousel", "Qs", "Carousel: First-call questions by industry", "W4-Qs-%d:7",
  """The questions that qualify a lead on the first call, by industry.

Insurance, real estate, business funding, auto and solar. Swipe to yours, then save it for your next training.

In VPEX they sit right on the dial screen. Answers save to the lead, and the whole team sees them.

Which question would you add? Tell us in the comments. Or comment DEMO for a live demo office in your industry.

#salesfloor #salestraining #insurancesales #realestate #solarsales"""),
 ("2026-10-23 12:30", "reel", "O", "Reel O: Call me Tuesday at 2", "O-BuzzAt2",
  f"""She said "call me Tuesday at 2." At 2:00, his phone buzzed.

VPEX sends follow-up alerts to your reps' phones, even with the app closed and the phone locked. Appointments 10 minutes early. New handoffs right away.

{DEMO}

#followup #salesfloor #insurancesales #salestips #powerdialer"""),
 ("2026-10-23 18:30", "image", "Buzz", "Post: Your phone buzzes when a follow-up is due", "W4-Buzz",
  """Your phone buzzes when a follow-up is due. Even with VPEX closed.

Turn it on once: Settings → Notifications → Turn on. On iPhone, add VPEX to your Home Screen first.

Comment DEMO and we'll send you a live demo office.

#followup #salesfloor #salesmanager #productivity #powerdialer"""),
 ("2026-10-24 12:30", "reel", "P", "Reel P: 8:30 AM, before the first call", "P-Morning830",
  f"""8:30 AM, before the first call, every rep gets one notification: what's waiting today.

"14 follow-ups waiting (3 new today) · 2 appointments today, first at 10:30 AM." Tap it and the follow-ups line up first, with what to say next.

{DEMO}

#salesfloor #salesmanager #followup #salesteam #powerdialer"""),
 ("2026-10-24 18:30", "carousel", "Day", "Carousel: A day on a VPEX floor", "W4-Day-%d:8",
  """A day on a VPEX floor:

8:30 AM: the summary
9:00 AM: first call, with the lead's local time
12:15 PM: the callback buzzes
2:30 PM: the handoff
2:31 PM: the confirmation text, already written
5:00 PM: the scoreboard

One app on the phones your reps already carry. $49 per rep, per month. Comment DEMO for a live demo office.

#salesfloor #salesmanager #dayinthelife #salesteam #powerdialer"""),
 ("2026-10-25 12:30", "reel", "Q", "Reel Q: Booked isn't showed", "Q-ConfirmOneTap",
  f"""Booked isn't showed.

In VPEX, the moment a setter hands an appointment to a closer, the confirmation text is already written, in the lead's own time zone: "You're all set for your solar consultation tomorrow at 2:30 PM with Sam." One tap to send.

{DEMO}

#appointmentsetting #salesfloor #solarsales #closers #powerdialer"""),
 ("2026-10-25 18:30", "image", "Price", "Post: $49 per rep, per month", "W4-Price",
  """$49 per rep, per month. Everything in.

Dialer, automatic follow-ups, calling hours for every state, scoreboard, handoffs and contests. Your reps use their own phones, so there's nothing else to buy.

7 days free, no card to start. Link in bio.

#salesfloor #powerdialer #salesmanager #smallbusiness #salesteam"""),
 ("2026-10-26 12:30", "reel", "R", "Reel R: 20 states, 20 sets of calling hours", "R-RulesHandled",
  f"""20 states. 20 sets of calling hours. Who's tracking that?

VPEX shows every lead's local time, flags anyone outside their state's hours, and counts calls where there's a limit.

{DEMO}

{LEGAL}

#salesfloor #telemarketing #salescompliance #coldcalling #powerdialer"""),
 ("2026-10-26 18:30", "carousel", "Checks", "Carousel: Before you dial a new list, 5 checks", "W4-Checks-%d:7",
  f"""Before you dial a new list: 5 checks.

1. Scrub it against the National Do Not Call Registry
2. Know each lead's state calling hours
3. Count your calls in FL, MD, OK and OR
4. Honor STOP on texts
5. Keep your own Do Not Call list

VPEX helps with 2 through 5. Number 1 is on you, before you upload.

{LEGAL}

#salesfloor #telemarketing #coldcalling #salescompliance #salesmanager"""),
]
REEL_ALT = {
 "L": "Text: Pennsylvania changed the rules. Since Oct 18, sales calls before 9 AM, after 7 PM and on Sundays are not allowed, and texts count too. Then the VPEX dial screen flags a Pennsylvania lead on a Sunday and at 7:20 PM.",
 "M": "Text: 4th call, same lead, same day, in Florida? Florida, Maryland, Oklahoma and Oregon allow 3 sales calls per person in 24 hours. VPEX shows the limit and when the next call is allowed.",
 "N": "An incoming call screen labeled Spam Likely, then three habits that get a number flagged, then VPEX spacing calls out and asking before a redial.",
 "O": "Text: she said call me Tuesday at 2. A locked phone at 2:00 PM shows a VPEX notification: Callback due. Then the rep taps to call and logs it in one tap.",
 "P": "8:30 AM. A locked phone shows a VPEX notification: Good morning, Jordan, 14 follow-ups waiting and 2 appointments today. Then follow-ups line up first.",
 "Q": "Text: booked, then nobody confirmed. Booked isn't showed. Then a handoff to a closer and a ready-to-send confirmation text with the appointment time.",
 "R": "Text: 20 states, 20 sets of calling hours, with examples for Florida, Texas, Kentucky, Pennsylvania and Rhode Island. Then VPEX shows local time, flags a lead outside their state's hours and counts calls.",
}
STORIES = [  # (when, stem, sticker note or None)
 ("2026-10-21 15:00", "W4-Story-Wed-2", None), ("2026-10-21 20:00", "W4-Story-Wed-3", None),
 ("2026-10-22 15:00", "W4-Story-Thu-2", None), ("2026-10-22 20:00", "W4-Story-Thu-3", None),
 ("2026-10-23 09:00", "W4-Story-Fri-1", "Add a Poll sticker: Yes / No."), ("2026-10-23 15:00", "W4-Story-Fri-2", None), ("2026-10-23 20:00", "W4-Story-Fri-3", None),
 ("2026-10-24 09:00", "W4-Story-Sat-1", "Add a Question sticker: “Your first question”."), ("2026-10-24 15:00", "W4-Story-Sat-2", None), ("2026-10-24 20:00", "W4-Story-Sat-3", None),
 ("2026-10-25 09:00", "W4-Story-Sun-1", "Add a Quiz sticker: 1 / 3 / Unlimited, with 3 as the right answer."), ("2026-10-25 15:00", "W4-Story-Sun-2", None), ("2026-10-25 20:00", "W4-Story-Sun-3", None),
 ("2026-10-26 09:00", "W4-Story-Mon-1", "Add a Poll sticker with 4 options: Callbacks / Spam Likely / Calling hours / No-shows."),
 ("2026-10-26 15:00", "W4-Story-Mon-3", None), ("2026-10-26 20:00", "W4-Story-Mon-2", None),
]

def jpg(src, dst):
    im = Image.open(src).convert("RGB"); im.save(dst, quality=92, subsampling=0, optimize=True)

if __name__ == "__main__":
    shutil.rmtree(OUT, ignore_errors=True)
    for d in ("1-Reels", "2-Posts", "3-Stories"): os.makedirs(OUT + "/" + d)
    items = []
    for when, typ, key, title, src, cap in FEED:
        it = {"id": "w4-" + key.lower(), "at": when, "type": typ, "title": title, "caption": cap}
        if typ == "reel":
            shutil.copyfile(D + "/out/video/Reel-%s-sound.mp4" % src, OUT + "/1-Reels/Reel-%s.mp4" % src)
            jpg(D + "/out/jpg/W4-Cover-%s.jpg" % key, OUT + "/1-Reels/Cover-%s.jpg" % key)
            it.update(video="1-Reels/Reel-%s.mp4" % src, cover="1-Reels/Cover-%s.jpg" % key, alt=REEL_ALT[key])
        elif typ == "image":
            jpg(D + "/out/jpg/%s.jpg" % src, OUT + "/2-Posts/%s.jpg" % src)
            it.update(image="2-Posts/%s.jpg" % src, alt=TITLES[src].split(": ", 1)[-1])
        else:
            pat, n = src.split(":"); n = int(n); imgs, alts = [], []
            for i in range(1, n + 1):
                stem = pat % i; jpg(D + "/out/jpg/%s.jpg" % stem, OUT + "/2-Posts/%s.jpg" % stem)
                imgs.append("2-Posts/%s.jpg" % stem); alts.append(TITLES[stem].split(": ", 1)[-1])
            it.update(images=imgs, alts=alts)
        items.append(it)
    for when, stem, sticker in STORIES:
        jpg(D + "/out/jpg/%s.jpg" % stem, OUT + "/3-Stories/%s.jpg" % stem)
        it = {"id": "w4-" + stem.lower().replace("w4-", ""), "at": when, "type": "story", "title": TITLES[stem], "image": "3-Stories/%s.jpg" % stem}
        if sticker: it.update(manual=True, note="Post 3-Stories/%s.jpg from the Week 4 pack and add the sticker. %s" % (stem, sticker))
        items.append(it)
    items.sort(key=lambda x: x["at"])
    plan = {"name": "VPEX Instagram, week 4: The rules changed", "timezone": "America/New_York",
            "notes": "Times are New York time. 5 a day: feed at 12:30 and 6:30 PM, stories at 9 AM (sticker, posted by hand with a reminder), 3 PM and 8 PM.", "items": items}
    json.dump(plan, open(OUT + "/plan.json", "w"), indent=1, ensure_ascii=False)
    # the posting plan, for Vincent
    lines = ["VPEX Instagram, week 4: The rules changed", "Posted by the bot. Times are New York time.", ""]
    for it in items:
        lines.append("%s  %-8s %s%s" % (it["at"], it["type"], it["title"], "  (BY HAND: " + it["note"].split(". ", 1)[1] + ")" if it.get("manual") else ""))
    lines += ["", "Captions", ""]
    for it in items:
        if it["type"] != "story": lines += ["== " + it["title"] + " (" + it["at"] + ")", it["caption"], ""]
    open(OUT + "/Week-4-Posting-Plan.txt", "w").write("\n".join(lines))
    z = OUT + ".zip"
    if os.path.exists(z): os.remove(z)
    with zipfile.ZipFile(z, "w", zipfile.ZIP_STORED) as zf:
        for root, _, files in os.walk(OUT):
            for f in sorted(files):
                p = os.path.join(root, f); zf.write(p, "VPEX-Instagram-Week-4/" + os.path.relpath(p, OUT))
    print(len(items), "items:", sum(1 for i in items if i["type"] != "story"), "feed,", sum(1 for i in items if i["type"] == "story"), "stories,", sum(1 for i in items if i.get("manual")), "by hand")
    print("zip %.1f MB" % (os.path.getsize(z) / 1e6))
