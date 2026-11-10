// VPEX notifications (Firebase Cloud Functions, 2nd gen).
//  - queueFromOffice / queueFromTeam: every time a lead record is saved, keep the alert queue in step with its follow-ups
//    and send handoff alerts to the closer right away.
//  - sendDue: every minute, send the follow-ups that just came due.
//  - sendTest: the "Send a test" button in the app.
//  - sendFloor: "Message your floor", an admin or manager sends one short message to every rep's phone (or the reps they pick).
//  - morningDigest: weekdays at 8:30 in each rep's time zone, what's waiting today; Mondays, admins and managers also get
//    last week on the floor (calls, conversations, interested, change from the week before, top caller).
//  - igDone: the "Done" button on an Instagram hand-off page (marks that post as posted by hand; needs the page's own key).
//  - hit: anonymous funnel counts from vpexdialer.com (page seen, demo opened, trial form, sign-up), by where people came from.
//  - cal: each login's follow-ups and appointments as a calendar feed its phone can subscribe to (a secret address).
//  - consent: proof of each cookie choice made on vpexdialer.com (random id, policy version, choice; no IP, nothing personal).
// Tokens live in pushTokens/{id} (written by the app, readable only here). The queue lives in pushQueue/{id}.
"use strict";

const { onDocumentWritten, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const L = require("./lib");

admin.initializeApp();
const db = admin.firestore();

// The deploy writes FN_REGION (the region next to the database) into functions/.env.
setGlobalOptions({ region: process.env.FN_REGION || "us-central1", memory: "256MiB", timeoutSeconds: 120, maxInstances: 10 });

function memberRef(office, uid) { return office ? db.doc("offices/" + office + "/members/" + uid) : db.doc("members/" + uid); }

// Is this person still allowed to get alerts for this office? (active login, office open)
async function allowed(office, uid, now, officeCache) {
  try {
    const m = await memberRef(office, uid).get();
    if (!m.exists || m.get("active") !== true) return false;
    if (!office) return true;
    let open = officeCache ? officeCache.get(office) : undefined;
    if (open === undefined) { const o = await db.doc("offices/" + office).get(); open = L.officeOpen(o.exists ? o.data() : null, now); if (officeCache) officeCache.set(office, open); }
    return open;
  } catch (e) { logger.warn("allowed check failed", { office, uid, err: String(e) }); return false; }
}

// Send messages to every phone a person turned notifications on for. Dead tokens are removed.
async function sendTo(uid, msgs, ttlSec) {
  if (!msgs.length) return { sent: 0, phones: 0 };
  const qs = await db.collection("pushTokens").where("uid", "==", uid).limit(20).get();
  if (qs.empty) return { sent: 0, phones: 0 };
  const batch = [], owners = [];
  qs.docs.forEach(function (d) {
    const t = d.get("token");
    if (typeof t !== "string" || !t) return;
    msgs.forEach(function (m) { batch.push(L.fcmMessage(t, m, ttlSec)); owners.push(d.ref); });
  });
  if (!batch.length) return { sent: 0, phones: 0 };
  let sent = 0;
  for (let i = 0; i < batch.length; i += 500) {
    const res = await admin.messaging().sendEach(batch.slice(i, i + 500));
    const dead = new Set();
    res.responses.forEach(function (r, j) {
      if (r.success) { sent++; return; }
      const code = r.error && r.error.code;
      if (L.deadToken(code)) dead.add(owners[i + j]);
      else logger.warn("push failed", { uid, code, msg: r.error && r.error.message });
    });
    await Promise.all(Array.from(dead).map(function (ref) { return ref.delete().catch(function () {}); }));
  }
  return { sent: sent, phones: qs.size };
}

// Token docs carry the phone's time zone so times read right on that phone.
async function tzFor(uid) {
  try { const qs = await db.collection("pushTokens").where("uid", "==", uid).limit(1).get(); return qs.empty ? "" : (qs.docs[0].get("tz") || ""); } catch (e) { return ""; }
}

async function onChunkWrite(office, chunkId, event) {
  if (!chunkId || chunkId.charAt(0) === "_") return;          // _team (settings) and _dnc (Do Not Call) hold no leads
  const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
  const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
  const now = Date.now();

  const d = L.diffQueue(office, chunkId, before, after, now);
  const writes = d.upserts.map(function (e) {
    const id = e.id; delete e.id; delete e.sig;
    return db.collection("pushQueue").doc(id).set(e);
  });
  // A lead can move to another record; only remove a queued alert if this record still owns it.
  const removes = d.removes.map(function (id) {
    return db.runTransaction(async function (tx) {
      const ref = db.collection("pushQueue").doc(id), s = await tx.get(ref);
      if (s.exists && s.get("ck") === chunkId) tx.delete(ref);
    });
  });
  await Promise.all(writes.concat(removes));

  // Handoffs: tell the closer now. A marker makes sure each handoff is announced once, even if the record moves.
  const evs = L.handoffEvents(office, before, after, now);
  for (const ev of evs) {
    try {
      await db.collection("pushSent").doc(ev.key).create({ at: now, uid: ev.h.to.uid, office: office || "" });
    } catch (e) { continue; }                                   // already announced
    if (!(await allowed(office, ev.h.to.uid, now, null))) continue;
    const tz = await tzFor(ev.h.to.uid);
    const r = await sendTo(ev.h.to.uid, [L.handoffMessage(office, ev, tz, now)], 86400);
    logger.info("handoff alert", { office, lead: ev.leadId, sent: r.sent });
  }
}

exports.queueFromOffice = onDocumentWritten({ document: "offices/{office}/leadChunks/{chunk}", retry: false }, function (event) {
  return onChunkWrite(event.params.office, event.params.chunk, event);
});
exports.queueFromTeam = onDocumentWritten({ document: "leadChunks/{chunk}", retry: false }, function (event) {
  return onChunkWrite("", event.params.chunk, event);
});

// Follow-ups that existed before notifications were turned on get queued once, on the first run.
let backfillSeen = false;   // per server instance: once the flag exists, stop touching it (it used to cost a write attempt a minute)
async function backfillOnce(now) {
  if (backfillSeen) return;
  const flag = db.doc("pushMeta/backfill");
  try { await flag.create({ startedAt: now }); } catch (e) { backfillSeen = true; return; }
  backfillSeen = true;
  let n = 0;
  const scan = async function (office, col) {
    const qs = await col.get();
    for (const doc of qs.docs) {
      if (doc.id.charAt(0) === "_") continue;
      const d = L.diffQueue(office, doc.id, null, doc.data(), now);
      for (const e of d.upserts) { const id = e.id; delete e.id; delete e.sig; await db.collection("pushQueue").doc(id).set(e); n++; }
    }
  };
  await scan("", db.collection("leadChunks"));
  const offices = await db.collection("offices").get();
  for (const o of offices.docs) await scan(o.id, db.collection("offices/" + o.id + "/leadChunks"));
  await flag.set({ startedAt: now, doneAt: Date.now(), queued: n });
  logger.info("backfill done", { queued: n });
}

exports.sendDue = onSchedule({ schedule: "every 1 minutes", timeZone: "Etc/UTC", retryCount: 0 }, async function () {
  const now = Date.now();
  await backfillOnce(now);
  const qs = await db.collection("pushQueue").where("at", "<=", now + 20000).orderBy("at").limit(400).get();
  if (qs.empty) return;
  // Claim each alert by deleting it as it was read; if it was rescheduled meanwhile (or another run took it), skip it.
  const claimed = [];
  await Promise.all(qs.docs.map(async function (doc) {
    try { await doc.ref.delete({ lastUpdateTime: doc.updateTime }); claimed.push(doc.data()); } catch (e) { /* changed or taken */ }
  }));
  const groups = new Map();
  claimed.forEach(function (e) {
    if (!e || !e.uid || now - e.at > L.DROP_MS) return;          // hours late (outage): don't buzz about it now
    const k = (e.office || "") + "|" + e.uid;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  });
  let sent = 0;
  const offices = new Map();
  for (const [k, items] of groups) {
    const office = items[0].office || "", uid = items[0].uid;
    if (!(await allowed(office, uid, now, offices))) continue;
    items.sort(function (a, b) { return a.at - b.at; });
    const r = await sendTo(uid, L.dueMessages(items), 3600);
    sent += r.sent;
  }
  logger.info("due alerts", { claimed: claimed.length, people: groups.size, sent: sent });

  // Once a day: forget phones that haven't opened VPEX in 4 months.
  const t = new Date(now);
  if (t.getUTCHours() === 8 && t.getUTCMinutes() === 0) {
    const old = await db.collection("pushTokens").where("at", "<", now - 120 * 86400000).limit(300).get();
    await Promise.all(old.docs.map(function (d) { return d.ref.delete().catch(function () {}); }));
    await retention(now);
  }
});

// Keep only what's needed (the Privacy Policy's retention section): handoff markers 30 days, once-a-day send marks and
// rate-limit gates 14 days, cookie-consent proof 3 years. A few hundred at a time, once a day, so it never runs long.
async function retention(now) {
  const sweep = async function (col, field, before) {
    try {
      const qs = await db.collection(col).where(field, "<", before).limit(300).get();
      await Promise.all(qs.docs.map(function (d) { return d.ref.delete().catch(function () {}); }));
      return qs.size;
    } catch (e) { logger.warn("retention sweep failed", { col, err: String(e).slice(0, 200) }); return 0; }
  };
  const n = { pushSent: await sweep("pushSent", "at", now - L.RETAIN.pushSent), pushMeta: await sweep("pushMeta", "at", now - L.RETAIN.pushMeta),
    consent: await sweep("consentLog", "at", now - L.RETAIN.consent) };
  logger.info("retention", n);
}

// "Send a test" in the app writes pushTests/{id}; this sends it to that person's phones and removes the request.
const TEST_DELAY_MS = Number(process.env.TEST_DELAY_MS || 5000);
exports.sendTest = onDocumentCreated({ document: "pushTests/{id}", retry: false }, async function (event) {
  const snap = event.data;
  if (!snap) return;
  const d = snap.data() || {}, now = Date.now();
  await snap.ref.delete().catch(function () {});
  if (typeof d.uid !== "string" || typeof d.at !== "number" || Math.abs(now - d.at) > 5 * 60000) return;
  const gate = db.doc("pushMeta/test_" + d.uid);
  const last = await gate.get();
  if (last.exists && now - (last.get("at") || 0) < 15000) return;   // one test every 15 seconds is plenty
  await gate.set({ at: now });
  await new Promise(function (res) { setTimeout(res, TEST_DELAY_MS); });   // time to lock the phone and see it on the lock screen
  const r = await sendTo(d.uid, [L.testMessage(typeof d.office === "string" ? d.office : "")], 600);
  logger.info("test alert", { uid: d.uid, sent: r.sent, phones: r.phones });
});

// ---------- "Message your floor" ----------
// The app writes pushFloor/{uid_time} {uid, office, at, body, to}. Only an active admin or manager of an open office can send.
// The message goes to the reps' phones, is kept in floor/{id} so reps with VPEX open (or without notifications on) see it
// as a banner, and the sender gets a receipt in pushFloorDone/{id}: how many reps it reached and who doesn't have notifications on.
exports.sendFloor = onDocumentCreated({ document: "pushFloor/{id}", retry: false }, async function (event) {
  const snap = event.data;
  if (!snap) return;
  const id = event.params.id, now = Date.now();
  await snap.ref.delete().catch(function () {});
  const req = L.floorRequest(snap.data(), id, now);
  if (!req) return;
  const done = db.doc("pushFloorDone/" + id);
  const finish = function (x) { return done.set(Object.assign({ uid: req.uid, at: now }, x)).catch(function (e) { logger.warn("floor receipt failed", { err: String(e) }); }); };
  const office = req.office;
  const me = await memberRef(office, req.uid).get().catch(function () { return null; });
  if (!me || !me.exists || me.get("active") !== true || !L.weekLead(me.get("role"))) return finish({ status: "not-allowed" });
  if (office) {
    const o = await db.doc("offices/" + office).get();
    if (!L.officeOpen(o.exists ? o.data() : null, now)) return finish({ status: "closed" });
  }
  const gate = db.doc("pushMeta/floor_" + (office || "_team"));
  const lim = await db.runTransaction(async function (tx) {
    const g = await tx.get(gate);
    const r = L.floorGate(g.exists ? g.data() : null, now);
    if (r.ok) tx.set(gate, r.next);
    return r;
  });
  if (!lim.ok) return finish({ status: lim.why });
  const ms = await (office ? db.collection("offices/" + office + "/members") : db.collection("members")).where("active", "==", true).get();
  const people = L.floorRecipients(ms.docs.map(function (d) { return { uid: d.id, name: d.get("name") || d.get("username") || "" }; }), req.uid, req.to);
  const byName = me.get("name") || me.get("username") || "";
  await db.doc((office ? "offices/" + office + "/" : "") + "floor/" + id).set({ by: req.uid, byName: byName, body: req.body, to: req.to, at: now });
  const msg = L.floorMessage(office, byName, req.body);
  const res = await Promise.all(people.map(function (p) {
    return sendTo(p.uid, [msg], 3600).catch(function () { return { sent: 0, phones: 0 }; }).then(function (r) { return { p: p, r: r }; });
  }));
  const reached = res.filter(function (x) { return x.r.sent > 0; }), off = res.filter(function (x) { return !x.r.sent; });
  await finish({ status: "sent", people: people.length, reached: reached.length, phones: reached.reduce(function (n, x) { return n + x.r.sent; }, 0),
    off: off.slice(0, 40).map(function (x) { return x.p.name || "A rep"; }) });
  logger.info("floor message", { office: office ? "office" : "team", people: people.length, reached: reached.length });
  // keep two days of messages
  const old = await db.collection((office ? "offices/" + office + "/" : "") + "floor").where("at", "<", now - 2 * 86400000).limit(50).get().catch(function () { return null; });
  if (old) await Promise.all(old.docs.map(function (d) { return d.ref.delete().catch(function () {}); }));
  // and a day of receipts
  const oldR = await db.collection("pushFloorDone").where("at", "<", now - 86400000).limit(50).get().catch(function () { return null; });
  if (oldR) await Promise.all(oldR.docs.map(function (d) { return d.ref.delete().catch(function () {}); }));
});

// ---------- morning summary ----------
// Weekdays in the 8 o'clock hour of each rep's own time zone: one notification with what's waiting today.
exports.morningDigest = onSchedule({ schedule: "30 * * * *", timeZone: "Etc/UTC", retryCount: 0, timeoutSeconds: 300 }, async function () {
  const now = Date.now();
  const toks = await db.collection("pushTokens").get();
  const people = new Map();
  toks.docs.forEach(function (d) {
    const uid = d.get("uid");
    if (typeof uid !== "string" || people.has(uid)) return;
    people.set(uid, { office: typeof d.get("office") === "string" ? d.get("office") : "", tz: L.safeTz(d.get("tz")) });
  });
  const officeCache = new Map(), chunkCache = new Map(), weekCache = new Map();
  let sent = 0, due = 0, weekSent = 0;
  for (const [uid, p] of people) {
    const lp = L.localParts(now, p.tz);
    if (!L.digestDue(lp)) continue;
    due++;
    if (!(await allowed(p.office, uid, now, officeCache))) continue;
    let name = "", role = "";
    try { const m = await memberRef(p.office, uid).get(); name = (m.exists && m.get("name")) || ""; role = (m.exists && m.get("role")) || ""; } catch (e) {}
    // Mondays, admins and managers: last week on the floor (its own once-a-week mark; never stops the morning summary).
    if (L.weekDue(lp) && L.weekLead(role)) {
      try {
        await db.doc("pushMeta/week_" + uid + "_" + lp.date).create({ at: now });
        const msg = L.weekMessage(name, await floorWeek(p.office, now, p.tz, weekCache), p.office);
        if (msg) weekSent += (await sendTo(uid, [msg], 6 * 3600)).sent;
      } catch (e) { if (!/exists/i.test(String(e && e.message)) && !(e && (e.code === 6 || e.code === "already-exists"))) logger.warn("week summary failed", { err: String(e) }); }
    }
    try { await db.doc("pushMeta/digest_" + uid + "_" + lp.date).create({ at: now }); } catch (e) { continue; }   // already sent today
    let chunks = chunkCache.get(p.office);
    if (!chunks) {
      const qs = await db.collection(p.office ? "offices/" + p.office + "/leadChunks" : "leadChunks").get();
      chunks = qs.docs.filter(function (d) { return d.id.charAt(0) !== "_"; }).map(function (d) { return d.data(); });
      chunkCache.set(p.office, chunks);
    }
    const msg = L.digestMessage(name, L.digestCounts(chunks, uid, now, p.tz), p.office, p.tz);
    if (!msg) continue;
    const r = await sendTo(uid, [msg], 4 * 3600);
    sent += r.sent;
  }
  logger.info("morning summary", { people: people.size, due, sent, weekSent });
});

// Last week's calls for one office (and the week before, for the change), read one UTC day at a time so a big floor
// never holds two weeks of calls at once. Cached per office and time zone for the run.
async function floorWeek(office, now, tz, cache) {
  const key = office + "|" + tz;
  if (cache.has(key)) return cache.get(key);
  const col = db.collection(office ? "offices/" + office + "/callDays" : "callDays"), ID = admin.firestore.FieldPath.documentId();
  const b = L.lastWeekBounds(now, tz), pb = L.lastWeekBounds(b.start + 12 * 3600000, tz);
  const read = async function (bounds, w) {
    for (const d of L.weekDates(bounds)) {
      const qs = await col.where(ID, ">=", d).where(ID, "<=", d + "~").get();   // {date}, {date}_{uid}, {date}_{uid}_{HH}; not n_ / act_
      qs.docs.forEach(function (x) { L.weekAdd(w, x.data(), bounds); });
    }
    return w;
  };
  const w = await read(b, L.weekNew());
  w.prev = (await read(pb, L.weekNew())).calls;
  w.seen = {};
  cache.set(key, w);
  return w;
}

// The Instagram bot's hand-off page: Vincent taps Done after posting by hand. Each page carries a one-time key that the bot
// saved with that post, so only that page can mark that post. Nothing else can be read or changed through this.
exports.igDone = onRequest({ invoker: "public", cors: true, maxInstances: 2, timeoutSeconds: 20 }, async function (req, res) {
  const id = String(req.query.id || ""), k = String(req.query.k || "");
  if (req.method !== "POST" || !/^[A-Za-z0-9._-]{1,120}$/.test(id) || k.length < 16) { res.status(400).json({ ok: false }); return; }
  const ref = db.doc("igBot/posted/items/" + id);
  try {
    const out = await db.runTransaction(async function (t) {
      const s = await t.get(ref);
      if (!s.exists || !s.get("doneKey") || s.get("doneKey") !== k) return "denied";
      if (s.get("by") === "hand" && s.get("status") === "posted") return "already";
      t.update(ref, { status: "posted", by: "hand", doneAt: Date.now() / 1000 });
      return "ok";
    });
    if (out === "denied") { res.status(403).json({ ok: false }); return; }
    res.json({ ok: true, already: out === "already" });
  } catch (e) {
    logger.error("igDone failed", { id: id, err: String(e) });
    res.status(500).json({ ok: false });
  }
});

// ---------- growth counts ----------
// Beacons from vpexdialer.com: one counter per (step, source, medium, campaign, post, industry, phone/computer) per day in
// growth/days/items/{YYYY-MM-DD}. Nothing that identifies a person is sent or kept. For a sign-up, the office's name is
// stored once with where it came from (growth/offices/items/{office}), only if that office was created in the last 3 hours.
// No app user can read growth/ (the database rules have no rule for it); the Instagram bot reads it for the weekly scorecard.
let hitWindow = 0, hitCount = 0;
function hitBudget(now) { if (now - hitWindow > 60000) { hitWindow = now; hitCount = 0; } return ++hitCount <= 1200; }
// The counter names already in today's document, read once per server instance per day (to cap new ones; see L.capHit).
let hitDay = "", hitSeen = null;
async function hitKeysToday(day) {
  if (hitDay !== day || !hitSeen) {
    const snap = await db.doc("growth/days/items/" + day).get();
    const c = snap.exists ? snap.get("c") : null;
    hitSeen = new Set(c && typeof c === "object" ? Object.keys(c) : []); hitDay = day;
  }
  return hitSeen;
}
exports.hit = onRequest({ invoker: "public", cors: L.HIT_ORIGINS, maxInstances: 3, timeoutSeconds: 10 }, async function (req, res) {
  const now = Date.now();
  if (req.method !== "POST") { res.status(405).end(); return; }
  const origin = req.get("origin") || "";
  if (!L.hitOriginOk(origin)) { res.status(403).end(); return; }
  if (!hitBudget(now)) { res.status(429).end(); return; }
  const raw = req.rawBody ? req.rawBody.toString("utf8") : (typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}));
  const parsed = raw.length <= 2000 ? L.parseHit(raw) : null;
  if (!parsed) { res.status(400).end(); return; }
  const day = L.nyDate(now), inc = admin.firestore.FieldValue.increment(1);
  try {
    const seen = await hitKeysToday(day), h = L.capHit(parsed, seen), key = L.hitKey(h);
    seen.add(key);
    const writes = [db.doc("growth/days/items/" + day).set({ day: day, t: inc, c: { [key]: inc } }, { merge: true })];
    if (h.e === "signup") writes.push((async function () {
      const o = await db.doc("offices/" + h.o).get();
      if (!o.exists || !L.freshOffice(o.data(), now)) return;
      try { await db.doc("growth/offices/items/" + h.o).create({ at: now, s: h.s, m: h.m, c: h.c, n: h.n, i: h.i || o.get("industry") || "", d: h.d }); } catch (e) {}   // first one wins
    })());
    await Promise.all(writes);
    res.status(204).end();
  } catch (e) {
    logger.warn("hit failed", { err: String(e) });
    res.status(500).end();
  }
});

// ---------- cookie consent records ----------
// The banner on vpexdialer.com posts each choice here (accept all, reject all, saved preferences, withdrawn, or the
// browser's Global Privacy Control). Stored as consentLog/{id}_{time}: the proof a regulator can ask for. Nobody reads
// it from the app (the database rules have no rule for it); deleted after 3 years by the daily retention sweep.
let consentWindow = 0, consentCount = 0;
exports.consent = onRequest({ invoker: "public", cors: L.HIT_ORIGINS, maxInstances: 2, timeoutSeconds: 10 }, async function (req, res) {
  const now = Date.now();
  if (req.method !== "POST") { res.status(405).end(); return; }
  if (!L.hitOriginOk(req.get("origin") || "")) { res.status(403).end(); return; }
  if (now - consentWindow > 60000) { consentWindow = now; consentCount = 0; }
  if (++consentCount > 600) { res.status(429).end(); return; }
  const raw = req.rawBody ? req.rawBody.toString("utf8") : (typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}));
  const c = raw.length <= 600 ? L.parseConsent(raw) : null;
  if (!c) { res.status(400).end(); return; }
  try {
    await db.doc("consentLog/" + c.id + "_" + now).set(Object.assign({ at: now }, c));
    res.status(204).end();
  } catch (e) {
    logger.warn("consent failed", { err: String(e).slice(0, 200) });
    res.status(500).end();
  }
});

// ---------- calendar feed ----------
// GET https://<region>-<project>.cloudfunctions.net/cal?k=vc_<office>_<uid>_<secret> (webcal:// on an iPhone): that login's
// open follow-ups and appointments as an iCalendar feed. The login keeps only the secret's SHA-256 in its own record
// (leadChunks/r_<uid>, calFeed.h); a turned-off login, a removed key or a paused office gets nothing.
exports.cal = onRequest({ invoker: "public", cors: false, maxInstances: 3, timeoutSeconds: 30 }, async function (req, res) {
  const now = Date.now(), no = function (code, msg) { res.status(code).set("Content-Type", "text/plain; charset=utf-8").send(msg); };
  if (req.method !== "GET" && req.method !== "HEAD") return no(405, "Use GET.");
  const k = L.calKey(String((req.query && req.query.k) || "").replace(/\.ics$/, ""));
  if (!k) return no(404, "Not found.");
  const pre = k.office ? "offices/" + k.office + "/" : "";
  try {
    const mine = await db.doc(pre + "leadChunks/r_" + k.uid).get();
    const cf = mine.exists ? mine.get("calFeed") : null;
    if (!cf || !L.sameHash(cf.h, L.sha256hex(k.secret))) return no(404, "Not found.");
    if (!(await allowed(k.office, k.uid, now, null))) return no(403, "This calendar is turned off.");
    const qs = await db.collection(pre + "leadChunks").get();
    const ev = L.calEvents(k.office, qs.docs.filter(function (d) { return d.id.charAt(0) !== "_"; }).map(function (d) { return d.data(); }), k.uid, now);
    res.status(200).set("Content-Type", "text/calendar; charset=utf-8").set("Cache-Control", "private, max-age=300").send(L.calIcs(ev, now));
  } catch (e) {
    logger.error("cal failed", { err: String(e) });
    no(500, "Try again later.");
  }
});

// ---------- booking links ----------
// GET  .../book?k=vb_<office>_<leadId>_<secret>  → the times the lead can pick (JSON), for vpexdialer.com/book/
// POST .../book {k, at}                           → books that time: a follow-up for the rep in the lead's record, and a push.
// Wrong, expired or turned-off links all answer 404, so a link says nothing about whether a lead exists.
let bookWindow = 0, bookCount = 0;
const bookPer = new Map();
exports.book = onRequest({ invoker: "public", cors: L.HIT_ORIGINS, maxInstances: 3, timeoutSeconds: 30 }, async function (req, res) {
  const now = Date.now();
  res.set("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "POST") { res.status(405).json({ error: "method" }); return; }
  if (now - bookWindow > 60000) { bookWindow = now; bookCount = 0; bookPer.clear(); }
  if (++bookCount > 600) { res.status(429).json({ error: "busy" }); return; }
  let body = {};
  if (req.method === "POST") {
    const raw = req.rawBody ? req.rawBody.toString("utf8") : (typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}));
    if (raw.length > 500) { res.status(400).json({ error: "bad" }); return; }
    try { body = JSON.parse(raw) || {}; } catch (e) { res.status(400).json({ error: "bad" }); return; }
  }
  const k = L.bookKey(req.method === "POST" ? body.k : (req.query && req.query.k));
  const gone = function () { res.status(404).json({ error: "gone" }); };
  if (!k) return gone();
  const n = (bookPer.get(k.leadId) || 0) + 1; bookPer.set(k.leadId, n);
  if (n > 30) { res.status(429).json({ error: "busy" }); return; }
  const pre = k.office ? "offices/" + k.office + "/" : "";
  try {
    const qs = await db.collection(pre + "leadChunks").get();
    const docs = qs.docs.filter(function (d) { return d.id.charAt(0) !== "_"; });
    const home = docs.find(function (d) { const ls = d.get("leads"); return ls && Object.prototype.hasOwnProperty.call(ls, k.leadId); });
    if (!home) return gone();
    const lead = home.get("leads")[k.leadId] || {}, book = lead.book;
    if (!L.bookLive(book, now) || !L.sameHash(book.h, L.sha256hex(k.secret))) return gone();
    if (lead.dnc || lead.retired || lead.badNumber) return gone();
    if (!(await allowed(k.office, book.by.uid, now, null))) return gone();
    let co = "";
    if (k.office) { const o = await db.doc("offices/" + k.office).get(); co = o.exists ? (o.get("name") || "") : ""; }
    const busy = L.bookBusy(docs.map(function (d) { return d.data(); }), book.by.uid, now, k.leadId);
    const slots = L.bookSlots(book, now, busy);
    if (req.method === "GET") { res.status(200).json(L.bookView(lead, book, co, slots, now)); return; }

    const at = Number(body.at);
    if (slots.indexOf(at) < 0) { res.status(409).json({ error: "taken", view: L.bookView(lead, book, co, slots, now) }); return; }
    const ref = home.ref, field = new admin.firestore.FieldPath("leads", k.leadId);
    let moved = false;
    const ok = await db.runTransaction(async function (tx) {
      const snap = await tx.get(ref), cur = snap.exists ? (snap.get("leads") || {})[k.leadId] : null;
      if (!cur || !L.bookLive(cur.book, now) || cur.book.h !== book.h) return false;
      moved = typeof cur.book.picked === "number" && cur.book.picked > now;
      tx.update(ref, field, L.bookApply(cur, k.leadId, at, now));
      return true;
    });
    if (!ok) return gone();
    const tz = (await tzFor(book.by.uid)) || book.rtz;
    const r = await sendTo(book.by.uid, [L.bookMessage(k.office, k.leadId, lead, at, tz, moved)], 86400).catch(function () { return { sent: 0 }; });
    logger.info("booking", { office: k.office ? "office" : "team", moved: moved, sent: r.sent });
    res.status(200).json(Object.assign(L.bookView(Object.assign({}, lead, { book: Object.assign({}, book, { picked: at }) }), Object.assign({}, book, { picked: at }), co, slots, now), { ok: true }));
  } catch (e) {
    logger.error("book failed", { err: String(e).slice(0, 200) });
    res.status(500).json({ error: "later" });
  }
});
