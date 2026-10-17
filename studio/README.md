# VPEX content studio

Everything that makes VPEX's Instagram posts: the brand kit, real app screenshots and footage from a demo office, the Reel builder with original soundtracks, and the pack builder the bot reads. Each week is a folder (`ig3` = week 3, `ig4` = week 4), and the next week starts as a copy of the last one.

## Build next week (about 1–2 hours)

1. **Set up:** run `bash studio/tools/setup.sh` from the repo root. It unpacks the footage and serves the live app at `http://localhost:8793/`.
2. **Learn from the numbers:** run the "VPEX Instagram bot" workflow with mode `insights`, then read its run notes (`gh api repos/777n2n8n5w-cloud/vpex/check-runs/<job id>/annotations`). Look for:
   - Shares and saves first: what people pass on.
   - Average watch time on Reels: which hooks hold attention.
   - Reach.
   - Make more of what wins, and drop what doesn't.
3. **Copy the last week:** `cp -r studio/ig4 studio/ig5`, then rename the files (`kit5.py`, `reel5.py`, `audio5.py`, `render5.py`, `capture5.py`, `make_pack5.py`) and the references inside them.
4. **New screenshots:** edit `captureN.py` for the screens the new posts need. Demo offices only: fictional leads and 555 numbers. Use `pg.clock.install(...)` to set the time of day.
5. **Write the boards:** in `kitN.py`, 1080x1350 feed posts and carousels, plus 1080x1920 stories and Reel covers. Render with `python3 renderN.py`, then check every board in a contact sheet. Fix any overlaps, text that runs off the edge, or crops that miss the target.
6. **Reels:** in `reelN.py`, the scene types are:
   - `words`, `clock`, `spam`, `taps`, `strike`
   - `clip` (footage from `ig3/clips`) and `still` (a screenshot with camera moves)
   - `lock` (a lock-screen notification) and `list` (a rule list)
   - `end`

   Check with `python3 reelN.py preview:NAME`, build with `python3 reelN.py NAME`, then add the sound with `python3 audioN.py`. Target about −14.5 LUFS, with peaks at or below −0.7 dBFS.
7. **Pack:** in `make_packN.py`, set the times, captions and alt text, then run `PACK_OUT=/tmp/VPEX-Instagram-Week-N python3 make_packN.py`. It writes `plan.json`, the media and a zip.
8. **Check before shipping:**
   - Every item loads in the bot (no missing files).
   - Captions are 2,200 characters or less, with 30 hashtags or fewer. Alt text is 1,000 characters or less.
   - Images are JPEG; feed images are 4:5. Reels are H.264/AAC, 3–90 seconds.
   - Item ids are unique across all packs (`wN-...`).
   - Exactly 5 per day, with no two at the same minute.
9. **Ship:** copy the zip to `instagram/`, push to main, then run the bot workflow in mode `check`. Every item should show "waiting".

## Schedule

5 a day, New York time:
- **Feed:** 12:30 and 6:30 PM, one Reel and one post or carousel.
- **Stories:** 9 AM, 3 PM and 8 PM. The 9 AM story carries a sticker (poll, question or quiz). Stickers can't be added through the API, so those items are `manual` and the bot sends Vincent a reminder.

Weeks run Tuesday to Monday. Week 5 starts Tue Oct 27, 2026. Never post in bursts: on Oct 16, 5 posts within 20 minutes reached 4–8 people each, while spaced posts reached 60–130.

## What has worked (update this after every week's numbers)

- **Shared most:** industry-specific carousels ("Built for your floor", 6 shares, 418 views) and calling-hours content ("A lead in LA doesn't want your call at 7:20 AM", 74 reach).
- **Watched longest:** "Spam Likely" (Reel H), about 15 seconds on average.
- **Problem first, fix second:** name the pain in big words, then show the real VPEX screen that fixes it.
- **End with "Comment DEMO":** the bot answers DEMO and price comments.

## Rules

- VPEX is its own product. Never mention Dovetail.
- **Data:** demo data only, with fictional names and 555 numbers. No real people, investors or customers.
- **Claims:** no fake testimonials and no invented statistics. Example math is labeled as an example.
- **Compliance posts:**
  - Every one says "Based on published state rules as of [month year]. Not legal advice."
  - State rules come from `STATE_HOURS` in `index.html`, so posts and the app always agree.
  - The national Do Not Call registry is not checked by VPEX; say so whenever it comes up.
- **Fonts:** Archivo, Big Shoulders Display and Unbounded (`deck/fonts`, SIL Open Font License).
- **Soundtracks:** synthesized in `audioN.py`, so there's no licensed music.
