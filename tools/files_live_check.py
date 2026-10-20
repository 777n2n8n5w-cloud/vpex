#!/usr/bin/env python3
"""End-to-end check of lead files on the live file store, done the way the app does it.

Makes a throwaway office (ci-files-xxxxxx, free plan) with one login, then with that login:
uploads a photo exactly as the app sends it, reads it back, opens its private link, checks the
refusals (wrong uploader label, a web page, signed out, a turned-off login), and deletes it.
Everything it made is removed at the end, even if a step fails. Prints no keys or tokens.

Needs a Google access token for the project (`gcloud auth print-access-token`). Exits 1 on failure.
"""
import json, os, re, secrets, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

PROJECT = os.environ.get("PROJECT", "dovetail-f863c")
HERE = os.path.dirname(os.path.abspath(__file__))
APP = open(os.path.join(HERE, "..", "index.html"), encoding="utf-8").read()
CFG = APP[APP.index("var FIREBASE_CONFIG = "):][:600]
KEY = re.search(r'apiKey: "([^"]+)"', CFG).group(1)          # the public web key the app itself uses
BUCKET = re.search(r'storageBucket: "([^"]+)"', CFG).group(1)
ORIGIN = "https://vpexdialer.com"
V0 = "https://firebasestorage.googleapis.com/v0/b/" + BUCKET + "/o"
FS = "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents" % PROJECT
IDT = "https://identitytoolkit.googleapis.com/v1"
GT = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()
results = []


def http(method, url, body=None, headers=None):
    h = dict(headers or {})
    if isinstance(body, (dict, list)):
        body = json.dumps(body).encode(); h.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=body, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read(), {k.lower(): v for k, v in r.headers.items()}
    except urllib.error.HTTPError as e:
        return e.code, e.read(), {k.lower(): v for k, v in e.headers.items()}


def js(b):
    try:
        return json.loads(b or b"null")
    except Exception:
        return None


def check(name, ok, info=""):
    results.append((name, bool(ok), str(info)[:300]))
    print(("ok    " if ok else "FAIL  ") + name + ("" if ok else "  " + str(info)[:300]))


def admin(method, url, body=None):
    return http(method, url, body, {"Authorization": "Bearer " + GT})


def fields(d):
    out = {}
    for k, v in d.items():
        out[k] = {"booleanValue": v} if isinstance(v, bool) else {"integerValue": str(v)} if isinstance(v, int) else {"stringValue": v}
    return {"fields": out}


def upload(tok, path, data, ctype, meta, origin=True):
    bd = "vpex" + secrets.token_hex(6)
    md = json.dumps({"name": path, "contentType": ctype, "cacheControl": "private, max-age=86400", "metadata": meta})
    body = ("--%s\r\nContent-Type: application/json; charset=utf-8\r\n\r\n%s\r\n--%s\r\nContent-Type: %s\r\n\r\n" % (bd, md, bd, ctype)).encode() + data + ("\r\n--%s--" % bd).encode()
    h = {"Authorization": "Firebase " + tok, "X-Goog-Upload-Protocol": "multipart", "Content-Type": "multipart/related; boundary=" + bd}
    if origin:
        h["Origin"] = ORIGIN
    return http("POST", V0 + "?name=" + urllib.parse.quote(path, safe=""), body, h)


def run(T):
    office, lead = T["office"], T["lead"]
    email, pw = "ci@" + office + ".vpex.app", secrets.token_urlsafe(18)
    path = "offices/%s/leadFiles/%s/f1" % (office, lead)
    made = T["made"]
    if True:
        s, b, _ = admin("POST", "%s/projects/%s/accounts" % (IDT, PROJECT), {"email": email, "password": pw})
        uid = T["uid"] = (js(b) or {}).get("localId")
        if not uid:
            check("make a test login", False, "HTTP %s %s" % (s, b[:200])); return
        now = int(time.time() * 1000)
        s1, _, _ = admin("PATCH", FS + "/offices/" + office, fields({"name": "CI check (removed after the test)", "industry": "insurance", "plan": "comp", "locked": False, "ownerUid": uid, "createdAt": now}))
        made.append("offices/" + office)
        s2, _, _ = admin("PATCH", FS + "/offices/%s/members/%s" % (office, uid), fields({"username": "ci", "name": "CI check", "role": "rep", "active": True, "lastSeen": now}))
        made.append("offices/%s/members/%s" % (office, uid))
        check("make a throwaway office and login", s1 == 200 and s2 == 200, (s1, s2))
        s, b, _ = http("POST", IDT + "/accounts:signInWithPassword?key=" + KEY, {"email": email, "password": pw, "returnSecureToken": True}, {"Referer": ORIGIN + "/"})
        tok = (js(b) or {}).get("idToken")
        check("sign in like the app", bool(tok), "HTTP %s" % s)
        if not tok:
            return

        # the browser asks first before sending a file with a login token
        s, _, h = http("OPTIONS", V0 + "?name=" + urllib.parse.quote(path, safe=""), None,
                       {"Origin": ORIGIN, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type,x-goog-upload-protocol"})
        allow = h.get("access-control-allow-origin", "")
        check("the file store accepts uploads from vpexdialer.com", s in (200, 204) and allow in ("*", ORIGIN), (s, allow, h.get("access-control-allow-headers", "")))

        data = b"\xff\xd8\xff\xe0" + secrets.token_bytes(4000) + b"\xff\xd9"
        s, b, h = upload(tok, path, data, "image/jpeg", {"uid": uid, "lead": lead})
        r = js(b) or {}
        check("upload a photo the way the app does", s == 200 and r.get("name") == path and r.get("downloadTokens"), "HTTP %s %s" % (s, b[:200]))
        check("the upload answer is readable by the app (cross-site)", h.get("access-control-allow-origin", "") in ("*", ORIGIN), h.get("access-control-allow-origin"))
        s, b, _ = upload(tok, path + "_t", data[:900] + b"\xff\xd9", "image/jpeg", {"uid": uid, "lead": lead})
        check("upload its small preview", s == 200, s)

        s, b, h = http("GET", V0 + "/" + urllib.parse.quote(path, safe=""), None, {"Authorization": "Firebase " + tok, "Origin": ORIGIN})
        dl = str((js(b) or {}).get("downloadTokens", "")).split(",")[0]
        check("read its details with the login", s == 200 and dl, "HTTP %s" % s)
        s, b, _ = http("GET", V0 + "/" + urllib.parse.quote(path, safe="") + "?alt=media&token=" + urllib.parse.quote(dl))
        check("its private link opens the same photo", s == 200 and b == data, "HTTP %s, %d bytes" % (s, len(b or b"")))

        s, _, _ = upload(tok, "offices/%s/leadFiles/%s/f2" % (office, lead), data, "image/jpeg", {"uid": "someone-else", "lead": lead})
        check("refused: a file labelled as someone else's", s == 403, s)
        s, _, _ = upload(tok, "offices/%s/leadFiles/%s/f3" % (office, lead), b"<html></html>", "text/html", {"uid": uid, "lead": lead})
        check("refused: a web page", s == 403, s)
        s, _, _ = upload(tok, "offices/%s/leadFiles/%s/f4" % (office, lead), data, "image/jpeg", {"uid": uid, "lead": "another-lead"})
        check("refused: a label that doesn't match the lead", s == 403, s)
        s, _, _ = http("GET", V0 + "/" + urllib.parse.quote(path, safe=""))
        check("refused: signed out", s == 403, s)
        s, _, _ = http("GET", V0 + "/" + urllib.parse.quote("offices/ci-files-zzzzzz/leadFiles/x/y", safe=""), None, {"Authorization": "Firebase " + tok})
        check("refused: another office's files", s == 403, s)

        admin("PATCH", FS + "/offices/%s/members/%s?updateMask.fieldPaths=active" % (office, uid), fields({"active": False}))
        time.sleep(2)
        s, _, _ = http("GET", V0 + "/" + urllib.parse.quote(path, safe=""), None, {"Authorization": "Firebase " + tok})
        check("refused: a login that was turned off", s == 403, s)
        admin("PATCH", FS + "/offices/%s/members/%s?updateMask.fieldPaths=active" % (office, uid), fields({"active": True}))
        time.sleep(2)

        for p in (path, path + "_t"):
            s, _, _ = http("DELETE", V0 + "/" + urllib.parse.quote(p, safe=""), None, {"Authorization": "Firebase " + tok, "Origin": ORIGIN})
            check("delete " + ("the photo" if p == path else "its preview") + " with the login", s in (200, 204), s)
        s, _, _ = http("GET", V0 + "/" + urllib.parse.quote(path, safe=""), None, {"Authorization": "Firebase " + tok})
        check("gone after delete", s == 404, s)


def main():
    T = {"office": "ci-files-" + secrets.token_hex(3), "lead": "ciL1", "uid": None, "made": []}
    office, lead = T["office"], T["lead"]
    try:
        run(T)
    except Exception as e:
        check("the check ran to the end", False, type(e).__name__ + ": " + str(e)[:200])
    finally:
        # remove everything this made, whatever happened above
        made, uid = T["made"], T["uid"]
        for n in ("f1", "f1_t", "f2", "f3", "f4"):
            admin("DELETE", "https://storage.googleapis.com/storage/v1/b/%s/o/%s" % (BUCKET, urllib.parse.quote("offices/%s/leadFiles/%s/%s" % (office, lead, n), safe="")))
        for d in reversed(made):
            admin("DELETE", FS + "/" + d)
        if uid:
            s, _, _ = admin("POST", "%s/projects/%s/accounts:delete" % (IDT, PROJECT), {"localId": uid})
            check("clean up the test office and login", s == 200, s)
    bad = [r for r in results if not r[1]]
    msg = "%d of %d checks passed" % (len(results) - len(bad), len(results))
    print("\nlead files live: " + msg)
    if os.environ.get("GITHUB_ACTIONS"):
        enc = lambda t: t.replace("%", "%25").replace("\r", "").replace("\n", "%0A")
        print("::notice title=Lead files, live::" + enc(msg))
        for n, _, i in bad[:8]:
            print("::error title=Lead files, live::" + enc(n + ": " + i))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main() or 0)
