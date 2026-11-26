# VPEX Instagram, week 10 (Tue Dec 1 - Mon Dec 7, 2026): "Brush-offs and remote floors". Built on the Nov 26 learn run (site-only
# while Meta blocks the app; 68 posts in the last 35 days, 6 site actions, under the 20 needed for a verdict): the posts that
# brought site visits were the brush-offs carousel (w8-brush, reference / objections, "Send this"), "In office vs. remote"
# (w6-office, contrast / remote-team) and the $49 post (w4-price, offer / price); "Send this to your manager" leads calls to
# action (0.2, n=19) and images lead formats (0.2); calling-hours is 0.0 on 11 posts in the window. So: brush-offs five ways
# (VPEX's starter rebuttals for real estate, auto, MCA, insurance and solar), remote floors twice (the new live rep tracker),
# price/offer three times, one calling-hours Reel, and new features (Calendar tab, follow-ups skip Christmas). Tests number and
# myth hooks. Real VPEX screens from demo offices only (fictional leads, 555 numbers).
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
 "re_number": ("rb_re_number", 8, 611, 374, 145), "auto_price": ("rb_auto_price", 8, 479, 374, 171), "auto_spouse": ("rb_auto_spouse", 8, 611, 374, 145),
 "ins_kids": ("rb_ins_kids", 8, 636, 374, 120), "sol_spouse": ("rb_sol_spouse", 8, 530, 374, 120), "mca_partner": ("rb_mca_partner", 8, 636, 374, 120),
 "mca_info": ("rb_mca_info", 8, 532, 374, 171), "sol_notint": ("rb_sol_notint", 8, 636, 374, 120), "mca_list": ("rb_mca_list", 8, 360, 374, 400),
 "trk_tiles": ("track_live", 8, 6, 374, 330), "trk_live": ("track_live", 8, 385, 374, 400), "trk_needs": ("track_needs", 8, 330, 374, 440),
 "tv": ("tv", 8, 0, 374, 600), "cal": ("cal_month", 16, 160, 358, 440), "fu_xmas": ("fu_xmas", 8, 330, 374, 510),
 "late_card": ("dial_0915", 16, 400, 358, 380), "auto_script": ("auto_script", 8, 140, 374, 450), "auto_card": ("auto_dial", 16, 450, 358, 280),
 "auto_pipe": ("auto_pipe", 8, 100, 374, 420),
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
cover("W10-Cover-BF", "Reel BF cover: How did you get my number?", lines([("“HOW DID", 150, PAPER), ("YOU GET MY", 120, PAPER), ("NUMBER?”", 128, RED_D)], 420, 22))
cover("W10-Cover-BG", "Reel BG cover: Remote reps. Who's dialing?", lines([("REMOTE", 170, PAPER), ("REPS.", 170, PAPER), ("WHO’S", 150, GOLD), ("DIALING?", 130, GOLD)], 380, 20))
cover("W10-Cover-BH", "Reel BH cover: Just send me your best price.", lines([("“JUST SEND", 124, PAPER), ("ME YOUR", 150, PAPER), ("BEST PRICE.”", 112, RED_D)], 420, 22))
cover("W10-Cover-BI", "Reel BI cover: 9:15 PM. Who can you still call?", lines([("9:15 PM.", 176, GOLD), ("WHO CAN YOU", 104, PAPER), ("STILL CALL?", 116, RED_D)], 420, 22))
cover("W10-Cover-BJ", "Reel BJ cover: 6 brush-offs. 6 answers.", lines([("6 BRUSH-", 160, PAPER), ("OFFS.", 170, RED_D), ("6 ANSWERS.", 112, GOLD)], 420, 22))
cover("W10-Cover-BK", "Reel BK cover: Follow up on Christmas?", lines([("FOLLOW UP", 130, PAPER), ("ON", 150, PAPER), ("CHRISTMAS?", 120, RED_D)], 420, 22))
cover("W10-Cover-BL", "Reel BL cover: 3 weeks left in 2026.", lines([("3 WEEKS", 170, PAPER), ("LEFT IN", 150, PAPER), ("2026.", 210, GOLD)], 400, 22))

# ========== Tue 19:00 carousel: one brush-off, every floor ==========
post("W10-Spouse-1", "One brush-off, every floor (cover)", NIGHT,
    at(88, 84, para("Brush-offs · every floor", 36, GOLD, "font-weight: 800; letter-spacing: .04em")) +
    at(84, 150, headline("“I need to talk to my spouse.”", 112, PAPER), w=920) +
    at(88, 470, para("Every sales floor hears it. Here’s how VPEX’s starter scripts answer it, floor by floor.", 44, MIST), w=880) +
    at(88, 720, checks(["Insurance", "Solar", "Auto sales", "Business funding"], True, 42, "→")) + foot_dark(1262, "Swipe"))
def spouse(n, floor, q, key, y, s, note):
    post("W10-Spouse-%d" % n, "Brush-off: " + floor, PAPER,
        kicker(floor) + at(84, 130, headline(q, 96, INK), w=910) + crop(key, y, s) +
        at(88, y + 420, para(note, 40, INK, "font-weight: 700"), w=900) + demo_tag(1150) + foot_light(1262, "Swipe"))
spouse(2, "Insurance", "“I’ll ask my kids first.”", "ins_kids", 460, 2.3, "The answer opens on the rep’s screen, mid-call: get the kids on the next call.")
spouse(3, "Solar", "“I need to talk to my spouse.”", "sol_spouse", 460, 2.3, "Book the consultation when both of them can be there.")
spouse(4, "Auto sales", "“I need to talk to my spouse.”", "auto_spouse", 420, 2.3, "Invite them in together, at a time that works for both.")
spouse(5, "Business funding", "“I need to talk to my partner.”", "mca_partner", 460, 2.3, "Get both owners on a quick call.")
post("W10-Spouse-6", "One brush-off (end)", NIGHT,
    stack(88, 110, 900, [headline("Same move every time: everyone on the next call.", 100, PAPER), para("Admins edit the answers; every rep’s app updates.", 44, MIST)], 34) +
    at(88, 800, big("SEND THIS", 112, PAPER, UNB)) + at(88, 930, big("TO YOUR FLOOR", 72, GOLD, UNB)) + foot_dark(1262))

# ========== Wed 19:00 post: budgeting 2027, $49 a rep (an example) ==========
post("W10-Budget", "Post: Budgeting 2027? Your dialer is one line.", PAPER,
    at(88, 84, para("Planning 2027", 36, GOLDINK, "font-weight: 800; letter-spacing: .04em")) +
    at(84, 150, headline("Budgeting 2027? Your dialer is one line.", 80, INK), w=910) +
    at(70, 470, big("$49", 220, GOLDINK)) + at(88, 700, para("a rep a month. That’s the whole price.", 46, INK, "font-weight: 800"), w=900) +
    at(88, 805, para("An example:", 34, SLATE, "font-weight: 700")) +
    at(88, 855, table([("5 reps", "$245 a month", ""), ("10 reps", "$490 a month", ""), ("20 reps", "$980 a month", "")], False, 42, 190)) +
    at(88, 1110, para("7 days free first, no card. Tap the link in our bio, then this post.", 34, SLATE, "font-weight: 600"), w=900) + foot_light(1262))

# ========== Thu 19:00 post: December on one screen (Calendar tab) ==========
post("W10-Calendar", "Post: Your floor's December, on one screen.", NIGHT,
    at(88, 84, para("New · Calendar tab", 36, GOLD, "font-weight: 800; letter-spacing: .04em")) +
    at(84, 150, headline("December, on one screen.", 96, PAPER), w=910) +
    crop("cal", 390, 1.6, dark=True) +
    at(88, 1150, para("Follow-ups and appointments counted per day. Tap a day for its agenda. Save this.", 32, MIST), w=900) + foot_dark(1262))

# ========== Fri 19:00 carousel: a floor you can't see ==========
post("W10-Remote-1", "Running a floor you can't see (cover)", NIGHT,
    at(88, 84, para("Remote floors", 36, GOLD, "font-weight: 800; letter-spacing: .04em")) +
    at(84, 150, headline("Reps at home? 3 things to check from your phone.", 100, PAPER), w=920) +
    at(88, 640, numbered(["Who’s dialing right now", "Who needs you", "The floor’s day, on one screen"], True, 46)) + foot_dark(1262, "Swipe"))
post("W10-Remote-2", "Remote: who's dialing", PAPER,
    kicker("1 · Who’s dialing right now") + at(84, 130, headline("Dialing, idle or offline. Live.", 88, INK), w=910) +
    crop("trk_live", 360, 1.55) + demo_tag(1000) + at(88, 1040, para("Updates the moment a rep dials. Admin controls > Team.", 34, SLATE), w=900) + foot_light(1262, "Swipe"))
post("W10-Remote-3", "Remote: who needs you", PAPER,
    kicker("2 · Who needs you") + at(84, 130, headline("Idle too long. Late follow-ups.", 88, INK), w=910) +
    crop("trk_needs", 360, 1.4) + demo_tag(1000) + at(88, 1040, para("One tap sorts the reps who need a nudge to the top.", 34, SLATE), w=900) + foot_light(1262, "Swipe"))
post("W10-Remote-4", "Remote: the floor's day", PAPER,
    kicker("3 · The floor’s day") + at(84, 130, headline("The floor’s day, live.", 96, INK), w=910) +
    crop("tv", 360, 1.25) + demo_tag(1130) + at(88, 1170, para("Floor TV: on the office TV, or on your phone at home.", 32, SLATE), w=900) + foot_light(1262, "Swipe"))
post("W10-Remote-5", "Remote floors (end)", NIGHT,
    stack(88, 110, 900, [headline("Same floor. Wherever your reps sit.", 110, PAPER), para("Keep this for your next remote hire.", 44, MIST)], 34) +
    at(88, 760, big("SAVE THIS", 128, GOLD, UNB)) + foot_dark(1262))

# ========== Sat 19:00 post: myth, a dialer needs a contract ==========
post("W10-Myth", "Post: Myth: trying a power dialer means a contract.", PAPER,
    at(88, 84, para("Myth", 40, RED, "font-weight: 800; letter-spacing: .06em")) +
    at(84, 150, headline("“Trying a power dialer means a contract and a long setup.”", 84, INK), w=910) +
    at(88, 560, para("With VPEX:", 40, SLATE, "font-weight: 700")) +
    at(88, 620, checks(["7 days free, no card", "Your list goes in as is", "Reps dial from their own phones", "$49 a rep a month, cancel any time"], False, 44)) +
    at(88, 1160, para("Comment DEMO and we’ll send you a live demo office.", 32, INK, "font-weight: 700")) + foot_light(1262))

# ========== Sun 19:00 carousel: Built for auto sales floors ==========
post("W10-Auto-1", "Built for auto sales floors (cover)", NIGHT,
    at(88, 84, para("Built for your floor · Auto sales", 36, GOLD, "font-weight: 800; letter-spacing: .04em")) +
    at(84, 150, headline("A power dialer for auto sales floors calling internet leads.", 92, PAPER), w=920) +
    at(88, 720, checks(["A script that books the test drive", "Answers to “just send me your best price”", "Every customer’s notes and best hour"], True, 44)) + foot_dark(1262, "Swipe"))
post("W10-Auto-2", "Auto: the script", PAPER,
    kicker("1 · The script, your words") + at(84, 130, headline("“Does today after work or Saturday morning work better?”", 72, INK), w=910) +
    crop("auto_script", 400, 1.5) + demo_tag(1100) + at(88, 1150, para("Auto demo office. Admins edit it; every rep’s app updates.", 30, SLATE), w=900) + foot_light(1262, "Swipe"))
post("W10-Auto-3", "Auto: the brush-offs", PAPER,
    kicker("2 · Answers mid-call, one tap") + at(84, 130, headline("“Just send me your best price.”", 84, INK), w=910) +
    crop("auto_price", 430, 2.3) + demo_tag(1000) + at(88, 1050, para("Six auto brush-offs, each with an answer that opens on tap.", 34, SLATE), w=900) + foot_light(1262, "Swipe"))
post("W10-Auto-4", "Auto: the lead card", PAPER,
    kicker("3 · Notes and the right hour") + at(84, 130, headline("What they want, and when they pick up.", 84, INK), w=910) +
    crop("auto_card", 450, 2.3) + demo_tag(1100) + at(88, 1150, para("Their local time and best hour to call, on every lead.", 30, SLATE), w=900) + foot_light(1262, "Swipe"))
post("W10-Auto-5", "Built for auto sales (end)", NIGHT,
    stack(88, 110, 900, [headline("Open the auto demo office.", 110, PAPER), para("No sign-up. Sample customers, real VPEX.", 44, MIST)], 34) +
    at(88, 740, big("SEND THIS", 112, PAPER, UNB)) + at(88, 870, big("TO YOUR SALES MANAGER", 52, GOLD, UNB)) + foot_dark(1262))

# ========== Mon 19:00 post: not interested, or not now? ==========
post("W10-NotNow", "Post: Not interested. In solar, or in now?", NIGHT,
    at(88, 84, para("Brush-offs · solar", 36, GOLD, "font-weight: 800; letter-spacing: .04em")) +
    at(84, 150, headline("“Not interested.” In solar, or in now?", 100, PAPER), w=910) +
    crop("sol_notint", 520, 2.3, dark=True) +
    at(88, 880, para("One question splits a hard no from a timing no. A timing no gets a callback, not a dead lead.", 40, MIST), w=890) +
    at(88, 1160, para("Comment DEMO and we’ll send you a live demo office.", 32, PAPER, "font-weight: 700")) + foot_dark(1262))

# ========== stories (1080x1920). 9 AM ones carry a sticker added by hand (the bot reminds Vincent). ==========
story("W10-Story-Tue-1", "Tue 9 AM · Poll: December on your floor", NIGHT,
    stack(84, 280, 900, [headline("December on your floor: pushing hard, or coasting to January?", 104, PAPER)], 40) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))
story("W10-Story-Wed-1", "Wed 9 AM · Quiz: How did you get my number?", NIGHT,
    stack(84, 280, 900, [headline("“How did you get my number?” Best first move?", 112, PAPER)], 40) +
    sticker_hint(1400, "Quiz below ↓", True) + story_foot(True))
story("W10-Story-Thu-1", "Thu 9 AM · Poll: reps working from home?", NIGHT,
    stack(84, 280, 900, [headline("How many of your reps dial from home?", 124, PAPER)], 40) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))
story("W10-Story-Fri-1", "Fri 9 AM · Quiz: 9:15 PM Eastern", NIGHT,
    stack(84, 280, 900, [headline("9:15 PM Eastern. Which lead can you still call?", 112, PAPER), para("The lead’s time.", 48, MIST)], 40) +
    sticker_hint(1400, "Quiz below ↓", True) + story_foot(True))
story("W10-Story-Sat-1", "Sat 9 AM · Question: the brush-off you hear most", NIGHT,
    stack(84, 280, 900, [headline("The brush-off your floor hears most this month?", 112, PAPER), para("We’ll answer the best ones.", 48, MIST)], 40) +
    sticker_hint(1400, "Answer below ↓", True) + story_foot(True))
story("W10-Story-Sun-1", "Sun 9 AM · Quiz: Christmas Day calls", NIGHT,
    stack(84, 280, 900, [headline("Christmas is a Friday. Which state bans sales calls that day?", 104, PAPER)], 40) +
    sticker_hint(1400, "Quiz below ↓", True) + story_foot(True))
story("W10-Story-Mon-1", "Mon 9 AM · Slider: ready for 2027?", NIGHT,
    stack(84, 280, 900, [headline("How ready is your floor for 2027?", 124, PAPER), para("Slide it.", 48, MIST)], 40) +
    sticker_hint(1400, "Slide below ↓", True) + story_foot(True))

if __name__ == "__main__":
    for b in B: print(b[0], b[1])
    print(len(B), "boards")
