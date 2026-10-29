# VPEX Instagram, week 6 (Tue Nov 3 - Mon Nov 9, 2026): "The rules your floor runs on". Built on the Oct 29 learn run
# (site-only while Meta blocks the app): calling-hours references, carousels, "Save this" and the 19:00 slot brought the
# site visits and demos, and on Instagram (Oct 21) "Two reps. One lead.", the manager's-eye Reel and "Built for" carousels
# led. So: calling hours three ways (8:15 AM in Connecticut, Sunday rules, Veterans Day), the follow-up rules, Built for
# solar, a Two-reps Reel, and new manager screens (Contest, Team scoreboard office vs remote, Call pacing, Add leads),
# plus one untested hook (myth).
# Real VPEX screens from demo offices only (fictional leads, 555 numbers). Same tokens and helpers as weeks 3-4.
import os, importlib.util
D = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("kit4", D + "/../ig4/kit4.py"); k4 = importlib.util.module_from_spec(spec); spec.loader.exec_module(k4)
for n in ("NIGHT", "GOLD", "GOLDINK", "PAPER", "INK", "SLATE", "MIST", "ARCH", "BIGS", "UNB", "RED", "RED_D", "REEL_BG", "RULE_L", "RULE_D", "GREEN",
          "img", "at", "board", "headline", "para", "wordmark", "phone", "foot_dark", "foot_light", "zoom", "stack", "fix_label", "big", "lines", "small", "rows",
          "story_foot", "sticker_hint"):
    globals()[n] = getattr(k4, n)
LEGAL = "Based on published state rules as of November 2026. Not legal advice."
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
 "qf_solar": ("qf_solar", 0, 145, 390, 362), "roof": ("rebut_roof", 8, 456, 374, 128), "roi_solar": ("roi_solar", 8, 532, 374, 272),
 "office": ("score_today", 12, 300, 366, 336), "ct_early": ("ct_early", 16, 400, 358, 128), "ri_sun": ("ri_sunday", 16, 400, 358, 128),
 "tx_sun": ("tx_sunday_am", 16, 400, 358, 128), "al_hol": ("al_holiday", 16, 442, 358, 128),
 "fu_noans": ("follow_rules", 8, 330, 374, 120), "fu_stuck": ("follow_rules", 8, 450, 374, 136), "fu_order": ("follow_rules", 8, 586, 374, 164),
}
def crop(key, y, s, x=None, dark=False): n, sx, sy, sw, sh = C[key]; return zoom(n, sx, sy, sw, sh, x, y, s, dark)
def checks(items, dark=False, size=44, mark="✓"):
    out = "".join('<div style="display: flex; gap: 24px; align-items: baseline; padding: 20px 0; border-top: 2px solid %s">'
                  '<span style="flex: none; width: 44px; font-family: %s; font-weight: 800; font-size: %dpx; color: %s">%s</span>'
                  '<span style="font-family: %s; font-weight: 700; font-size: %dpx; line-height: 1.15; color: %s">%s</span></div>'
                  % (RULE_D if dark else RULE_L, ARCH, size, GOLD if dark else GOLDINK, mark, ARCH, size, PAPER if dark else INK, t) for t in items)
    return '<div style="width: 904px">%s</div>' % out
def struck_line(text, size=70, dark=True):
    return ('<span style="position: relative; display: inline; font-family: %s; font-weight: 800; font-stretch: 108%%; font-size: %dpx; line-height: 1.12; letter-spacing: -0.02em; color: %s;'
            ' text-decoration: line-through; text-decoration-color: %s; text-decoration-thickness: 9px">%s</span>' % (ARCH, size, "#8A93B8" if dark else SLATE, RED_D if dark else RED, text))

# ========== Reel covers (words inside the middle 1080x1350, so the grid crop keeps them) ==========
cover("W6-Cover-AD", "Reel AD cover: Slow Tuesday? Start a contest.", lines([("SLOW", 190, PAPER), ("TUESDAY?", 150, RED_D), ("START A CONTEST.", 76, GOLD)], 450, 24))
cover("W6-Cover-AE", "Reel AE cover: 8:15 AM. Can you call Connecticut?", at(0, 380, '<div style="width: 1080px; text-align: center; font-family: %s; font-weight: 800; font-size: 330px; line-height: 0.85; color: %s">8:15<span style="font-size: 120px; margin-left: 16px">AM</span></div>' % (BIGS, GOLD)) +
      lines([("CAN YOU CALL", 96, PAPER), ("CONNECTICUT?", 100, RED_D)], 720, 18))
cover("W6-Cover-AF", "Reel AF cover: Who's winning today?", lines([("WHO’S", 170, PAPER), ("WINNING", 150, GOLD), ("TODAY?", 170, PAPER)], 450, 22))
cover("W6-Cover-AG", "Reel AG cover: Two reps. One lead.", lines([("TWO REPS.", 150, PAPER), ("ONE LEAD.", 150, RED_D), ("SAME AFTERNOON.", 76, MIST)], 460, 24))
cover("W6-Cover-AH", "Reel AH cover: Your number got flagged. Again.", lines([("YOUR NUMBER", 104, PAPER), ("GOT FLAGGED.", 102, RED_D), ("AGAIN.", 170, RED_D)], 450, 22))
cover("W6-Cover-AI", "Reel AI cover: Your best rep quit.", lines([("YOUR", 150, PAPER), ("BEST REP", 150, PAPER), ("QUIT.", 210, RED_D)], 430, 22))
cover("W6-Cover-AJ", "Reel AJ cover: Monday's list came in a mess", lines([("MONDAY’S LIST", 96, PAPER), ("CAME IN", 150, PAPER), ("A MESS.", 160, RED_D)], 450, 22))

# ========== Tue 19:00 carousel: Built for solar floors ==========
post("W6-Solar-1", "Built for solar floors (cover)", NIGHT,
    at(84, 96, headline("Built for solar floors.", 150, PAPER), w=920) +
    at(88, 560, para("Homeowners, roofs and utility bills. Same dialer, your floor’s words.", 46, MIST), w=880) +
    at(88, 820, checks(["Qualify while you talk", "“My roof is old.” Answered", "Which lists sign homeowners"], True, 44)) + foot_dark(1262, "Swipe"))
post("W6-Solar-2", "Solar: qualify while you talk", PAPER,
    kicker("1 of 3 · Qualify") + at(84, 130, headline("Owns the home? Roof age? Bill? Tap it mid-call.", 80, INK), w=910) +
    crop("qf_solar", 400, 1.9) + foot_light(1262, "Swipe"))
post("W6-Solar-3", "Solar: My roof is old", PAPER,
    kicker("2 of 3 · Objections") + at(84, 130, headline("“My roof is old.” The answer is one tap away.", 84, INK), w=910) +
    crop("roof", 470, 2.45) +
    at(88, 820, para("Rebuttals open from the Dial screen, mid-call. You write them once; every rep’s app updates.", 36, SLATE), w=880) + demo_tag(1170) + foot_light(1262, "Swipe"))
post("W6-Solar-4", "Solar: which lists sign homeowners", PAPER,
    kicker("3 of 3 · Your lists") + at(84, 130, headline("Door knocks or web leads: which sign homeowners?", 80, INK), w=910) +
    crop("roi_solar", 430, 2.25) + demo_tag(1170) + foot_light(1262, "Swipe"))
post("W6-Solar-5", "Built for solar floors (end)", NIGHT,
    stack(88, 110, 900, [headline("Run a solar floor?", 110, PAPER), para("There’s a live solar demo office with sample homeowners. No sign-up. Or send this to whoever runs yours.", 42, MIST)], 34) +
    at(88, 760, big("SEND THIS", 112, PAPER, UNB)) + at(88, 890, big("TO YOUR MANAGER", 76, GOLD, UNB)) + foot_dark(1262))

# ========== Wed 11:00 post: In office vs remote ==========
post("W6-Office", "Post: In office vs. remote. Same numbers?", PAPER,
    at(84, 84, headline("In office vs. remote. Same numbers?", 84, INK), w=910) +
    at(88, 300, para("The Team scoreboard puts them side by side, per rep, every day.", 38, SLATE, "font-weight: 600"), w=880) +
    crop("office", 420, 1.95) + demo_tag(1130) + at(88, 1180, para("Send this to your manager.", 34, INK, "font-weight: 700")) + foot_light(1262))

# ========== Thu 19:00 carousel: follow-up rules ==========
post("W6-Rules-1", "Follow-up rules (cover)", NIGHT,
    at(84, 96, headline("How many times do you call a lead who never answers?", 112, PAPER), w=920) +
    at(88, 820, para("Most floors never decide. So every rep decides differently.", 44, MIST), w=880) + foot_dark(1262, "Swipe"))
post("W6-Rules-2", "Follow-up rules: no answer", PAPER,
    kicker("1 of 3 · No answer") + at(84, 130, headline("4 tries over 4 business days. Then it rests.", 88, INK), w=910) +
    crop("fu_noans", 500, 2.4) +
    at(88, 860, para("It comes back in 60–90 days. Pick 3, 4, 6 or 10 tries for your floor.", 38, SLATE), w=880) + foot_light(1262, "Swipe"))
post("W6-Rules-3", "Follow-up rules: interested but stuck", PAPER,
    kicker("2 of 3 · Interested, but stuck") + at(84, 130, headline("3 follow-ups and no stage change? It’s parked.", 86, INK), w=910) +
    crop("fu_stuck", 480, 2.4) +
    at(88, 860, para("Reps move on to leads that are moving. A parked lead waits in Pipeline with a Revive button.", 38, SLATE), w=880) + foot_light(1262, "Swipe"))
post("W6-Rules-4", "Follow-up rules: who comes first", PAPER,
    kicker("3 of 3 · Who comes first") + at(84, 130, headline("Closest to closing comes up first.", 92, INK), w=910) +
    crop("fu_order", 420, 2.3) +
    at(88, 840, para("A callback time the lead asked for is always kept, and comes up first.", 38, SLATE), w=880) + foot_light(1262, "Swipe"))
post("W6-Rules-5", "Follow-up rules (end)", NIGHT,
    stack(88, 110, 900, [headline("Set it once. It applies to every rep.", 100, PAPER), para("In VPEX: Admin controls, then Calling rules.", 42, MIST)], 34) +
    at(88, 800, big("SAVE THIS", 128, GOLD, UNB)) + at(88, 940, para("for your next team meeting.", 44, PAPER, "font-weight: 700")) + foot_dark(1262))

# ========== Fri 11:00 post: Myth ==========
post("W6-Myth", "Post: Myth: you need desks, headsets and an IT guy", NIGHT,
    at(88, 84, para("MYTH", 40, RED_D, "font-weight: 800; letter-spacing: .12em")) +
    at(88, 150, '<div style="width: 900px">%s</div>' % struck_line("A power dialer needs desks, headsets and an IT guy.", 74)) +
    at(88, 560, para("FACT", 40, GOLD, "font-weight: 800; letter-spacing: .12em")) +
    at(88, 620, checks(["Reps dial from their own phones.", "You run the floor from yours.", "A free trial takes two minutes. No card."], True, 46)) +
    at(88, 1110, para("Comment DEMO and we’ll send you a live demo office.", 36, MIST, "font-weight: 600"), w=880) + foot_dark(1262))

# ========== Sat 19:00 carousel: Sunday calling rules ==========
post("W6-Sunday-1", "Sunday calls (cover)", NIGHT,
    at(84, 96, headline("Calling leads tomorrow?", 120, PAPER), w=920) +
    at(70, 420, big("SUNDAY", 300, GOLD)) +
    at(88, 720, para("Six states on VPEX’s list allow no sales calls at all. Texas says wait until noon.", 48, MIST), w=880) +
    small(LEGAL, 1170, True) + foot_dark(1262, "Swipe"))
post("W6-Sunday-2", "Sunday: no sales calls", PAPER,
    kicker("No sales calls on Sundays") + at(84, 130, headline("Six states. The lead’s state, not yours.", 84, INK), w=910) +
    at(88, 400, rows([("Alabama", "No Sunday calls"), ("Louisiana", "No Sunday calls"), ("Mississippi", "No Sunday calls"), ("Pennsylvania", "No Sunday calls"),
                      ("Rhode Island", "No Sunday calls"), ("South Dakota", "No Sunday calls")], False, 42, 380)) +
    small(LEGAL, 1170, False) + foot_light(1262, "Swipe"))
post("W6-Sunday-3", "Sunday: Texas, noon to 9", PAPER,
    kicker("Texas") + at(84, 130, headline("Sundays: noon to 9 PM, their time.", 96, INK), w=910) +
    crop("tx_sun", 520, 2.4) +
    at(88, 900, para("A 10 AM Sunday call to a Texas lead gets flagged. Weekdays in Texas: 9 AM to 9 PM.", 38, SLATE), w=880) + demo_tag(1130) + small(LEGAL, 1180, False) + foot_light(1262, "Swipe"))
post("W6-Sunday-4", "Sunday: VPEX checks first", PAPER,
    kicker("Before anyone dials") + at(84, 130, headline("VPEX checks the lead’s state first.", 96, INK), w=910) +
    crop("ri_sun", 520, 2.4) +
    at(88, 900, para("Every lead shows its local time and that state’s calling hours, Sundays and holidays included.", 38, SLATE), w=880) + demo_tag(1130) + small(LEGAL, 1180, False) + foot_light(1262, "Swipe"))
post("W6-Sunday-5", "Sunday (end)", NIGHT,
    stack(88, 110, 900, [headline("Calling on weekends?", 110, PAPER), para("Keep this where your reps can find it on Sunday morning.", 44, MIST)], 34) +
    at(88, 760, big("SAVE THIS", 128, GOLD, UNB)) + small(LEGAL, 1170, True) + foot_dark(1262))

# ========== Sun 11:00 post: what's in the trial ==========
post("W6-Trial", "Post: Day one of the free trial", PAPER,
    at(84, 84, headline("Day one of your free trial.", 104, INK), w=910) +
    at(88, 360, checks(["The Dial screen, with your script and rebuttals", "Calling hours checked for every lead’s state", "Your own Do Not Call list, team-wide",
                        "Team scoreboard and Sales coach", "Contests on every rep’s screen"], False, 42)) +
    at(88, 1070, para("7 days free, no card. Then $49 per rep per month.", 36, INK, "font-weight: 700"), w=910) +
    at(88, 1160, para("Tap the link in our bio, then this post.", 34, SLATE, "font-weight: 600")) + foot_light(1262))

# ========== Mon 19:00 post: Veterans Day ==========
post("W6-Vets", "Post: Wednesday is Veterans Day. 3 states: no sales calls.", NIGHT,
    at(88, 84, para("Wednesday, November 11", 40, GOLD, "font-weight: 700")) +
    at(84, 150, headline("Veterans Day. No sales calls in 3 states.", 104, PAPER), w=910) +
    at(88, 470, rows([("Alabama", "No sales calls on legal holidays"), ("Louisiana", "No sales calls on legal holidays"), ("Rhode Island", "No sales calls on legal holidays")], True, 38, 300)) +
    crop("al_hol", 830, 2.3, None, True) +
    small("Demo office. " + LEGAL, 1170, True) + foot_dark(1262))

# ========== stories (1080x1920). 9 AM ones carry a sticker added by hand (the bot reminds Vincent). ==========
story("W6-Story-Tue-1", "Tue 9 AM · Poll: contest this week?", NIGHT,
    stack(84, 280, 900, [headline("Is your floor running a contest this week?", 116, PAPER), para("Even a lunch counts.", 48, MIST)], 40) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))
story("W6-Story-Wed-1", "Wed 9 AM · Quiz: 8:15 AM in Connecticut", NIGHT,
    stack(84, 280, 900, [headline("8:15 AM in Connecticut. OK to make a sales call?", 110, PAPER), para("The lead’s time, not yours.", 48, MIST)], 40) +
    sticker_hint(1400, "Quiz below ↓", True) + story_foot(True))
story("W6-Story-Thu-1", "Thu 9 AM · Question: first number you check", NIGHT,
    stack(84, 280, 900, [headline("What’s the first number you check every morning?", 112, PAPER), para("Calls? Conversations? Dollars?", 48, MIST)], 40) +
    sticker_hint(1400, "Answer below ↓", True) + story_foot(True))
story("W6-Story-Fri-1", "Fri 9 AM · Poll: where do your reps dial from?", NIGHT,
    stack(84, 280, 900, [headline("Where do your reps dial from?", 130, PAPER), para("Office, home, or both.", 48, MIST)], 40) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))
story("W6-Story-Sat-1", "Sat 9 AM · Quiz: Sunday calls after noon", NIGHT,
    stack(84, 280, 900, [headline("Sunday sales calls are OK after noon in which state?", 110, PAPER)], 40) +
    sticker_hint(1400, "Quiz below ↓", True) + story_foot(True))
story("W6-Story-Sun-1", "Sun 9 AM · Slider: Monday's list ready?", NIGHT,
    stack(84, 280, 900, [headline("How ready is Monday’s list?", 130, PAPER), para("Slide it. Be honest.", 48, MIST)], 40) +
    sticker_hint(1400, "Slide below ↓", True) + story_foot(True))
story("W6-Story-Mon-1", "Mon 9 AM · Quiz: Veterans Day states", NIGHT,
    stack(84, 280, 900, [headline("Wednesday is Veterans Day. How many states on our list have no sales calls on holidays?", 96, PAPER)], 40) +
    sticker_hint(1400, "Quiz below ↓", True) + story_foot(True))

if __name__ == "__main__":
    for b in B: print(b[0], b[1])
    print(len(B), "boards")
