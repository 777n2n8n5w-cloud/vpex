# Original soundtrack for each week-3 Reel, timed to its cuts: a soft four-on-the-floor beat, a light tick on every
# word, a whoosh into the footage and a riser into "HERE'S THE FIX". Everything is synthesized here (no samples, no
# licensed music), so the bot can post the Reels with sound. usage: audio3.py [NAME ...]
import sys, os, json, subprocess, importlib.util
import numpy as np
D = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("reel3", D + "/reel3.py"); reel3 = importlib.util.module_from_spec(spec); spec.loader.exec_module(reel3)
SR = 44100
rng = np.random.default_rng(7)

def env(n, a=0.002, d=0.1):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)
    return e
def kick(n=int(0.35 * SR)):
    t = np.arange(n) / SR
    f = 45 + 75 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env(n, 0.001, 0.12)
def hat(n=int(0.06 * SR)):
    x = rng.standard_normal(n); x = np.diff(np.concatenate([[0], x]))      # tilt the noise up
    return x * env(n, 0.0005, 0.012) * 0.5
def clap(n=int(0.2 * SR)):
    x = rng.standard_normal(n)
    k = np.ones(8) / 8; lo = np.convolve(x, k, "same"); bp = x - lo           # keep the mids
    t = np.arange(n) / SR
    return (bp * 0.8 + 0.3 * np.sin(2 * np.pi * 190 * t)) * env(n, 0.001, 0.05)
def tick(freq=1600, n=int(0.05 * SR)):
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * freq * t) * 0.6 + rng.standard_normal(n) * 0.15) * env(n, 0.0005, 0.012)
def thud(n=int(0.18 * SR)):
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * (70 + 40 * np.exp(-t / 0.02)) * t) * env(n, 0.001, 0.06)
def whoosh(n=int(0.45 * SR)):
    x = rng.standard_normal(n)
    out = np.zeros(n); y = 0.0
    for i in range(n):                                 # one-pole filter opening up over the swell
        a = 0.02 + 0.5 * (i / n) ** 2; y += a * (x[i] - y); out[i] = y
    e = (np.arange(n) / n) ** 2.2
    return out * e * 1.2
def riser(n):
    t = np.arange(n) / SR
    f = 220 * (2 ** (2 * t / (n / SR)))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    return (tone + whoosh(n) * 0.6) * (np.arange(n) / n) ** 1.6
def pad(n, notes, vol):
    t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) for f in notes) / len(notes)
    fade = np.minimum(1, np.minimum(t / 0.4, (n / SR - t) / 0.4))
    return x * vol * fade

def place(buf, snd, at, gain):
    i = int(at * SR)
    if i >= len(buf): return
    j = min(len(buf), i + len(snd))
    buf[i:j] += snd[: j - i] * gain

def make(name):
    tl = reel3.timeline(name)
    dur = tl["dur"]; n = int((dur + 0.6) * SR)
    drums = np.zeros(n); fx = np.zeros(n); music = np.zeros(n)
    bpm = 120.0; beat = 60 / bpm
    fix_t = None; media_t = None; end_t = None
    for s in tl["segs"]:
        if s["type"] == "words":
            for w in s["words"]:
                tt = s["t0"] + w["a"]
                place(fx, thud() if w["c"] == "r" else tick(1900 if w["c"] == "g" else 1500), tt, 0.22 if w["c"] != "r" else 0.35)
                if w["text"] in ("THE FIX.",): fix_t = tt
        elif s["type"] == "clock":
            for x in s["times"]: place(fx, tick(2400), s["t0"] + x["a"], 0.28)
        elif s["type"] in ("taps", "strike"):
            per = s["per"]; k = len(s.get("steps") or s.get("items"))
            for i in range(k): place(fx, tick(1300 + 60 * i), s["t0"] + i * per, 0.22)
        elif s["type"] == "spam":
            for b in (0.0, 0.5, 1.0): place(fx, tick(880, int(0.25 * SR)) * 0.9, s["t0"] + 0.3 + b, 0.18)   # a ring
            place(fx, thud(), s["t0"] + 1.55, 0.5)
        elif s["type"] in ("clip", "still") and media_t is None:
            media_t = s["t0"]
        elif s["type"] == "end":
            end_t = s["t0"]
    media_t = media_t or dur * 0.55; end_t = end_t or dur - 2.8
    # beat: light before the fix, full groove over the footage, one hit and a tail on the end card
    t = 0.0; i = 0
    while t < end_t:
        full = t >= media_t
        place(drums, kick(), t, 0.55 if full else 0.32)
        place(drums, hat(), t + beat / 2, 0.22 if full else 0.12)
        if full and i % 2 == 1: place(drums, clap(), t, 0.22)
        t += beat; i += 1
    place(drums, kick(), end_t, 0.7); place(fx, thud(), end_t, 0.45)
    # into the fix: a riser, then a whoosh as the footage comes in
    if fix_t: rl = min(1.2, fix_t); place(fx, riser(int(rl * SR)), fix_t - rl + 0.1, 0.35)
    place(fx, whoosh(), media_t - 0.4, 0.45)
    # a low pad: tense (A minor) for the problem, open (C major) for the fix
    a = int(media_t * SR)
    music[:a] += pad(a, [110.0, 130.81, 164.81], 0.10)
    b = int(end_t * SR)
    music[a:b] += pad(b - a, [130.81, 164.81, 196.0], 0.12)
    music[b:] += pad(n - b, [130.81, 164.81, 196.0, 261.63], 0.10) * np.exp(-np.arange(n - b) / SR / 1.2)
    # simple sidechain so the beat breathes
    duck = np.ones(n); t = media_t
    while t < end_t:
        k = int(t * SR); L = int(0.25 * SR); duck[k:k + L] = np.minimum(duck[k:k + L], 0.55 + 0.45 * (np.arange(min(L, n - k)) / L)); t += beat
    mix = drums + fx + music * duck
    # gentle limiter and level
    peak = np.max(np.abs(mix)) or 1; mix = mix / peak * 0.89
    mix = np.tanh(mix * 1.15) / np.tanh(1.15)
    st = np.stack([mix, mix], 1)
    st[:, 0] = np.convolve(st[:, 0], [0.92, 0.08], "same"); st[:, 1] = np.convolve(st[:, 1], [0.08, 0.92], "same")   # a little width
    pcm = (np.clip(st, -1, 1) * 32767).astype(np.int16)
    wav = D + "/out/audio/%s.wav" % name; os.makedirs(D + "/out/audio", exist_ok=True)
    import wave
    with wave.open(wav, "wb") as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    src = D + "/out/video/Reel-%s.mp4" % name
    out = D + "/out/video/Reel-%s-sound.mp4" % name
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-af", "loudnorm=I=-15:TP=-1.5:LRA=11,alimiter=limit=0.8:level=disabled", "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
                    "-t", "%.3f" % dur, "-movflags", "+faststart", out], check=True)
    rms = float(np.sqrt(np.mean(mix ** 2)))
    print(name, "%.1fs" % dur, "rms %.3f" % rms, "->", os.path.basename(out))

if __name__ == "__main__":
    for nm in sys.argv[1:] or list(reel3.REELS): make(nm)
