/* VPEX notifications worker. It only shows notifications sent by VPEX (follow-ups, appointments, handoffs)
   and opens the app when one is tapped. It doesn't cache pages, so app updates arrive exactly as before. */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAdtYFpI6YkpGXdgSIGrmCOQvSxqs9jPac",
  authDomain: "dovetail-f863c.firebaseapp.com",
  projectId: "dovetail-f863c",
  storageBucket: "dovetail-f863c.firebasestorage.app",
  messagingSenderId: "49612256344",
  appId: "1:49612256344:web:5b2ace3e051f6654ec862d"
});
// Notifications arrive with a title, body and link; Firebase shows them and opens the link on tap.
firebase.messaging();

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (event) { event.waitUntil(self.clients.claim()); });
