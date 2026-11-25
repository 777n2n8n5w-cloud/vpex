# Read-only check of saved calls in the live database (run by .github/workflows/vpex-diag-calls.yml).
# Prints no names, phone numbers or office names: people and offices appear as short codes, so the public log stays clean.
import json, os, urllib.request, hashlib, datetime, time
TOK = os.environ["TOK"]; P = "projects/dovetail-f863c/databases/(default)/documents"; API = "https://firestore.googleapis.com/v1/"
def call(url, body=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body else None, headers={"Authorization": "Bearer " + TOK, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req))
def code(s, n=4): return hashlib.sha1(s.encode()).hexdigest()[:n]
def val(v):
    if v is None: return None
    for k in ("stringValue", "booleanValue"): 
        if k in v: return v[k]
    if "integerValue" in v: return int(v["integerValue"])
    if "doubleValue" in v: return v["doubleValue"]
    if "timestampValue" in v: return v["timestampValue"]
    if "mapValue" in v: return {k: val(x) for k, x in v["mapValue"].get("fields", {}).items()}
    return None
def lst(parent, coll, mask):
    out, tok = [], ""
    while True:
        u = API + P + ("/" + parent if parent else "") + "/" + coll + "?pageSize=300" + "".join("&mask.fieldPaths=" + m for m in mask) + ("&pageToken=" + tok if tok else "")
        r = call(u); out += r.get("documents", []); tok = r.get("nextPageToken")
        if not tok: return out
def days_docs(parent, since):
    body = {"structuredQuery": {"from": [{"collectionId": "callDays"}], "where": {"fieldFilter": {"field": {"fieldPath": "__name__"}, "op": "GREATER_THAN_OR_EQUAL",
            "value": {"referenceValue": P + ("/" + parent if parent else "") + "/callDays/" + since}}}}}
    r = call(API + P + ("/" + parent if parent else "") + ":runQuery", body)
    return [x["document"] for x in r if "document" in x]
now = time.time() * 1000
et = lambda ms: (datetime.datetime.utcfromtimestamp(ms / 1000) - datetime.timedelta(hours=5)).strftime("%m-%d %I:%M %p ET")
since = (datetime.datetime.utcnow() - datetime.timedelta(days=2)).strftime("%Y-%m-%d")
scopes = [("", "top")] + [("offices/" + d["name"].split("/")[-1], "office " + code(d["name"].split("/")[-1], 6)) for d in lst("", "offices", ["plan"])]
for parent, label in scopes:
    try:
        mem = {d["name"].split("/")[-1]: {k: val(v) for k, v in d.get("fields", {}).items()} for d in lst(parent, "members", ["role", "active", "lastSeen"])}
    except Exception as e:
        print(label, "members: error", str(e)[:80]); continue
    if not mem: continue
    try: docs = days_docs(parent, since)
    except Exception as e: print(label, "callDays: error", str(e)[:120]); continue
    per = {}; acts = []
    for d in docs:
        did = d["name"].split("/")[-1]; f = {k: val(v) for k, v in d.get("fields", {}).items()}
        if did.startswith("act_"): acts.append((did, sorted(code(u) for u in (f.get("live") or {}).keys()))); continue
        if did.startswith("n_"): continue
        parts = did.split("_")
        if len(parts) < 3: continue
        day, uid = parts[0], "_".join(parts[1:-1])
        calls = f.get("calls") or {}
        p = per.setdefault(uid, {}); x = p.setdefault(day, [0, 0, 0])
        x[0] += len(calls)
        for c in calls.values():
            ts = c.get("timestamp") if isinstance(c, dict) else None
            try: t = datetime.datetime.strptime(ts[:19], "%Y-%m-%dT%H:%M:%S").timestamp() * 1000
            except Exception: t = 0
            x[1] = max(x[1], t)
            by = (c.get("by") or {}).get("uid") if isinstance(c, dict) else None
            if by and by != uid: x[2] += 1
    print("==", label, "| people:", len(mem))
    for uid, m in sorted(mem.items(), key=lambda kv: -(kv[1].get("lastSeen") or 0) if isinstance(kv[1].get("lastSeen"), (int, float)) else 0):
        ls = m.get("lastSeen"); ls = ls if isinstance(ls, (int, float)) else 0
        d = per.get(uid, {})
        print("  person", code(uid), "|", m.get("role"), "| active", m.get("active"), "| last seen", (et(ls) if ls else "never"),
              "| saved calls by day:", ", ".join("%s: %d (last %s)%s" % (k, v[0], et(v[1]) if v[1] else "?", " [%d by someone else]" % v[2] if v[2] else "") for k, v in sorted(d.items())) or "none")
    for uid in per:
        if uid not in mem: print("  calls saved under a code with no person:", code(uid), {k: v[0] for k, v in per[uid].items()})
    for did, live in acts: print("  presence", did, "on a call:", live)

# ---- the top-level team: what William-type reps' phones did today (codes only) ----
today_utc = datetime.datetime.utcnow().strftime("%Y-%m-%d")
since2 = (datetime.datetime.utcnow() - datetime.timedelta(days=2)).strftime("%Y-%m-%d")
for d in days_docs("", "act_" + since2):
    did = d["name"].split("/")[-1]
    if not did.startswith("act_"): continue
    f = {k: val(v) for k, v in d.get("fields", {}).items()}
    for u, x in (f.get("live") or {}).items():
        x = x or {}
        print("  live", did, code(u), "| state", x.get("s"), "| since", et(x.get("at")) if isinstance(x.get("at"), (int, float)) else x.get("at"))
    for u, x in (f.get("notes") or {}).items(): print("  notes", did, code(u), "|", x if isinstance(x, (int, float)) else type(x).__name__)
chunks = lst("", "leadChunks", [])
by = {}
for d in chunks:
    ck = d["name"].split("/")[-1]; f = {k: val(v) for k, v in d.get("fields", {}).items()}
    for lid, L in (f.get("leads") or {}).items():
        if not isinstance(L, dict): continue
        ca = str(L.get("calledAt") or "")
        own = (L.get("owner") or {}).get("uid") if isinstance(L.get("owner"), dict) else None
        cl = (L.get("claim") or {}).get("uid") if isinstance(L.get("claim"), dict) else None
        for who, tag in ((own, "owner"), (cl, "claim")):
            if not who: continue
            s = by.setdefault(code(who), {"owner": 0, "claim": 0, "called_2d": 0, "outcomes": {}, "chunks": set(), "last": ""})
            s[tag] += 1; s["chunks"].add(ck[:2])
            if tag == "owner" and ca >= since2:
                s["called_2d"] += 1; s["outcomes"][L.get("outcome")] = s["outcomes"].get(L.get("outcome"), 0) + 1; s["last"] = max(s["last"], ca)
for k, s in by.items(): print("  leads", k, "| owns", s["owner"], "| holding", s["claim"], "| called in 2 days", s["called_2d"], s["outcomes"], "| last", s["last"][:16], "| records", sorted(s["chunks"]))
r = lst("", "leadChunks", ["prefs"])
for d in r:
    ck = d["name"].split("/")[-1]
    if ck.startswith("r_"): print("  own record", "r_" + code(ck[2:]), "| has prefs", bool(d.get("fields")))

# ---- what the hourly save check sees right now (top-level team) ----
now_ms = time.time() * 1000
have = set()
for d in days_docs("", (datetime.datetime.utcnow() - datetime.timedelta(days=2)).strftime("%Y-%m-%d")):
    did = d["name"].split("/")[-1]
    if not did[:1].isdigit(): continue
    for c in ((val(d.get("fields", {}).get("calls")) or {}).values()):
        if isinstance(c, dict) and c.get("leadId") and c.get("timestamp"): have.add(c["leadId"] + "|" + c["timestamp"])
miss = {}
for d in lst("", "leadChunks", []):
    f = {k: val(v) for k, v in d.get("fields", {}).items()}
    for lid, L in (f.get("leads") or {}).items():
        if not isinstance(L, dict) or not isinstance(L.get("calledAt"), str): continue
        try: t = datetime.datetime.strptime(L["calledAt"][:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=datetime.timezone.utc).timestamp() * 1000
        except Exception: continue
        if not (now_ms - 24 * 3600000 <= t <= now_ms - 20 * 60000): continue
        if (lid + "|" + L["calledAt"]) in have: continue
        o = (L.get("owner") or {}).get("uid") if isinstance(L.get("owner"), dict) else ""
        miss[code(o or "?")] = miss.get(code(o or "?"), 0) + 1
print("  SAVECHECK missing in last 24h by person:", miss or "none")
