#!/usr/bin/env python3
"""Tests firestore-rules.txt (who can read and write the database) with Google's own rules engine,
before anything is published. Nothing changes in the project: the rules are only evaluated.

Covers "Message your floor" (pushFloor, pushFloorDone, floor), plus rules that were already live as
known-good controls (notification tokens, test alerts, lead records, members).

Needs a Google access token for the VPEX project, from `gcloud auth print-access-token` (the
GitHub workflows sign in with the FIREBASE_SERVICE_ACCOUNT key first). Exits 1 if any case fails.
"""
import json, os, subprocess, sys, urllib.request, urllib.error

PROJECT = os.environ.get("PROJECT", "dovetail-f863c")
HERE = os.path.dirname(os.path.abspath(__file__))
RULES = os.path.join(HERE, "..", "firestore-rules.txt")
NOW = "2026-11-05T15:00:00Z"
NOW_MS = 1793372400000
DB = "/databases/(default)/documents/"

# The database the rules look things up in: office "acme" on a trial, office "shut" locked.
DOCS = {
    "offices/acme/members/rep1": {"active": True, "role": "rep"},
    "offices/acme/members/mgr1": {"active": True, "role": "manager"},
    "offices/acme/members/adm1": {"active": True, "role": "admin"},
    "offices/acme/members/gone": {"active": False, "role": "rep"},
    "members/team1": {"active": True, "role": "rep"},
    "members/tadm": {"active": True, "role": "admin"},
    "members/tgone": {"active": False, "role": "rep"},
    "offices/acme": {"plan": "trial", "trialEnds": NOW_MS + 5 * 86400000, "locked": False, "ownerUid": "adm1", "invite": "abc123xyz"},
    "offices/shut": {"plan": "trial", "trialEnds": NOW_MS + 5 * 86400000, "locked": True, "ownerUid": "x"},
}


def mocks():
    out = []
    for path, data in DOCS.items():
        full = DB + path
        out.append({"function": "exists", "args": [{"exactValue": full}], "result": {"value": True}})
        out.append({"function": "get", "args": [{"exactValue": full}], "result": {"value": {"data": data}}})
    out.append({"function": "exists", "args": [{"anyValue": {}}], "result": {"value": False}})
    out.append({"function": "get", "args": [{"anyValue": {}}], "result": {"undefined": {}}})
    return out


def who(uid, email):
    return {"uid": uid, "token": {"email": email, "email_verified": False, "firebase": {"sign_in_provider": "password"}}}


REP1 = who("rep1", "jo@acme.vpex.app")
MGR1 = who("mgr1", "lee@acme.vpex.app")
ADM1 = who("adm1", "boss@acme.vpex.app")
GONE = who("gone", "old@acme.vpex.app")
OTHER = who("rep1", "jo@other.vpex.app")          # right person id, wrong office login
TEAM1 = who("team1", "pat@dovetail-f863c.firebaseapp.com")
TGONE = who("tgone", "ex@dovetail-f863c.firebaseapp.com")
STRANGER = who("nobody", "x@dovetail-f863c.firebaseapp.com")


def case(name, expect, method, path, auth=None, new=None, old=None):
    req = {"method": method, "path": DB + path, "time": NOW}
    if auth is not None:
        req["auth"] = auth
    if new is not None:
        req["resource"] = {"data": new}
    c = {"request": req, "expectation": expect, "functionMocks": mocks()}
    if old is not None:
        c["resource"] = {"data": old}
    return name, c


def floor_req(uid="adm1", **kw):
    d = {"uid": uid, "office": "acme", "at": NOW_MS, "body": "Back on the phones!", "to": []}
    d.update(kw)
    return d


FL = "offices/acme/floor/adm1_abc"
MSG = {"by": "adm1", "byName": "Dana Cruz", "body": "Back on the phones!", "to": [], "at": NOW_MS}
CASES = [
    # ---- known-good controls (rules already live) ----
    case("control: a phone saves its own notification token", "ALLOW", "create", "pushTokens/t1", REP1,
         new={"uid": "rep1", "office": "acme", "token": "tok", "ua": "iPhone", "tz": "America/New_York", "at": NOW_MS}),
    case("control: Send a test request", "ALLOW", "create", "pushTests/rep1_x", REP1, new={"uid": "rep1", "office": "acme", "at": NOW_MS}),
    case("control: nobody reads tokens", "DENY", "get", "pushTokens/t1", ADM1, old={"uid": "adm1", "token": "tok"}),
    case("control: a rep reads their office's leads", "ALLOW", "get", "offices/acme/leadChunks/c001", REP1, old={"leads": {}}),
    case("control: another office can't", "DENY", "get", "offices/acme/leadChunks/c001", OTHER, old={"leads": {}}),
    # ---- Message your floor: the request ----
    case("floor: an admin asks to send", "ALLOW", "create", "pushFloor/adm1_abc", ADM1, new=floor_req()),
    case("floor: a picked list of reps", "ALLOW", "create", "pushFloor/adm1_abd", ADM1, new=floor_req(to=["rep1", "mgr1"])),
    case("floor: the original team (no office)", "ALLOW", "create", "pushFloor/tadm_abc", who("tadm", "lee@dovetail-f863c.firebaseapp.com"), new=floor_req("tadm", office="")),
    case("floor: 180 characters is fine", "ALLOW", "create", "pushFloor/adm1_abe", ADM1, new=floor_req(body="x" * 180)),
    case("floor: 181 characters is refused", "DENY", "create", "pushFloor/adm1_abf", ADM1, new=floor_req(body="x" * 181)),
    case("floor: an empty message is refused", "DENY", "create", "pushFloor/adm1_abg", ADM1, new=floor_req(body="")),
    case("floor: signed out can't ask", "DENY", "create", "pushFloor/adm1_abh", None, new=floor_req()),
    case("floor: can't ask as someone else", "DENY", "create", "pushFloor/rep1_abi", REP1, new=floor_req("adm1")),
    case("floor: no extra fields (like a title or a role)", "DENY", "create", "pushFloor/adm1_abj", ADM1, new=dict(floor_req(), title="Hi")),
    case("floor: the list must be a list", "DENY", "create", "pushFloor/adm1_abk", ADM1, new=floor_req(to="rep1")),
    case("floor: at most 200 people", "DENY", "create", "pushFloor/adm1_abl", ADM1, new=floor_req(to=["r%d" % i for i in range(201)])),
    case("floor: the time must be a number", "DENY", "create", "pushFloor/adm1_abm", ADM1, new=floor_req(at="now")),
    case("floor: nobody reads requests", "DENY", "get", "pushFloor/adm1_abc", ADM1, old=floor_req()),
    case("floor: nobody changes a request", "DENY", "update", "pushFloor/adm1_abc", ADM1, new=floor_req(body="Changed"), old=floor_req()),
    # ---- the sender's receipt ----
    case("receipt: the sender reads their own", "ALLOW", "get", "pushFloorDone/adm1_abc", ADM1, old={"uid": "adm1", "status": "sent"}),
    case("receipt: before the server writes it (listening for it)", "ALLOW", "get", "pushFloorDone/adm1_abz", ADM1),
    case("receipt: nobody else reads it", "DENY", "get", "pushFloorDone/adm1_abc", REP1, old={"uid": "adm1", "status": "sent"}),
    case("receipt: an id that only starts like yours doesn't count", "DENY", "get", "pushFloorDone/adm1x_abc", ADM1, old={"uid": "adm1x", "status": "sent"}),
    case("receipt: a shorter id inside yours doesn't count", "DENY", "get", "pushFloorDone/adm1_abc", who("adm", "z@acme.vpex.app"), old={"uid": "adm1", "status": "sent"}),
    case("receipt: nobody writes one but the server", "DENY", "create", "pushFloorDone/adm1_abc", ADM1, new={"uid": "adm1", "status": "sent"}),
    # ---- the kept messages reps see in the app ----
    case("message: a rep in the office reads it", "ALLOW", "get", FL, REP1, old=MSG),
    case("message: a manager reads it", "ALLOW", "get", FL, MGR1, old=MSG),
    case("message: a turned-off login can't", "DENY", "get", FL, GONE, old=MSG),
    case("message: another office can't", "DENY", "get", FL, OTHER, old=MSG),
    case("message: even an admin can't write one (only the server)", "DENY", "create", FL, ADM1, new=MSG),
    case("message: nobody deletes one", "DENY", "delete", FL, ADM1, old=MSG),
    case("message: original team member reads", "ALLOW", "get", "floor/tadm_abc", TEAM1, old=MSG),
    case("message: original team, turned off", "DENY", "get", "floor/tadm_abc", TGONE, old=MSG),
    case("message: original team, not a member", "DENY", "get", "floor/tadm_abc", STRANGER, old=MSG),
    case("message: an office login isn't on the original team", "DENY", "get", "floor/tadm_abc", REP1, old=MSG),
]


def token():
    t = os.environ.get("ACCESS_TOKEN", "").strip()
    if t:
        return t
    return subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()


def main():
    src = open(RULES).read()
    body = {"source": {"files": [{"name": "firestore-rules.txt", "content": src}]},
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
        print("::error::firestore-rules.txt has errors")
        return 1
    results = res.get("testResults", [])
    if len(results) != len(CASES):
        print("::error title=Database rules::The rules engine answered %d of %d cases." % (len(results), len(CASES)))
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
            notes.append("%s should %s. %s" % (name, c["expectation"].lower(), " ".join(r.get("debugMessages", [])[:2])[:300]))
    total = len(CASES)
    print("\ndatabase rules: %d of %d cases as expected" % (total - bad, total))
    if os.environ.get("GITHUB_ACTIONS"):
        enc = lambda t: t.replace("%", "%25").replace("\r", "").replace("\n", "%0A")
        print("::notice title=Database rules::" + enc("%d of %d cases as expected" % (total - bad, total)))
        for n in notes[:8]:
            print("::error title=Database rules case::" + enc(n))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
