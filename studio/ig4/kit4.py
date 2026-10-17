# VPEX Instagram, week 4 ("The rules changed"): built on what week 1-3 numbers showed. Shares (industry and calling
# hours) and watch time (Spam Likely) led, so: state calling hours (Pennsylvania's new rule), the 3-call limit, a Spam
# Likely sequel, an industry carousel, and the new features (lock-screen alerts, the 8:30 summary, one-tap confirmations).
# Real VPEX screens from a demo office (fictional leads, 555 numbers). Same tokens and helpers as weeks 1-3.
import os, importlib.util
D = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("kit3", D + "/../ig3/kit3.py"); k3 = importlib.util.module_from_spec(spec); spec.loader.exec_module(k3)
NIGHT, GOLD, GOLDINK, PAPER, INK, SLATE, MIST = k3.NIGHT, k3.GOLD, k3.GOLDINK, k3.PAPER, k3.INK, k3.SLATE, k3.MIST
ARCH, BIGS, UNB, RED, RED_D, REEL_BG, RULE_L, RULE_D = k3.ARCH, k3.BIGS, k3.UNB, k3.RED, k3.RED_D, k3.REEL_BG, k3.RULE_L, k3.RULE_D
img, at, board, headline, para, wordmark, phone = k3.img, k3.at, k3.board, k3.headline, k3.para, k3.wordmark, k3.phone
foot_dark, foot_light, zoom, stack, fix_label, big, lines = k3.foot_dark, k3.foot_light, k3.zoom, k3.stack, k3.fix_label, k3.big, k3.lines
story_foot, sticker_hint = k3.story_foot, k3.sticker_hint
GREEN = "#2E9E62"
LEGAL = "Based on published state rules as of October 2026. Not legal advice."
WARN = (31, 469, 320, 57)     # the lead's calling-hours line on the dial screen
PROMPT = (8, 672, 374, 140)    # the ready-to-send text prompt

B = []   # (file stem, title, w, h, html)
def post(stem, title, bg, inner): B.append((stem, title, 1080, 1350, board(1080, 1350, bg, inner)))
def story(stem, title, bg, inner): B.append((stem, title, 1080, 1920, board(1080, 1920, bg, inner)))
def cover(stem, title, inner):
    B.append((stem, title, 1080, 1920, board(1080, 1920, REEL_BG, inner + at(0, 1500, '<div style="width: 1080px; display: flex; justify-content: center">%s</div>' % wordmark(64)))))
def small(text, y, dark=False, x=88, w=900, size=24):
    return at(x, y, '<div style="font-family: %s; font-weight: 500; font-size: %dpx; line-height: 1.35; color: %s">%s</div>' % (ARCH, size, MIST if dark else SLATE, text), w=w)

# ---------- a generic phone lock screen with VPEX notifications (no phone maker's design) ----------
ICON = ('<div style="flex: none; width: {s}px; height: {s}px; border-radius: {r}px; background: #0E1433; display: flex; align-items: center; justify-content: center;'
        ' box-shadow: inset 0 0 0 2px rgba(232,185,74,.35)"><span style="font-family: %s; font-weight: 800; font-size: {f}px; color: #E8B94A; line-height: 1">V</span></div>') % UNB
def notif(title, body, when="now", w=820, k=1.0):
    s = round(64 * k)
    return ('<div style="width: %dpx; box-sizing: border-box; padding: %dpx %dpx; border-radius: %dpx; background: rgba(244,245,249,0.93); box-shadow: 0 24px 60px -24px rgba(0,0,0,.6);'
            ' display: flex; gap: %dpx; align-items: flex-start">%s<div style="flex: 1; min-width: 0">'
            '<div style="display: flex; justify-content: space-between; font-family: %s; font-weight: 600; font-size: %dpx; color: #4A5274; letter-spacing: .02em"><span>VPEX</span><span>%s</span></div>'
            '<div style="font-family: %s; font-weight: 750; font-size: %dpx; line-height: 1.18; color: #131A3E; margin-top: %dpx">%s</div>'
            '<div style="font-family: %s; font-weight: 500; font-size: %dpx; line-height: 1.3; color: #2B3358; margin-top: %dpx">%s</div></div></div>'
            % (w, round(26 * k), round(28 * k), round(36 * k), round(22 * k), ICON.format(s=s, r=round(16 * k), f=round(34 * k)),
               ARCH, round(24 * k), when, ARCH, round(34 * k), round(4 * k), title, ARCH, round(30 * k), round(4 * k), body))
def lock(x, y, w, time, ampm, date, notes, k=None):
    """A phone showing a lock screen: big time, date, then notification cards. notes = [(title, body, when)]."""
    k = k or w / 900
    h = round(w * 2.05)
    nk = k * 1.35
    cards = "".join('<div style="margin-top: %dpx">%s</div>' % (round(18 * k), notif(t, b, wh, round(w - 56 * k), nk)) for t, b, wh in notes)
    return ('<div style="position: absolute; left: %dpx; top: %dpx; width: %dpx; height: %dpx; box-sizing: border-box; padding: %dpx; border-radius: %dpx; background: #2A3272; box-shadow: 0 70px 110px -50px rgba(0,0,0,.8)">'
            '<div style="position: relative; width: 100%%; height: 100%%; border-radius: %dpx; overflow: hidden; background: radial-gradient(120%% 80%% at 30%% 10%%, #2B3A8C 0%%, #141B4A 45%%, #070A1E 100%%)">'
            '<div style="position: absolute; left: 0; right: 0; top: %dpx; text-align: center; font-family: %s; font-weight: 600; font-size: %dpx; color: #C7CBE4">%s</div>'
            '<div style="position: absolute; left: 0; right: 0; top: %dpx; text-align: center; font-family: %s; font-weight: 800; font-size: %dpx; line-height: .85; color: #F4F5F9">%s<span style="font-size: %dpx; margin-left: %dpx">%s</span></div>'
            '<div style="position: absolute; left: %dpx; right: %dpx; top: %dpx">%s</div></div></div>'
            % (x, y, w, h, round(20 * k), round(110 * k), round(92 * k), round(150 * k), ARCH, round(40 * k), date, round(210 * k), BIGS, round(300 * k), time, round(100 * k), round(12 * k), ampm,
               round(28 * k), round(28 * k), round(560 * k), cards))

def rows(items, dark=False, size=44, lw=300, gap=0, color=None):
    """Two-column rule list: (left, right)."""
    out = "".join('<div style="display: flex; gap: 28px; align-items: baseline; padding: 20px 0; border-top: 2px solid %s">'
                  '<span style="flex: none; width: %dpx; font-family: %s; font-weight: 800; font-size: %dpx; line-height: 1.05; color: %s">%s</span>'
                  '<span style="font-family: %s; font-weight: 650; font-size: %dpx; line-height: 1.2; color: %s">%s</span></div>'
                  % (RULE_D if dark else RULE_L, lw, ARCH, size, PAPER if dark else INK, l, ARCH, size, color or (MIST if dark else SLATE), r) for l, r in items)
    return '<div style="width: 904px">%s</div>' % out

# ========== Reel covers (words inside the middle 1080x1350, so the grid crop keeps them) ==========
cover("W4-Cover-L", "Reel L cover: Pennsylvania changed the rules", lines([("PENNSYLVANIA", 92, PAPER), ("CHANGED", 150, PAPER), ("THE RULES.", 124, GOLD)], 480, 18) +
      at(0, 1040, '<div style="width: 1080px; text-align: center; font-family: %s; font-weight: 700; font-size: 54px; color: %s">9 AM–7 PM. No Sundays.</div>' % (ARCH, RED_D)))
cover("W4-Cover-M", "Reel M cover: 4th call in Florida", at(0, 380, '<div style="width: 1080px; text-align: center; font-family: %s; font-weight: 800; font-size: 520px; line-height: .82; color: %s">4<span style="font-size: 200px">TH</span></div>' % (BIGS, RED_D)) +
      lines([("CALL. SAME LEAD.", 80, PAPER), ("IN FLORIDA?", 124, GOLD)], 900, 16))
cover("W4-Cover-N", "Reel N cover: 3 things that get you flagged", lines([("3 THINGS THAT", 84, PAPER), ("GET YOUR NUMBER", 76, PAPER)], 470, 16) +
      at(0, 720, '<div style="width: 1080px; text-align: center; font-family: %s; font-weight: 800; font-stretch: 110%%; font-size: 190px; line-height: .9; letter-spacing: -0.03em; color: %s">Spam<br>Likely.</div>' % (ARCH, RED_D)))
cover("W4-Cover-O", "Reel O cover: Call me Tuesday at 2", lines([("SHE SAID", 104, PAPER), ("“CALL ME", 128, PAPER), ("TUESDAY AT 2.”", 98, GOLD)], 450, 16) +
      at(0, 960, '<div style="width: 1080px; text-align: center; font-family: %s; font-weight: 800; font-size: 300px; line-height: 0.85; color: %s">2:00<span style="font-size: 110px; margin-left: 14px">PM</span></div>' % (BIGS, PAPER)))
cover("W4-Cover-P", "Reel P cover: 8:30 AM", at(0, 400, '<div style="width: 1080px; text-align: center; font-family: %s; font-weight: 800; font-size: 400px; line-height: 0.85; color: %s">8:30<span style="font-size: 140px; margin-left: 16px">AM</span></div>' % (BIGS, GOLD)) +
      lines([("BEFORE THE", 104, PAPER), ("FIRST CALL.", 132, PAPER)], 800, 16))
cover("W4-Cover-Q", "Reel Q cover: Booked isn't showed", lines([("BOOKED", 180, PAPER), ("ISN’T", 130, MIST), ("SHOWED.", 164, RED_D)], 460, 22))
cover("W4-Cover-R", "Reel R cover: 20 states, 20 sets of calling hours", at(0, 360, '<div style="width: 1080px; text-align: center; font-family: %s; font-weight: 800; font-size: 520px; line-height: .82; color: %s">20</div>' % (BIGS, GOLD)) +
      lines([("STATES. 20 SETS OF", 62, PAPER), ("CALLING HOURS.", 90, PAPER)], 860, 16))

# ========== 1. Tue: Pennsylvania card (static) ==========
post("W4-PA", "Post: Pennsylvania, starting Oct 18", NIGHT,
    at(88, 84, para("Pennsylvania, starting October 18, 2026", 40, GOLD, "font-weight: 700")) +
    at(70, 150, big("9–7", 400, PAPER)) +
    at(88, 480, headline("No sales calls before 9 AM or after 7 PM. None on Sundays.", 74, PAPER), w=880) +
    at(88, 750, para("Texts count too. Reps won’t remember it on every lead. VPEX does: a Pennsylvania lead on a Sunday is flagged before anyone dials.", 36, MIST), w=880) +
    zoom("pa_sunday", *WARN, None, 930, 2.7, True) +
    small("Covers unsolicited sales calls and texts to Pennsylvania consumers; exceptions include existing customers and written consent. " + LEGAL, 1150, True, w=900) +
    foot_dark(1262))

# ========== 2. Wed: carousel, calling hours by state ==========
def ch_slide(n, kicker, title, items, note="", lw=300, size=42):
    post("W4-Hours-%d" % n, "Calling hours %d: %s" % (n, title), PAPER,
        at(88, 80, para(kicker, 32, GOLDINK, "font-weight: 700")) +
        at(84, 130, headline(title, 84, INK), w=910) +
        at(88, 400, rows(items, False, size, lw)) +
        (small(note, 1150, False) if note else "") + foot_light(1262, "Swipe"))
post("W4-Hours-1", "Calling hours by state (cover)", NIGHT,
    at(84, 96, headline("Calling hours, state by state.", 132, PAPER), w=900) +
    at(88, 560, para("8 AM to 9 PM is only the federal rule. 20 states are stricter, and one just changed.", 44, MIST), w=880) +
    at(88, 820, big("SAVE THIS.", 150, GOLD, UNB)) +
    small(LEGAL, 1150, True) + foot_dark(1262, "Swipe"))
ch_slide(2, "The default", "Everywhere else: 8 AM to 9 PM.", [("Federal rule", "8 AM–9 PM, the lead’s local time"), ("Who it covers", "Sales calls and texts, in every state"), ("Stricter states", "Their rule wins. Next slides.")],
         "Time is the lead’s local time, not yours. A 9 AM call from New York reaches Los Angeles at 6 AM.")
ch_slide(3, "Ends at 8 PM", "These states stop an hour early.", [("FL · MD · MA", "8 AM–8 PM"), ("OK · OR · WA", "8 AM–8 PM"), ("WY", "8 AM–8 PM"), ("AL · LA · MS", "8 AM–8 PM, and no Sundays")], lw=330)
ch_slide(4, "Starts later", "These states start late.", [("KY", "10 AM–9 PM"), ("CT · NV", "9 AM–8 PM"), ("MI · MN · NM", "9 AM–9 PM"), ("SD", "9 AM–9 PM, no Sundays"), ("PA", "9 AM–7 PM, no Sundays (from Oct 18)")], lw=330)
ch_slide(5, "Weekends and holidays", "Sundays are different.", [("No Sundays", "AL · LA · MS · PA · RI · SD"), ("TX Sundays", "Noon to 9 PM"), ("RI", "Weekdays 9–6, Saturdays 10–5"), ("No holidays", "AL · LA · RI")], lw=330)
ch_slide(6, "Call limits", "3 calls in 24 hours. That’s it.", [("Florida", "3 sales calls to one person in 24 hours"), ("Maryland", "3 in 24 hours"), ("Oklahoma", "3 in 24 hours"), ("Oregon", "3 in 24 hours")],
         "The limit is per person, per 24 hours, for sales calls on the same subject.", lw=280)
post("W4-Hours-7", "Calling hours 7: VPEX tracks it (end)", NIGHT,
    stack(88, 90, 900, [headline("Nobody can keep that in their head. VPEX does.", 92, PAPER),
                        para("Every lead shows their local time. Outside their state’s hours, or over a call limit, VPEX flags it and moves on.", 38, MIST)], 30) +
    zoom("pa_sunday", *WARN, None, 560, 2.5, True) + zoom("fl_cap", *WARN, None, 770, 2.5, True) +
    at(88, 960, '<div style="display: flex; gap: 30px; align-items: baseline">%s%s</div>' % (big("COMMENT", 84, PAPER, UNB), big("DEMO", 84, GOLD, UNB))) +
    small(LEGAL, 1140, True) + foot_dark(1262))

# ========== 3. Thu: carousel, first-call questions by industry ("Built for your floor" got the most shares) ==========
QS = [("Insurance", "Product · age · coverage · budget a month · tobacco · current carrier · renewal date"),
      ("Real estate", "Buying or selling · property · price range · timeframe · financing · has an agent · why moving"),
      ("Business funding", "Industry · monthly revenue · time in business · credit · open advances · amount needed"),
      ("Auto", "Vehicle wanted · new or used · trade-in · payment budget · credit · when buying"),
      ("Solar", "Owns the home · electric bill · utility · roof age · shade · credit · all owners at the appointment")]
post("W4-Qs-1", "First-call questions (cover)", PAPER,
    at(84, 96, headline("The questions that qualify a lead on the first call.", 108, INK), w=910) +
    at(88, 560, para("By industry. Ask them while you talk; skip the second call.", 44, SLATE, "font-weight: 600"), w=880) +
    at(88, 760, '<div style="display: flex; flex-wrap: wrap; gap: 16px; width: 904px">%s</div>' % "".join(
        '<span style="font-family: %s; font-weight: 700; font-size: 38px; padding: 16px 28px; border-radius: 999px; background: #E9ECF6; color: %s">%s</span>' % (ARCH, INK, q[0]) for q in QS)) +
    foot_light(1262, "Swipe"))
for i, (ind, qs) in enumerate(QS):
    items = [q.strip() for q in qs.split("·")]
    post("W4-Qs-%d" % (i + 2), "First-call questions: %s" % ind, PAPER,
        at(88, 80, para("%d of %d" % (i + 1, len(QS)), 30, SLATE, "font-weight: 700")) +
        at(84, 128, headline(ind + ".", 110 if len(ind) < 12 else 92, INK, "white-space: nowrap"), w=910) +
        at(88, 330, '<div style="width: 904px">%s</div>' % "".join(
            '<div style="display: flex; gap: 24px; align-items: baseline; padding: 18px 0; border-top: 2px solid %s"><span style="font-family: %s; font-weight: 800; font-size: 40px; color: %s; width: 44px">%d</span>'
            '<span style="font-family: %s; font-weight: 650; font-size: 44px; color: %s">%s</span></div>' % (RULE_L, BIGS, GOLDINK, j + 1, ARCH, INK, q[0].upper() + q[1:]) for j, q in enumerate(items))) +
        foot_light(1262, "Swipe"))
post("W4-Qs-7", "First-call questions (end)", NIGHT,
    stack(88, 90, 900, [headline("Built for your floor.", 120, PAPER), para("Pick your industry and VPEX asks these on the dial screen. Answers save to the lead and the whole team sees them.", 38, MIST)], 30) +
    phone("qualify", 640, 470, 360, True) +
    at(88, 640, big("COMMENT", 72, PAPER, UNB)) + at(88, 740, big("DEMO", 72, GOLD, UNB)) +
    at(92, 860, para("for a live demo office in your industry.", 34, MIST), w=480) + foot_dark(1262))

# ========== 4. Fri: static, your phone buzzes ==========
post("W4-Buzz", "Post: your phone buzzes when a follow-up is due", PAPER,
    stack(84, 96, 500, [headline("Your phone buzzes when a follow-up is due.", 78, INK),
                        para("Even with VPEX closed and the phone locked. Appointments 10 minutes early. New handoffs right away.", 34, SLATE),
                        fix_label(), para("Settings → Notifications → Turn on. That’s it.", 34, INK, "font-weight: 650")], 28) +
    lock(610, 90, 400, "2:00", "PM", "Tuesday", [("Callback due: Maria Lopez", "She asked for Tuesday at 2. (555) 010-2233", "now")]) +
    foot_light(1262))

# ========== 5. Sat: carousel, a day on a VPEX floor ==========
DAY = [("8:30 AM", "The summary.", "Every rep gets one notification: what’s waiting today.", ("lock", "8:30", "AM", [("Good morning, Jordan", "14 follow-ups waiting (3 new today) · 2 appointments today, first at 10:30 AM.", "now")])),
       ("9:00 AM", "First call.", "Local time on every lead, so nobody calls too early or too late.", ("shot", "ny_ok")),
       ("12:15 PM", "The callback buzzes.", "Due now, with the lead’s name. Tap it and you’re on the dial screen.", ("lock", "12:15", "PM", [("Callback due: Marcus Hill", "He said after lunch. (555) 010-4471", "now")])),
       ("2:30 PM", "The handoff.", "Setter books it, closer gets it, with the whole history.", ("shot", "handoff_sheet4")),
       ("2:31 PM", "The confirmation.", "The text is already written, in the lead’s own time. One tap to send.", ("shot", "confirm_text")),
       ("5:00 PM", "The scoreboard.", "Calls, conversations and appointments for every rep. No walking the floor.", ("shot", "scoreboard"))]
post("W4-Day-1", "A day on a VPEX floor (cover)", NIGHT,
    at(84, 96, headline("A day on a VPEX floor.", 140, PAPER), w=900) +
    at(88, 470, rows([(t, h) for t, h, _, _ in DAY], True, 42, 260)) + foot_dark(1262, "Swipe"))
for i, (t, h, d, vis) in enumerate(DAY):
    pic = lock(560, 120, 420, vis[1], vis[2], "Tuesday", vis[3]) if vis[0] == "lock" else phone(vis[1], 580, 120, 400, vis[1] == "scoreboard")
    post("W4-Day-%d" % (i + 2), "A day %d: %s" % (i + 1, h), PAPER,
        at(70, 110, big(t.split()[0], 190, INK)) + at(88, 300, para(t.split()[1], 50, SLATE, "font-weight: 700")) +
        stack(88, 470, 440, [headline(h, 60 if len(h) > 13 else 72, INK), para(d, 34, SLATE)], 24) + pic + foot_light(1262, "Swipe"))
B[-1] = (B[-1][0], B[-1][1], 1080, 1350, B[-1][4])
post("W4-Day-8", "A day on a VPEX floor (end)", NIGHT,
    stack(88, 110, 900, [headline("That’s the whole day.", 120, PAPER), para("One app on the phones your reps already carry. $49 per rep, per month.", 40, MIST)], 34) +
    at(88, 640, big("COMMENT", 128, PAPER, UNB)) + at(88, 780, big("DEMO", 128, GOLD, UNB)) +
    at(92, 950, para("We’ll send you a live demo office. 7 days free, no card to start.", 38, MIST), w=860) + foot_dark(1262))

# ========== 6. Sun: static, pricing ==========
post("W4-Price", "Post: $49 per rep", PAPER,
    at(70, 90, big("$49", 420, INK)) +
    at(88, 480, headline("per rep, per month. Everything in.", 76, INK), w=900) +
    at(88, 760, rows([("Dialer", "One tap to call, one tap to log"), ("Follow-ups", "Booked automatically, buzz on time"), ("Compliance", "Calling hours for every state"), ("Team", "Scoreboard, handoffs, contests"), ("Phones", "Your reps’ own. Nothing to buy.")], False, 36, 250)) +
    foot_light(1262, "7 days free · no card to start"))

# ========== 7. Mon: carousel, before you dial a new list ==========
CHECKS = [("Scrub it against the National Do Not Call Registry.", "Do this before you upload. VPEX doesn’t check the national registry; it keeps your office’s own Do Not Call list.", None),
          ("Know their state’s hours.", "20 states are stricter than 8 AM to 9 PM. VPEX flags any lead outside their state’s hours.", "pa_evening"),
          ("Count your calls in FL, MD, OK and OR.", "3 sales calls to one person in 24 hours. VPEX counts and shows when the next call is allowed.", "fl_cap"),
          ("Honor STOP on texts.", "Every VPEX text template ends with an opt-out. Mark a lead “Do not text” and no text is offered again.", None),
          ("Keep your own Do Not Call list.", "Anyone who asks to stop goes on it, and VPEX skips them for the whole office.", None)]
post("W4-Checks-1", "Before you dial a new list (cover)", PAPER,
    at(84, 96, headline("Before you dial a new list:", 120, INK), w=900) +
    at(70, 470, big("5", 560, GOLDINK)) + at(430, 760, headline("checks.", 150, INK)) +
    small(LEGAL, 1150, False) + foot_light(1262, "Swipe"))
for i, (h, d, shot) in enumerate(CHECKS):
    pic = zoom(shot, *WARN, None, 880, 2.5) if shot else ""
    post("W4-Checks-%d" % (i + 2), "Check %d: %s" % (i + 1, h), PAPER,
        at(84, 76, '<div style="display: flex; align-items: baseline; gap: 18px">%s<span style="font-family: %s; font-weight: 600; font-size: 30px; color: %s">of 5</span></div>' % (big(str(i + 1), 170, GOLDINK), ARCH, SLATE)) +
        stack(84, 270, 912, [headline(h, 80, INK), para(d, 38, SLATE)], 28) + pic + foot_light(1262, "Swipe"))
post("W4-Checks-7", "Before you dial (end)", NIGHT,
    stack(88, 100, 900, [headline("Then dial. VPEX handles the rest.", 110, PAPER), para("Local time on every lead, state rules built in, follow-ups that book themselves.", 40, MIST)], 34) +
    at(88, 760, big("COMMENT", 128, PAPER, UNB)) + at(88, 900, big("DEMO", 128, GOLD, UNB)) +
    small(LEGAL, 1150, True) + foot_dark(1262))

# ========== stories (1080x1920). 9 AM ones carry a sticker added by hand (the bot reminds Vincent). ==========
story("W4-Story-Wed-2", "Wed 3 PM · New: calling hours built in", PAPER,
    stack(84, 260, 900, [headline("New in VPEX: every state’s calling hours.", 104, INK), para("20 states are stricter than 8 AM to 9 PM. VPEX flags a lead outside their state’s hours before anyone dials.", 44, SLATE)], 34) +
    zoom("pa_evening", *WARN, None, 820, 2.9) + phone("pa_evening", 390, 1080, 300) + story_foot(False, 1800))
story("W4-Story-Wed-3", "Wed 8 PM · PA 9-7", NIGHT,
    at(84, 260, para("Pennsylvania, from Oct 18", 44, GOLD, "font-weight: 700")) +
    at(70, 330, big("9–7", 420, PAPER)) + at(84, 700, headline("No sales calls on Sundays.", 104, RED_D), w=900) +
    small("Covers unsolicited sales calls and texts; exceptions apply. " + LEGAL, 1500, True, size=30) + story_foot(True))
story("W4-Story-Thu-2", "Thu 3 PM · Spam Likely teaser", NIGHT,
    at(84, 280, headline("Is your number showing up as", 96, PAPER), w=900) +
    at(84, 540, big("Spam Likely?", 170, RED_D, ARCH, "font-stretch: 110%; letter-spacing: -0.03em")) +
    at(84, 900, para("3 habits that get it flagged, in today’s Reel.", 50, MIST), w=900) + story_foot(True))
story("W4-Story-Thu-3", "Thu 8 PM · save the hours carousel", PAPER,
    stack(84, 280, 900, [headline("Calling hours, state by state.", 120, INK), para("It’s on our page. Save it for the next time someone asks “can I call Texas on a Sunday?”", 48, SLATE)], 36) +
    at(84, 1000, rows([("TX Sunday", "Noon to 9 PM"), ("PA", "9 AM–7 PM, no Sundays"), ("FL", "8 AM–8 PM")], False, 46, 300)) + story_foot(False))
story("W4-Story-Fri-1", "Fri 9 AM · Poll: do you call PA?", NIGHT,
    stack(84, 280, 900, [headline("Do your reps call Pennsylvania leads?", 112, PAPER), para("The rules changed on Oct 18: 9 AM–7 PM, no Sundays.", 48, MIST)], 40) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))
story("W4-Story-Fri-2", "Fri 3 PM · the buzz", NIGHT,
    at(84, 240, headline("2:00 PM. VPEX closed. Phone locked.", 96, PAPER), w=900) +
    lock(170, 560, 740, "2:00", "PM", "Friday", [("Callback due: Maria Lopez", "She asked for Friday at 2. (555) 010-2233", "now")]) + story_foot(True, 1780))
story("W4-Story-Fri-3", "Fri 8 PM · still on time", PAPER,
    stack(84, 300, 900, [headline("Every follow-up, on time. Even when nobody’s looking at the app.", 104, INK),
                         para("Turn it on in Settings → Notifications. Works on iPhone from the Home Screen.", 46, SLATE)], 36) + story_foot(False))
story("W4-Story-Sat-1", "Sat 9 AM · Question: first question", NIGHT,
    stack(84, 280, 900, [headline("What’s the first question you ask a new lead?", 112, PAPER), para("Best answers go in next week’s post.", 48, MIST)], 40) +
    sticker_hint(1400, "Answer below ↓", True) + story_foot(True))
story("W4-Story-Sat-2", "Sat 3 PM · 8:30 summary", NIGHT,
    at(84, 240, headline("8:30 AM, before the first call:", 96, PAPER), w=900) +
    lock(170, 520, 740, "8:30", "AM", "Monday", [("Good morning, Jordan", "14 follow-ups waiting (3 new today) · 2 appointments today, first at 10:30 AM.", "now")]) + story_foot(True, 1780))
story("W4-Story-Sat-3", "Sat 8 PM · a day on a VPEX floor", PAPER,
    stack(84, 280, 900, [headline("A whole day on a VPEX floor, in 8 slides.", 112, INK), para("Summary at 8:30, buzz on every callback, handoff, confirmation text, scoreboard at 5.", 46, SLATE)], 36) +
    at(84, 1000, rows([(t, h) for t, h, _, _ in DAY], False, 40, 230)) + story_foot(False, 1780))
story("W4-Story-Sun-1", "Sun 9 AM · Quiz: Florida", NIGHT,
    stack(84, 280, 900, [headline("How many sales calls can you make to one Florida lead in 24 hours?", 100, PAPER)], 40) +
    sticker_hint(1400, "Quiz below ↓ (answer: 3)", True) + story_foot(True))
story("W4-Story-Sun-2", "Sun 3 PM · confirmation text", PAPER,
    stack(84, 240, 900, [headline("Booked? The confirmation text is already written.", 100, INK), para("Right after the handoff, in the lead’s own time. One tap to send.", 44, SLATE)], 34) +
    zoom("confirm_text", *PROMPT, None, 840, 2.7) + story_foot(False, 1780))
story("W4-Story-Sun-3", "Sun 8 PM · $49", NIGHT,
    at(70, 300, big("$49", 420, GOLD)) + at(84, 660, headline("per rep, per month. Everything in.", 104, PAPER), w=900) +
    at(84, 1060, para("7 days free, no card to start. vpexdialer.com", 50, MIST), w=900) + story_foot(True))
story("W4-Story-Mon-1", "Mon 9 AM · Poll: biggest leak", NIGHT,
    stack(84, 280, 900, [headline("Biggest leak on your floor this week?", 116, PAPER), para("Callbacks, Spam Likely, calling hours or no-shows.", 48, MIST)], 40) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))
story("W4-Story-Mon-2", "Mon 3 PM · 5 checks teaser", PAPER,
    stack(84, 280, 900, [headline("Before you dial a new list: 5 checks.", 116, INK), para("Number 1 isn’t something any dialer does for you. On our page now.", 48, SLATE)], 36) + story_foot(False))
story("W4-Story-Mon-3", "Mon 8 PM · Comment DEMO", NIGHT,
    stack(84, 300, 900, [headline("Want to try it?", 130, PAPER), para("Comment DEMO on any post and we’ll send you a live demo office for your industry.", 52, MIST)], 40) +
    at(84, 900, big("DEMO", 220, GOLD, UNB)) + story_foot(True))

if __name__ == "__main__":
    for b in B: print(b[0], b[2], b[3], b[1])
    print(len(B), "boards")
