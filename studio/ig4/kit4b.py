# Week 4b bridge (Fri Oct 23 evening to Mon Oct 26): "Built for your floor", one industry at a time, since industry
# content got the most shares. Each piece shows what VPEX does differently for that kind of sales: the compliance
# prompt in the Qualify sheet, the pipeline words and the closing checklist. Demo offices only (fictional leads, 555 numbers).
import os, importlib.util
D = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("kit4", D + "/kit4.py"); k4 = importlib.util.module_from_spec(spec); spec.loader.exec_module(k4)
for n in ("NIGHT", "GOLD", "GOLDINK", "PAPER", "INK", "SLATE", "MIST", "ARCH", "BIGS", "UNB", "RED", "RED_D", "REEL_BG", "RULE_L", "RULE_D",
          "img", "at", "board", "headline", "para", "wordmark", "phone", "foot_dark", "foot_light", "zoom", "stack", "fix_label", "big", "lines", "small", "rows", "story_foot"):
    globals()[n] = getattr(k4, n)
B = []
def post(stem, title, bg, inner): B.append((stem, title, 1080, 1350, board(1080, 1350, bg, inner)))
def cover(stem, title, inner):
    B.append((stem, title, 1080, 1920, board(1080, 1920, REEL_BG, inner + at(0, 1500, '<div style="width: 1080px; display: flex; justify-content: center">%s</div>' % wordmark(64)))))
# crops on the 390x844 screen (measured from the app)
NOTE = {"q_medicare": (15, 688, 360, 72), "q_solar_owner": (15, 744, 360, 72), "q_re_agent": (15, 759, 360, 91)}
STEPS = {"steps_insurance": (22, 525, 346, 170), "steps_realestate": (22, 525, 346, 170), "steps_mca": (22, 570, 346, 170), "steps_auto": (22, 570, 346, 170), "steps_solar": (22, 545, 346, 202)}
def note(name, y, s=2.55): return zoom(name, *NOTE[name], None, y, s)
def steps(name, y, s=2.4): return zoom(name, *STEPS[name], None, y, s, True)
def pipe(words, dark=False, size=40):
    chips = "".join('<span style="font-family: %s; font-weight: 700; font-size: %dpx; padding: 14px 26px; border-radius: 999px; background: %s; color: %s">%s</span>%s'
                    % (ARCH, size, "#1E2660" if dark else "#E9ECF6", PAPER if dark else INK, w, '<span style="font-family: %s; font-size: %dpx; color: %s; padding: 0 4px">→</span>' % (ARCH, size, GOLD if dark else GOLDINK) if i < len(words) - 1 else "")
                    for i, w in enumerate(words))
    return '<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px 8px; width: 904px">%s</div>' % chips

# ---------- covers ----------
cover("W4B-Cover-S", "Reel S cover: The 48-hour wait is gone. The Scope of Appointment isn't.", lines([("THE 48-HOUR", 94, PAPER), ("WAIT IS GONE.", 84, PAPER), ("THE SCOPE OF", 84, GOLD), ("APPOINTMENT", 88, GOLD), ("ISN’T.", 150, RED_D)], 430, 18))
cover("W4B-Cover-T", "Reel T cover: Signed isn't installed", lines([("SIGNED", 170, PAPER), ("ISN’T", 120, MIST), ("INSTALLED.", 122, RED_D)], 470, 22))
cover("W4B-Cover-U", "Reel U cover: Test drive isn't sold", lines([("TEST DRIVE", 124, PAPER), ("ISN’T", 120, MIST), ("SOLD.", 190, RED_D)], 470, 22))
cover("W4B-Cover-V", "Reel V cover: Your floor, your words", lines([("ONE APP.", 130, PAPER), ("YOUR FLOOR’S", 94, PAPER), ("WORDS.", 170, GOLD)], 470, 22))

# ---------- Fri: Medicare static ----------
post("W4B-Medicare", "Post: The 48-hour wait is gone. The Scope of Appointment isn't.", PAPER,
    at(84, 96, headline("The 48-hour wait is gone. The Scope of Appointment isn’t.", 86, INK), w=910) +
    at(88, 500, para("For 2027 Medicare marketing (from Oct 1, 2026), CMS dropped the 48-hour wait. A Scope of Appointment is still required before a Medicare Advantage or Part D sales appointment.", 34, SLATE), w=880) +
    note("q_medicare", 730, 2.5) +
    at(88, 975, para("In an insurance office, VPEX reminds the rep the moment they pick Medicare in the Qualify sheet.", 34, INK, "font-weight: 650"), w=880) +
    small("Based on the CMS final rule for 2027, as of October 2026. Not legal advice. Follow your carriers’ guidelines.", 1150, False) + foot_light(1262))

# ---------- Sat: insurance carousel ----------
post("W4B-Ins-1", "Built for insurance floors (cover)", NIGHT,
    at(84, 96, headline("Built for insurance floors.", 140, PAPER), w=900) +
    at(88, 560, para("Same dialer. Insurance words, insurance steps, insurance rules.", 44, MIST), w=880) + foot_dark(1262, "Swipe"))
post("W4B-Ins-2", "Insurance: your pipeline words", PAPER,
    at(88, 80, para("1 of 3 · Pipeline", 30, SLATE, "font-weight: 700")) + at(84, 130, headline("Your stages, in your words.", 90, INK), w=900) +
    at(88, 420, pipe(["New lead", "Qualified", "Quoted", "Considering", "Applied", "Issued", "In force"])) +
    at(88, 760, para("Leads move to Qualified when they say they’re interested. Every stage shows who’s on the deal and the next step.", 38, SLATE), w=880) + foot_light(1262, "Swipe"))
post("W4B-Ins-3", "Insurance: Medicare prompt", PAPER,
    at(88, 80, para("2 of 3 · The rules", 30, SLATE, "font-weight: 700")) + at(84, 130, headline("Medicare? It reminds you about the Scope of Appointment.", 84, INK), w=900) +
    note("q_medicare", 560, 2.5) + at(88, 820, para("Shown the moment the rep picks Medicare in the Qualify sheet. Not legal advice.", 34, SLATE), w=880) + foot_light(1262, "Swipe"))
post("W4B-Ins-4", "Insurance: closing checklist", PAPER,
    at(88, 80, para("3 of 3 · After the yes", 30, SLATE, "font-weight: 700")) + at(84, 130, headline("Every policy gets a closing checklist.", 90, INK), w=900) +
    steps("steps_insurance", 480, 2.45) + at(88, 1000, para("Application signed, underwriting, issued, first premium paid. Each with a date, so nothing stalls quietly.", 34, SLATE), w=880) + foot_light(1262, "Swipe"))
post("W4B-Ins-5", "Built for insurance floors (end)", NIGHT,
    stack(88, 110, 900, [headline("Try the insurance office.", 120, PAPER), para("A live demo office with sample leads: turning-65 lists, aged leads, Medicare, final expense.", 40, MIST)], 34) +
    at(88, 700, big("COMMENT", 128, PAPER, UNB)) + at(88, 840, big("DEMO", 128, GOLD, UNB)) + foot_dark(1262))

# ---------- Sat: solar static ----------
post("W4B-Solar", "Post: Only the homeowner can sign", NIGHT,
    at(84, 96, headline("Only the homeowner can sign.", 100, PAPER), w=900) +
    at(88, 470, para("Book the appointment with a renter and you’ve booked nothing. In a solar office, VPEX catches it while you qualify.", 38, MIST), w=880) +
    note("q_solar_owner", 690, 2.5) +
    at(88, 960, para("Doesn’t own the home? VPEX tells the rep to find out who does and set the appointment with them.", 36, PAPER, "font-weight: 650"), w=880) + foot_dark(1262))

# ---------- Sun: real estate carousel ----------
post("W4B-RE-1", "Built for real estate floors (cover)", PAPER,
    at(84, 96, headline("Built for real estate floors.", 140, INK), w=900) +
    at(88, 560, para("Expired listings, FSBOs, and the rules that come with them.", 44, SLATE), w=880) + foot_light(1262, "Swipe"))
post("W4B-RE-2", "Real estate: pipeline words", PAPER,
    at(88, 80, para("1 of 3 · Pipeline", 30, SLATE, "font-weight: 700")) + at(84, 130, headline("Appointment set to under contract.", 90, INK), w=900) +
    at(88, 420, pipe(["New lead", "Qualified", "Appointment set", "Negotiating", "Under contract", "Sold", "Commission paid"])) +
    at(88, 800, para("Your stages, your words, on every rep’s phone and your scoreboard.", 38, SLATE), w=880) + foot_light(1262, "Swipe"))
post("W4B-RE-3", "Real estate: already has an agent", PAPER,
    at(88, 80, para("2 of 3 · The rules", 30, SLATE, "font-weight: 700")) + at(84, 130, headline("Already working with an agent? VPEX says so.", 88, INK), w=900) +
    note("q_re_agent", 540, 2.5) + at(88, 860, para("Shown when the rep marks “Has an agent: Yes” in the Qualify sheet.", 34, SLATE), w=880) + foot_light(1262, "Swipe"))
post("W4B-RE-4", "Real estate: closing checklist", PAPER,
    at(88, 80, para("3 of 3 · After the yes", 30, SLATE, "font-weight: 700")) + at(84, 130, headline("Offer accepted to closed, with dates.", 90, INK), w=900) +
    steps("steps_realestate", 480, 2.45) + at(88, 1000, para("Inspection, appraisal, closing. Each step dated, so you see what’s about to slip.", 34, SLATE), w=880) + foot_light(1262, "Swipe"))
post("W4B-RE-5", "Built for real estate floors (end)", NIGHT,
    stack(88, 110, 900, [headline("Try the real estate office.", 120, PAPER), para("A live demo office with sample expired listings and FSBO leads.", 40, MIST)], 34) +
    at(88, 700, big("COMMENT", 128, PAPER, UNB)) + at(88, 840, big("DEMO", 128, GOLD, UNB)) + foot_dark(1262))

# ---------- Sun: business funding static ----------
post("W4B-MCA", "Post: Approved isn't funded", PAPER,
    at(76, 100, big("Approved", 190, INK, ARCH, "font-stretch: 112%; letter-spacing: -0.03em")) +
    at(84, 300, headline("isn’t funded.", 120, RED), w=900) +
    at(88, 520, para("Offer accepted, contract signed, funded. In a business funding office, every advance gets that checklist, with a date on each step.", 36, SLATE), w=880) +
    steps("steps_mca", 720, 2.45) + foot_light(1262))

# ---------- Mon: auto carousel ----------
post("W4B-Auto-1", "Built for auto floors (cover)", NIGHT,
    at(84, 96, headline("Built for auto floors.", 150, PAPER), w=900) +
    at(88, 560, para("Website leads, service drive, test drives and trade-ins.", 44, MIST), w=880) + foot_dark(1262, "Swipe"))
post("W4B-Auto-2", "Auto: pipeline words", PAPER,
    at(88, 80, para("1 of 3 · Pipeline", 30, SLATE, "font-weight: 700")) + at(84, 130, headline("Appointment set to delivered.", 90, INK), w=900) +
    at(88, 420, pipe(["New lead", "Appointment set", "Test drive", "Negotiating", "Sold", "Delivered", "Completed"])) +
    at(88, 800, para("The words your floor already uses, on every rep’s phone.", 38, SLATE), w=880) + foot_light(1262, "Swipe"))
post("W4B-Auto-3", "Auto: first-call questions", PAPER,
    at(88, 80, para("2 of 3 · First call", 30, SLATE, "font-weight: 700")) + at(84, 130, headline("Ask it once. The whole team sees it.", 90, INK), w=900) +
    at(88, 440, rows([("Vehicle", "What they want"), ("New or used", ""), ("Trade-in", "Year and model"), ("Budget", "Monthly payment"), ("Credit", "Rough range"), ("Timing", "When they’re buying")], False, 40, 300)) +
    foot_light(1262, "Swipe"))
post("W4B-Auto-4", "Auto: closing checklist", PAPER,
    at(88, 80, para("3 of 3 · After the yes", 30, SLATE, "font-weight: 700")) + at(84, 130, headline("Credit app to delivered, with dates.", 90, INK), w=900) +
    steps("steps_auto", 480, 2.45) + at(88, 1000, para("Every sale gets a checklist: credit app in, approved, deal signed, delivered.", 34, SLATE), w=880) + foot_light(1262, "Swipe"))
post("W4B-Auto-5", "Built for auto floors (end)", NIGHT,
    stack(88, 110, 900, [headline("Try the auto office.", 120, PAPER), para("A live demo office with sample website and service-drive leads.", 40, MIST)], 34) +
    at(88, 700, big("COMMENT", 128, PAPER, UNB)) + at(88, 840, big("DEMO", 128, GOLD, UNB)) + foot_dark(1262))

if __name__ == "__main__":
    for b in B: print(b[0], b[1])
    print(len(B), "boards")
