# VPEX Instagram, week 7 (Tue Nov 10 - Mon Nov 16, 2026): "Know the clock, know the floor". Built on the Nov 5 learn run
# (site-only while Meta blocks the app): reference posts (3.0 site actions per post, n=3), carousels (1.0, n=9) and the
# calling-hours topic (1.7, n=6) bring the site visits; offer/price (1.0) and contrast/remote-team (w6-office) brought taps;
# 19:00 beats 11:00 (0.6 vs 0.2). So: four save-able references at 19:00 (last call by state, Medicare AEP checks, the
# 3-calls-in-24-hours states, five questions before you pick a dialer), example price math, a time-zone Reel, a Spam Likely
# sequel (redial guard), and new screens (Sales coach, no-answer text, export and backup, the Monday floor push), plus the
# barely tested story and myth hooks. Real VPEX screens from demo offices only (fictional leads, 555 numbers).
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

# ========== Reel covers (words inside the middle 1080x1350, so the grid crop keeps them) ==========
cover("W7-Cover-AK", "Reel AK cover: Your 9 AM is their 6 AM.", lines([("YOUR 9 AM", 118, PAPER), ("IS THEIR", 120, MIST), ("6 AM.", 230, RED_D)], 430, 22))
cover("W7-Cover-AL", "Reel AL cover: Most calls. Fewest conversations.", lines([("MOST CALLS.", 108, PAPER), ("FEWEST", 150, RED_D), ("CONVERSATIONS?", 74, RED_D)], 450, 24))
cover("W7-Cover-AM", "Reel AM cover: Called him 11 minutes ago?", lines([("CALLED HIM", 118, PAPER), ("11 MINUTES", 118, RED_D), ("AGO?", 200, RED_D)], 430, 22))
cover("W7-Cover-AN", "Reel AN cover: Rep POV: my first 10 minutes", lines([("REP POV:", 120, GOLD), ("MY FIRST", 150, PAPER), ("10 MINUTES.", 130, PAPER)], 450, 24))
cover("W7-Cover-AO", "Reel AO cover: Myth: you can't manage a remote floor.", lines([("MYTH:", 120, RED_D), ("YOU CAN’T MANAGE", 82, PAPER), ("A REMOTE", 140, PAPER), ("FLOOR.", 150, PAPER)], 420, 22))
cover("W7-Cover-AP", "Reel AP cover: No answer. Now what?", lines([("NO ANSWER.", 112, RED_D), ("NOW", 190, PAPER), ("WHAT?", 190, PAPER)], 430, 22))
cover("W7-Cover-AQ", "Reel AQ cover: Monday 8:30. Last week, before coffee.", at(0, 360, '<div style="width: 1080px; text-align: center; font-family: %s; font-weight: 800; font-size: 330px; line-height: 0.85; color: %s">8:30<span style="font-size: 120px; margin-left: 16px">AM</span></div>' % (BIGS, GOLD)) +
      lines([("LAST WEEK,", 110, PAPER), ("BEFORE COFFEE.", 92, PAPER)], 700, 18))

# ========== Tue 19:00 carousel: last call, state by state ==========
post("W7-Last-1", "Last call by state (cover)", NIGHT,
    at(84, 96, headline("7:45 PM. Who can you still call?", 128, PAPER), w=920) +
    at(88, 560, para("The federal window closes at 9 PM, the lead’s time. 14 states on VPEX’s list close earlier.", 46, MIST), w=880) +
    at(88, 800, checks(["6 PM: Rhode Island", "7 PM: Pennsylvania", "8 PM: 12 more states"], True, 46)) + small(LEGAL, 1170, True) + foot_dark(1262, "Swipe"))
post("W7-Last-2", "Last call: 6 PM and 7 PM", PAPER,
    kicker("The earliest last calls (weekdays)") + at(84, 130, headline("Rhode Island: 6 PM. Pennsylvania: 7 PM.", 88, INK), w=910) +
    crop("pa_late", 470, 1.95) +
    at(88, 1020, para("7:10 PM in Pennsylvania: flagged. Both states: no Sunday calls.", 36, SLATE), w=900) + demo_tag(1130) + small(LEGAL, 1180, False) + foot_light(1262, "Swipe"))
post("W7-Last-3", "Last call: 8 PM states", PAPER,
    kicker("Last call at 8 PM, the lead’s time") + at(84, 130, headline("12 states close at 8.", 100, INK), w=910) +
    at(88, 380, rows([("Alabama", "Louisiana"), ("Connecticut", "Maryland"), ("Florida", "Massachusetts"), ("Mississippi", "Nevada"), ("Oklahoma", "Oregon"), ("Washington", "Wyoming")], False, 44, 440, color=INK)) +
    at(88, 1000, para("Everyone else: 9 PM. Some of these start later too: Connecticut and Nevada at 9 AM.", 36, SLATE), w=900) + small(LEGAL, 1180, False) + foot_light(1262, "Swipe"))
post("W7-Last-4", "Last call: VPEX checks first", PAPER,
    kicker("Before anyone dials") + at(84, 130, headline("8:05 PM in Connecticut? Flagged.", 96, INK), w=910) +
    crop("ct_late", 460, 1.95) +
    at(88, 1010, para("Every lead shows its local time and its state’s window, so the last call of the night is the right one.", 36, SLATE), w=900) + demo_tag(1130) + small(LEGAL, 1180, False) + foot_light(1262, "Swipe"))
post("W7-Last-5", "Last call (end)", NIGHT,
    stack(88, 110, 900, [headline("Dialing past 7?", 120, PAPER), para("Keep this where your evening shift can find it.", 44, MIST)], 34) +
    at(88, 760, big("SAVE THIS", 128, GOLD, UNB)) + small(LEGAL, 1170, True) + foot_dark(1262))

# ========== Wed 19:00 post: example price math ==========
post("W7-Math", "Post: Example math, a 6-rep floor", PAPER,
    at(88, 84, para("Floor math · an example", 36, GOLDINK, "font-weight: 800; letter-spacing: .04em")) +
    at(84, 150, headline("What does a power dialer cost a 6-rep floor?", 92, INK), w=910) +
    at(70, 470, big("6 × $49", 210, INK)) +
    at(88, 680, big("= $294 a month", 120, GOLDINK)) +
    at(88, 840, checks(["Every rep on their own phone", "Scoreboard, coach and contests included", "7 days free first, no card"], False, 40)) +
    at(88, 1170, para("Tap the link in our bio, then this post.", 34, SLATE, "font-weight: 600")) + foot_light(1262))

# ========== Thu 19:00 carousel: Medicare AEP ==========
post("W7-AEP-1", "Medicare AEP checks (cover)", NIGHT,
    at(88, 84, para("Medicare AEP ends December 7", 40, GOLD, "font-weight: 700")) +
    at(84, 150, headline("3 checks before every Medicare call.", 128, PAPER), w=920) +
    at(88, 640, numbered(["Is it a calling hour in their state?", "Is the Scope of Appointment on record?", "Did they ask not to be called?"], True, 44)) +
    small(MED, 1150, True) + foot_dark(1262, "Swipe"))
post("W7-AEP-2", "AEP check 1: calling hours", PAPER,
    kicker("1 of 3 · Their clock, not yours") + at(84, 130, headline("9 AM in New York is 6 AM in California.", 88, INK), w=910) +
    crop("ca_early", 420, 1.95) +
    at(88, 960, para("VPEX shows every lead’s local time and checks their state’s calling hours before anyone dials.", 36, SLATE), w=900) + demo_tag(1100) + small(LEGAL, 1150, False) + foot_light(1262, "Swipe"))
post("W7-AEP-3", "AEP check 2: Scope of Appointment", PAPER,
    kicker("2 of 3 · Scope of Appointment") + at(84, 130, headline("The 48-hour wait is gone. The Scope of Appointment isn’t.", 80, INK), w=910) +
    crop("medicare", 520, 2.4) +
    at(88, 860, para("Pick Medicare in VPEX’s Qualify sheet and the reminder shows up mid-call: get it on record, signed or recorded on the call, before the sales meeting.", 36, SLATE), w=900) + demo_tag(1100) + small(MED, 1150, False) + foot_light(1262, "Swipe"))
post("W7-AEP-4", "AEP check 3: Do Not Call", PAPER,
    kicker("3 of 3 · Do Not Call") + at(84, 130, headline("“Take me off your list” means every rep.", 88, INK), w=910) +
    crop("dnc_chip", 480, 2.4) +
    at(88, 800, para("VPEX blocks the number for your whole office. It doesn’t check the National Do Not Call Registry: scrub new lists against it before you upload.", 36, SLATE), w=900) + demo_tag(1100) + small(MED, 1150, False) + foot_light(1262, "Swipe"))
post("W7-AEP-5", "Medicare AEP (end)", NIGHT,
    stack(88, 110, 900, [headline("Running an insurance floor this AEP?", 100, PAPER), para("There’s a live insurance demo office, no sign-up.", 44, MIST)], 34) +
    at(88, 760, big("SAVE THIS", 128, GOLD, UNB)) + at(88, 900, para("for your next team huddle.", 44, PAPER, "font-weight: 700")) + small(MED, 1150, True) + foot_dark(1262))

# ========== Fri 19:00 carousel: 3 calls in 24 hours ==========
post("W7-Three-1", "3 calls in 24 hours (cover)", NIGHT,
    at(84, 96, headline("Third call to the same lead today?", 120, PAPER), w=920) +
    at(70, 470, big("3 IN 24", 280, GOLD)) +
    at(88, 760, para("In four states on VPEX’s list, that’s the limit: at most 3 sales calls to one person in 24 hours.", 46, MIST), w=880) +
    small(LEGAL, 1170, True) + foot_dark(1262, "Swipe"))
post("W7-Three-2", "3 calls: the four states", PAPER,
    kicker("At most 3 sales calls in 24 hours") + at(84, 130, headline("Florida, Maryland, Oklahoma, Oregon.", 80, INK), w=910) +
    at(88, 470, rows([("Florida", "3 in 24 hours · 8 AM–8 PM"), ("Maryland", "3 in 24 hours · 8 AM–8 PM"), ("Oklahoma", "3 in 24 hours · 8 AM–8 PM"), ("Oregon", "3 in 24 hours · 8 AM–8 PM")], False, 42, 300)) +
    at(88, 930, para("Counted per person, across your whole floor. The lead’s state, not yours.", 38, SLATE), w=900) + small(LEGAL, 1180, False) + foot_light(1262, "Swipe"))
post("W7-Three-3", "3 calls: VPEX counts them", PAPER,
    kicker("Before anyone dials") + at(84, 130, headline("VPEX counts the calls and says when it’s OK again.", 84, INK), w=910) +
    crop("cap_fl", 430, 1.95) +
    at(88, 1040, para("Florida lead, 2:10 PM, called 3 times since 9:05 AM: next call after 9:05 AM tomorrow.", 34, SLATE), w=900) + demo_tag(1140) + small(LEGAL, 1185, False) + foot_light(1262, "Swipe"))
post("W7-Three-4", "3 calls: the rep moves on", PAPER,
    kicker("Same check, every state on the list") + at(84, 130, headline("Maryland, Oregon: same flag.", 88, INK), w=910) +
    crop("cap_md", 440, 1.3, 70) + crop("cap_or", 440, 1.3, 560) +
    at(88, 1000, para("Reps skip it and move on. It comes back when calls are allowed.", 36, SLATE), w=900) + demo_tag(1130) + small(LEGAL, 1180, False) + foot_light(1262, "Swipe"))
post("W7-Three-5", "3 calls (end)", NIGHT,
    stack(88, 110, 900, [headline("Calling Florida, Maryland, Oklahoma or Oregon?", 96, PAPER), para("Keep this for whoever builds your call lists.", 44, MIST)], 34) +
    at(88, 760, big("SAVE THIS", 128, GOLD, UNB)) + small(LEGAL, 1170, True) + foot_dark(1262))

# ========== Sat 19:00 carousel: 5 questions before you pick a dialer ==========
post("W7-Buy-1", "Picking a dialer (cover)", NIGHT,
    at(84, 96, headline("Picking a dialer? Ask these 5 first.", 128, PAPER), w=920) +
    at(88, 560, numbered(["Does it check each lead’s state?", "Can two reps grab the same lead?", "Can you see remote reps?", "Can reps use their own phones?", "What does it cost per rep?"], True, 40)) +
    foot_dark(1262, "Swipe"))
post("W7-Buy-2", "Question 1: the lead's state", PAPER,
    kicker("1 · Does it check each lead’s state?") + at(84, 130, headline("Calling hours, checked before the call.", 88, INK), w=910) +
    crop("ct_late", 440, 1.95) + demo_tag(1100) + small(LEGAL, 1150, False) + foot_light(1262, "Swipe"))
post("W7-Buy-3", "Question 2: two reps, one lead", PAPER,
    kicker("2 · Can two reps grab the same lead?") + at(84, 130, headline("In VPEX, a lead a rep opens is held for them.", 88, INK), w=910) +
    crop("held", 480, 2.5) +
    at(88, 760, para("Everyone else’s queue skips it, and you can see who’s on what.", 38, SLATE), w=900) + demo_tag(1170) + foot_light(1262, "Swipe"))
post("W7-Buy-4", "Questions 3 and 4: remote reps, own phones", PAPER,
    kicker("3 and 4 · Remote reps? Their own phones?") + at(84, 130, headline("Office and remote, one scoreboard.", 88, INK), w=910) +
    at(88, 340, para("And every rep dials from their own phone.", 38, SLATE, "font-weight: 600"), w=900) +
    crop("office", 440, 1.95) + demo_tag(1130) + foot_light(1262, "Swipe"))
post("W7-Buy-5", "Question 5: cost (end)", NIGHT,
    at(88, 96, para("5 · What does it cost per rep?", 40, GOLD, "font-weight: 700")) +
    at(84, 160, headline("VPEX: $49 per rep a month. 7 days free, no card.", 104, PAPER), w=910) +
    at(88, 740, big("SEND THIS", 112, PAPER, UNB)) + at(88, 870, big("TO WHOEVER PICKS", 64, GOLD, UNB)) + at(88, 950, big("YOUR DIALER", 64, GOLD, UNB)) + foot_dark(1262))

# ========== Sun 19:00 post: your data comes with you ==========
post("W7-Data", "Post: If you switched dialers tomorrow", PAPER,
    at(84, 84, headline("Switching dialers tomorrow? Could you take your call history?", 74, INK), w=910) +
    at(88, 420, para("In VPEX, two taps in Admin controls: every call as a CSV, or leads, calls and follow-ups in one backup file.", 38, SLATE, "font-weight: 600"), w=900) +
    crop("data", 600, 2.0) + demo_tag(1110) + at(88, 1170, para("Send this to your manager.", 34, INK, "font-weight: 700")) + foot_light(1262))

# ========== Mon 19:00 post: start a trial tonight ==========
post("W7-Trial", "Post: Start tonight, dial tomorrow", NIGHT,
    at(84, 84, headline("Start tonight. Your floor dials tomorrow.", 110, PAPER), w=910) +
    at(88, 470, numbered(["Create your office: about two minutes, no card.", "Upload your list: Excel, CSV, text or contacts.", "Send reps the office link. They sign in on their own phones."], True, 44)) +
    at(88, 1060, para("7 days free. Then $49 per rep per month.", 38, PAPER, "font-weight: 700"), w=900) +
    at(88, 1140, para("Tap the link in our bio, then this post.", 34, MIST, "font-weight: 600")) + foot_dark(1262))

# ========== stories (1080x1920). 9 AM ones carry a sticker added by hand (the bot reminds Vincent). ==========
story("W7-Story-Tue-1", "Tue 9 AM · Poll: West Coast before noon?", NIGHT,
    stack(84, 280, 900, [headline("Does your floor call the West Coast before noon?", 116, PAPER), para("Your noon is their 9 AM.", 48, MIST)], 40) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))
story("W7-Story-Wed-1", "Wed 9 AM · Quiz: last call in Pennsylvania", NIGHT,
    stack(84, 280, 900, [headline("Last sales call of the day in Pennsylvania?", 120, PAPER), para("The lead’s time, on a weekday.", 48, MIST)], 40) +
    sticker_hint(1400, "Quiz below ↓", True) + story_foot(True))
story("W7-Story-Thu-1", "Thu 9 AM · Question: AEP headache", NIGHT,
    stack(84, 280, 900, [headline("Insurance floors: what’s your biggest AEP headache this week?", 104, PAPER), para("No-shows? Scope of Appointment? Lists?", 48, MIST)], 40) +
    sticker_hint(1400, "Answer below ↓", True) + story_foot(True))
story("W7-Story-Fri-1", "Fri 9 AM · Quiz: Florida's call limit", NIGHT,
    stack(84, 280, 900, [headline("Florida: most sales calls to one person in 24 hours?", 110, PAPER)], 40) +
    sticker_hint(1400, "Quiz below ↓", True) + story_foot(True))
story("W7-Story-Sat-1", "Sat 9 AM · Slider: every rep follows the hours?", NIGHT,
    stack(84, 280, 900, [headline("How sure are you every rep follows the calling hours?", 110, PAPER), para("Slide it. Be honest.", 48, MIST)], 40) +
    sticker_hint(1400, "Slide below ↓", True) + story_foot(True))
story("W7-Story-Sun-1", "Sun 9 AM · Poll: could you export your call history?", NIGHT,
    stack(84, 280, 900, [headline("Could you export your floor’s call history today?", 116, PAPER)], 40) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))
story("W7-Story-Mon-1", "Mon 9 AM · Poll: did you beat last week?", NIGHT,
    stack(84, 280, 900, [headline("Did your floor beat last week?", 130, PAPER), para("Calls, conversations, interested.", 48, MIST)], 40) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))

if __name__ == "__main__":
    for b in B: print(b[0], b[1])
    print(len(B), "boards")
