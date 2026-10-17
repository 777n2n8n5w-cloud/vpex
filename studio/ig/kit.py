# VPEX Instagram kit: every static board as inline-styled markup (shared by the PNG renderer and the Design canvas).
NIGHT, NIGHT2, GOLD, GOLDINK, PAPER, INK, SLATE, MIST, SIGNAL = "#0E1433", "#1A2260", "#E8B94A", "#9A6F10", "#F4F5F9", "#131A3E", "#4A5274", "#C7CBE4", "#2F55E4"
ARCH, BIGS, UNB = "Arch, 'Archivo', sans-serif", "BigS, 'Big Shoulders Display', sans-serif", "Unb, 'Unbounded', sans-serif"
SW, SH = 390, 844   # app screen size the screenshots were taken at

# Where things are on the captured screens (in 390x844 screen px), for the gold tap ring
TAPS = {
    "dial_insurance": (135, 694, 196, 56), "live": (114, 580, 154, 54), "noanswer_text": (282, 796, 165, 45),
}

def img(name): return "{IMG:%s}" % name

def phone(name, x, y, w, dark=False, ring=None, ring_label=None):
    pad = round(w * 0.03); sw = w - 2 * pad; sh = round(sw * SH / SW); h = sh + 2 * pad
    R = round(w * 0.135); r = R - pad
    bezel = "#2A3272" if dark else INK
    shadow = "none" if dark else "0 60px 90px -40px rgba(19,26,62,0.55)"
    ring_html = ""
    if ring:
        # a gold outline around the button the rep taps (stills); the Reels animate an actual tap
        cx, cy, bw_, bh_ = TAPS[ring]
        k = sw / SW; o = 7
        ring_html = ('<div style="position: absolute; left: %dpx; top: %dpx; width: %dpx; height: %dpx; border-radius: %dpx; border: 5px solid %s; box-shadow: 0 0 0 7px rgba(232,185,74,0.28); box-sizing: border-box"></div>'
                     % ((cx - bw_ / 2) * k - o, (cy - bh_ / 2) * k - o, bw_ * k + 2 * o, bh_ * k + 2 * o, round(13 * k) + o, GOLD))
    return ('<div style="position: absolute; left: %dpx; top: %dpx; width: %dpx; height: %dpx; box-sizing: border-box; padding: %dpx; border-radius: %dpx; background: %s; box-shadow: %s">'
            '<div style="position: relative; width: %dpx; height: %dpx; border-radius: %dpx; overflow: hidden; background: #ffffff">'
            '<img src="%s" alt="" style="display: block; width: %dpx; height: %dpx">%s</div></div>'
            % (x, y, w, h, pad, R, bezel, shadow, sw, sh, r, img(name), sw, sh, ring_html))

def wordmark(size, color=GOLD, extra=""):
    return '<div style="font-family: %s; font-weight: 800; font-size: %dpx; line-height: 0.9; letter-spacing: -0.01em; color: %s; %s">VPEX</div>' % (UNB, size, color, extra)

def headline(text, size, color, extra="", width=115, weight=800):
    return ('<h1 style="margin: 0; font-family: %s; font-weight: %d; font-stretch: %d%%; font-size: %dpx; line-height: 0.98; letter-spacing: -0.02em; color: %s; text-wrap: balance; %s">%s</h1>'
            % (ARCH, weight, width, size, color, extra, text))

def para(text, size, color, extra=""):
    return '<p style="margin: 0; font-family: %s; font-weight: 500; font-stretch: 100%%; font-size: %dpx; line-height: 1.38; color: %s; %s">%s</p>' % (ARCH, size, color, extra, text)

def board(w, h, bg, inner):
    return '<div style="position: relative; width: %dpx; height: %dpx; overflow: hidden; background: %s; font-family: %s">%s</div>' % (w, h, bg, ARCH, inner)

def at(x, y, inner, w=None, extra=""):
    return '<div style="position: absolute; left: %dpx; top: %dpx; %s%s">%s</div>' % (x, y, ("width: %dpx; " % w) if w else "", extra, inner)

def foot_dark(y=1262, text="Link in bio"):
    return at(88, y, '<div style="display: flex; align-items: baseline; gap: 22px">%s<span style="font-family: %s; font-weight: 600; font-size: 28px; color: %s">%s</span></div>' % (wordmark(46), ARCH, MIST, text))

def foot_light(y=1262, text="Link in bio"):
    return at(88, y, '<div style="display: flex; align-items: baseline; gap: 22px">%s<span style="font-family: %s; font-weight: 600; font-size: 28px; color: %s">%s</span></div>' % (wordmark(46, GOLDINK), ARCH, SLATE, text))

B = []   # (file stem, title, w, h, html)

# ---------- profile picture ----------
B.append(("Profile", "Profile picture", 1080, 1080, board(1080, 1080, NIGHT,
    at(0, 0, '<div style="width: 1080px; height: 1080px; display: flex; align-items: center; justify-content: center">%s</div>' % wordmark(232)))))

# ---------- 1. launch ----------
B.append(("Post1-Launch", "1 · Launch", 1080, 1350, board(1080, 1350, NIGHT,
    at(88, 96, wordmark(236)) +
    at(92, 340, headline("The power dialer for sales floors.", 64, PAPER, width=112, weight=700), w=640) +
    phone("dial_insurance", 470, 600, 560, dark=True) +
    at(92, 1150, para("Free for 7 days.<br>Link in bio.", 34, MIST, "font-weight: 600"), w=330))))

# ---------- 3. carousel: how it works ----------
steps = [("Load your list", "Paste it, upload a spreadsheet, or add leads one at a time.", "load_leads", None),
         ("Tap to call", "The call goes out from your rep's own phone. No lines to buy.", "dial_insurance", "dial_insurance"),
         ("Log it in one tap", "VPEX sets the follow-up and has the text ready to send.", "noanswer_text", "noanswer_text"),
         ("Watch the floor", "Calls, conversations and pipeline for every rep, live.", "scoreboard", None)]
cover = "".join('<div style="display: flex; align-items: baseline; gap: 34px; padding: 26px 0; border-top: 2px solid rgba(199,203,228,0.25)">'
                '<span style="font-family: %s; font-weight: 800; font-size: 120px; line-height: 0.8; color: %s; width: 70px">%d</span>'
                '<span style="font-family: %s; font-weight: 700; font-stretch: 112%%; font-size: 54px; color: %s">%s</span></div>'
                % (BIGS, GOLD, i + 1, ARCH, PAPER, s[0]) for i, s in enumerate(steps))
B.append(("Post3-HowItWorks-1", "3 · How it works (cover)", 1080, 1350, board(1080, 1350, NIGHT,
    at(88, 104, headline("From lead list to follow-up in four steps.", 88, PAPER), w=900) +
    at(88, 480, cover, w=904) + foot_dark(1262, "Swipe"))))
for i, (t, s, shot, ring) in enumerate(steps):
    B.append(("Post3-HowItWorks-%d" % (i + 2), "3 · Step %d" % (i + 1), 1080, 1350, board(1080, 1350, PAPER,
        at(80, 70, '<div style="font-family: %s; font-weight: 800; font-size: 300px; line-height: 0.8; color: %s">%d</div>' % (BIGS, GOLDINK, i + 1)) +
        at(84, 360, headline(t, 76, INK), w=440) +
        at(84, 560, para(s, 36, SLATE), w=430) +
        phone(shot, 560, 300, 470, ring=ring) + foot_light(1262, "Swipe" if i < 3 else "Link in bio"))))
B.append(("Post3-HowItWorks-6", "3 · Try it", 1080, 1350, board(1080, 1350, NIGHT,
    at(88, 104, headline("Try it on your floor for 7 days.", 96, PAPER), w=880) +
    at(92, 470, para("No card to start. Your reps sign in from their own phones in a couple of minutes.", 40, MIST), w=760) +
    at(88, 1060, wordmark(150)) + at(92, 1262, para("Link in bio", 30, MIST, "font-weight: 600")))))

# ---------- 4. your reps already have phones ----------
B.append(("Post4-Phones", "4 · Your reps already have phones", 1080, 1350, board(1080, 1350, PAPER,
    at(84, 96, headline("Your reps already have phones.", 112, INK), w=900) +
    at(88, 470, para("VPEX dials from each rep's own phone. No phone lines to buy. No shared numbers getting flagged.", 36, SLATE), w=440) +
    phone("live", 560, 470, 450, ring="live") + foot_light(1262))))

# ---------- 5. pricing ----------
rows = "".join('<div style="padding: 22px 0; border-top: 2px solid rgba(199,203,228,0.25); font-family: %s; font-weight: 700; font-stretch: 112%%; font-size: 52px; color: %s">%s</div>' % (ARCH, PAPER, t)
               for t in ("7 days free", "No card to start", "Cancel any time"))
B.append(("Post5-Pricing", "5 · Pricing", 1080, 1350, board(1080, 1350, NIGHT,
    at(66, 72, '<div style="font-family: %s; font-weight: 800; font-size: 580px; line-height: 0.86; color: %s; letter-spacing: -0.01em">$49</div>' % (BIGS, GOLD)) +
    at(92, 680, headline("per rep, per month", 68, PAPER, width=112, weight=700)) +
    at(92, 850, rows, w=896) + foot_dark(1262))))

# ---------- 8. carousel: built for your floor ----------
inds = [("Insurance", "dial_insurance", "Clients, policies and premium. Aged leads and turning-65 lists in one shared queue."),
        ("Real estate", "dial_realestate", "Expireds and FSBOs, with every callback set the moment you hang up."),
        ("Business funding", "dial_mca", "Merchants and advances, tracked from the first call to funded."),
        ("Auto sales", "dial_auto", "Website leads and service-drive customers, followed up on time."),
        ("Solar", "dial_solar", "Homeowners and projects, from door-knock lead to install.")]
lst = "".join('<div style="padding: 20px 0; border-top: 2px solid #D8DCE8; font-family: %s; font-weight: 750; font-stretch: 112%%; font-size: 58px; color: %s">%s</div>' % (ARCH, INK, n) for n, _, _ in inds)
B.append(("Post8-Industries-1", "8 · Built for your floor (cover)", 1080, 1350, board(1080, 1350, PAPER,
    at(84, 96, headline("Built for your floor.", 112, INK), w=900) +
    at(88, 360, lst, w=904) + foot_light(1262, "Swipe"))))
for i, (n, shot, line) in enumerate(inds):
    B.append(("Post8-Industries-%d" % (i + 2), "8 · " + n, 1080, 1350, board(1080, 1350, PAPER,
        at(84, 96, headline(n, 96, INK), w=460) +
        at(88, 330, para(line, 36, SLATE), w=440) +
        at(88, 1150, para("Try the %s demo office. Link in bio." % n.lower(), 28, SLATE, "font-weight: 600"), w=420) +
        phone(shot, 560, 260, 470))))
B.append(("Post8-Industries-7", "8 · Your words", 1080, 1350, board(1080, 1350, NIGHT,
    at(88, 104, headline("Your pipeline, in your words.", 96, PAPER), w=880) +
    at(92, 470, para("Policies, deals, advances, sales or projects. Each office's VPEX uses the words your floor already uses.", 40, MIST), w=780) +
    foot_dark(1262))))

# ---------- 9. founding offices ----------
B.append(("Post9-Founding", "9 · Founding offices", 1080, 1350, board(1080, 1350, NIGHT,
    at(66, 30, '<div style="font-family: %s; font-weight: 800; font-size: 620px; line-height: 0.86; color: %s">25</div>' % (BIGS, GOLD)) +
    at(92, 600, headline("founding offices", 68, PAPER, width=112, weight=700)) +
    at(92, 800, para("The first 25 offices on VPEX pay <b style=\"color: %s; font-weight: 700\">$29 per rep, per month</b> instead of $49." % PAPER, 44, MIST), w=860) +
    at(92, 1040, para("DM us FOUNDING to claim a spot.", 44, PAPER, "font-weight: 700"), w=860) + foot_dark(1262, "Spots are limited"))))

# ---------- Reel covers (1080x1920; the grid shows the middle 1080x1350) ----------
B.append(("ReelA-Cover", "Reel A cover · One tap", 1080, 1920, board(1080, 1920, PAPER,
    at(84, 330, headline("One tap.<br>Every lead.", 124, INK), w=900) +
    phone("dial_insurance", 300, 720, 600, ring="dial_insurance"))))
B.append(("ReelB-Cover", "Reel B cover · Follow-ups", 1080, 1920, board(1080, 1920, PAPER,
    at(84, 330, headline("Follow-ups never slip.", 124, INK), w=900) +
    phone("callback_set", 300, 720, 600))))
B.append(("ReelC-Cover", "Reel C cover · Whole floor", 1080, 1920, board(1080, 1920, NIGHT,
    at(84, 330, headline("Your whole floor, live.", 124, PAPER), w=900) +
    phone("scoreboard", 300, 720, 600, dark=True))))

# ---------- Stories (1080x1920) ----------
B.append(("Story1-Live", "Story 1 · VPEX is live", 1080, 1920, board(1080, 1920, NIGHT,
    at(88, 250, wordmark(236)) +
    at(92, 500, headline("is live.", 112, PAPER)) +
    at(92, 680, para("The power dialer for sales floors.", 44, MIST), w=820) +
    phone("dial_insurance", 240, 900, 600, dark=True))))
B.append(("Story2-Demo", "Story 2 · Try the demo", 1080, 1920, board(1080, 1920, PAPER,
    at(84, 250, headline("See it work.", 124, INK), w=900) +
    at(88, 440, para("Open a demo office loaded with sample leads. No signup.", 44, SLATE), w=820) +
    phone("live", 300, 700, 480, ring="live"))))
B.append(("Story3-Free", "Story 3 · 7 days free", 1080, 1920, board(1080, 1920, NIGHT,
    at(70, 250, '<div style="font-family: %s; font-weight: 800; font-size: 560px; line-height: 0.86; color: %s">7</div>' % (BIGS, GOLD)) +
    at(92, 760, headline("days free.", 112, PAPER)) +
    at(92, 920, para("$49 per rep, per month after that. No card to start.", 44, MIST), w=820))))

# ---------- Highlight covers (1080x1920, icon in the middle circle) ----------
ICONS = {
    "Demo": '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 9.5v5l4-2.5z"/>',
    "HowItWorks": '<path d="M4 7h3M4 12h3M4 17h3"/><path d="M10 7h10M10 12h10M10 17h10"/>',
    "Pricing": '<path d="M12 3v18"/><path d="M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.6 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3"/>',
    "Start": '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
}
for k, d in ICONS.items():
    B.append(("Highlight-" + k, "Highlight · " + k, 1080, 1920, board(1080, 1920, NIGHT,
        at(0, 0, '<div style="width: 1080px; height: 1920px; display: flex; align-items: center; justify-content: center">'
                 '<svg width="420" height="420" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg></div>' % (GOLD, d)))))
