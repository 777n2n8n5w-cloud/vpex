// Counts every follow-up in every office by why it is (or isn't) queued for a phone alert, using the server's own rules.
// Prints counts only: no names, numbers or notes. Office names are shortened.
"use strict";
const admin = require("firebase-admin");
const L = require("../functions/lib.js");

admin.initializeApp({ projectId: process.env.PROJECT || "dovetail-f863c" });
const db = admin.firestore();

function bucket(t, lead, now) {
  if (!t || !t.id) return "no id";
  if (t.done) return "done";
  if (typeof t.dueAt !== "number" || !isFinite(t.dueAt)) return "no due time";
  if (lead.retired || lead.badNumber) return "lead retired / bad number";
  const at = L.notifyAt(t, lead);
  if (at == null) return "automatic retry (by design, no buzz)";
  const uid = L.assigneeOf(t, lead);
  if (at < now - L.STALE_MS) return uid ? "already due (app shows it)" : "already due, no assignee";
  if (!uid) {
    const a = t.assignee && t.assignee.uid;
    return "UPCOMING BUT NO ASSIGNEE (" + (a === "me" ? 'assignee "me"' : a ? "assignee id too short" : "no assignee") + (lead.owner && lead.owner.uid ? ", owner " + (lead.owner.uid === "me" ? '"me"' : "bad id") : ", no owner") + ")";
  }
  return "upcoming: should be queued";
}

(async function () {
  const now = Date.now();
  const snap = await db.collectionGroup("leadChunks").get();
  const total = {}, offices = {};
  let upcoming = 0, soonest = Infinity, leadsN = 0, tasksN = 0;
  const horizon = { "next 24 h": 0, "1-7 days": 0, "later": 0 };
  snap.forEach(function (doc) {
    if (doc.id.charAt(0) === "_") return;
    const parent = doc.ref.parent.parent;           // offices/{office} or null (original team)
    const office = parent ? parent.id : "";
    const label = office ? office.slice(0, 2) + "…" : "original team";
    const leads = (doc.data() || {}).leads || {};
    Object.keys(leads).forEach(function (id) {
      const lead = leads[id] || {}; leadsN++;
      (Array.isArray(lead.tasks) ? lead.tasks : []).forEach(function (t) {
        tasksN++;
        const b = bucket(t, lead, now);
        total[b] = (total[b] || 0) + 1;
        offices[label] = offices[label] || {};
        offices[label][b] = (offices[label][b] || 0) + 1;
        if (b === "upcoming: should be queued") {
          upcoming++;
          const at = L.notifyAt(t, lead); soonest = Math.min(soonest, at);
          const d = at - now; horizon[d < 864e5 ? "next 24 h" : d < 7 * 864e5 ? "1-7 days" : "later"]++;
        }
      });
    });
  });
  const q = await db.collection("pushQueue").count().get();
  const out = [];
  out.push(snap.size + " lead records, " + leadsN + " leads, " + tasksN + " tasks");
  Object.keys(total).sort(function (a, b) { return total[b] - total[a]; }).forEach(function (k) { out.push("  " + total[k] + "  " + k); });
  out.push("Upcoming alerts by time: " + JSON.stringify(horizon) + (isFinite(soonest) ? ", soonest in " + Math.round((soonest - now) / 60000) + " min" : ""));
  out.push("In the queue now: " + q.data().count + " (should match the upcoming count)");
  out.push("By office:");
  Object.keys(offices).forEach(function (o) { out.push("  " + o + ": " + JSON.stringify(offices[o])); });
  const text = out.join("\n");
  console.log(text);
  const bad = Object.keys(total).some(function (k) { return /^UPCOMING BUT NO ASSIGNEE/.test(k); }) || q.data().count < upcoming;
  const enc = function (s) { return s.replace(/%/g, "%25").replace(/\r/g, "").replace(/\n/g, "%0A"); };
  console.log("::notice title=Follow-up queue diagnosis::" + enc(text.slice(0, 6000)));
  if (bad) console.log("::warning title=Follow-up queue::Some upcoming follow-ups won't buzz anyone, or the queue is short. See the diagnosis.");
  process.exit(0);
})().catch(function (e) { console.log("::warning title=Follow-up queue diagnosis::Couldn't run: " + String(e.message || e).slice(0, 300)); process.exit(0); });
