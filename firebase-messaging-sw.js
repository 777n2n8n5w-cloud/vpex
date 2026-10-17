/* VPEX notifications worker (v2).
   Shows every VPEX notification itself (follow-ups, appointments, handoffs, tests), also while VPEX is open:
   iPhones stop delivering to a site whose alerts arrive without being shown. Tapping one opens VPEX on that lead.
   It doesn't cache pages, so app updates arrive exactly as before. */
"use strict";
var APP = self.registration.scope;

function payloadOf(event) {
  if (!event.data) return {};
  try { return event.data.json() || {}; } catch (e) {}
  try { return { notification: { body: event.data.text() } }; } catch (e) {}
  return {};
}

self.addEventListener("push", function (event) {
  var p = payloadOf(event), n = p.notification || {}, d = p.data || {};
  var link = (p.fcmOptions && p.fcmOptions.link) || d.link || APP;
  var title = n.title || "VPEX";
  var options = {
    body: n.body || "",
    icon: n.icon || APP + "vpex-icon-192.png",
    badge: n.badge || APP + "vpex-icon-96.png",
    tag: n.tag || d.kind || "vpex",
    renotify: true,
    data: { link: link, kind: d.kind || "", leadId: d.leadId || "" }
  };
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    // Tell an open VPEX too, so it can confirm a test right away
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      list.forEach(function (c) { try { c.postMessage({ vpexPush: { kind: d.kind || "", leadId: d.leadId || "", title: title } }); } catch (e) {} });
    }).catch(function () {})
  ]));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var link = (event.notification.data && event.notification.data.link) || APP;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    var same = list.filter(function (c) { return c.url === link; })[0];
    if (same && same.focus) return same.focus();
    var open = list.filter(function (c) { return c.url.indexOf(APP) === 0; })[0];
    if (open && open.focus) {
      return open.focus().then(function (w) {
        var c = w || open;
        return c.navigate ? c.navigate(link).catch(function () { return self.clients.openWindow(link); }) : null;
      });
    }
    return self.clients.openWindow ? self.clients.openWindow(link) : null;
  }));
});

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (event) { event.waitUntil(self.clients.claim()); });
