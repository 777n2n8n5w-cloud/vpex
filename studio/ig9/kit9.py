# VPEX Instagram, week 9 (Tue Nov 24 - Mon Nov 30, 2026): "Before December". Built on the Nov 19 learn run (site-only while
# Meta blocks the app; 73 posts, 16 site actions, still under the 20 needed for a verdict): calling-hours is the topic with the
# most site actions per post (0.8, n=14), carousels lead formats (0.6 vs image 0.2, reel 0.1), "Save this" leads calls to action
# (0.6, n=14) and 19:00 beats 11:00 (0.3 vs 0.1); "Comment DEMO" is 0.0 on 25 posts. So: calling hours four new ways (Kentucky's
# 10 AM start, Saturday in Rhode Island, Sunday rules, December's two Friday holidays), reference carousels at 19:00, save on 5,
# comment on 2. New screens: call back In 30/60/90 days, a dialed call needs its real outcome, follow-up tries then rest, the
# no-answer text, the real estate script and rebuttals. Real VPEX screens from demo offices only (fictional leads, 555 numbers).
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
 "cb_later": ("cb_sheet", 8, 100, 374, 300), "ky_early": ("ky_0930", 16, 250, 358, 250), "ky_open": ("ky_1002", 16, 440, 358, 130),
 "ri_sat": ("ri_sat0930", 16, 270, 358, 240), "sun_pa": ("sun_pa", 16, 460, 358, 215), "sun_tx": ("sun_tx", 16, 460, 358, 215),
 "sun_tx1": ("sun_tx1", 16, 440, 358, 130), "xmas_pill": ("xmas_thu", 8, 190, 374, 62), "xmas_card": ("xmas_fri", 16, 385, 358, 178),
 "late": ("mon_dial", 8, 120, 374, 250), "tries": ("fu_rules", 8, 330, 374, 118), "office": ("score_new", 12, 300, 366, 340),
 "na_text": ("na_after", 8, 690, 374, 150), "outcomes": ("pad_toast", 16, 650, 358, 192), "re_script": ("re_script", 8, 140, 374, 400),
 "re_rebut": ("re_rebut", 8, 340, 374, 330), "re_card": ("re_dial", 16, 480, 358, 268),
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

#BOARDS
# ========== Reel covers (words inside the middle 1080x1350, so the grid crop keeps them) ==========
cover("W9-Cover-AY", "Reel AY cover: Call me after the holidays.", lines([("“CALL ME", 140, PAPER), ("AFTER THE", 124, PAPER), ("HOLIDAYS.”", 118, RED_D)], 420, 22))
cover("W9-Cover-AZ", "Reel AZ cover: 9:30 in Kentucky? Too early.", lines([("9:30 IN", 170, PAPER), ("KENTUCKY?", 116, GOLD), ("TOO EARLY.", 112, RED_D)], 420, 22))
cover("W9-Cover-BA", "Reel BA cover: What your floor is thankful for", lines([("WHAT YOUR", 116, PAPER), ("FLOOR IS", 140, PAPER), ("THANKFUL", 126, GOLD), ("FOR", 170, GOLD)], 380, 20))
cover("W9-Cover-BB", "Reel BB cover: No Black Friday sale.", lines([("NO BLACK", 150, PAPER), ("FRIDAY", 176, RED_D), ("SALE.", 200, PAPER)], 420, 22))
cover("W9-Cover-BC", "Reel BC cover: Saturday, 9:30 AM. Who can you call?", lines([("SATURDAY,", 112, GOLD), ("9:30 AM.", 156, PAPER), ("WHO CAN", 120, PAPER), ("YOU CALL?", 110, RED_D)], 380, 20))
cover("W9-Cover-BD", "Reel BD cover: Sunday. Who can you call?", lines([("SUNDAY.", 168, GOLD), ("WHO CAN", 140, PAPER), ("YOU CALL?", 128, RED_D)], 420, 22))
cover("W9-Cover-BE", "Reel BE cover: Monday after Thanksgiving. Follow-ups first.", lines([("MONDAY.", 150, PAPER), ("FOLLOW-UPS", 110, GOLD), ("FIRST.", 190, GOLD)], 420, 22))

# ========== Tue 19:00 carousel: Built for real estate floors ==========
post("W9-RE-1", "Built for real estate floors (cover)", NIGHT,
    at(88, 84, para("Built for your floor · Real estate", 36, GOLD, "font-weight: 800; letter-spacing: .04em")) +
    at(84, 150, headline("A power dialer for real estate agents calling expireds and FSBOs.", 92, PAPER), w=920) +
    at(88, 700, checks(["A script that opens on the listing", "Answers to the brush-offs agents hear", "Every lead in their own state’s hours"], True, 44)) +
    foot_dark(1262, "Swipe"))
post("W9-RE-2", "Real estate: the script", PAPER,
    kicker("1 · The script, your words") + at(84, 130, headline("“I saw your home was listed for sale.”", 76, INK), w=910) +
    crop("re_script", 350, 1.65) + demo_tag(1130) + at(88, 1170, para("Real estate demo office. Admins edit it; every rep’s app updates.", 30, SLATE), w=900) + foot_light(1262, "Swipe"))
post("W9-RE-3", "Real estate: the brush-offs", PAPER,
    kicker("2 · Answers mid-call, one tap") + at(84, 130, headline("“Your commission is too high.”", 84, INK), w=910) +
    crop("re_rebut", 360, 1.9) + demo_tag(1030) + at(88, 1080, para("Six real estate brush-offs, each with an answer that opens on tap.", 34, SLATE), w=900) + foot_light(1262, "Swipe"))
post("W9-RE-4", "Real estate: the lead card", PAPER,
    kicker("3 · Notes and the right hour") + at(84, 130, headline("Every seller’s story, and when they pick up.", 84, INK), w=910) +
    crop("re_card", 420, 2.0) + demo_tag(1100) + at(88, 1150, para("Their local time and best hour to call, on every lead.", 30, SLATE), w=900) + foot_light(1262, "Swipe"))
post("W9-RE-5", "Built for real estate (end)", NIGHT,
    stack(88, 110, 900, [headline("Open the real estate demo office.", 110, PAPER), para("No sign-up. Sample sellers, real VPEX.", 44, MIST)], 34) +
    at(88, 740, big("SEND THIS", 112, PAPER, UNB)) + at(88, 870, big("TO YOUR TEAM LEAD", 60, GOLD, UNB)) + foot_dark(1262))

# ========== Wed 19:00 post: calls today should mean calls ==========
post("W9-Honest", "Post: 212 calls today. Were they all calls?", NIGHT,
    at(88, 84, para("Manager view", 36, GOLD, "font-weight: 800; letter-spacing: .04em")) +
    at(84, 150, headline("“212 calls today.” Were they all calls?", 96, PAPER), w=910) +
    at(88, 470, para("In VPEX a dialed call needs its real outcome before the rep moves on. Skip doesn’t log anything, so Call + Skip can’t pad the count.", 40, MIST), w=890) +
    crop("outcomes", 700, 2.3, dark=True) +
    at(88, 1160, para("Tap the link in our bio, then this post.", 34, PAPER, "font-weight: 700")) + foot_dark(1262))

# ========== Thu 19:00 post: remote reps, one scoreboard ==========
post("W9-Remote", "Post: Half your floor dials from home?", PAPER,
    at(84, 84, headline("Half your floor dials from home?", 104, INK), w=910) +
    at(88, 380, para("Same scoreboard. In office and remote, side by side, per rep.", 40, SLATE, "font-weight: 600"), w=900) +
    crop("office", 500, 1.75) + demo_tag(1150) +
    at(88, 1195, para("Comment DEMO and we’ll send you a live demo office.", 30, INK, "font-weight: 700")) + foot_light(1262))

# ========== Fri 19:00 carousel: no answer, your next 3 moves ==========
post("W9-Next-1", "No answer: your next 3 moves (cover)", NIGHT,
    at(84, 96, headline("No answer. Now what?", 128, PAPER), w=920) +
    at(88, 480, numbered(["Text them before the next dial", "Try again on a schedule, not a whim", "Let them rest, then bring them back"], True, 46)) +
    foot_dark(1262, "Swipe"))
post("W9-Next-2", "No answer: text them", PAPER,
    kicker("1 · Before the next dial") + at(84, 130, headline("One tap: a quick text, ready to send.", 84, INK), w=910) +
    crop("na_text", 470, 2.4) +
    at(88, 900, para("Log No answer and VPEX offers the text, written with the rep’s name and your company.", 38, SLATE), w=900) + demo_tag(1130) + foot_light(1262, "Swipe"))
post("W9-Next-3", "No answer: tries on a schedule", PAPER,
    kicker("2 · Tries on a schedule") + at(84, 130, headline("You set the tries. VPEX spaces them.", 84, INK), w=910) +
    crop("tries", 470, 2.4) +
    at(88, 860, para("Example setting: 4 tries over 4 business days, each one inside the lead’s calling hours.", 38, SLATE), w=900) + demo_tag(1130) + foot_light(1262, "Swipe"))
post("W9-Next-4", "No answer: rest, then back", PAPER,
    kicker("3 · Rest, then back") + at(84, 130, headline("Not dead. Resting.", 110, INK), w=910) +
    at(88, 420, para("After the last try, the lead rests and comes back in 60–90 days for a fresh try. Nobody has to remember it.", 46, INK, "font-weight: 700"), w=900) +
    at(88, 760, para("Fresh leads keep coming up in the meantime.", 40, SLATE), w=900) + foot_light(1262, "Swipe"))
post("W9-Next-5", "No answer (end)", NIGHT,
    stack(88, 110, 900, [headline("Text. Retry. Rest. Return.", 110, PAPER), para("Your no-answers, handled the same way on every rep’s phone.", 44, MIST)], 34) +
    at(88, 760, big("SAVE THIS", 128, GOLD, UNB)) + foot_dark(1262))

# ========== Sat 19:00 post: floor math, January callbacks (an example) ==========
post("W9-Math", "Post: Floor math, January callbacks", NIGHT,
    at(88, 84, para("Floor math · an example", 36, GOLD, "font-weight: 800; letter-spacing: .04em")) +
    at(84, 150, headline("“Call me after the holidays.”", 92, PAPER), w=910) +
    at(70, 420, big("10 × 4 × 5", 170, PAPER)) +
    at(88, 610, big("= 200 CALLBACKS", 92, GOLD)) +
    at(88, 740, para("A 10-rep floor, 4 of those a rep a week, 5 weeks to New Year’s: 200 callbacks due in January.", 40, MIST), w=880) +
    at(88, 930, para("On sticky notes? In VPEX: one tap, In 30, 60 or 90 days, on the right rep’s Tasks.", 40, PAPER, "font-weight: 700"), w=880) +
    at(88, 1160, para("Save this for your next floor meeting.", 34, MIST, "font-weight: 600")) + foot_dark(1262))

# ========== Sun 19:00 post: $49 a rep, every day ==========
post("W9-Price", "Post: No Black Friday sale. $49 a rep, every day.", PAPER,
    at(84, 84, headline("No Black Friday sale. No Cyber Monday sale.", 84, INK), w=910) +
    at(70, 440, big("$49", 250, GOLDINK)) + at(88, 680, para("a rep a month. Every day of the year.", 48, INK, "font-weight: 800"), w=900) +
    at(88, 800, checks(["7 days free first, no card", "Your list goes in as is", "Cancel any time"], False, 42)) +
    at(88, 1160, para("Tap the link in our bio, then this post.", 34, SLATE, "font-weight: 600")) + foot_light(1262))

# ========== Mon 19:00 carousel: December calling calendar ==========
post("W9-Dec-1", "December calling days (cover)", NIGHT,
    at(88, 84, para("December 2026 · the lead’s state", 40, GOLD, "font-weight: 700")) +
    at(84, 150, headline("Two Friday holidays. Four states say no calls.", 104, PAPER), w=920) +
    at(88, 680, table([("Fri", "Dec 25", "Christmas Day"), ("Fri", "Jan 1", "New Year’s Day")], True, 44, 120)) +
    at(88, 900, para("No sales calls those days in Alabama, Louisiana, Pennsylvania and Rhode Island.", 40, MIST), w=880) +
    small(LEGAL, 1170, True) + foot_dark(1262, "Swipe"))
post("W9-Dec-2", "December: Thursday heads-up", PAPER,
    kicker("Thursday, Dec 24 · the day before") + at(84, 130, headline("VPEX tells you Thursday.", 100, INK), w=910) +
    crop("xmas_pill", 420, 2.4) +
    at(88, 640, para("A heads-up on the Dial tab: call your leads in those states today, while you still can. Same on Thursday, Dec 31.", 40, SLATE), w=900) + demo_tag(1130) + small(LEGAL, 1180, False) + foot_light(1262, "Swipe"))
post("W9-Dec-3", "December: Friday hold", PAPER,
    kicker("Friday, Dec 25 · Christmas Day") + at(84, 130, headline("Those leads are held all day.", 96, INK), w=910) +
    crop("xmas_card", 380, 2.3) +
    at(88, 900, para("Pennsylvania lead, 10:05 AM: “holiday, no sales calls in PA today.”", 36, SLATE), w=900) + demo_tag(1130) + small(LEGAL, 1180, False) + foot_light(1262, "Swipe"))
post("W9-Dec-4", "December: Sundays too", PAPER,
    kicker("And every Sunday") + at(84, 130, headline("Sundays: six states, no sales calls.", 92, INK), w=910) +
    at(88, 420, table([("AL", "No Sundays", ""), ("LA", "No Sundays", ""), ("MS", "No Sundays", ""), ("PA", "No Sundays", ""), ("RI", "No Sundays", ""), ("SD", "No Sundays", ""), ("TX", "Noon–9 PM", "on Sundays")], False, 40, 120)) +
    small(LEGAL, 1180, False) + foot_light(1262, "Swipe"))
post("W9-Dec-5", "December (end)", NIGHT,
    stack(88, 110, 900, [headline("Plan December’s calling days now.", 110, PAPER), para("Keep this for your December huddles.", 44, MIST)], 34) +
    at(88, 760, big("SAVE THIS", 128, GOLD, UNB)) + small(LEGAL, 1170, True) + foot_dark(1262))

# ========== stories (1080x1920). 9 AM ones carry a sticker added by hand (the bot reminds Vincent). ==========
story("W9-Story-Tue-1", "Tue 9 AM · Poll: call me after the holidays", NIGHT,
    stack(84, 280, 900, [headline("“Call me after the holidays.” Does it get a date on your floor?", 104, PAPER)], 40) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))
story("W9-Story-Wed-1", "Wed 9 AM · Quiz: Kentucky's calling hours", NIGHT,
    stack(84, 280, 900, [headline("Kentucky’s calling hours start at…", 124, PAPER), para("The lead’s time.", 48, MIST)], 40) +
    sticker_hint(1400, "Quiz below ↓", True) + story_foot(True))
story("W9-Story-Thu-1", "Thu 9 AM · Question: what's your floor thankful for?", NIGHT,
    stack(84, 280, 900, [headline("Happy Thanksgiving. What’s your floor thankful for?", 112, PAPER), para("We’ll share the best ones.", 48, MIST)], 40) +
    sticker_hint(1400, "Answer below ↓", True) + story_foot(True))
story("W9-Story-Fri-1", "Fri 9 AM · Poll: dialing today?", NIGHT,
    stack(84, 280, 900, [headline("Black Friday. Is your floor dialing today?", 124, PAPER)], 40) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))
story("W9-Story-Sat-1", "Sat 9 AM · Quiz: Rhode Island at 9:30 Saturday", NIGHT,
    stack(84, 280, 900, [headline("Saturday, 9:30 AM. Can you call a Rhode Island lead?", 112, PAPER), para("The lead’s time.", 48, MIST)], 40) +
    sticker_hint(1400, "Quiz below ↓", True) + story_foot(True))
story("W9-Story-Sun-1", "Sun 9 AM · Quiz: Sunday calls from noon", NIGHT,
    stack(84, 280, 900, [headline("Which state allows Sunday sales calls from noon?", 112, PAPER)], 40) +
    sticker_hint(1400, "Quiz below ↓", True) + story_foot(True))
story("W9-Story-Mon-1", "Mon 9 AM · Slider: ready for December?", NIGHT,
    stack(84, 280, 900, [headline("How ready is your floor for December?", 124, PAPER), para("Slide it.", 48, MIST)], 40) +
    sticker_hint(1400, "Slide below ↓", True) + story_foot(True))

if __name__ == "__main__":
    for b in B: print(b[0], b[1])
    print(len(B), "boards")
