# VPEX Instagram, week 3 ("Every floor leaks"): problem-first boards. Each post names a leak first; the fix comes second,
# shown with real VPEX screens from a demo office (fictional leads, 555 numbers). Shares helpers and tokens with weeks 1-2.
import os, importlib.util
D = os.path.dirname(os.path.abspath(__file__))
IG = os.path.join(D, "..", "ig")
spec = importlib.util.spec_from_file_location("kit", IG + "/kit.py"); kit = importlib.util.module_from_spec(spec); spec.loader.exec_module(kit)
NIGHT, GOLD, GOLDINK, PAPER, INK, SLATE, MIST = kit.NIGHT, kit.GOLD, kit.GOLDINK, kit.PAPER, kit.INK, kit.SLATE, kit.MIST
ARCH, BIGS, UNB = kit.ARCH, kit.BIGS, kit.UNB
img, at, board, headline, para, wordmark, phone = kit.img, kit.at, kit.board, kit.headline, kit.para, kit.wordmark, kit.phone
foot_dark, foot_light = kit.foot_dark, kit.foot_light
RED, RED_D = "#C2362B", "#FF6B5E"            # the leak (problem) color: light / dark backgrounds
REEL_BG = "#070A1E"                           # matches the Reels
RULE_L, RULE_D = "#D8DCE8", "rgba(199,203,228,0.22)"
SW, SH = 390, 844

def zoom(name, sx, sy, sw, sh, x, y, scale, dark=False, r=26):
    """An enlarged piece of an app screen, lifted off the page (sx..sh in 390x844 screen px). x=None centers it."""
    w, h = round(sw * scale), round(sh * scale)
    if x is None: x = (1080 - w) // 2
    shadow = "0 46px 90px -34px rgba(0,0,0,0.75)" if dark else "0 46px 90px -34px rgba(19,26,62,0.5)"
    return ('<div style="position: absolute; left: %dpx; top: %dpx; width: %dpx; height: %dpx; overflow: hidden; border-radius: %dpx; background: #ffffff; '
            'box-shadow: 0 0 0 5px %s, %s">'
            '<img src="%s" alt="" style="position: absolute; left: %dpx; top: %dpx; width: %dpx; height: %dpx; max-width: none"></div>'
            % (x, y, w, h, r, GOLD, shadow, img(name), round(-sx * scale), round(-sy * scale), round(SW * scale), round(SH * scale)))

def stack(x, y, w, parts, gap=36):
    return at(x, y, '<div style="display: flex; flex-direction: column; gap: %dpx">%s</div>' % (gap, "".join(parts)), w=w)

def fix_label(dark=False):
    return ('<div style="display: flex; align-items: center; gap: 16px"><span style="display: block; width: 46px; height: 6px; border-radius: 3px; background: %s"></span>'
            '<span style="font-family: %s; font-weight: 700; font-size: 30px; color: %s">The fix</span></div>' % (GOLD, ARCH, GOLD if dark else GOLDINK))

def big(text, size, color, font=BIGS, extra=""):
    return '<div style="font-family: %s; font-weight: 800; font-size: %dpx; line-height: 0.82; letter-spacing: -0.01em; color: %s; %s">%s</div>' % (font, size, color, extra, text)

def struck(items, dark=True, size=58, pad=22):
    """The leak list, each line crossed out in red."""
    line = RED_D if dark else RED
    return "".join('<div style="padding: %dpx 0; border-top: 2px solid %s; white-space: nowrap">'
                   '<span style="position: relative; display: inline-block; font-family: %s; font-weight: 750; font-stretch: 110%%; font-size: %dpx; line-height: 1.05; letter-spacing: -0.02em; color: %s">%s'
                   '<span style="position: absolute; left: -6px; right: -6px; top: 52%%; height: 8px; border-radius: 4px; background: %s"></span></span></div>'
                   % (pad, RULE_D if dark else RULE_L, ARCH, size, "#8A93B8" if dark else SLATE, t, line) for t in items)

def leaklist(items, dark=False, size=34, cols=2, w=912):
    """Compact numbered preview of the leaks (cover slide)."""
    cells = "".join('<div style="display: flex; align-items: baseline; gap: 16px; padding: 14px 0; border-top: 2px solid %s">'
                    '<span style="font-family: %s; font-weight: 800; font-size: %dpx; line-height: 0.9; color: %s; width: 30px">%d</span>'
                    '<span style="font-family: %s; font-weight: 650; font-size: %dpx; line-height: 1.15; color: %s">%s</span></div>'
                    % (RULE_D if dark else RULE_L, BIGS, size + 10, RED_D if dark else RED, i + 1, ARCH, size, PAPER if dark else INK, t) for i, t in enumerate(items))
    return '<div style="display: grid; grid-template-columns: repeat(%d, 1fr); column-gap: 44px; width: %dpx">%s</div>' % (cols, w, cells)

B = []   # (file stem, title, w, h, html)

# ---------- 19-27: Reel covers (1080x1920; words stay inside the middle 1080x1350 so the grid crop keeps them) ----------
def cover(stem, title, inner):
    B.append((stem, title, 1080, 1920, board(1080, 1920, REEL_BG, inner + at(0, 1500, '<div style="width: 1080px; display: flex; justify-content: center">%s</div>' % wordmark(64)))))
def lines(rows, top, gap=10):
    """Stacked, centered uppercase lines: (text, size, color)."""
    out = "".join('<div style="font-family: %s; font-weight: 800; font-size: %dpx; line-height: 1; letter-spacing: -0.01em; color: %s; white-space: nowrap">%s</div>' % (UNB, s, c, t) for t, s, c in rows)
    return at(0, top, '<div style="width: 1080px; display: flex; flex-direction: column; align-items: center; gap: %dpx">%s</div>' % (gap, out))
cover("W3-Cover-G", "19 · Reel cover: He said call me back at 2", lines([("HE SAID", 120, PAPER), ("“CALL ME", 140, PAPER), ("BACK AT 2.”", 138, GOLD)], 520, 16) +
      at(0, 1010, '<div style="width: 1080px; text-align: center; font-family: %s; font-weight: 800; font-size: 300px; line-height: 0.85; color: %s">4:45<span style="font-size: 110px; margin-left: 14px">PM</span></div>' % (BIGS, RED_D)))
cover("W3-Cover-H", "21 · Reel cover: Spam Likely", lines([("THEIR SCREEN", 64, MIST), ("SPAM", 250, RED_D), ("LIKELY.", 196, RED_D)], 520, 22) +
      at(0, 1190, '<div style="width: 1080px; text-align: center; font-family: %s; font-weight: 700; font-size: 52px; color: %s">when your rep calls.</div>' % (ARCH, PAPER)))
cover("W3-Cover-I", "23 · Reel cover: It's 5 PM", lines([("IT’S", 110, PAPER)], 420) +
      at(0, 560, '<div style="width: 1080px; text-align: center; font-family: %s; font-weight: 800; font-size: 380px; line-height: 0.85; color: %s">5:00<span style="font-size: 140px; margin-left: 16px">PM</span></div>' % (BIGS, GOLD)) +
      lines([("DO YOU KNOW", 96, PAPER), ("WHAT YOUR FLOOR", 80, PAPER), ("DID TODAY?", 108, PAPER)], 940, 14))
cover("W3-Cover-J", "25 · Reel cover: 11 taps", at(0, 360, '<div style="width: 1080px; text-align: center; font-family: %s; font-weight: 800; font-size: 620px; line-height: 0.82; color: %s">11</div>' % (BIGS, GOLD)) +
      lines([("TAPS TO MAKE", 104, PAPER), ("ONE CALL.", 150, PAPER)], 920, 18))
cover("W3-Cover-K", "27 · Reel cover: Every floor leaks", lines([("EVERY", 230, PAPER), ("FLOOR", 230, PAPER), ("LEAKS.", 216, RED_D)], 470, 26))

# ---------- 20. carousel: 7 places deals go to die ----------
LEAKS = [
    ("The callback nobody made.", "“Call me back at 2.” At 4:45 they bought from the rep who called.",
     "Tap Interested and the follow-up books itself. When it’s due, it’s first in line.",
     [("after_interested", 6, 6, 378, 62, 2.41, False), ("after_interested", 8, 360, 374, 46, 2.43, False)]),
    ("Two reps. One lead.", "Two pitches, two prices, one confused prospect. Then they stop picking up.",
     "When a rep opens a lead, VPEX holds it for them. Everyone else’s queue skips it.",
     [("team_access", 22, 390, 210, 74, 3.25, False)]),
    ("Spam Likely.", "Too many short calls, too close together. Now nobody answers your number.",
     "VPEX paces your calls and asks before you redial someone you just called.",
     [("redial_guard", 0, 668, 390, 150, 2.34, False)]),
    ("The 5 AM wake-up call.", "It’s 8:25 in New York and 5:25 in California. That lead will remember you.",
     "Every lead shows their own local time. Outside 8 AM to 9 PM, VPEX flags it in red.",
     [("too_early_pacific", 14, 400, 300, 106, 3.04, False)]),
    ("Notes nobody wrote.", "Six calls in, nobody remembers who said what. The next rep starts from zero.",
     "One tap logs what happened, books the next try and keeps the history on the lead.",
     [("outcomes", 30, 540, 330, 128, 2.6, False)]),
    ("The rep who quit.", "Their leads, notes and follow-ups lived in their own spreadsheet. Now they’re gone too.",
     "Leads, notes and call history belong to your office. Turn off a login and it’s signed out within seconds.",
     [("team_access", 14, 142, 362, 78, 2.46, False)]),
    ("5 PM guesswork.", "Who called? Who’s behind? Which leads went cold? “Let me ask around.”",
     "A live scoreboard: every rep’s calls, conversations and pipeline, on your phone.",
     [("scoreboard", 16, 604, 358, 206, 1.8, True)]),
]
B.append(("W3-20-Leaks-1", "20 · 7 places deals go to die (cover)", 1080, 1350, board(1080, 1350, PAPER,
    at(64, 70, big("7", 560, RED)) +
    at(84, 556, headline("places deals go to die.", 118, INK), w=900) +
    at(88, 830, para("None of them is your lead list.", 42, SLATE, "font-weight: 600"), w=900) +
    at(84, 930, leaklist([l[0].rstrip(".") for l in LEAKS], False, 28)) +
    foot_light(1262, "Swipe"))))
for i, (prob, cost, fix, zs) in enumerate(LEAKS):
    zh = ""; y = 870
    for (nm, sx, sy, sw, sh, sc, dk) in zs:
        zh += zoom(nm, sx, sy, sw, sh, None, y, sc, dk); y += round(sh * sc) + 34
    B.append(("W3-20-Leaks-%d" % (i + 2), "20 · Leak %d: %s" % (i + 1, prob), 1080, 1350, board(1080, 1350, PAPER,
        at(84, 76, '<div style="display: flex; align-items: baseline; gap: 18px">%s<span style="font-family: %s; font-weight: 600; font-size: 30px; color: %s">of 7</span></div>' % (big(str(i + 1), 170, RED), ARCH, SLATE)) +
        stack(84, 260, 912, [headline(prob, 84, INK), para(cost, 36, SLATE)], 24) +
        stack(84, 640, 912, [fix_label(), para(fix, 36, INK, "font-weight: 600")], 18) +
        zh + foot_light(1262, "Swipe"))))
B.append(("W3-20-Leaks-9", "20 · Plug the leaks (end)", 1080, 1350, board(1080, 1350, NIGHT,
    stack(88, 100, 900, [headline("Plug the leaks.", 132, PAPER), para("VPEX is a power dialer built around them: follow-ups that book themselves, pacing that protects your number, and a live view of your whole floor.", 38, MIST)], 34) +
    at(88, 700, big("COMMENT", 128, PAPER, UNB)) + at(88, 840, big("DEMO", 128, GOLD, UNB)) +
    at(92, 1010, para("We’ll send you a live demo office to try. 7 days free, no card to start.", 38, MIST), w=860) +
    foot_dark(1262))))

# ---------- 22. static: two reps, one lead ----------
B.append(("W3-22-TwoReps", "22 · Two reps. One lead. Same afternoon.", 1080, 1350, board(1080, 1350, PAPER,
    at(84, 96, headline("Two reps.<br>One lead.<br>Same afternoon.", 96, INK), w=940) +
    stack(88, 440, 430, [para("Two pitches. Two prices. Then the lead stops picking up.", 36, SLATE),
                         fix_label(), para("When a rep opens a lead, VPEX holds it for them. Everyone else’s queue skips it, and you can see who’s on what.", 32, INK, "font-weight: 600")], 26) +
    phone("team_access", 560, 430, 440) +
    zoom("team_access", 22, 390, 210, 74, 60, 1030, 2.3) +
    foot_light(1262))))

# ---------- 24. carousel: do the math ----------
def mathslide(n, num, numcolor, label, tally, extra=""):
    return ("W3-24-Math-%d" % n, "24 · Do the math %d" % n, 1080, 1350, board(1080, 1350, PAPER,
        at(70, 150, big(num, 420, numcolor)) +
        at(84, 560, headline(label, 84, INK), w=900) +
        (at(88, 900, '<div style="font-family: %s; font-weight: 700; font-stretch: 105%%; font-size: 40px; color: %s; padding-top: 26px; border-top: 3px solid %s; width: 904px">%s</div>' % (ARCH, SLATE, RULE_L, tally)) if tally else "") +
        extra + foot_light(1262, "Swipe")))
B.append(("W3-24-Math-1", "24 · Do the math (cover)", 1080, 1350, board(1080, 1350, PAPER,
    at(84, 96, headline("One missed callback a day.", 120, INK), w=900) +
    at(84, 520, big("Do the math.", 210, RED, ARCH, "font-stretch: 112%; letter-spacing: -0.03em; line-height: 0.9")) +
    at(88, 1000, para("Example numbers. Swap in your floor’s.", 36, SLATE, "font-weight: 600"), w=900) +
    foot_light(1262, "Swipe"))))
B.append(mathslide(2, "10", INK, "reps on your floor.", "10 reps"))
B.append(mathslide(3, "×1", INK, "callback each, every day, that nobody makes.", "10 × 1 = 10 a day"))
B.append(mathslide(4, "×20", INK, "workdays in a month.", "10 × 1 × 20 = 200 a month"))
B.append(("W3-24-Math-5", "24 · 200 people who asked you to call", 1080, 1350, board(1080, 1350, PAPER,
    at(70, 150, big("200", 420, RED)) +
    at(84, 560, headline("people who asked you to call back. Every month.", 84, INK), w=900) +
    at(88, 900, '<div style="padding-top: 26px; border-top: 3px solid %s; width: 904px">%s</div>' % (RULE_L, para("Now multiply by your close rate and your average deal. That’s what’s leaking.", 40, SLATE, "font-weight: 600"))) +
    foot_light(1262, "Swipe"))))
B.append(("W3-24-Math-6", "24 · Every callback, on time (end)", 1080, 1350, board(1080, 1350, NIGHT,
    at(88, 100, headline("Every callback, back in front of the rep. On time.", 96, PAPER), w=900) +
    zoom("after_interested", 6, 6, 378, 62, None, 520, 2.41, True) +
    zoom("followups_coach", 6, 6, 378, 62, None, 700, 2.41, True) +
    at(88, 900, big("COMMENT", 96, PAPER, UNB)) + at(88, 1005, big("DEMO", 96, GOLD, UNB)) +
    at(92, 1130, para("We’ll send you a live demo office. 7 days free.", 36, MIST), w=900) +
    foot_dark(1262))))

# ---------- 26. static: your best rep quit ----------
B.append(("W3-26-RepQuit", "26 · Your best rep quit.", 1080, 1350, board(1080, 1350, PAPER,
    at(84, 96, headline("Your best rep quit.<br>Their pipeline<br>left with them.", 84, INK), w=960) +
    stack(88, 420, 430, [para("Leads in a personal spreadsheet. Notes in their head. Follow-ups on their phone.", 36, SLATE),
                         fix_label(), para("In VPEX, leads, notes and call history belong to your office. Turn off a login and it’s signed out within seconds.", 32, INK, "font-weight: 600")], 26) +
    phone("team_access", 560, 420, 440) +
    zoom("team_access", 14, 142, 362, 78, 60, 1090, 1.3) +
    foot_light(1262))))

# ---------- Daily stories (1080x1920; words between 250 and 1580 px; stickers go in the open space) ----------
def story(stem, title, bg, inner): B.append((stem, title, 1080, 1920, board(1080, 1920, bg, inner)))
def story_foot(dark, y=1620):
    return at(88, y, '<div style="display: flex; align-items: baseline; gap: 22px">%s<span style="font-family: %s; font-weight: 600; font-size: 30px; color: %s">vpexdialer.com</span></div>'
              % (wordmark(52, GOLD if dark else GOLDINK), ARCH, MIST if dark else SLATE))
def sticker_hint(y, text, dark):
    # a small arrow + hint where the sticker goes, so the frame still reads if the sticker is moved
    return at(88, y, '<div style="font-family: %s; font-weight: 600; font-size: 34px; color: %s">%s</div>' % (ARCH, MIST if dark else SLATE, text))

story("W3-Story-Mon-1", "Mon 1 · Poll: does the callback happen?", NIGHT,
    stack(84, 280, 900, [headline("“Call me back at 2.”", 120, PAPER), para("On your floor, does that callback actually happen?", 46, MIST)], 40) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))
story("W3-Story-Mon-2", "Mon 2 · VPEX books it", PAPER,
    stack(84, 270, 900, [headline("In VPEX, it books itself.", 104, INK), para("Tap Interested. The follow-up is set before you hang up.", 44, SLATE)], 34) +
    zoom("after_interested", 6, 6, 378, 62, None, 760, 2.41) + zoom("after_interested", 8, 360, 374, 46, None, 950, 2.43) +
    phone("after_interested", 600, 1130, 400) + story_foot(False))
story("W3-Story-Tue-1", "Tue 1 · Poll: Spam Likely", NIGHT,
    at(84, 280, headline("Ever seen your own number show up as", 92, PAPER), w=900) +
    at(84, 560, big("Spam Likely?", 170, RED_D, ARCH, "font-stretch: 110%; letter-spacing: -0.03em")) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))
story("W3-Story-Tue-2", "Tue 2 · Redial too soon? It asks first.", PAPER,
    stack(84, 270, 900, [headline("Redialing too soon? VPEX asks first.", 100, INK), para("Plus steady pacing between calls, so your number keeps getting answered.", 44, SLATE)], 34) +
    phone("redial_guard", 340, 700, 400) + story_foot(False))
story("W3-Story-Wed-1", "Wed 1 · Poll: same lead, two reps", NIGHT,
    stack(84, 280, 900, [headline("Two of your reps called the same lead today.", 104, PAPER), para("Would you even know?", 52, MIST, "font-weight: 600")], 40) +
    sticker_hint(1400, "Vote below ↓", True) + story_foot(True))
story("W3-Story-Wed-2", "Wed 2 · VPEX holds the lead", PAPER,
    stack(84, 270, 900, [headline("One rep per lead. Automatically.", 104, INK), para("When a rep opens a lead, VPEX holds it for them. Everyone else’s queue skips it.", 44, SLATE)], 34) +
    zoom("team_access", 22, 390, 210, 74, None, 800, 4.0) + story_foot(False))
story("W3-Story-Thu-1", "Thu 1 · Slider: calls today", NIGHT,
    at(70, 250, big("5:00<span style=\"font-size: 110px; margin-left: 14px\">PM</span>", 300, GOLD)) +
    stack(84, 560, 900, [headline("How many calls did your floor make today?", 96, PAPER), para("No peeking. Then answer below.", 46, MIST)], 34) +
    sticker_hint(1400, "Answer below ↓", True) + story_foot(True))
story("W3-Story-Thu-2", "Thu 2 · Or just look", NIGHT,
    stack(84, 270, 900, [headline("Or just look.", 120, PAPER), para("Every rep, every call, live. On your phone.", 44, MIST)], 34) +
    phone("scoreboard", 330, 620, 420, dark=True) + story_foot(True))
story("W3-Story-Fri-1", "Fri 1 · Quiz: taps per call", NIGHT,
    stack(84, 280, 900, [headline("How many taps does it take your reps to make one call?", 100, PAPER), para("Unlock, find the row, copy, paste, call, log it… count them.", 44, MIST)], 40) +
    sticker_hint(1400, "Pick one below ↓", True) + story_foot(True))
story("W3-Story-Fri-2", "Fri 2 · One tap to call, one tap to log", PAPER,
    stack(84, 270, 900, [headline("One tap to call. One tap to log.", 104, INK), para("Then VPEX lines up the next lead.", 44, SLATE)], 34) +
    zoom("outcomes", 30, 540, 330, 128, None, 740, 2.6) + phone("dial_card", 600, 1110, 400) + story_foot(False))
story("W3-Story-Sat-1", "Sat 1 · Do the math", PAPER,
    stack(84, 270, 900, [headline("Do the math.", 140, INK), para("10 reps × 1 missed callback a day × 20 workdays =", 50, SLATE, "font-weight: 600")], 40) +
    at(70, 760, big("200", 460, RED)) +
    at(88, 1150, para("people who asked you to call back, every month.", 50, INK, "font-weight: 700"), w=900) +
    at(88, 1320, para("Example numbers. Swap in yours.", 36, SLATE), w=900) + story_foot(False))
story("W3-Story-Sat-2", "Sat 2 · Every floor leaks", NIGHT,
    at(84, 270, headline("Every floor leaks.", 120, PAPER), w=900) +
    at(88, 560, struck(["Callbacks nobody made", "Two reps, one lead", "Spam Likely", "Calls at 7 AM", "The rep who quit", "5 PM guesswork"], True, 60, 24), w=904) +
    story_foot(True))
story("W3-Story-Sun-1", "Sun 1 · Poll: which leak costs most", PAPER,
    stack(84, 280, 900, [headline("Which leak costs your floor the most?", 110, INK), para("Missed callbacks, Spam Likely, reps doubling up, or no idea what happened today?", 44, SLATE)], 40) +
    sticker_hint(1400, "Vote below ↓", False) + story_foot(False))
story("W3-Story-Sun-2", "Sun 2 · Comment DEMO", NIGHT,
    stack(84, 280, 900, [headline("Want to see it on your floor?", 104, PAPER)], 0) +
    at(84, 640, big("COMMENT", 132, PAPER, UNB)) + at(84, 790, big("DEMO", 132, GOLD, UNB)) +
    at(88, 980, para("on any post this week. We’ll send you a live demo office to try. 7 days free.", 46, MIST), w=900) +
    story_foot(True))
