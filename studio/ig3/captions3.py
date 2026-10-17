# Week-3 captions, alt text, story notes, ad copy and the scale plan. Writes Week-3-Posting-Plan.txt for the packet.
import os
D = os.path.dirname(os.path.abspath(__file__))

POSTS = [  # (number, day, file(s), what, caption, alt text)
(19, "Mon", "Reel-G-Callback.mp4 + Cover-19-Reel-G.jpg", "Reel G: He said call me back at 2 (21 s)",
"""He said "call me back at 2."

Nobody did. He bought from the rep who called.

That's not a lead problem. It's a follow-up problem. In VPEX, one tap on Interested books the follow-up, and when it's due it's first in line, with a note on what to say.

Comment DEMO and we'll send you a live demo office.

#salesfloor #followup #coldcalling #insurancesales #powerdialer""",
"Text: He said call me back at 2. A clock runs from 2:00 to 4:45 PM. Nobody called. Then a phone shows the VPEX dial screen: one tap to call, one tap to log Interested, and a follow-up is set automatically."),
(20, "Tue", "Post-20-Leaks-slide1..9.jpg (carousel)", "Carousel: 7 places deals go to die (9 slides)",
"""7 places deals go to die on a sales floor. None of them is your lead list.

1. The callback nobody made
2. Two reps on the same lead
3. Spam Likely
4. The 5 AM wake-up call
5. Notes nobody wrote
6. The rep who quit
7. 5 PM guesswork

Swipe for the fix to each one. Which one hurts your floor most?

#salesfloor #salesmanager #coldcalling #salestips #powerdialer""",
"A carousel listing seven ways sales floors lose deals, each with a screenshot of the VPEX feature that fixes it: automatic follow-ups, one rep per lead, call pacing, local-time warnings, one-tap logging, office-owned lead history and a live scoreboard."),
(21, "Wed", "Reel-H-SpamLikely.mp4 + Cover-21-Reel-H.jpg", "Reel H: Spam Likely (19 s)",
"""Your rep dials. Their screen says Spam Likely. Declined.

It's usually not the list. It's how the number gets dialed: too fast, too short, too soon.

VPEX spaces calls out and asks before anyone redials a lead they just called.

Comment DEMO and we'll send you a live demo office.

#spamlikely #coldcalling #salesfloor #salestips #powerdialer""",
"An incoming call screen labeled Spam Likely gets declined. Text: It's not your list, it's how you dial. Then the VPEX app pauses a rapid-fire call with 'One moment, next call in 1s' and asks 'Call Anthony again?' before a quick redial."),
(22, "Thu noon", "Post-22-TwoReps.jpg", "Static: Two reps. One lead. Same afternoon.",
"""Two reps. One lead. Same afternoon.

Two pitches, two prices, and a prospect who stops picking up.

In VPEX, when a rep opens a lead it's held for them. Everyone else's queue skips it, and you can see who's on what.

#salesteam #salesfloor #salesmanager #callcenter #powerdialer""",
"Headline: Two reps. One lead. Same afternoon. A phone shows the VPEX Team screen, with Jordan Lee marked 'Active just now, 39 calls today, on Mark Walsh'."),
(23, "Thu evening", "Reel-I-FivePM.mp4 + Cover-23-Reel-I.jpg", "Reel I: It's 5 PM (19 s)",
"""It's 5 PM. Do you know what your floor did today?

How many calls. Who's behind. Which leads went cold. If the answer is "I'll ask around," you're managing blind.

VPEX shows every rep and every call, live, on your phone.

Comment DEMO and we'll send you a live demo office.

#salesmanager #salesleadership #salesfloor #callcenter #powerdialer""",
"A big 5:00 PM clock, then rapid text questions: how many calls, who's behind, which leads went cold. Then the VPEX team scoreboard with calls, conversations and pipeline per rep, and a team list showing which lead each rep is on."),
(24, "Fri", "Post-24-Math-slide1..6.jpg (carousel)", "Carousel: Do the math (6 slides)",
"""One missed callback a day. Do the math.

Example: 10 reps × 1 callback each that slips × 20 workdays = 200 people a month who asked you to call back.

Now multiply by your close rate and your average deal. Swap in your own numbers in the comments.

#salesmanager #salesfloor #followup #salestips #powerdialer""",
"A carousel of large numbers: 10 reps, times 1 missed callback a day, times 20 workdays, equals 200 people a month who asked for a callback. Marked as example numbers. The last slide shows VPEX follow-up alerts."),
(25, "Sat", "Reel-J-Taps.mp4 + Cover-25-Reel-J.jpg", "Reel J: 11 taps (17 s)",
"""11 taps to make one call. Count them: unlock, open the sheet, find the row, copy, open Phone, paste, call, hang up, back to the sheet, type what happened, set a reminder.

× 150 calls a day = 1,650 taps. Tapping isn't selling.

In VPEX: one tap to call, one tap to log, and the next lead is ready.

Comment DEMO and we'll send you a live demo office.

#coldcalling #salesproductivity #salesfloor #insuranceagent #powerdialer""",
"A counter runs from 1 to 11 through the steps of calling from a spreadsheet, then 150 calls a day equals 1,650 taps. Then the VPEX app: one tap to call, one tap to log No answer, next try booked, next lead ready."),
(26, "Sun noon", "Post-26-RepQuit.jpg", "Static: Your best rep quit.",
"""Your best rep quit. Their pipeline left with them.

Leads in a personal spreadsheet. Notes in their head. Follow-ups on their phone.

In VPEX, leads, notes and call history belong to your office. Turn off a login and it's signed out within seconds.

#salesmanager #salesteam #smallbusiness #salesfloor #powerdialer""",
"Headline: Your best rep quit. Their pipeline left with them. A phone shows the VPEX Team & access screen: 'Turning someone off signs them out within seconds.'"),
(27, "Sun evening", "Reel-K-EveryLeak.mp4 + Cover-27-Reel-K.jpg", "Reel K: Every floor leaks (21 s)",
"""Every floor leaks. Callbacks nobody made. Two reps on one lead. Spam Likely. Calls at 7 AM. The rep who quit. 5 PM guesswork.

Every one has a fix, and they're all in one app your reps already have room for: their phone.

Comment DEMO and we'll send you a live demo office. 7 days free.

#salesfloor #salesmanager #coldcalling #callcenter #powerdialer""",
"Text: Every floor leaks. A list of six problems is crossed out one by one. Then a fast montage of the VPEX app: automatic follow-ups, who's on each lead, call pacing, qualifying questions, the pipeline and the team scoreboard."),
]

STORIES = [  # (file, sticker to add)
("Story-Mon-1", "Poll sticker: \"Every time\" / \"Usually\" / \"Honestly? Not always\""),
("Story-Mon-2", "Link sticker: vpexdialer.com. Or share Reel G to your story right after it."),
("Story-Tue-1", "Poll sticker: \"Yes, it's happened\" / \"Not yet\""),
("Story-Tue-2", "Link sticker: vpexdialer.com"),
("Story-Wed-1", "Poll sticker: \"I'd know\" / \"No idea\""),
("Story-Wed-2", "Link sticker: vpexdialer.com/#demo-insurance (a live demo office)"),
("Story-Thu-1", "Question sticker: \"How many calls today?\" (or the emoji slider)"),
("Story-Thu-2", "Link sticker: vpexdialer.com"),
("Story-Fri-1", "Quiz sticker: \"1-3\" / \"4-7\" / \"8+\" (mark 8+ as the answer)"),
("Story-Fri-2", "Link sticker: vpexdialer.com/#demo-insurance"),
("Story-Sat-1", "Emoji slider: \"How many callbacks slip on your floor?\""),
("Story-Sat-2", "None needed. Save to a new highlight called Leaks."),
("Story-Sun-1", "Poll sticker (4 options): Missed callbacks / Spam Likely / Reps doubling up / No visibility"),
("Story-Sun-2", "Link sticker: vpexdialer.com"),
]

DM_REPLY = """Here's your live demo office: vpexdialer.com/#demo-insurance

Swap "insurance" for realestate, mca, auto or solar to see your industry. Everything in it is sample data, so tap anything. When you're ready, start the 7-day free trial at vpexdialer.com (no card to start)."""

ADS = {
"Primary text (pick one per ad)": [
    "\"Call me back at 2.\" Nobody did. VPEX books the follow-up the moment your rep taps Interested. Try it free for 7 days.",
    "Your reps' calls showing up as Spam Likely? VPEX paces dialing and asks before a quick redial. 7 days free.",
    "It's 5 PM. Do you know what your floor did today? VPEX shows every rep and every call, live. 7 days free.",
    "11 taps to make one call from a spreadsheet. In VPEX it's one tap to call and one to log. Try it free for 7 days.",
],
"Headline (40 characters max)": ["Stop losing callbacks", "Every callback, on time", "See your whole floor, live", "One tap to call. One to log.", "Try VPEX free for 7 days"],
"Description": ["The power dialer for sales floors. Reps call from their own phones."],
"Button": ["Learn more (or Sign up)"],
"Website": ["https://vpexdialer.com"],
}

SCALE = """1. Match the shape to the placement. Reels and Stories are full-screen 9:16, so use the Reels there. Use the 4:5 posts only in Feed. (Your current story ad is the 4:5 post, which is why the phone gets cut off and "Learn more" covers it.)
2. Run the 5 Reels as 5 ads in one ad set. Same budget, same audience, so they compete fairly.
3. Leave them alone for 5 to 7 days. Meta says an ad set needs about 50 results in a week to finish its learning phase, and big edits restart it.
4. Then keep the 1 or 2 with the lowest cost per link click and the best 3-second hold (Ads Manager > Breakdown), and turn the rest off. Put the saved budget on the winners in steps of about 20% every few days.
5. Remake the winner. Same structure, new hook line (for example, swap "He said call me back at 2" for "She said call me Friday"). New hooks on a proven format are the cheapest way to scale.
6. Boost organic winners too. If one Reel gets unusual saves or shares in Insights, use it as an ad (Boost or "Use existing post").
7. Answer every DEMO comment within the hour with the saved reply. Tools like ManyChat can automate comment-to-DM replies if volume grows.
8. Next step on the site: add the Meta Pixel to vpexdialer.com so Meta can optimize for sign-ups instead of clicks. Send the Pixel ID (not a secret) and it can be added to the page."""

HOW = """How these were made: real VPEX footage from a demo office (fictional leads, 555 numbers), cut in the pattern-interrupt style of your example: one big line at a time, hard cuts, problem first, fix second, one clear ask at the end. No invented stats or testimonials; the "Do the math" numbers are labeled as an example.
Reels are silent on purpose. Add a trending sound in Instagram's editor before posting, and pick the cover from the camera roll (Cover-*.jpg)."""

def text():
    out = ["VPEX INSTAGRAM, WEEK 3: EVERY FLOOR LEAKS", "Problem first, fix second. Posts 19 to 27.", "", HOW, "", "=" * 60, "GRID AND CAPTIONS (post in this order)", "=" * 60]
    for n, day, files, what, cap, alt in POSTS:
        out += ["", "%d. %s | %s" % (n, day, what), "Files: " + files, "", cap, "", "Alt text: " + alt, "-" * 60]
    out += ["", "=" * 60, "STORIES (Mon to Sun, 2 a day). Sticker to add:", "=" * 60]
    out += ["%s: %s" % s for s in STORIES]
    out += ["", "Story ads: use the files in 4-Story-ad-versions (9:16 versions of every post).", "", "=" * 60, "SAVED REPLY FOR \"DEMO\" COMMENTS (send as a DM)", "=" * 60, DM_REPLY, "", "=" * 60, "AD COPY", "=" * 60]
    for k, v in ADS.items(): out += ["", k + ":"] + ["- " + x for x in v]
    out += ["", "=" * 60, "HOW TO SCALE IT", "=" * 60, SCALE, ""]
    return "\n".join(out)

if __name__ == "__main__":
    os.makedirs(D + "/out", exist_ok=True)
    open(D + "/out/Week-3-Posting-Plan.txt", "w").write(text()); print("ok", len(text()))
