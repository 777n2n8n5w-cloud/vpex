#!/usr/bin/env python3
"""Tests storage-rules.txt (who can open, add and delete lead files) with Google's own rules engine,
before anything is published. Nothing changes in the project: the rules are only evaluated.

Needs a Google access token for the VPEX project, from `gcloud auth print-access-token` (the
GitHub workflows sign in with the FIREBASE_SERVICE_ACCOUNT key first). Exits 1 if any case fails.
"""
import json, os, subprocess, sys, urllib.request, urllib.error

PROJECT = os.environ.get("PROJECT", "dovetail-f863c")
BUCKET = os.environ.get("BUCKET", PROJECT + ".firebasestorage.app")
HERE = os.path.dirname(os.path.abspath(__file__))
RULES = os.path.join(HERE, "..", "storage-rules.txt")
NOW = "2026-10-20T15:00:00Z"
NOW_MS = 1792508400000
DB = "/databases/(default)/documents/"

# The database the rules look things up in: office "acme" on a trial, office "shut" locked.
MEMBERS = {
    "offices/acme/members/rep1": {"active": True, "role": "rep"},
    "offices/acme/members/rep2": {"active": True, "role": "rep"},
    "offices/acme/members/adm1": {"active": True, "role": "admin"},
    "offices/acme/members/gone": {"active": False, "role": "rep"},
    "offices/shut/members/rep9": {"active": True, "role": "rep"},
    "members/team1": {"active": True, "role": "rep"},
    "members/tadm": {"active": True, "role": "admin"},
    "members/tgone": {"active": False, "role": "rep"},
}
OFFICES = {
    "offices/acme": {"plan": "trial", "trialEnds": NOW_MS + 5 * 86400000, "locked": False},
    "offices/shut": {"plan": "trial", "trialEnds": NOW_MS + 5 * 86400000, "locked": True},
    "offices/late": {"plan": "paid", "paidThrough": NOW_MS - 20 * 86400000},
}


def mocks():
    out = []
    docs = dict(MEMBERS); docs.update(OFFICES)
    for path, data in docs.items():
        full = DB + path
        out.append({"function": "firestore.exists", "args": [{"exactValue": full}], "result": {"value": True}})
        out.append({"function": "firestore.get", "args": [{"exactValue": full}], "result": {"value": {"data": data}}})
    # anything else does not exist
    out.append({"function": "firestore.exists", "args": [{"anyValue": {}}], "result": {"value": False}})
    out.append({"function": "firestore.get", "args": [{"anyValue": {}}], "result": {"undefined": {}}})
    return out


def who(uid, email):
    return {"uid": uid, "token": {"email": email, "email_verified": False, "firebase": {"sign_in_provider": "password"}}}


REP1 = who("rep1", "jo@acme.vpex.app")
REP2 = who("rep2", "sam@acme.vpex.app")
ADM1 = who("adm1", "boss@acme.vpex.app")
GONE = who("gone", "old@acme.vpex.app")
OTHER = who("rep1", "jo@other.vpex.app")          # right person id, wrong office login
REP9 = who("rep9", "kim@shut.vpex.app")
OWNER = who("own1", "vincent@dovetail-f863c.firebaseapp.com")
TEAM1 = who("team1", "pat@dovetail-f863c.firebaseapp.com")
TADM = who("tadm", "lee@dovetail-f863c.firebaseapp.com")
TGONE = who("tgone", "ex@dovetail-f863c.firebaseapp.com")
STRANGER = who("nobody", "x@dovetail-f863c.firebaseapp.com")


def obj(path, uid="rep1", lead="L1", size=250000, ctype="image/jpeg"):
    return {"name": path, "bucket": BUCKET, "size": size, "contentType": ctype, "metadata": {"uid": uid, "lead": lead}}


def case(name, expect, method, path, auth=None, new=None, old=None):
    req = {"method": method, "path": "/b/" + BUCKET + "/o/" + path, "time": NOW}
    if auth is not None:
        req["auth"] = auth
    if new is not None:
        req["resource"] = new
    c = {"request": req, "expectation": expect, "pathEncoding": "PLAIN", "functionMocks": mocks()}
    if old is not None:
        c["resource"] = old
    return name, c


A = "offices/acme/leadFiles/L1/f1"
T = "team/leadFiles/L1/f1"
CASES = [
    case("rep opens a file in their office", "ALLOW", "get", A, REP1, old=obj(A, "rep2")),
    case("signed out can't open it", "DENY", "get", A, None, old=obj(A)),
    case("a login from another office can't open it", "DENY", "get", A, OTHER, old=obj(A)),
    case("a turned-off login can't open it", "DENY", "get", A, GONE, old=obj(A)),
    case("VPEX's owner can open it", "ALLOW", "get", A, OWNER, old=obj(A)),
    case("rep adds a photo", "ALLOW", "create", A, REP1, new=obj(A)),
    case("rep adds its small preview", "ALLOW", "create", A + "_t", REP1, new=obj(A + "_t", size=24000)),
    case("rep adds a PDF", "ALLOW", "create", A, REP1, new=obj(A, ctype="application/pdf")),
    case("rep adds a Word file", "ALLOW", "create", A, REP1, new=obj(A, ctype="application/vnd.openxmlformats-officedocument.wordprocessingml.document")),
    case("rep adds an Excel file", "ALLOW", "create", A, REP1, new=obj(A, ctype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")),
    case("rep adds a CSV", "ALLOW", "create", A, REP1, new=obj(A, ctype="text/csv")),
    case("20 MB is the most", "ALLOW", "create", A, REP1, new=obj(A, size=20 * 1024 * 1024)),
    case("over 20 MB is refused", "DENY", "create", A, REP1, new=obj(A, size=20 * 1024 * 1024 + 1)),
    case("an empty file is refused", "DENY", "create", A, REP1, new=obj(A, size=0)),
    case("a program is refused", "DENY", "create", A, REP1, new=obj(A, ctype="application/x-msdownload")),
    case("a web page is refused", "DENY", "create", A, REP1, new=obj(A, ctype="text/html")),
    case("can't sign a file as someone else", "DENY", "create", A, REP1, new=obj(A, uid="rep2")),
    case("the label must match the lead", "DENY", "create", A, REP1, new=obj(A, lead="L2")),
    case("a turned-off login can't add", "DENY", "create", A, GONE, new=obj(A, uid="gone")),
    case("another office's login can't add", "DENY", "create", A, OTHER, new=obj(A)),
    case("a locked office can't add", "DENY", "create", "offices/shut/leadFiles/L1/f1", REP9, new=obj("offices/shut/leadFiles/L1/f1", uid="rep9")),
    case("a locked office can still open", "ALLOW", "get", "offices/shut/leadFiles/L1/f1", REP9, old=obj("offices/shut/leadFiles/L1/f1", uid="rep9")),
    case("rep deletes their own file", "ALLOW", "delete", A, REP1, old=obj(A, "rep1")),
    case("rep can't delete a teammate's file", "DENY", "delete", A, REP1, old=obj(A, "rep2")),
    case("admin deletes any file", "ALLOW", "delete", A, ADM1, old=obj(A, "rep2")),
    case("a turned-off login can't delete", "DENY", "delete", A, GONE, old=obj(A, "gone")),
    case("nobody changes a file in place", "DENY", "update", A, ADM1, new=obj(A, "adm1"), old=obj(A, "adm1")),
    case("nobody lists a lead's folder", "DENY", "list", "offices/acme/leadFiles/L1", ADM1),
    case("nothing outside lead files", "DENY", "create", "offices/acme/other/f1", ADM1, new=obj("offices/acme/other/f1", "adm1")),
    case("nothing at the top", "DENY", "create", "f1", OWNER, new=obj("f1", "own1")),
    case("original team: a member opens", "ALLOW", "get", T, TEAM1, old=obj(T, "tadm")),
    case("original team: a member adds", "ALLOW", "create", T, TEAM1, new=obj(T, "team1")),
    case("original team: not a member", "DENY", "get", T, STRANGER, old=obj(T)),
    case("original team: a turned-off member", "DENY", "get", T, TGONE, old=obj(T)),
    case("original team: a member can't delete another's", "DENY", "delete", T, TEAM1, old=obj(T, "tadm")),
    case("original team: admin deletes", "ALLOW", "delete", T, TADM, old=obj(T, "team1")),
    case("original team: an office login isn't a member", "DENY", "create", T, REP1, new=obj(T, "rep1")),
]


def token():
    t = os.environ.get("ACCESS_TOKEN", "").strip()
    if t:
        return t
    return subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()


def main():
    src = open(RULES).read()
    body = {"source": {"files": [{"name": "storage-rules.txt", "content": src}]},
            "testSuite": {"testCases": [c for _, c in CASES]}}
    req = urllib.request.Request("https://firebaserules.googleapis.com/v1/projects/%s:test" % PROJECT,
                                 data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": "Bearer " + token(), "Content-Type": "application/json"})
    try:
        res = json.load(urllib.request.urlopen(req, timeout=60))
    except urllib.error.HTTPError as e:
        print("::error::The rules engine refused the test: HTTP %s %s" % (e.code, e.read().decode()[:1500]))
        return 1
    for i in res.get("issues", []):
        p = i.get("sourcePosition", {})
        print("%s line %s:%s %s" % (i.get("severity"), p.get("line"), p.get("column"), i.get("description")))
    if any(i.get("severity") == "ERROR" for i in res.get("issues", [])):
        print("::error::storage-rules.txt has errors")
        return 1
    results = res.get("testResults", [])
    if len(results) != len(CASES):
        print("::error title=File rules::The rules engine answered %d of %d cases." % (len(results), len(CASES)))
        return 1
    bad, notes = 0, []
    for (name, c), r in zip(CASES, results):
        ok = r.get("state") == "SUCCESS"
        print(("ok    " if ok else "FAIL  ") + c["expectation"].lower().ljust(5) + " " + name)
        if not ok:
            bad += 1
            for m in r.get("debugMessages", [])[:4]:
                print("        " + m)
            calls = [f.get("function") + "(" + json.dumps(f.get("args"))[:160] + ")" for f in r.get("functionCalls", [])[:4]]
            if calls:
                print("        calls: " + "; ".join(calls))
            if r.get("errorPosition"):
                print("        at line %s" % r["errorPosition"].get("line"))
            notes.append("%s should %s. %s %s" % (name, c["expectation"].lower(), " ".join(r.get("debugMessages", [])[:2])[:300],
                         ("calls: " + "; ".join(calls))[:500] if calls else ""))
    total = len(CASES)
    print("\nstorage rules: %d of %d cases as expected" % (total - bad, total))
    if os.environ.get("GITHUB_ACTIONS"):
        enc = lambda t: t.replace("%", "%25").replace("\r", "").replace("\n", "%0A")
        print("::notice title=File rules::" + enc("%d of %d cases as expected" % (total - bad, total)))
        for n in notes[:8]:
            print("::error title=File rules case::" + enc(n))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
