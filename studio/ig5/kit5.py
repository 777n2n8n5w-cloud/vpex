# VPEX Instagram, week 5 (Tue Oct 27 - Mon Nov 2, 2026): "Run the floor from your phone". Built on the first learn runs:
# the manager's-eye Reel (It's 5 PM) kept viewers longest and skipped least, "Two reps. One lead." got the most sends per
# reach, and calling-hours and "Built for your floor" posts were saved and shared. So: the manager screens (Sales coach,
# Results report, Answer times, List ROI, Monthly goals, Overdue follow-ups), the team-wide Do Not Call list, who calls
# each list, the clocks falling back, a business funding carousel, and a first-day carousel for new reps.
# Real VPEX screens from demo offices only (fictional leads, 555 numbers). Same tokens and helpers as weeks 3-4.
import os, importlib.util
D = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("kit4", D + "/../ig4/kit4.py"); k4 = importlib.util.module_from_spec(spec); spec.loader.exec_module(k4)
for n in ("NIGHT", "GOLD", "GOLDINK", "PAPER", "INK", "SLATE", "MIST", "ARCH", "BIGS", "UNB", "RED", "RED_D", "REEL_BG", "RULE_L", "RULE_D", "GREEN",
          "img", "at", "board", "headline", "para", "wordmark", "phone", "foot_dark", "foot_light", "zoom", "stack", "fix_label", "big", "lines", "small", "rows",
          "story_foot", "sticker_hint"):
    globals()[n] = getattr(k4, n)
LEGAL = "Based on published state rules as of October 2026. Not legal advice."
DNC_NOTE = "VPEX keeps your office’s own Do Not Call list. It doesn’t check the National Do Not Call Registry; scrub new lists against it before you upload. Not legal advice."
B = []
def post(stem, title, bg, inner): B.append((stem, title, 1080, 1350, board(1080, 1350, bg, inner)))
def story(stem, title, bg, inner): B.append((stem, title, 1080, 1920, board(1080, 1920, bg, inner)))
def cover(stem, title, inner):
    B.append((stem, title, 1080, 1920, board(1080, 1920, REEL_BG, inner + at(0, 1500, '<div style="width: 1080px; display: flex; justify-content: center">%s</div>' % wordmark(64)))))
def kicker(text, dark=False): return at(88, 80, para(text, 30, MIST if dark else SLATE, "font-weight: 700"))
def demo_tag(y, dark=False): return small("Demo office, sample leads.", y, dark)

# crops on the 390x844 screen (measured from the captures)
C = {
 "dnc_ask": ("dnc_after", 0, 680, 390, 164), "dnc_chip": ("dnc_done", 8, 142, 374, 104), "dnc_list": ("dnc_list", 8, 618, 374, 46),
 "lists": ("lists_choose", 0, 452, 390, 318), "rebut_mca": ("rebut_mca_info", 12, 532, 366, 160), "roi_mca": ("roi_mca", 8, 515, 374, 290),
 "script": ("script", 12, 288, 366, 262), "prime": ("prime_hour", 27, 486, 272, 46), "mycoach": ("mycoach", 8, 118, 374, 262),
 "dst_before": ("dst_before", 26, 467, 318, 46), "dst_after": ("dst_after", 26, 468, 188, 46), "goals": ("goals", 8, 232, 374, 265),
 "qf": ("qf_insurance", 8, 140, 374, 312),
}
def crop(key, y, s, x=None, dark=False): n, sx, sy, sw, sh = C[key]; return zoom(n, sx, sy, sw, sh, x, y, s, dark)
def pipe(words, dark=False, size=40):
    chips = "".join('<span style="font-family: %s; font-weight: 700; font-size: %dpx; padding: 14px 26px; border-radius: 999px; background: %s; color: %s">%s</span>%s'
                    % (ARCH, size, "#1E2660" if dark else "#E9ECF6", PAPER if dark else INK, w, '<span style="font-family: %s; font-size: %dpx; color: %s; padding: 0 4px">→</span>' % (ARCH, size, GOLD if dark else GOLDINK) if i < len(words) - 1 else "")
                    for i, w in enumerate(words))
    return '<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px 8px; width: 904px">%s</div>' % chips
def steps_list(items, dark=False, size=40):
    out = "".join('<div style="display: flex; gap: 26px; align-items: baseline; padding: 22px 0; border-top: 2px solid %s">'
                  '<span style="flex: none; width: 60px; font-family: %s; font-weight: 800; font-size: %dpx; line-height: .9; color: %s">%d</span>'
                  '<span><b style="display: block; font-family: %s; font-weight: 800; font-size: %dpx; line-height: 1.1; color: %s">%s</b>'
                  '<span style="display: block; margin-top: 8px; font-family: %s; font-weight: 500; font-size: %dpx; line-height: 1.3; color: %s">%s</span></span></div>'
                  % (RULE_D if dark else RULE_L, BIGS, size + 30, GOLD if dark else GOLDINK, i + 1, ARCH, size, PAPER if dark else INK, t, ARCH, size - 8, MIST if dark else SLATE, s)
                  for i, (t, s) in enumerate(items))
    return '<div style="width: 904px">%s</div>' % out

# ========== Reel covers (words inside the middle 1080x1350, so the grid crop keeps them) ==========
cover("W5-Cover-W", "Reel W cover: One rep is struggling. Which one?", lines([("ONE REP IS", 112, PAPER), ("STRUGGLING.", 100, RED_D), ("WHICH ONE?", 108, GOLD)], 480, 24))
cover("W5-Cover-X", "Reel X cover: Just mail me something", lines([("“JUST MAIL", 120, PAPER), ("ME", 150, PAPER), ("SOMETHING.”", 96, RED_D)], 470, 22))
cover("W5-Cover-Y", "Reel Y cover: Calling at the wrong hour?", lines([("CALLING", 150, PAPER), ("AT THE", 110, MIST), ("WRONG HOUR?", 94, RED_D)], 480, 22))
cover("W5-Cover-Z", "Reel Z cover: Friday 5 PM. How did we do?", at(0, 380, '<div style="width: 1080px; text-align: center; font-family: %s; font-weight: 800; font-size: 330px; line-height: 0.85; color: %s">5:00<span style="font-size: 120px; margin-left: 16px">PM</span></div>' % (BIGS, GOLD)) +
      lines([("FRIDAY.", 110, PAPER), ("HOW’D WE DO?", 94, PAPER)], 720, 18))
cover("W5-Cover-AA", "Reel AA cover: You paid for the list. Did it pay?", lines([("YOU PAID", 150, PAPER), ("FOR THE LIST.", 116, PAPER), ("DID IT PAY?", 140, RED_D)], 460, 22))
cover("W5-Cover-AB", "Reel AB cover: She said yes. Then nobody called.", lines([("SHE SAID YES.", 94, PAPER), ("THEN NOBODY", 98, RED_D), ("CALLED.", 160, RED_D)], 470, 22))
cover("W5-Cover-AC", "Reel AC cover: They stare at it all day", lines([("YOUR REPS", 130, PAPER), ("STARE AT IT", 124, PAPER), ("ALL DAY.", 170, GOLD)], 460, 22))

# ========== Tue 19:00 carousel: Take me off your list (Do Not Call, team-wide) ==========
post("W5-DNC-1", "“Take me off your list.” (cover)", NIGHT,
    at(84, 110, headline("“Take me off your list.”", 128, PAPER), w=910) +
    at(88, 560, para("He told one rep. Two days later, another rep called him from the same list.", 46, MIST), w=880) +
    at(88, 820, big("Who else", 150, RED_D, ARCH, "font-stretch: 112%; letter-spacing: -0.03em")) + at(88, 960, big("heard it?", 150, RED_D, ARCH, "font-stretch: 112%; letter-spacing: -0.03em")) +
    foot_dark(1262, "Swipe"))
post("W5-DNC-2", "DNC: one tap, the rep who heard it", PAPER,
    kicker("1 of 3 · The rep who heard it") + at(84, 130, headline("One tap: Do not call.", 100, INK), w=900) +
    at(88, 380, para("On the lead’s profile, the rep taps Do not call and confirms.", 38, SLATE), w=880) +
    crop("dnc_ask", 560, 2.45) + demo_tag(1190) + foot_light(1262, "Swipe"))
post("W5-DNC-3", "DNC: blocked for the whole team", PAPER,
    kicker("2 of 3 · Everyone else") + at(84, 130, headline("Blocked for the whole team. Right away.", 96, INK), w=900) +
    crop("dnc_chip", 470, 2.4) +
    at(88, 830, para("Nobody on the team can call or text that number, on any list, from any phone.", 38, SLATE), w=880) + demo_tag(1190) + foot_light(1262, "Swipe"))
post("W5-DNC-4", "DNC: skipped on the next upload", PAPER,
    kicker("3 of 3 · The next list") + at(84, 130, headline("Next list you load? That number is skipped.", 82, INK), w=910) +
    crop("dnc_list", 540, 2.4) +
    at(88, 790, para("Your Do Not Call list lives in Admin controls. Paste in numbers you already have, too.", 38, SLATE), w=880) + demo_tag(1190) + foot_light(1262, "Swipe"))
post("W5-DNC-5", "DNC: send this to your manager (end)", NIGHT,
    stack(88, 110, 900, [headline("One “no” should stop the whole floor.", 92, PAPER), para("If yours doesn’t yet, send this to your manager.", 44, MIST)], 34) +
    at(88, 720, big("SEND THIS", 112, PAPER, UNB)) + at(88, 850, big("TO YOUR MANAGER", 76, GOLD, UNB)) +
    small(DNC_NOTE, 1090, True, size=26) + foot_dark(1262))

# ========== Wed 11:00 post: Two reps. One list. (Lead lists: who calls each list) ==========
post("W5-Lists", "Post: Two reps dialed the same list all morning", PAPER,
    at(84, 90, headline("Two reps dialed the same list all morning.", 84, INK), w=910) +
    at(88, 360, para("In VPEX, you pick who calls each list. Only they get those leads.", 36, SLATE, "font-weight: 600"), w=880) +
    crop("lists", 530, 1.9) + small("Demo office, sample leads. Leads someone already worked keep their owner and their follow-ups.", 1172, False, size=24) +
    foot_light(1262))

# ========== Thu 19:00 carousel: Built for business funding floors ==========
post("W5-MCA-1", "Built for business funding floors (cover)", NIGHT,
    at(84, 96, headline("Built for business funding floors.", 140, PAPER), w=920) +
    at(88, 660, para("Merchants, advances, renewals. Same dialer, your floor’s words.", 44, MIST), w=880) + foot_dark(1262, "Swipe"))
post("W5-MCA-2", "Business funding: pipeline words", PAPER,
    kicker("1 of 3 · Pipeline") + at(84, 130, headline("App sent to funded.", 100, INK), w=900) +
    at(88, 400, pipe(["New lead", "Qualified", "App sent", "Negotiating", "Submitted", "Funded", "Paid off"])) +
    at(88, 760, para("Merchants, advances and renewals, in the words your floor already uses, on every rep’s phone.", 38, SLATE), w=880) + foot_light(1262, "Swipe"))
post("W5-MCA-3", "Business funding: just send me some info", PAPER,
    kicker("2 of 3 · Objections") + at(84, 130, headline("“Just send me some info.” The answer is one tap away.", 84, INK), w=910) +
    crop("rebut_mca", 520, 2.45) +
    at(88, 960, para("Rebuttals open from the Dial screen, mid-call. You write them once; every rep’s app updates.", 34, SLATE), w=880) + foot_light(1262, "Swipe"))
post("W5-MCA-4", "Business funding: which lists produce merchants", PAPER,
    kicker("3 of 3 · Your lists") + at(84, 130, headline("Which lists actually produce merchants?", 90, INK), w=900) +
    crop("roi_mca", 440, 2.3) + demo_tag(1130) + foot_light(1262, "Swipe"))
post("W5-MCA-5", "Built for business funding floors (end)", NIGHT,
    stack(88, 110, 900, [headline("Try the business funding office.", 100, PAPER), para("A live demo office with sample merchants and UCC leads. No sign-up.", 40, MIST)], 34) +
    at(88, 760, big("COMMENT", 128, PAPER, UNB)) + at(88, 900, big("DEMO", 128, GOLD, UNB)) + foot_dark(1262))

# ========== Fri 11:00 carousel: Your new rep's first day ==========
post("W5-Day1-1", "Your new rep's first day (cover)", PAPER,
    at(84, 96, headline("POV: it’s your new rep’s first day.", 140, INK), w=910) +
    at(88, 780, para("Four things they see before they ever ask you a question.", 46, SLATE), w=880) + foot_light(1262, "Swipe"))
post("W5-Day1-2", "First day: the script", PAPER,
    kicker("1 of 4 · What to say") + at(84, 130, headline("The script opens on the Dial screen, with the lead’s name in it.", 80, INK), w=910) +
    crop("script", 470, 2.4) + demo_tag(1130) + foot_light(1262, "Swipe"))
post("W5-Day1-3", "First day: what to ask", PAPER,
    kicker("2 of 4 · What to ask") + at(84, 130, headline("Tap the answers. No second call to qualify.", 86, INK), w=910) +
    crop("qf", 440, 2.3) + foot_light(1262, "Swipe"))
post("W5-Day1-4", "First day: the right hour", PAPER,
    kicker("3 of 4 · When to call") + at(84, 130, headline("Every lead shows their local time.", 92, INK), w=900) +
    crop("prime", 470, 3.0) +
    at(88, 700, para("Outside their state’s calling hours? Flagged before anyone dials. ★ marks the hour your team reaches people best.", 38, SLATE), w=880) +
    small(LEGAL, 1150, False) + foot_light(1262, "Swipe"))
post("W5-Day1-5", "First day: their own numbers", PAPER,
    kicker("4 of 4 · How they’re doing") + at(84, 130, headline("My coach: their numbers. Only they see it.", 90, INK), w=900) +
    crop("mycoach", 440, 2.25) + demo_tag(1060) + at(88, 1150, para("Save this for your next new hire.", 36, INK, "font-weight: 700")) + foot_light(1262))

# ========== Sat 11:00 is Reel AC (Halloween look). Sat 19:00 post: clocks fall back ==========
post("W5-DST", "Post: Clocks fall back tonight. Arizona's don't.", NIGHT,
    at(84, 90, headline("Clocks fall back tonight. Arizona’s don’t.", 104, PAPER), w=910) +
    at(88, 420, para("10:00 AM in New York, on two Mondays, for a lead in Phoenix:", 36, MIST, "font-weight: 600"), w=880) +
    at(88, 530, para("Last Monday", 32, GOLD, "font-weight: 700")) + crop("dst_before", 580, 2.7, 88, True) +
    at(88, 740, para("This Monday", 32, GOLD, "font-weight: 700")) + crop("dst_after", 790, 2.7, 88, True) +
    at(88, 950, para("Hawaii doesn’t change either. VPEX shows every lead’s local time and checks their state’s calling hours, so nobody does the math on Monday.", 32, PAPER), w=880) +
    small("Demo office. " + LEGAL, 1170, True) + foot_dark(1262))

# ========== Sun 11:00 post: Set it up Sunday. Dial Monday. (the free trial) ==========
post("W5-Trial", "Post: Set it up Sunday. Dial Monday.", PAPER,
    at(84, 90, headline("Set it up Sunday. Dial Monday.", 104, INK), w=910) +
    at(88, 460, steps_list([("Start your free trial.", "Two minutes, no card."), ("Text your reps the invite link.", "They pick a username and sign in on their own phones."),
                            ("Load your list and dial.", "Paste it or upload a spreadsheet. Duplicates and Do Not Call numbers are skipped.")], False, 42)) +
    at(88, 1130, para("7 days free, then $49 per rep per month.", 40, INK, "font-weight: 700")) + foot_light(1262))

# ========== Mon 19:00 post: New month. Does every rep know their number? ==========
post("W5-Goals", "Post: New month. Does every rep know their number?", PAPER,
    at(84, 90, headline("New month. Does every rep know their number?", 84, INK), w=910) +
    crop("goals", 420, 2.2) +
    at(88, 1040, para("Set each rep’s targets once. They see their own pace in My coach, every day.", 36, SLATE), w=880) + demo_tag(1170) + foot_light(1262))

# ========== stories (1080x1920). 9 AM ones carry a sticker added by hand (the bot reminds Vincent). ==========
story("W5-Story-Tue-1", "Tue 9 AM · Poll: who needs help?", NIGHT,
    stack(84, 280, 900, [headline("Could you name the rep who needs help today?", 112, PAPER), para("Before you look at a single report.", 48, MIST)], 40) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))
story("W5-Story-Wed-1", "Wed 9 AM · Question: the brush-off", NIGHT,
    stack(84, 280, 900, [headline("What’s the brush-off your reps hear most?", 116, PAPER), para("Best answers get a rebuttal in a post.", 48, MIST)], 40) +
    sticker_hint(1400, "Answer below ↓", True) + story_foot(True))
story("W5-Story-Thu-1", "Thu 9 AM · Poll: when do they pick up?", NIGHT,
    stack(84, 280, 900, [headline("When do your leads actually pick up?", 120, PAPER), para("Morning, afternoon or evening, their time.", 48, MIST)], 40) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))
story("W5-Story-Fri-1", "Fri 9 AM · Slider: how was the week?", NIGHT,
    stack(84, 280, 900, [headline("How was your floor’s week?", 130, PAPER), para("Slide it. Be honest.", 48, MIST)], 40) +
    sticker_hint(1400, "Slide below ↓", True) + story_foot(True))
story("W5-Story-Sat-1", "Sat 9 AM · Quiz: Arizona", NIGHT,
    stack(84, 280, 900, [headline("Clocks fall back tonight. On Monday, how far behind New York is Phoenix?", 100, PAPER)], 40) +
    sticker_hint(1400, "Quiz below ↓", True) + story_foot(True))
story("W5-Story-Sun-1", "Sun 9 AM · Poll: ready for Monday?", NIGHT,
    stack(84, 280, 900, [headline("Is Monday’s list loaded yet?", 130, PAPER), para("Or is that a Monday 9 AM problem?", 48, MIST)], 40) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))
story("W5-Story-Mon-1", "Mon 9 AM · Poll: goals set?", NIGHT,
    stack(84, 280, 900, [headline("New month. Did every rep get a goal?", 124, PAPER), para("Calls, interested, closed. Set or not yet?", 48, MIST)], 40) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))

if __name__ == "__main__":
    for b in B: print(b[0], b[1])
    print(len(B), "boards")
