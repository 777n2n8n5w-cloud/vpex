# Week-4b bridge pack for the bot: "Built for your floor", one industry at a time (industry content got the most shares).
# Fills the slots the 8-a-day re-time (tools/replan_8day.py) left open: Fri Oct 23 at 19:00, then Sat Oct 24 - Mon Oct 26
# feed at 11:00, 15:30 and 19:00 plus story shares of the first two feed posts at 12:30 and 17:30. The 09:00, 14:30 and
# 21:00 stories on those days already come from the week 3 and week 4 packs.
# usage: PACK_OUT=/tmp/VPEX-Instagram-Week-4b python3 make_pack4b.py
import os, json, shutil, zipfile, importlib.util
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("kit4b", D + "/kit4b.py"); kit = importlib.util.module_from_spec(spec); spec.loader.exec_module(kit)
OUT = os.environ.get("PACK_OUT", "/tmp/VPEX-Instagram-Week-4b")
NAME = "VPEX-Instagram-Week-4b"
TITLES = {b[0]: b[1] for b in kit.B}
DEMO = "Comment DEMO and we'll send you a live demo office."
CMS = "Based on the CMS final rule for 2027, as of October 2026. Not legal advice. Follow your carriers' guidelines."

# (when, type, key, title, source, caption, share story at or None)
FEED = [
 ("2026-10-23 19:00", "image", "medicare", "Post: The 48-hour wait is gone. The Scope of Appointment isn't.", "W4B-Medicare",
  f"""The 48-hour wait is gone. The Scope of Appointment isn't.

For 2027 Medicare marketing, which started October 1, CMS dropped the 48-hour wait between the Scope of Appointment and the sales meeting. A Scope of Appointment is still required before a Medicare Advantage or Part D sales appointment.

In an insurance office, VPEX reminds the rep the moment they pick Medicare in the Qualify sheet. One less thing for a new rep to remember during enrollment season.

{DEMO}

{CMS}

#medicare #insuranceagent #medicareadvantage #aep #salesfloor""", None),
 ("2026-10-24 11:00", "reel", "s", "Reel S: Medicare, the 48-hour wait is gone", "S-MedicareSOA",
  f"""Medicare: the 48-hour wait is gone. The Scope of Appointment is still required.

New reps forget. VPEX doesn't: pick Medicare in the Qualify sheet and the reminder is right there. After the yes, every policy gets a closing checklist, from application signed to first premium paid.

{DEMO}

{CMS}

#medicare #insuranceagent #medicareadvantage #salesfloor #powerdialer""", "2026-10-24 12:30"),
 ("2026-10-24 15:30", "carousel", "ins", "Carousel: Built for insurance floors", "W4B-Ins-%d:5",
  """Built for insurance floors.

Same dialer, insurance words:
• Your pipeline: New lead → Qualified → Quoted → Considering → Applied → Issued → In force
• Medicare? A Scope of Appointment reminder, right on the Qualify sheet
• Every policy gets a closing checklist, with a date on each step

Comment DEMO for a live insurance demo office with sample leads.

Not legal advice. Follow CMS marketing rules and your carriers' guidelines.

#insurancesales #insuranceagent #finalexpense #medicare #salesfloor""", "2026-10-24 17:30"),
 ("2026-10-24 19:00", "image", "solar", "Post: Only the homeowner can sign", "W4B-Solar",
  f"""Only the homeowner can sign.

Book a solar appointment with a renter and you've booked nothing. In a solar office, the VPEX Qualify sheet asks whether they own the home. Answer No and it tells the rep to find out who does and set the appointment with them.

{DEMO}

#solarsales #solar #appointmentsetting #salesfloor #powerdialer""", None),
 ("2026-10-25 11:00", "reel", "t", "Reel T: Signed isn't installed", "T-SignedNotInstalled",
  f"""Signed isn't installed.

Site survey, permit, install, permission to operate. Somebody has to chase every step.

In a VPEX solar office, every deal carries that checklist, with a date on each step. And when the rep is talking to a renter, the Qualify sheet tells them to find the homeowner.

{DEMO}

#solarsales #solar #solarenergy #salesfloor #powerdialer""", "2026-10-25 12:30"),
 ("2026-10-25 15:30", "carousel", "re", "Carousel: Built for real estate floors", "W4B-RE-%d:5",
  """Built for real estate floors.

• Your pipeline: New lead → Qualified → Appointment set → Negotiating → Under contract → Sold → Commission paid
• Already working with an agent? Mark it on the Qualify sheet and VPEX tells the rep not to pitch
• Every deal gets a closing checklist: offer accepted, inspection, appraisal, closed

Comment DEMO for a live real estate demo office with sample expired and FSBO leads.

#realestate #realestateagent #expiredlistings #fsbo #salesfloor""", "2026-10-25 17:30"),
 ("2026-10-25 19:00", "image", "mca", "Post: Approved isn't funded", "W4B-MCA",
  f"""Approved isn't funded.

Offer accepted, contract signed, funded. In a VPEX business funding office, every advance gets that checklist, with a date on each step. A step running late is flagged right on the lead.

{DEMO}

#mca #businessfunding #merchantcashadvance #salesfloor #powerdialer""", None),
 ("2026-10-26 11:00", "reel", "u", "Reel U: Test drive isn't sold", "U-TestDriveNotSold",
  f"""Test drive isn't sold.

Credit app, approved, deal signed, delivered. In a VPEX auto office, every sale carries that checklist with dates, and a step that runs late is flagged right on the lead. The pipeline shows who needs a next step.

{DEMO}

#carsales #autosales #cardealership #salesfloor #powerdialer""", "2026-10-26 12:30"),
 ("2026-10-26 15:30", "carousel", "auto", "Carousel: Built for auto floors", "W4B-Auto-%d:5",
  """Built for auto floors.

• Your pipeline: New lead → Appointment set → Test drive → Negotiating → Sold → Delivered → Completed
• First-call questions: vehicle, new or used, trade-in, budget, credit, timing. Ask once and the whole team sees it
• Every sale gets a closing checklist, with a date on each step

Comment DEMO for a live auto demo office with sample website and service-drive leads.

#carsales #autosales #bdc #cardealership #salesfloor""", "2026-10-26 17:30"),
 ("2026-10-26 19:00", "reel", "v", "Reel V: One app, your floor's words", "V-YourFloorsWords",
  f"""Every floor sells differently.

Insurance: application to first premium. Real estate: offer to closing. Business funding: approved to funded. Auto: credit app to delivered. Solar: signed to switched on.

Pick your industry when you set up your office, and VPEX uses your floor's stages, questions and checklists.

{DEMO}

#salesfloor #salesmanager #powerdialer #insurancesales #realestate""", None),
]
REEL_ALT = {
 "s": "Text: Medicare. The 48-hour wait? Gone. The Scope of Appointment? Still required. New reps forget. Then the VPEX Qualify sheet with Medicare picked shows a note: get a signed Scope of Appointment before the sales meeting. Then a policy's closing checklist, from application signed to first premium paid.",
 "t": "Text: Signed isn't installed. Site survey, permit, install, permission to operate. Who's chasing each one? Then the VPEX Qualify sheet tells the rep only the homeowner can sign for solar, and a solar deal's closing checklist shows a date on each step.",
 "u": "Text: Test drive isn't sold. Credit app, approved, signed, delivered. Which step is late? Then a VPEX auto sale's closing checklist, an Approved overdue flag on the lead, and the pipeline by stage.",
 "v": "Text: Every floor sells differently. Then VPEX closing checklists for insurance, real estate, business funding, auto and solar. Text: One app. Your floor's words.",
}
ALT = {
 "W4B-Medicare": "Headline: The 48-hour wait is gone. The Scope of Appointment isn't. A VPEX Qualify sheet note reads: Medicare Advantage or Part D: get a signed Scope of Appointment before the sales meeting.",
 "W4B-Solar": "Headline: Only the homeowner can sign. A VPEX Qualify sheet note reads: Only the homeowner can sign for solar. Ask who owns the home and set the appointment with them.",
 "W4B-MCA": "Headline: Approved isn't funded. A VPEX closing checklist for a business funding advance: approved, offer accepted, contract signed, funded, each with a date.",
 "W4B-Ins-1": "Built for insurance floors. Same dialer, insurance words, insurance steps, insurance rules.",
 "W4B-Ins-2": "Insurance pipeline stages in VPEX: New lead, Qualified, Quoted, Considering, Applied, Issued, In force.",
 "W4B-Ins-3": "Picking Medicare on the VPEX Qualify sheet shows a Scope of Appointment reminder.",
 "W4B-Ins-4": "A VPEX policy closing checklist: application signed, underwriting done, policy issued, first premium paid, each with a date.",
 "W4B-Ins-5": "Try the insurance office. Comment DEMO.",
 "W4B-RE-1": "Built for real estate floors. Expired listings, FSBOs, and the rules that come with them.",
 "W4B-RE-2": "Real estate pipeline stages in VPEX: New lead, Qualified, Appointment set, Negotiating, Under contract, Sold, Commission paid.",
 "W4B-RE-3": "Marking Has an agent: Yes on the VPEX Qualify sheet shows a note: They're working with an agent. Don't pitch your services while they're under an agreement with someone else.",
 "W4B-RE-4": "A VPEX deal closing checklist: offer accepted, inspection done, appraisal in, deal closed, each with a date.",
 "W4B-RE-5": "Try the real estate office. Comment DEMO.",
 "W4B-Auto-1": "Built for auto floors. Website leads, service drive, test drives and trade-ins.",
 "W4B-Auto-2": "Auto pipeline stages in VPEX: New lead, Appointment set, Test drive, Negotiating, Sold, Delivered, Completed.",
 "W4B-Auto-3": "First-call questions for auto: vehicle, new or used, trade-in, budget, credit and timing.",
 "W4B-Auto-4": "A VPEX sale closing checklist: credit app in, approved, deal signed, delivered, each with a date.",
 "W4B-Auto-5": "Try the auto office. Comment DEMO.",
}

def jpg(src, dst):
    im = Image.open(src).convert("RGB"); im.save(dst, quality=92, subsampling=0, optimize=True)

if __name__ == "__main__":
    shutil.rmtree(OUT, ignore_errors=True)
    for d in ("1-Reels", "2-Posts", "3-Stories"): os.makedirs(OUT + "/" + d)
    items = []
    for when, typ, key, title, src, cap, share_at in FEED:
        it = {"id": "w4b-" + key, "at": when, "type": typ, "title": title, "caption": cap}
        share = {"id": "w4b-" + key + "-share", "at": share_at, "type": "story", "title": "Story share: " + title}
        if typ == "reel":
            shutil.copyfile(D + "/out/video/Reel-%s-sound.mp4" % src, OUT + "/1-Reels/Reel-%s.mp4" % src)
            jpg(D + "/out/jpg/W4B-Cover-%s.jpg" % key.upper(), OUT + "/1-Reels/Cover-%s.jpg" % key.upper())
            it.update(video="1-Reels/Reel-%s.mp4" % src, cover="1-Reels/Cover-%s.jpg" % key.upper(), alt=REEL_ALT[key])
            share["video"] = it["video"]
        elif typ == "image":
            jpg(D + "/out/jpg/%s.jpg" % src, OUT + "/2-Posts/%s.jpg" % src)
            it.update(image="2-Posts/%s.jpg" % src, alt=ALT[src])
            first = src
        else:
            pat, n = src.split(":"); n = int(n); imgs, alts = [], []
            for i in range(1, n + 1):
                stem = pat % i; jpg(D + "/out/jpg/%s.jpg" % stem, OUT + "/2-Posts/%s.jpg" % stem)
                imgs.append("2-Posts/%s.jpg" % stem); alts.append(ALT[stem])
            it.update(images=imgs, alts=alts)
            first = pat % 1
        items.append(it)
        if share_at:
            if typ != "reel":
                f = "Story-%s.jpg" % first
                jpg(D + "/out/story_versions/" + f, OUT + "/3-Stories/" + f); share["image"] = "3-Stories/" + f
            items.append(share)
    items.sort(key=lambda x: x["at"])
    plan = {"name": "VPEX Instagram, week 4b: Built for your floor (bridge to week 5)", "timezone": "America/New_York",
            "notes": "Times are New York time. 8 a day: feed at 11:00, 15:30 and 19:00; stories at 09:00 (sticker, by hand), 12:30, 14:30, 17:30 and 21:00. This pack fills Fri Oct 23 at 19:00 and the feed and story-share slots for Sat Oct 24 - Mon Oct 26; the other stories come from the week 3 and 4 packs.",
            "items": items}
    json.dump(plan, open(OUT + "/plan.json", "w"), indent=1, ensure_ascii=False)
    lines = ["VPEX Instagram, week 4b: Built for your floor", "Posted by the bot. Times are New York time. Nothing here is posted by hand.", ""]
    for it in items: lines.append("%s  %-8s %s" % (it["at"], it["type"], it["title"]))
    lines += ["", "Captions", ""]
    for it in items:
        if it["type"] != "story": lines += ["== " + it["title"] + " (" + it["at"] + ")", it["caption"], ""]
    open(OUT + "/Week-4b-Posting-Plan.txt", "w").write("\n".join(lines))
    z = OUT + ".zip"
    if os.path.exists(z): os.remove(z)
    with zipfile.ZipFile(z, "w", zipfile.ZIP_STORED) as zf:
        for root, _, files in os.walk(OUT):
            for f in sorted(files):
                p = os.path.join(root, f); zf.write(p, NAME + "/" + os.path.relpath(p, OUT))
    print(len(items), "items:", sum(1 for i in items if i["type"] != "story"), "feed,", sum(1 for i in items if i["type"] == "story"), "stories")
    print("zip %.1f MB" % (os.path.getsize(z) / 1e6))
