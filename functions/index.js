// VPEX notifications (Firebase Cloud Functions, 2nd gen).
//  - queueFromOffice / queueFromTeam: every time a lead record is saved, keep the alert queue in step with its follow-ups
//    and send handoff alerts to the closer right away.
//  - sendDue: every minute, send the follow-ups that just came due.
//  - sendTest: the "Send a test" button in the app.
// Tokens live in pushTokens/{id} (written by the app, readable only here). The queue lives in pushQueue/{id}.
"use strict";

const { onDocumentWritten, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
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
async function backfillOnce(now) {
  const flag = db.doc("pushMeta/backfill");
  try { await flag.create({ startedAt: now }); } catch (e) { return; }
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
  }
});

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
