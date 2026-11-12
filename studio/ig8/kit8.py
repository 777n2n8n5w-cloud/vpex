# VPEX Instagram, week 8 (Tue Nov 17 - Mon Nov 23, 2026): "Right lead, right hour". Built on the Nov 12 learn run (site-only
# while Meta blocks the app): reference posts lead (1.4 site actions per post, n=7), then offer (0.7, n=3), contrast (0.4) and
# pov (0.2); pain is 0.0 on 13 posts. So: four save-able reference carousels at 19:00 (every state's calling hours, brush-offs,
# who to call first, Thanksgiving week), a $49 offer post and a trial Reel, contrast and pov Reels, and new screens (the clock's
# time-across-the-US sheet, booking links, Floor TV, the holiday heads-up, Manual dial, handoff). Tests story, math, quote and
# feature again. Real VPEX screens from demo offices only (fictional leads, 555 numbers).
import os, importlib.util
D = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("kit4", D + "/../ig4/kit4.py"); k4 = importlib.util.module_from_spec(spec); spec.loader.exec_module(k4)
for n in ("NIGHT", "GOLD", "GOLDINK", "PAPER", "INK", "SLATE", "MIST", "ARCH", "BIGS", "UNB", "RED", "RED_D", "REEL_BG", "RULE_L", "RULE_D", "GREEN",
          "img", "at", "board", "headline", "para", "wordmark", "phone", "foot_dark", "foot_light", "zoom", "stack", "fix_label", "big", "lines", "small", "rows",
          "story_foot", "sticker_hint"):
    globals()[n] = getattr(k4, n)
LEGAL = "Based on published state rules as of November 2026. Not legal advice."
MED = "Based on the CMS final rule for 2027, as of November 2026. Not legal advice. Follow your carriers’ guidelines."
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
 "tz_pac": ("tz_0905", 16, 436, 358, 176), "tz_all": ("tz_1105", 16, 262, 358, 350), "book": ("book_sheet", 16, 255, 358, 385),
 "hol_pill": ("hol_wed", 8, 364, 374, 56), "hol_card": ("hol_thu", 16, 548, 358, 130), "rebut": ("rebut_list", 8, 330, 374, 420),
 "rebut_mail": ("rebut_mail", 8, 505, 374, 160), "smart": ("sort_smart_sheet", 8, 612, 374, 150), "late_fu": ("dial_smart_1110", 8, 236, 374, 72),
 "callback": ("callback_set", 8, 6, 374, 62),
 "ca_early": ("ca_early", 16, 250, 358, 250), "ct_late": ("ct_late", 16, 250, 358, 270), "pa_late": ("pa_late", 16, 250, 358, 270),
 "ri_late": ("ri_late", 16, 250, 358, 270), "cap_fl": ("cap_fl", 16, 250, 358, 300), "cap_md": ("cap_md", 16, 250, 358, 300),
 "cap_or": ("cap_or", 16, 250, 358, 300), "medicare": ("q_medicare", 8, 655, 374, 115), "dnc_chip": ("dnc_done", 8, 142, 374, 104),
 "noanswer": ("noanswer_text", 8, 672, 374, 164), "data": ("hub_data", 16, 222, 358, 250), "office": ("score_today", 12, 300, 366, 336),
 "held": ("team_access", 14, 142, 362, 78), "where_ct": ("ct_late", 16, 462, 358, 70),
}
def crop(key, y, s, x=None, dark=False): n, sx, sy, sw, sh = C[key]; return zoom(n, sx, sy, sw, sh, x, y, s, dark)
def checks(items, dark=False, size=44, mark="✓"):
    out = "".join('<div style="display: flex; gap: 24px; align-items: baseline; padding: 20px 0; border-top: 2px solid %s">'
                  '<span style="flex: none; width: 44px; font-family: %s; font-weight: 800; font-size: %dpx; color: %s">%s</span>'
                  '<span style="font-family: %s; font-weight: 700; font-size: %dpx; line-height: 1.15; color: %s">%s</span></div>'
                  % (RULE_D if dark else RULE_L, ARCH, size, GOLD if dark else GOLDINK, mark, ARCH, size, PAPER if dark else INK, t) for t in items)
    return '<div style="width: 904px">%s</div>' % out
def numbered(items, dark=False, size=42):
    out = "".join('<div style="display: flex; gap: 28px; align-items: baseline; padding: 22px 0; border-top: 2px solid %s">'
                  '<span style="flex: none; width: 56px; font-family: %s; font-weight: 800; font-size: %dpx; line-height: .9; color: %s">%d</span>'
                  '<span style="font-family: %s; font-weight: 700; font-size: %dpx; line-height: 1.18; color: %s">%s</span></div>'
                  % (RULE_D if dark else RULE_L, BIGS, size + 26, GOLD if dark else GOLDINK, i + 1, ARCH, size, PAPER if dark else INK, t) for i, t in enumerate(items))
    return '<div style="width: 904px">%s</div>' % out


def table(items, dark=False, size=36, lw=150):
    out = "".join('<div style="display: flex; gap: 24px; align-items: baseline; padding: 13px 0; border-top: 2px solid %s">'
                  '<span style="flex: none; width: %dpx; font-family: %s; font-weight: 800; font-size: %dpx; color: %s">%s</span>'
                  '<span style="flex: none; width: 300px; font-family: %s; font-weight: 800; font-size: %dpx; color: %s">%s</span>'
                  '<span style="font-family: %s; font-weight: 600; font-size: %dpx; color: %s">%s</span></div>'
                  % (RULE_D if dark else RULE_L, lw, ARCH, size, GOLD if dark else GOLDINK, a, ARCH, size, PAPER if dark else INK, b, ARCH, size - 6, MIST if dark else SLATE, c)
                  for a, b, c in items)
    return '<div style="width: 904px">%s</div>' % out

# ========== Reel covers (words inside the middle 1080x1350, so the grid crop keeps them) ==========
cover("W8-Cover-AR", "Reel AR cover: 9 AM. Who can you call?", lines([("9 AM.", 230, GOLD), ("WHO CAN", 140, PAPER), ("YOU CALL?", 128, RED_D)], 420, 22))
cover("W8-Cover-AS", "Reel AS cover: Just text me a time.", lines([("“JUST TEXT", 116, PAPER), ("ME A", 150, PAPER), ("TIME.”", 210, RED_D)], 420, 22))
cover("W8-Cover-AT", "Reel AT cover: Same lead. Wrong hour.", lines([("SAME LEAD.", 116, PAPER), ("WRONG", 176, RED_D), ("HOUR.", 190, RED_D)], 420, 22))
cover("W8-Cover-AU", "Reel AU cover: Friday 4 PM. Who's on the phone?", lines([("FRIDAY, 4 PM.", 104, GOLD), ("WHO’S ON", 140, PAPER), ("THE PHONE?", 118, RED_D)], 440, 24))
cover("W8-Cover-AV", "Reel AV cover: Rep POV: my closer is out today.", lines([("REP POV:", 120, GOLD), ("MY CLOSER", 122, PAPER), ("IS OUT", 170, RED_D), ("TODAY.", 170, RED_D)], 400, 20))
cover("W8-Cover-AW", "Reel AW cover: Number on a sticky note?", lines([("NUMBER ON", 118, PAPER), ("A STICKY", 146, RED_D), ("NOTE?", 210, RED_D)], 420, 22))
cover("W8-Cover-AX", "Reel AX cover: Monday. Dialing by lunch.", lines([("MONDAY.", 150, PAPER), ("DIALING", 156, GOLD), ("BY LUNCH.", 128, GOLD)], 430, 22))

# ========== Tue 19:00 carousel: every state's calling hours, one page (from STATE_HOURS in index.html) ==========
post("W8-Hours-1", "Calling hours by state (cover)", NIGHT,
    at(84, 96, headline("Calling hours, every state. One carousel.", 100, PAPER), w=920) +
    at(88, 600, para("Everywhere: 8 AM to 9 PM, the lead’s time (the federal window). 20 states on VPEX’s list are stricter. Here they are.", 46, MIST), w=880) +
    at(88, 860, checks(["Later starts and earlier ends", "No Sunday calls", "No calls on holidays"], True, 44)) + small(LEGAL, 1170, True) + foot_dark(1262, "Swipe"))
post("W8-Hours-2", "Calling hours: AL to MS", PAPER,
    kicker("Stricter states, A to M · the lead’s time") + at(84, 130, headline("Alabama to Mississippi", 76, INK), w=910) +
    at(88, 330, table([("AL", "8 AM–8 PM", "no Sundays, no holidays"), ("CT", "9 AM–8 PM", ""), ("FL", "8 AM–8 PM", "3 calls in 24 hrs"), ("KY", "10 AM–9 PM", ""),
                       ("LA", "8 AM–8 PM", "no Sundays, no holidays"), ("MA", "8 AM–8 PM", ""), ("MD", "8 AM–8 PM", "3 calls in 24 hrs"), ("MI", "9 AM–9 PM", ""),
                       ("MN", "9 AM–9 PM", ""), ("MS", "8 AM–8 PM", "no Sundays")])) + small(LEGAL, 1180, False) + foot_light(1262, "Swipe"))
post("W8-Hours-3", "Calling hours: NM to WY", PAPER,
    kicker("Stricter states, N to W · the lead’s time") + at(84, 130, headline("New Mexico to Wyoming", 76, INK), w=910) +
    at(88, 330, table([("NM", "9 AM–9 PM", ""), ("NV", "9 AM–8 PM", ""), ("OK", "8 AM–8 PM", "3 calls in 24 hrs"), ("OR", "8 AM–8 PM", "3 calls in 24 hrs"),
                       ("PA", "9 AM–7 PM", "no Sundays, no holidays"), ("RI", "9 AM–6 PM", "Sat 10–5, no Sun, no holidays"), ("SD", "9 AM–9 PM", "no Sundays"),
                       ("TX", "9 AM–9 PM", "Sundays noon–9 PM"), ("WA", "8 AM–8 PM", ""), ("WY", "8 AM–8 PM", "")])) + small(LEGAL, 1180, False) + foot_light(1262, "Swipe"))
post("W8-Hours-4", "Calling hours: VPEX checks first", PAPER,
    kicker("Nobody has to memorize it") + at(84, 130, headline("VPEX checks each lead’s state before they come up.", 84, INK), w=910) +
    crop("ct_late", 470, 1.95) +
    at(88, 1030, para("8:05 PM in Connecticut: flagged, and the rep moves on.", 36, SLATE), w=900) + demo_tag(1130) + small(LEGAL, 1180, False) + foot_light(1262, "Swipe"))
post("W8-Hours-5", "Calling hours (end)", NIGHT,
    stack(88, 110, 900, [headline("Pin it where your floor can see it.", 112, PAPER), para("Pennsylvania’s 9 AM to 7 PM started October 18, 2026.", 44, MIST)], 34) +
    at(88, 760, big("SAVE THIS", 128, GOLD, UNB)) + small(LEGAL, 1170, True) + foot_dark(1262))

# ========== Wed 19:00 carousel: brush-offs ==========
post("W8-Brush-1", "Brush-offs (cover)", NIGHT,
    at(84, 96, headline("6 brush-offs your floor hears every day.", 100, PAPER), w=920) +
    at(88, 560, numbered(["“I already have coverage.”", "“It’s too expensive.”", "“I need to think about it.”", "“Just mail me something.”", "“I’m not interested.”", "“I’ll ask my kids first.”"], True, 38)) +
    foot_dark(1262, "Swipe"))
post("W8-Brush-2", "Brush-offs: answers on screen", PAPER,
    kicker("Mid-call, one tap") + at(84, 130, headline("Every one has an answer on the rep’s screen.", 70, INK), w=910) +
    crop("rebut", 390, 1.6) + demo_tag(1100) + at(88, 1150, para("Insurance demo office. Each industry’s office has its own.", 30, SLATE), w=900) + foot_light(1262, "Swipe"))
post("W8-Brush-3", "Brush-offs: just mail me something", PAPER,
    kicker("Tap one, the answer opens") + at(84, 130, headline("“Just mail me something.”", 96, INK), w=910) +
    crop("rebut_mail", 430, 2.4) +
    at(88, 880, para("Keep the call going with two quick questions, then send what fits.", 38, SLATE), w=900) + demo_tag(1130) + foot_light(1262, "Swipe"))
post("W8-Brush-4", "Brush-offs: text me a time", PAPER,
    kicker("The seventh one") + at(84, 130, headline("“Text me a time.” Send a link.", 76, INK), w=910) +
    crop("book", 400, 1.6) + demo_tag(1100) + at(88, 1150, para("They pick a time inside their calling hours. It lands in your Tasks.", 30, SLATE), w=900) + foot_light(1262, "Swipe"))
post("W8-Brush-5", "Brush-offs (end)", NIGHT,
    stack(88, 110, 900, [headline("Your scripts and answers, your words.", 110, PAPER), para("Edit them for your floor in VPEX.", 44, MIST)], 34) +
    at(88, 740, big("SEND THIS", 112, PAPER, UNB)) + at(88, 870, big("TO YOUR MANAGER", 64, GOLD, UNB)) + foot_dark(1262))

# ========== Thu 19:00 carousel: who to call first ==========
post("W8-First-1", "Who to call first (cover)", NIGHT,
    at(84, 96, headline("Who should your reps call first?", 128, PAPER), w=920) +
    at(88, 560, numbered(["The times they picked", "Follow-ups due now", "Whoever’s likeliest to pick up right now", "Not: anyone outside their state’s hours"], True, 42)) +
    foot_dark(1262, "Swipe"))
post("W8-First-2", "Call first: the times they picked", PAPER,
    kicker("1 · The times they picked") + at(84, 130, headline("A booked time beats a cold dial.", 92, INK), w=910) +
    crop("book", 360, 1.85) + at(88, 1112, para("Booking links land in Tasks, and booked times come up first.", 32, SLATE), w=900) + demo_tag(1170) + foot_light(1262, "Swipe"))
post("W8-First-3", "Call first: follow-ups due now", PAPER,
    kicker("2 · Follow-ups due now") + at(84, 130, headline("Late follow-ups get a red button, not a sticky note.", 84, INK), w=910) +
    crop("late_fu", 470, 2.6) +
    at(88, 720, para("One tap calls them in order: times they picked first, then the leads closest to closing.", 38, SLATE), w=900) + demo_tag(1130) + foot_light(1262, "Swipe"))
post("W8-First-4", "Call first: likeliest to pick up", PAPER,
    kicker("3 · Likeliest to pick up now") + at(84, 130, headline("Sort by best time to answer.", 96, INK), w=910) +
    crop("smart", 420, 2.3) +
    at(88, 880, para("Ranked by when your own leads actually pick up, by the day and hour where they are. It re-ranks after every call.", 36, SLATE), w=900) + demo_tag(1130) + foot_light(1262, "Swipe"))
post("W8-First-5", "Who to call first (end)", NIGHT,
    stack(88, 110, 900, [headline("And skip anyone outside their state’s hours.", 100, PAPER), para("VPEX holds them until calls are allowed.", 44, MIST)], 34) +
    at(88, 760, big("SAVE THIS", 128, GOLD, UNB)) + at(88, 900, para("for tomorrow’s first dial.", 44, PAPER, "font-weight: 700")) + small(LEGAL, 1170, True) + foot_dark(1262))

# ========== Fri 19:00 post: $49, what's in it ==========
post("W8-Price", "Post: $49 a rep. What's in it?", PAPER,
    at(84, 84, headline("$49 a rep. What’s in it?", 110, INK), w=910) +
    at(88, 330, checks(["The dialer, on every rep’s own phone", "Follow-ups that schedule themselves", "Calling hours checked by state", "One shared list, no double-dials",
                        "Scoreboard, contests, Sales coach, Floor TV", "Booking links and ready-to-send texts"], False, 40)) +
    at(88, 1030, para("7 days free first, no card.", 44, GOLDINK, "font-weight: 800")) +
    at(88, 1150, para("Tap the link in our bio, then this post.", 34, SLATE, "font-weight: 600")) + foot_light(1262))

# ========== Sat 19:00 post: floor math, an example ==========
post("W8-Math", "Post: Floor math, picking who to call next", NIGHT,
    at(88, 84, para("Floor math · an example", 36, GOLD, "font-weight: 800; letter-spacing: .04em")) +
    at(84, 150, headline("15 minutes a day picking who to call next.", 92, PAPER), w=910) +
    at(70, 470, big("8 × 15 × 5", 170, PAPER)) +
    at(88, 660, big("= 10 HOURS A WEEK", 92, GOLD)) +
    at(88, 790, para("An 8-rep floor, 15 minutes each a day, 5 days: 600 minutes of not dialing.", 40, MIST), w=880) +
    at(88, 960, para("In VPEX the next lead is already up, ranked by who’s likeliest to answer.", 40, PAPER, "font-weight: 700"), w=880) +
    at(88, 1160, para("Save this for your next floor meeting.", 34, MIST, "font-weight: 600")) + foot_dark(1262))

# ========== Sun 19:00 post: callback on a sticky note vs in VPEX ==========
NOTE = ('<div style="width: 400px; height: 400px; background: #F7D96B; transform: rotate(-4deg); box-shadow: 0 30px 50px -20px rgba(0,0,0,.35); padding: 40px; box-sizing: border-box;'
        ' font-family: %s; font-weight: 700; font-size: 46px; line-height: 1.2; color: #3A3200">Call Mark back tmrw 10??<br><span style="font-size: 34px; opacity: .7">(201) 555-01…</span></div>') % ARCH
post("W8-Callback", "Post: Call me back tomorrow at 10", PAPER,
    at(84, 84, headline("“Call me back tomorrow at 10.”", 96, INK), w=910) +
    at(88, 330, para("Where does that go on your floor?", 40, SLATE, "font-weight: 600")) +
    at(96, 440, NOTE) + at(560, 520, para("On a sticky note: lost by lunch.", 40, INK, "font-weight: 800"), w=430) +
    at(88, 900, para("In VPEX: logged as a callback, on the rep’s Tasks for 10:00 AM.", 38, INK, "font-weight: 700"), w=900) +
    crop("callback", 1000, 2.4) + demo_tag(1170) + at(88, 1210, para("Send this to your manager.", 30, INK, "font-weight: 700")) + foot_light(1262))

# ========== Mon 19:00 carousel: Thanksgiving week ==========
post("W8-Thanks-1", "Thanksgiving (cover)", NIGHT,
    at(88, 84, para("Thursday, November 26", 40, GOLD, "font-weight: 700")) +
    at(84, 150, headline("Thanksgiving: no sales calls in 4 states.", 112, PAPER), w=920) +
    at(88, 660, checks(["Alabama", "Louisiana", "Pennsylvania", "Rhode Island"], True, 48)) +
    small(LEGAL, 1170, True) + foot_dark(1262, "Swipe"))
post("W8-Thanks-2", "Thanksgiving: Wednesday heads-up", PAPER,
    kicker("Wednesday · the day before") + at(84, 130, headline("VPEX tells you first.", 100, INK), w=910) +
    crop("hol_pill", 400, 2.4) +
    at(88, 640, para("A heads-up on the Dial tab: call your leads in those states today, while you still can.", 40, SLATE), w=900) + demo_tag(1130) + small(LEGAL, 1180, False) + foot_light(1262, "Swipe"))
post("W8-Thanks-3", "Thanksgiving: Thursday hold", PAPER,
    kicker("Thursday · Thanksgiving") + at(84, 130, headline("Those leads are held all day.", 96, INK), w=910) +
    crop("hol_card", 400, 2.4) +
    at(88, 900, para("Pennsylvania lead, 10:05 AM: “holiday, no sales calls in PA today.” They open again Friday.", 36, SLATE), w=900) + demo_tag(1130) + small(LEGAL, 1180, False) + foot_light(1262, "Swipe"))
post("W8-Thanks-4", "Thanksgiving: Friday", PAPER,
    kicker("Friday · the day after") + at(84, 130, headline("Friday: back to the usual hours.", 96, INK), w=910) +
    at(88, 400, para("Black Friday isn’t a federal holiday, so VPEX uses each state’s usual hours:", 40, SLATE, "font-weight: 600"), w=900) +
    at(88, 580, table([("PA", "9 AM–7 PM", ""), ("RI", "9 AM–6 PM", ""), ("AL, LA", "8 AM–8 PM", ""), ("Others", "8 AM–9 PM", "")], False, 40, 230)) +
    small(LEGAL, 1180, False) + foot_light(1262, "Swipe"))
post("W8-Thanks-5", "Thanksgiving (end)", NIGHT,
    stack(88, 110, 900, [headline("Calling those states this week?", 110, PAPER), para("Keep this for Wednesday’s huddle.", 44, MIST)], 34) +
    at(88, 760, big("SAVE THIS", 128, GOLD, UNB)) + small(LEGAL, 1170, True) + foot_dark(1262))

# ========== stories (1080x1920). 9 AM ones carry a sticker added by hand (the bot reminds Vincent). ==========
story("W8-Story-Tue-1", "Tue 9 AM · Quiz: 9 AM Eastern in Denver", NIGHT,
    stack(84, 280, 900, [headline("It’s 9 AM in New York. What time is it in Denver?", 112, PAPER)], 40) +
    sticker_hint(1400, "Quiz below ↓", True) + story_foot(True))
story("W8-Story-Wed-1", "Wed 9 AM · Question: the brush-off you hear most", NIGHT,
    stack(84, 280, 900, [headline("The brush-off your reps hear most?", 124, PAPER), para("We’ll answer the best ones.", 48, MIST)], 40) +
    sticker_hint(1400, "Answer below ↓", True) + story_foot(True))
story("W8-Story-Thu-1", "Thu 9 AM · Poll: when do your leads pick up?", NIGHT,
    stack(84, 280, 900, [headline("When do your leads pick up most?", 124, PAPER), para("Their time, not yours.", 48, MIST)], 40) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))
story("W8-Story-Fri-1", "Fri 9 AM · Poll: a TV on your floor's wall?", NIGHT,
    stack(84, 280, 900, [headline("Is there a scoreboard on your floor’s wall?", 116, PAPER)], 40) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))
story("W8-Story-Sat-1", "Sat 9 AM · Quiz: Saturday hours in Rhode Island", NIGHT,
    stack(84, 280, 900, [headline("Saturday calling hours in Rhode Island?", 120, PAPER), para("The lead’s time.", 48, MIST)], 40) +
    sticker_hint(1400, "Quiz below ↓", True) + story_foot(True))
story("W8-Story-Sun-1", "Sun 9 AM · Slider: ready for Thanksgiving week?", NIGHT,
    stack(84, 280, 900, [headline("How ready is your floor for Thanksgiving week?", 112, PAPER), para("Slide it.", 48, MIST)], 40) +
    sticker_hint(1400, "Slide below ↓", True) + story_foot(True))
story("W8-Story-Mon-1", "Mon 9 AM · Poll: dialing Black Friday?", NIGHT,
    stack(84, 280, 900, [headline("Is your floor dialing on Black Friday?", 124, PAPER)], 40) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))

if __name__ == "__main__":
    for b in B: print(b[0], b[1])
    print(len(B), "boards")
