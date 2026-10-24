# VPEX content studio

Everything that makes VPEX's posts: the brand kit, real app screenshots and footage from a demo office, the Reel builder with original soundtracks, and the pack builder the bot reads. Each week is a folder (`ig3` = week 3, `ig4` = week 4), and the next week starts as a copy of the last one.

One pack feeds three places: Instagram (feed, stories, trial Reels), the VPEX Facebook Page (the same feed posts, with tappable links) and Threads (the same feed posts trimmed to 500 characters, plus one Threads-only post a day). Every post points to one place on vpexdialer.com, and the site counts what each post brought in: link-page taps, visits, demos, trial forms and sign-ups.

## Build next week (about 1–2 hours)

1. **Set up:** run `bash studio/tools/setup.sh` from the repo root. It unpacks the footage and serves the live app at `http://localhost:8793/`.
2. **Learn from the numbers:** the bot runs mode `learn` every morning. Run it again to get fresh notes: `gh api -X POST repos/777n2n8n5w-cloud/vpex/actions/workflows/vpex-instagram.yml/dispatches -f ref=main -f 'inputs[mode]=learn'` (`gh workflow run` doesn't work through the proxy), then read the run notes (`gh api repos/777n2n8n5w-cloud/vpex/check-runs/<job id>/annotations`). They give:
   - Every post's score next to its reach, sends (shares) and saves per reach, watch time, "kept %" (watch time over length), skip rate (left in the first 3 seconds), bio-page taps and demos it brought in.
   - Averages by hook, topic, format, call to action, time slot and industry, each marked winning, losing or testing (a winner needs 3+ posts).
   - "Make more of", "Make less of" and "Hooks not tested yet".
   - Build the week as roughly 70% proven (winning hooks and topics), 20% variations on them, 10% new hooks from the untested list. Don't call anything a winner on one post.
3. **Copy the last week:** `cp -r studio/ig4 studio/ig5`, then rename the files (`kit5.py`, `reel5.py`, `audio5.py`, `render5.py`, `capture5.py`, `make_pack5.py`) and the references inside them.
4. **New screenshots:** edit `captureN.py` for the screens the new posts need. Demo offices only: fictional leads and 555 numbers. Use `pg.clock.install(...)` to set the time of day.
5. **Write the boards:** in `kitN.py`, 1080x1350 feed posts and carousels, plus 1080x1920 stories and Reel covers. Render with `python3 renderN.py`, then check every board in a contact sheet. Fix any overlaps, text that runs off the edge, or crops that miss the target.
6. **Reels:** in `reelN.py`, the scene types are:
   - `words`, `clock`, `spam`, `taps`, `strike`
   - `clip` (footage from `ig3/clips`) and `still` (a screenshot with camera moves)
   - `lock` (a lock-screen notification) and `list` (a rule list)
   - `end`

   Check with `python3 reelN.py preview:NAME`, build with `python3 reelN.py NAME`, then add the sound with `python3 audioN.py`. Target about −14.5 LUFS, with peaks at or below −0.7 dBFS.
7. **Pack:** in `make_packN.py`, set the times, captions, alt text, tags and destinations (see "Plan item fields" below), with `"format": 2` at the top of plan.json, then run `PACK_OUT=/tmp/VPEX-Instagram-Week-N python3 make_packN.py`. It writes `plan.json`, the media and a zip.
8. **Check before shipping:** copy `instagram/*.zip`, `instagram/tags.json` and the new zip into one folder, then run `python3 -I studio/tools/validate_packs.py FOLDER VPEX-Instagram-Week-N FIRST_DAY LAST_DAY`. It must end with `RESULT: PASS`. It checks:
   - Every item loads in the bot (no missing files).
   - Captions are 2,200 characters or less; 5 hashtags at most on format-2 packs (Instagram's limit). Alt text is 1,000 characters or less.
   - Images are JPEG; feed images are 4:5. Reels are H.264/AAC, 3–90 seconds.
   - Item ids are unique across all packs (`wN-...`).
   - Every day exactly at the bot's daily ceilings (`instagram/limits.json`: 2 feed posts, 3 stories, 1 Threads-only post), with no two at the same minute. Trial Reels don't count.
   - Every feed post and thread has tags (hook from the list, topic, cta) and a valid `go`; Threads text fits 500 characters and keeps any legal line.
9. **Ship:** copy the zip to `instagram/`, run `python3 studio/tools/build_bio_page.py` (it refreshes the tiles on vpexdialer.com/ig), commit `instagram/`, `ig/` and the week's studio folder, push to main, then run the bot workflow in mode `check`. Every item should show "waiting".

## Schedule

**Safe cadence since Oct 22, 2026.** On Oct 21 Meta blocked the whole VPEX Content app (Instagram, then Facebook and Threads) after weeks of 16 posts a day plus stories and auto-replies from a new account. The bot now enforces daily ceilings from `instagram/limits.json` whatever the plan holds, backs off for 6 hours after any refusal instead of retrying every 15 minutes, and caps automatic comment replies (8 a day, one per person). Plan exactly to the ceilings so nothing is skipped; raise them only one step at a time after a few clean weeks.

Instagram: 2 feed posts and 3 stories a day, New York time. Facebook Page: the same 2 feed posts. Threads: the same 2 feed posts plus 1 Threads-only post. That's 7 posts a day across the three, plus the stories.
- **Feed:** 11:00 and 19:00 (the two best-scoring slots in the learn run). Alternate Reels with posts and carousels.
- **Stories:**
  - 09:00: the sticker story (poll, question or quiz). Stickers can't be added through the API, so it's a `manual` item and the bot sends Vincent a reminder.
  - 12:30: share of the 11:00 post. For a Reel, post the Reel video itself as the story (`"video": ...`). For a post, use a 1080x1920 story version (`render<N>.py --story-versions`).
  - 20:30: share of the 19:00 post, or an original story.
- **Threads-only:** 08:30.
- **A week** is Tuesday to Monday: 14 feed posts, 21 stories (7 sticker), 7 Threads-only posts.
- **Fewer posts, better posts.** With 14 feed posts a week, every one has to earn its slot: proven hooks first, one clear call to action.
- **Never post in bursts.** On Oct 16, 5 posts within 20 minutes reached 4–8 people each, while spaced posts reached 60–130.
- **Bridge:** `tools/replan_8day.py` re-timed weeks 3–4 when the cadence changed. The week 4b bridge pack (`ig4/kit4b.py`, Reels S–V in `ig4/reel4.py`, `ig4/make_pack4b.py`) covers Fri Oct 23 at 19:00 through Mon Oct 26. Week 5 starts Tue Oct 27.

## Plan item fields (format 2)

On top of the existing fields (`id`, `at`, `type`, `title`, `caption`, `image`, `images`, `alts`, `video`, `cover`, `manual`, `note`):

- `tags`: `{"hook": ..., "topic": ..., "ind": ..., "cta": ..., "series": ...}` on every feed post and thread. The bot's `learn` mode groups results by them.
  - `hook`: pain, quote, number, news, question, pov, contrast, myth, story, math, reference, identity, offer, feature, rule.
  - `topic`: free text, reused week to week (followups, spam, calling-hours, medicare, shared-list, rep-turnover, pipeline, industry-fit, speed, manager-view, price...).
  - `ind`: insurance, realestate, mca, auto, solar, or empty for every floor.
  - `cta`: bio, comment, save, share, question, none.
  - `series`: rule-watch, built-for, isnt, floor-math, rep-pov... (optional).
- `go`: where the post's tile on vpexdialer.com/ig and its Facebook/Threads link lead: `demo:<industry>` (that industry's demo office), `home` (the sales page) or `trial` (the trial form). Default: the industry's demo if `ind` is set, else home.
- `type: "thread"`: a Threads-only post with `threads_text` (500 characters at most; `{link}` becomes the post's own tagged link). Add `image` for a picture.
- `threads_text` / `fb_caption` on a feed post: write them yourself when the automatic version (opening paragraphs that fit + legal line + link; or the caption with "Comment DEMO"/"Link in bio" turned into the link) won't read well.
- `trial`: `"SS_PERFORMANCE"` (or `"MANUAL"`) makes a Reel a trial Reel: shown to non-followers first, so two hooks for the same idea can be compared without posting a duplicate to the grid. Instagram allows them from 200 followers; until then the bot skips them. They also count as feed posts under the daily ceilings, so plan one only on a day with a free feed slot, so only build them once `check` says "Trial Reels: available". Trial Reels go to Instagram only and get no tile.
- `platforms`: e.g. `["instagram", "threads"]` to keep a post off one platform.
- `bio: false`: no tile on vpexdialer.com/ig.

## Content playbook (what the evidence says)

- **Win the first second.** Big on-screen words naming the pain (7 words or fewer), movement from the first frame, no logo or intro. Facebook's research with Nielsen found up to 47% of a video campaign's value lands in the first 3 seconds. Instagram now reports a skip rate (people gone within 3 seconds); `learn` shows it per Reel.
- **Make posts people send.** Instagram's head, Adam Mosseri, names watch time, likes and sends (shares by DM) as the top three ranking signals, with sends weighing more for reaching people who don't follow you yet. Design for "a manager sends this to the floor": rule changes, checklists, "this is literally our floor" moments.
- **Short and kept.** 7–20 second Reels with the payoff before 15 seconds and an end that loops. Check "kept %" in `learn`.
- **Original only.** Since April 30, 2026, Instagram stops recommending accounts that repost too much, photos and carousels included. Everything here is original footage and graphics; keep it that way.
- **Keywords over hashtags.** Instagram caps hashtags at 5 and says they don't raise reach; put the words a floor owner would search for ("power dialer for insurance agents") in the first line instead.
- **One call to action per post, and rotate them:** "Tap the link in our bio, then this post", "Comment DEMO", "Send this to your manager" and "Save this". Tag which one (`cta`) so `learn` can compare them.
- **Message match.** A post about Medicare opens the insurance demo; a post about expired listings opens the real estate demo. Set `go`.
- **Proof without fakes.** Real VPEX screens from demo offices, labeled examples, Vincent's own voice. No testimonials or customer numbers until a real customer agrees in writing.
- **Series build habits and clean comparisons:** Rule watch, Built for your floor, X isn't Y, Floor math, Rep POV.

## Measuring

- **Every morning (`learn`):** each post's numbers, scored against posts of the same kind, plus what it brought to the site; averages by tag; what to make more and less of. Notes are public (the repo is public), so they hold content numbers only.
- **Every Monday (`scorecard`):** a private page on Vincent's phone: posts per platform, Instagram reach and bio-link taps, the site funnel (link page, visits, demos, first demo call, trial form, sign-ups) by source and by post, new trials that made a first call, offices still calling in week 2, paying offices, Home Screen launches, and the biggest drop-off to fix.
- **The site counts** (`hit` in functions/) are anonymous: no cookies, names, numbers or addresses; one counter per step, source and post per day.

## What has worked (update this after every week's numbers)

- **The first 3 seconds are the biggest leak (first `learn` run, Oct 20):** Reels so far lose 84–95% of viewers in the first 3 seconds, and the best kept only about a third of its length (Reel I, 34%). Fix openings before anything else: the pain in big words on frame one, movement right away, no slow build or logo.

- **Learn run, Oct 21 (26 posts, 28 followers, before Meta's block):** nothing is a winner yet; every tag is still "testing" (no tag has 3+ posts with a clear lead), and most posts reached under 30 people, so single posts are mostly noise.
  - Top scores: "Two reps. One lead." (w3-22, pain / shared-list) +0.91, with 5 sends on 11 reach (45%); the calling-hours carousel (w4-hours, reference / save) +0.75; Reel I "It's 5 PM" (w3-23, pov / manager-view) +0.57, the best-kept Reel at 34% of its length and the lowest skip rate (70%).
  - Most shares: "Built for your floor" carousel, 6 sends on 71 reach (8.5%).
  - By hook: reference +0.75 (n=1), pov +0.57 (n=1), pain +0.11 (n=3, the most-tested positive hook); number −0.29 (n=2). By call to action: save +0.32 (n=2), comment −0.12 (n=3), question −0.14 (n=2). By time: 19:00 +0.83 (n=2), 11:00 +0.06 (n=2).
  - Biggest leak, unchanged: Reel skip rates of 84–95% (Reel I 70%). Plain product-intro Reels did worst ("One tap to call", 95% skip, −0.68).
  - Week 5 leans on manager's-eye Reels (pov), team pain (shared list, Do Not Call, follow-ups), a save-able calling-hours reference and a "Built for" carousel; it tests quote, feature, offer and question hooks, and send/save calls to action against "Comment DEMO".
- **Since Oct 21 Meta blocks the bot ("API access blocked"),** so learn and check can't read Instagram's numbers until the block lifts. Since Oct 24, learn still scores the site side while blocked: "Site-only learning" lists each post that went out (posted or handed off) with its bio taps, visits, demos and demo calls, grouped by hook, topic, format, time and platform (raw counts per post; "winning" needs 3+ posts at 1.5× the average). Build from those and these notes meanwhile.

- **Shared most:** industry-specific carousels ("Built for your floor", 6 shares, 418 views) and calling-hours content ("A lead in LA doesn't want your call at 7:20 AM", 74 reach).
- **Watched longest:** "Spam Likely" (Reel H), about 15 seconds on average.
- **Problem first, fix second:** name the pain in big words, then show the real VPEX screen that fixes it.
- **End with "Comment DEMO":** the bot answers DEMO and price comments (the DEMO reply now points to the link in bio).

## Rules

- VPEX is its own product. Never mention Dovetail.
- **Data:** demo data only, with fictional names and 555 numbers. No real people, investors or customers.
- **Claims:** no fake testimonials and no invented statistics. Example math is labeled as an example.
- **Compliance posts:**
  - Every one says "Based on published state rules as of [month year]. Not legal advice."
  - State rules come from `STATE_HOURS` in `index.html`, so posts and the app always agree.
  - The national Do Not Call registry is not checked by VPEX; say so whenever it comes up.
  - Medicare: for 2027 marketing (from Oct 1, 2026), CMS dropped the 48-hour wait, but a Scope of Appointment is still required before a Medicare Advantage or Part D sales appointment. Posts say "Based on the CMS final rule for 2027, as of [month year]. Not legal advice. Follow your carriers' guidelines."
- **Fonts:** Archivo, Big Shoulders Display and Unbounded (`deck/fonts`, SIL Open Font License).
- **Soundtracks:** synthesized in `audioN.py`, so there's no licensed music.
