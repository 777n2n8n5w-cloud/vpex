// VPEX notifications: the plain logic (no Firebase calls), so it can be tested on its own.
"use strict";

const APP_URL = "https://vpexdialer.com/";
const STALE_MS = 2 * 60 * 1000;          // a follow-up that came due more than 2 minutes ago is never queued
const DROP_MS = 6 * 60 * 60 * 1000;      // a queued alert more than 6 hours late is dropped instead of sent
const APPT_LEAD_MS = 10 * 60 * 1000;     // appointment reminders go out 10 minutes early

function str(v, max) { v = v == null ? "" : String(v); return max && v.length > max ? v.slice(0, max - 1) + "…" : v; }
function firstName(n) { return str(n).trim().split(/\s+/)[0] || ""; }
function isUid(u) { return typeof u === "string" && u.length >= 6 && u !== "me"; }

// Doc ids can't hold "/"; office "" means VPEX's original team (top-level collections).
function queueId(office, taskId) { return ((office || "_") + "__" + str(taskId)).replace(/[\/#\[\]\.\s]/g, "_").slice(0, 300); }

function isAppt(t) { return /^Appointment/.test(str(t && t.note)); }

// When (if ever) a task should ping the person it's assigned to.
function notifyAt(t, lead) {
  if (!t || t.done || typeof t.dueAt !== "number" || !isFinite(t.dueAt)) return null;
  if (lead && (lead.retired || lead.badNumber)) return null;
  // Routine "try again" calls after a no answer or voicemail stay in the dialer's queue; they don't buzz the phone.
  if (t.auto && t.type === "Call" && /^Try \d+/.test(str(t.note))) return null;
  return isAppt(t) ? t.dueAt - APPT_LEAD_MS : t.dueAt;
}

function assigneeOf(t, lead) {
  var u = t && t.assignee && t.assignee.uid;
  if (!isUid(u)) u = lead && lead.owner && lead.owner.uid;
  return isUid(u) ? u : null;
}

// Everything in one lead record that should become a queued alert, keyed by queue doc id.
function taskEntries(office, chunkId, data, now) {
  var out = new Map();
  var leads = (data && data.leads) || {};
  Object.keys(leads).forEach(function (leadId) {
    var lead = leads[leadId] || {};
    (Array.isArray(lead.tasks) ? lead.tasks : []).forEach(function (t) {
      if (!t || !t.id) return;
      var at = notifyAt(t, lead), uid = assigneeOf(t, lead);
      if (at == null || !uid) return;
      var e = {
        office: office || "", ck: chunkId, leadId: leadId, taskId: str(t.id, 120), uid: uid, at: at, dueAt: t.dueAt,
        leadName: str(lead.name || t.leadName || "a lead", 80), type: str(t.type || "Follow-up", 30), note: str(t.note, 200), appt: isAppt(t)
      };
      e.sig = [e.at, e.uid, e.note, e.leadName, e.type].join("|");
      out.set(queueId(office, t.id), e);
    });
  });
  return out;
}

// What one write to a lead record changes in the queue. Only tasks that are new or changed are (re)queued,
// so saving a record never re-sends an alert that already went out.
function diffQueue(office, chunkId, before, after, now) {
  var was = taskEntries(office, chunkId, before, now), will = taskEntries(office, chunkId, after, now);
  var upserts = [], removes = [];
  will.forEach(function (e, k) {
    var o = was.get(k);
    if (o && o.sig === e.sig) return;
    if (e.at < now - STALE_MS) { if (o) removes.push(k); return; }      // already past: the app shows it, no late buzz
    upserts.push(Object.assign({ id: k }, e));
  });
  was.forEach(function (e, k) { if (!will.has(k)) removes.push(k); });
  return { upserts: upserts, removes: removes };
}

// Handoffs that just landed on a closer (sent right away, once).
function handoffEvents(office, before, after, now) {
  var out = [], bl = (before && before.leads) || {}, al = (after && after.leads) || {};
  Object.keys(al).forEach(function (id) {
    var lead = al[id] || {}, h = lead.handoff;
    if (!h || h.seen || !h.to || !isUid(h.to.uid) || typeof h.at !== "number") return;
    if (now - h.at > DROP_MS || h.at - now > 5 * 60 * 1000) return;
    var p = (bl[id] || {}).handoff;
    if (p && p.at === h.at && p.to && p.to.uid === h.to.uid) return;
    out.push({ leadId: id, lead: lead, h: h, key: ((office || "_") + "__h_" + id + "_" + h.at).replace(/[\/#\[\]\.\s]/g, "_").slice(0, 300) });
  });
  return out;
}

// Open = not paused, and on a trial, paid (plus 7 days' grace) or free. Same test as the security rules.
function officeOpen(d, now) {
  if (!d) return false;
  if (d.locked === true) return false;
  if (d.plan === "comp") return true;
  if (d.plan === "paid") return now < (typeof d.paidThrough === "number" ? d.paidThrough : 99999999999999) + 7 * 86400000;
  if (d.plan === "trial") return typeof d.trialEnds === "number" && now < d.trialEnds;
  return false;
}

function safeTz(tz) {
  try { if (tz) { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } } catch (e) {}
  return "America/New_York";
}
function fmtWhen(ts, tz, now) {
  tz = safeTz(tz);
  var day = function (t) { return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t)); };
  var time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(ts));
  var d = day(ts), n = day(now || Date.now()), tm = day((now || Date.now()) + 86400000);
  if (d === n) return "today " + time;
  if (d === tm) return "tomorrow " + time;
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(new Date(ts)) + ", " + time;
}

function leadLink(office, leadId) {
  var q = [];
  if (office) q.push("o=" + encodeURIComponent(office));
  if (leadId) q.push("open=" + encodeURIComponent(leadId));
  return APP_URL + (q.length ? "?" + q.join("&") : "");
}

// The first part of a task note, the way the app shows it ("Interested — follow up while it's warm" -> that line).
function why(note) {
  var w = str(note).split(" · ")[0].trim();
  return w.length > 90 ? w.slice(0, 89) + "…" : w;
}

// One person's alerts from one run of the clock, turned into notifications. Appointments stay separate;
// three or more follow-ups due at once become one summary instead of a stack of buzzes.
function dueMessages(items) {
  var appts = items.filter(function (i) { return i.appt; }), rest = items.filter(function (i) { return !i.appt; });
  var out = appts.map(function (i) {
    var n = str(i.note).replace(/^Appointment\s*[—-]\s*/, "");
    return { kind: "appt", title: "Appointment in 10 min: " + i.leadName, body: n ? n.charAt(0).toUpperCase() + n.slice(1) : "Tap to open their file.", link: leadLink(i.office, i.leadId), tag: "vpex-lead-" + i.leadId, leadId: i.leadId, office: i.office };
  });
  if (rest.length >= 3) {
    var names = rest.slice(0, 3).map(function (i) { return i.leadName; });
    out.push({ kind: "due", title: rest.length + " follow-ups due now", body: names.join(", ") + (rest.length > 3 ? " and " + (rest.length - 3) + " more" : "") + ". Tap to start.",
      link: leadLink(rest[0].office, ""), tag: "vpex-due", leadId: "", office: rest[0].office });
  } else {
    rest.forEach(function (i) {
      var cb = /callback/i.test(i.note), fu = i.type === "Follow-up";
      var w = why(i.note);
      var title = (cb ? "Callback due: " : fu ? "Follow-up due: " : (i.type && i.type !== "Call" ? i.type + " due: " : "Call due: ")) + i.leadName;
      var body = cb ? "They asked you to call back now." : (w && !/^interested$/i.test(w) ? w : "Tap to open and call.");
      out.push({ kind: "due", title: title, body: body, link: leadLink(i.office, i.leadId), tag: "vpex-lead-" + i.leadId, leadId: i.leadId, office: i.office });
    });
  }
  return out;
}

function handoffMessage(office, ev, tz, now) {
  var h = ev.h, from = firstName(h.from && h.from.name) || "Your team";
  var body = (typeof h.apptAt === "number" ? "Appointment " + fmtWhen(h.apptAt, tz, now) : "Tap to open their file.") + (h.note ? " · " + str(h.note, 120) : "");
  return { kind: "handoff", title: "New handoff from " + from + ": " + str(ev.lead.name || "a lead", 60), body: body, link: leadLink(office, ev.leadId), tag: "vpex-lead-" + ev.leadId, leadId: ev.leadId, office: office || "" };
}

function testMessage(office) {
  return { kind: "test", title: "Notifications are on", body: "Follow-ups and handoffs will show up here, even when VPEX is closed.", link: leadLink(office, ""), tag: "vpex-test", leadId: "", office: office || "" };
}

// The message Firebase Cloud Messaging sends to one phone.
function fcmMessage(token, m, ttlSec) {
  return {
    token: token,
    data: { kind: m.kind, leadId: m.leadId || "", office: m.office || "", link: m.link },
    webpush: {
      headers: { Urgency: "high", TTL: String(ttlSec || 3600) },
      notification: { title: m.title, body: m.body, icon: APP_URL + "vpex-icon-192.png", badge: APP_URL + "vpex-icon-96.png", tag: m.tag, renotify: true },
      fcmOptions: { link: m.link }
    }
  };
}

// Tokens that will never work again (app removed, notifications turned off): delete them.
function deadToken(code) {
  return code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token" || code === "messaging/invalid-argument";
}

// Office slug from a login email (name@office.vpex.app); "" for VPEX's original team.
function officeFromEmail(email) {
  var m = /@([a-z0-9-]{3,32})\.vpex\.app$/.exec(String(email || "").toLowerCase());
  return m ? m[1] : "";
}

// ---------- morning summary ----------
var DIGEST_HOUR = 8;       // weekdays, in the 8 o'clock hour of the rep's own time zone (the clock runs at half past)
function localParts(ts, tz) {
  var p = new Intl.DateTimeFormat("en-US", { timeZone: safeTz(tz), hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short" }).formatToParts(new Date(ts));
  var g = function (k) { var x = p.filter(function (y) { return y.type === k; })[0]; return x ? x.value : ""; };
  return { date: g("year") + "-" + g("month") + "-" + g("day"), hour: Number(g("hour")) % 24, weekday: g("weekday") };
}
function digestDue(lp) { return lp.hour === DIGEST_HOUR && lp.weekday !== "Sat" && lp.weekday !== "Sun"; }
// First and last moments of the rep's local day, found to the minute (safe across clock changes).
function localDayBounds(now, tz) {
  var today = localParts(now, tz).date, lo, hi, mid;
  lo = now; hi = now + 26 * 3600000;
  while (hi - lo > 60000) { mid = Math.floor((lo + hi) / 2); if (localParts(mid, tz).date === today) lo = mid; else hi = mid; }
  var end = Math.floor(lo / 60000) * 60000 + 60000;        // midnight always falls on a whole minute
  lo = now - 26 * 3600000; hi = now;
  while (hi - lo > 60000) { mid = Math.floor((lo + hi) / 2); if (localParts(mid, tz).date === today) hi = mid; else lo = mid; }
  return { start: Math.floor(lo / 60000) * 60000 + 60000, end: end };
}
// What one rep has waiting today: open follow-ups due by the end of their day, and today's appointments.
function digestCounts(chunks, uid, now, tz) {
  var b = localDayBounds(now, tz), c = { waiting: 0, today: 0, appts: 0, firstAppt: null };
  (chunks || []).forEach(function (data) {
    var leads = (data && data.leads) || {};
    Object.keys(leads).forEach(function (id) {
      var lead = leads[id] || {};
      if (lead.retired || lead.badNumber || lead.dnc) return;
      (Array.isArray(lead.tasks) ? lead.tasks : []).forEach(function (t) {
        if (!t || t.done || typeof t.dueAt !== "number" || !isFinite(t.dueAt)) return;
        if (assigneeOf(t, lead) !== uid) return;
        if (isAppt(t)) {
          if (t.dueAt >= b.start && t.dueAt < b.end) { c.appts++; if (c.firstAppt == null || t.dueAt < c.firstAppt) c.firstAppt = t.dueAt; }
          return;
        }
        if (t.dueAt < b.end) { c.waiting++; if (t.dueAt >= b.start) c.today++; }
      });
    });
  });
  return c;
}
function digestMessage(name, c, office, tz) {
  if (!c || (!c.waiting && !c.appts)) return null;
  var n = function (x) { return Number(x).toLocaleString("en-US"); }, bits = [];
  if (c.waiting) bits.push(n(c.waiting) + " follow-up" + (c.waiting === 1 ? "" : "s") + " waiting" + (c.today && c.today < c.waiting ? " (" + n(c.today) + " new today)" : ""));
  if (c.appts) bits.push(c.appts + " appointment" + (c.appts === 1 ? "" : "s") + " today, first at " +
    new Intl.DateTimeFormat("en-US", { timeZone: safeTz(tz), hour: "numeric", minute: "2-digit" }).format(new Date(c.firstAppt)));
  var fn = firstName(name);
  return { kind: "digest", title: "Good morning" + (fn ? ", " + fn : ""), body: bits.join(" · ") + (c.waiting ? ". Tap to start dialing." : "."),
    link: leadLink(office, ""), tag: "vpex-digest", leadId: "", office: office || "" };
}

// ---------- growth: anonymous funnel counts from vpexdialer.com (no cookies, no names, no numbers, no addresses) ----------
// The site sends one small beacon per step: the sales page seen, a demo opened, a first call in the demo, the trial form
// opened, an office created, VPEX opened from the Home Screen, and the Instagram link page seen or a post on it tapped.
// Each carries where the visitor came from (utm source, medium, campaign, post id), the industry and phone/computer.
var HIT_EVENTS = ["visit", "demo", "demo_call", "trial_view", "signup", "home_screen", "bio_view", "bio_tap"];
var HIT_INDS = ["insurance", "realestate", "mca", "auto", "solar", "investments"];
var HIT_ORIGINS = ["https://vpexdialer.com", "https://www.vpexdialer.com"];
function hitTok(v, max) { return String(v == null ? "" : v).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/, ""); }
function parseHit(body) {
  var o;
  try { o = typeof body === "string" ? JSON.parse(body) : body; } catch (e) { return null; }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  var e = String(o.e || "");
  if (HIT_EVENTS.indexOf(e) < 0) return null;
  var h = { e: e, s: hitTok(o.s, 24) || "direct", m: hitTok(o.m, 24), c: hitTok(o.c, 40), n: hitTok(o.n, 60),
    i: HIT_INDS.indexOf(o.i) >= 0 ? o.i : "", d: o.d === "m" || o.d === "d" ? o.d : "" };
  if (e === "signup") { var sl = String(o.o || ""); if (!/^[a-z0-9-]{3,40}$/.test(sl)) return null; h.o = sl; }
  return h;
}
// Only the site's own pages may count. A browser always sends Origin on these POSTs; a request without one is a script.
function hitOriginOk(origin) { return HIT_ORIGINS.indexOf(String(origin || "")) >= 0; }
// A day's counters live in one document (1 MiB cap, about 8,000 counters). Past HIT_DAY_KEYS different combinations in a
// day, a new combination is counted as source "other" with no medium, campaign or post (step, industry and phone/computer
// kept), so junk tags can't fill the document and stop the real counts. Combinations already seen that day still count.
var HIT_DAY_KEYS = 2000;
function capHit(h, seen) {
  if (!h || !seen || seen.has(hitKey(h)) || seen.size < HIT_DAY_KEYS) return h;
  var f = { e: h.e, s: "other", m: "", c: "", n: "", i: h.i, d: h.d }; if (h.o) f.o = h.o; return f;
}
// One counter per combination, in one document per New York day.
function hitKey(h) { return [h.e, h.s, h.m || "-", h.c || "-", h.n || "-", h.i || "-", h.d || "-"].join("~"); }
function unHitKey(k) { var p = String(k).split("~"), f = function (x) { return x === "-" || x == null ? "" : x; };
  return { e: p[0], s: p[1], m: f(p[2]), c: f(p[3]), n: f(p[4]), i: f(p[5]), d: f(p[6]) }; }
function nyDate(ms) { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms)); }
// A sign-up is credited to where the visitor came from only if that office was really just created.
function freshOffice(d, now) { return !!(d && typeof d.createdAt === "number" && now - d.createdAt >= -60000 && now - d.createdAt < 3 * 3600000); }

module.exports = { APP_URL, STALE_MS, DROP_MS, APPT_LEAD_MS, queueId, notifyAt, assigneeOf, taskEntries, diffQueue, handoffEvents, officeOpen,
  fmtWhen, leadLink, dueMessages, handoffMessage, testMessage, fcmMessage, deadToken, officeFromEmail, safeTz, firstName,
  localParts, digestDue, localDayBounds, digestCounts, digestMessage,
  HIT_EVENTS, HIT_INDS, HIT_ORIGINS, HIT_DAY_KEYS, hitOriginOk, capHit, hitTok, parseHit, hitKey, unHitKey, nyDate, freshOffice };
