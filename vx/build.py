#!/usr/bin/env python3
"""Builds the VPEX Experience layer into index.html.

  vx/core.css   the system (light, material, motion), with @MO(name) / @DET(name) macros
  vx/themes.py  one identity recipe per public theme
  vx/vx.js      the interaction engine (runs inside the app's main script)

Run `python3 vx/build.py` after editing any of them. `--check` exits 1 if index.html is stale.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from themes import R  # noqa: E402
import art  # noqa: E402
import urllib.parse  # noqa: E402

INDEX = os.path.join(ROOT, 'index.html')
html = open(INDEX, encoding='utf-8').read()
line = re.search(r'^\s*var THEMES = (\[.*\]);\s*$', html, re.M)
THEMES = json.loads(line.group(1)); IDS = [t['id'] for t in THEMES]; BY = {t['id']: t for t in THEMES}
missing = [i for i in IDS if i not in R]; extra = [i for i in R if i not in BY]
if missing or extra: sys.exit('vx/themes.py out of step with THEMES. missing: %s extra: %s' % (missing, extra))

def rgba(h, a):
    h = h.lstrip('#'); return 'rgba(%d,%d,%d,%s)' % (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), ('%.3f' % a).rstrip('0').rstrip('.'))
def rgb(h):
    h = h.lstrip('#'); return '%d,%d,%d' % (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))

def screen(bg, c):
    b = [int(bg.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4)] if len(bg.lstrip('#')) == 6 else [0, 0, 0]
    x = [int(c.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return '#' + ''.join('%02X' % round(255 * (1 - (1 - p) * (1 - q))) for p, q in zip(b, x))
def T(p): return 'color-mix(in srgb, var(--text) %s%%, transparent)' % p
def A(p): return 'color-mix(in srgb, var(--accent) %s%%, transparent)' % p
def svg(s): return 'url("data:image/svg+xml,' + s.replace('<', '%3C').replace('>', '%3E').replace('#', '%23').replace('"', "'") + '")'
NOISE = lambda freq, rgbv, k, off: svg('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="%s" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 %s 0 0 0 0 %s 0 0 0 0 %s %s 0 0 0 %s"/></filter><rect width="100%%" height="100%%" filter="url(#n)"/></svg>' % ((freq,) + tuple(rgbv) + (k, off)))
GRAIN_LIGHT = NOISE('.85', (1, 1, 1), 2.2, -.9)    # bright specks for dark themes
GRAIN_DARK = NOISE('.85', (0, 0, 0), 2.2, -.9)     # dark specks for light themes
STUCCO = lambda dark: NOISE('.11', (1, 1, 1) if dark else (.25, .2, .12), .9, -.38)

LOW = 'linear-gradient(to top, #000 0%, rgba(0,0,0,.55) 45%, transparent 80%)'
EDGE = 'radial-gradient(120% 90% at 50% 35%, transparent 38%, #000 88%)'
def TEX(name, t, dark):
    dots = [d for d in (t.get('dots') or [])][:4] or [t['accent']]
    if name == 'linen': return ('repeating-linear-gradient(0deg, %s 0 1px, transparent 1px 4px), repeating-linear-gradient(90deg, %s 0 1px, transparent 1px 4px)' % (T(4), T(3)), 'auto', 'none')
    if name == 'brushed': return ('repeating-linear-gradient(90deg, %s 0 1px, transparent 1px 3px, %s 3px 4px, transparent 4px 7px)' % (T(3), T(2)), 'auto', EDGE)
    if name == 'guilloche': return ('repeating-radial-gradient(circle at 50%% 115%%, transparent 0 11px, %s 11px 12px), repeating-radial-gradient(circle at 50%% -15%%, transparent 0 11px, %s 11px 12px)' % (A(9), A(6)), 'auto', LOW)
    if name == 'topo': return ('repeating-radial-gradient(ellipse 150%% 95%% at 18%% 112%%, transparent 0 21px, %s 21px 22.5px), repeating-radial-gradient(ellipse 120%% 80%% at 92%% -8%%, transparent 0 29px, %s 29px 30.5px)' % (T(6), T(4)), 'auto', EDGE)
    if name == 'waves': return ('repeating-radial-gradient(ellipse 220%% 60%% at 50%% 130%%, transparent 0 18px, %s 18px 19px)' % A(10), 'auto', LOW)
    if name == 'stars': return ('radial-gradient(1.2px 1.2px at 22px 34px, %s, transparent), radial-gradient(1px 1px at 140px 88px, %s, transparent), radial-gradient(1.5px 1.5px at 210px 190px, %s, transparent), radial-gradient(1px 1px at 80px 230px, %s, transparent), radial-gradient(1.3px 1.3px at 260px 40px, %s, transparent)' % (T(70), T(55), T(80), T(45), T(60)), '300px 280px', EDGE)
    if name == 'sparkle': return ('radial-gradient(1.6px 1.6px at 30px 40px, %s, transparent), radial-gradient(1.2px 1.2px at 150px 120px, %s, transparent), radial-gradient(2px 2px at 220px 30px, %s, transparent), radial-gradient(1px 1px at 90px 200px, %s, transparent)' % (A(85), T(60), A(70), T(50)), '260px 240px', EDGE)
    if name == 'confetti':
        c = (dots * 3)[:5]
        return (', '.join('radial-gradient(%spx %spx at %spx %spx, %s, transparent 70%%)' % (s, s, x, y, rgba(col, .5 if dark else .38)) for (s, x, y), col in zip([(3, 30, 40), (2.5, 150, 110), (3.5, 230, 30), (2.5, 90, 210), (3, 200, 190)], c)), '270px 250px', EDGE)
    if name == 'bokeh': return ('radial-gradient(38px 38px at 60px 80px, %s, transparent 70%%), radial-gradient(26px 26px at 300px 220px, %s, transparent 70%%), radial-gradient(48px 48px at 470px 60px, %s, transparent 70%%), radial-gradient(22px 22px at 180px 420px, %s, transparent 70%%)' % (A(14), A(10), A(9), A(12)), '560px 520px', LOW)
    if name == 'carbon': return ('radial-gradient(%s 22%%, transparent 24%%) 0 0 / 6px 6px, radial-gradient(%s 22%%, transparent 24%%) 3px 3px / 6px 6px' % (T(6), T(4)), 'auto', EDGE)
    if name == 'stucco': return (STUCCO(dark), '420px 420px', 'none')
    raise SystemExit('unknown texture ' + name)

def recipe_css(tid):
    t = BY[tid]; k = R[tid]; dark = t['mode'] == 'dark'; L = k['L']
    amb = k.get('amb', 1 if L else 0)
    v = {}
    for i in range(3):
        # Dark themes: the light's color is pre-screened over the theme's background, so plain alpha
        # compositing looks like light falling on the surface (no blend mode, the cheapest path on phones).
        v['--vx-l%d' % (i + 1)] = rgba(screen(t['bg'], L[i][0]) if dark else L[i][0], min(.85, L[i][1] * (2.9 if dark else 1.6))) if i < len(L) else 'transparent'
    if k.get('P'):
        for i, p in enumerate(k['P']): v['--vx-p%d' % (i + 1)] = p
    if amb != 1: v['--vx-amb'] = str(amb)
    if 'g' in k: v['--vx-grain'] = str(k['g'])
    if 'vig' in k: v['--vx-vig'] = str(k['vig'])
    if not dark: v['--vx-vig-c'] = rgb(t['text'])
    if not amb: v['--vx-bounce'] = 'transparent'
    if k.get('tx'):
        img, size, mask = TEX(k['tx'], t, dark)
        v['--vx-tex'] = img; v['--vx-tex-size'] = size; v['--vx-tex-mask'] = mask; v['--vx-tex-op'] = str(k.get('txo', .6))
    else:
        v['--vx-tex'] = 'none'
    if k.get('det') == 'foil':
        f = k.get('f') or (t['accent'], L[1][0] if len(L) > 1 else t['accent'])
        v['--vx-f1'] = f[0]; v['--vx-f2'] = f[1]
    return ' '.join('%s: %s;' % kv for kv in v.items()) + (' ' + art_css(tid) if art_css(tid) else '')

def preview_css(tid):
    t = BY[tid]; L = R[tid]['L']
    if not L: return ''
    a = rgba(L[0][0], min(.8, L[0][1] * 2.4)); b2 = rgba(L[1][0], min(.8, L[1][1] * 2.4)) if len(L) > 1 else 'transparent'
    return '.theme-card[data-theme-choice="%s"] .tc-prev { --tcl: radial-gradient(70%% 90%% at 0%% 100%%, %s, transparent 70%%), radial-gradient(60%% 80%% at 100%% 30%%, %s, transparent 70%%);%s }' % (tid, a, b2, ' --tcb: screen;' if t['mode'] == 'dark' else '')

# Kits (round two): which family shapes each theme's Call button and rows. 'none' = bespoke or deliberately plain.
KIT = {}
for _t in ['wallstreet', 'ivory', 'royal', 'oldmoney', 'oxblood', 'nantucket', 'gilded', 'blackcard', 'privatejet', 'monaco', 'bullion', 'chairman', 'kingpin', 'velvet', 'midnight', 'rosegold', 'victorian', 'luxurytype']: KIT[_t] = 'ledger'
for _t in ['oceandrive', 'neonnoir', 'synthwave', 'afterparty', 'highroller']: KIT[_t] = 'neon'
for _t in ['terminal', 'tickertape', 'cybergrid', 'chrome', 'missioncontrol', 'cybercore', 'cyberpunk']: KIT[_t] = 'hud'
for _t in ['forest', 'sunset', 'ocean', 'aurora', 'deepsea', 'sakura', 'desertdusk', 'rainforest', 'sand', 'wabisabi', 'ethereal', 'bohemian']: KIT[_t] = 'botanic'
for _t in ['flow', 'flowlight', 'daylight', 'slate', 'emerald', 'arctic', 'graphite', 'glassmorphism', 'bentogrid', 'y2k', 'claymorphism', 'scrapbook', 'maximalism', 'neumorphism', 'surrealism']: KIT[_t] = 'studio'
for _t in ['swiss', 'editorial']: KIT[_t] = 'plain'
for _t in ['contrast', 'minimalism', 'neobrutalism', 'sketch', 'pixelart', 'arcade', 'bossfight', 'starfighter', 'loadout', 'pocketlcd', 'cozyvillage']: KIT[_t] = 'none'
for _t in IDS:
    if _t not in KIT: KIT[_t] = {'holiday': 'festive', 'sports': 'arena'}.get(BY[_t]['cat']) or sys.exit('no kit for ' + _t)

def art_css(tid):
    t = BY[tid]; dark = t['mode'] == 'dark'
    color = t['accent']; a = .3 if dark else .24
    body = art.ART.get(tid)
    if not body: return ''
    if KIT[tid] == 'neon':
        inner = body()
        s = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><g fill="none" stroke="%s" stroke-linecap="round" stroke-linejoin="round">'
             '<g stroke-opacity=".12" stroke-width="7">%s</g><g stroke-opacity=".55" stroke-width="1.4">%s</g></g></svg>') % (color, inner, inner)
    else:
        s = art.svg_for(tid, color, a)
    s = s.replace('"', "'").replace('%', '%25').replace('#', '%23').replace('<', '%3C').replace('>', '%3E')
    return '--vx-art: url("data:image/svg+xml,%s");' % s

def sel(tid):
    return ':root[data-theme="%s"]' % tid

out = ['/* VX:CSS:BEGIN (generated by vx/build.py from vx/core.css + vx/themes.py; edit those, then rebuild) */']
core = open(os.path.join(HERE, 'core.css'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'kits.css'), encoding='utf-8').read()
groups = {}
for tid in IDS:
    k = R[tid]; groups.setdefault(('mo', k.get('mo', 'glide')), []).append(tid)
    if k.get('det'): groups.setdefault(('det', k['det']), []).append(tid)
def grp(kind, name):
    ids = groups.get((kind, name), [])
    parts = ['[data-theme="%s"]' % i for i in ids]
    if (kind == 'mo' and name == R['flow'].get('mo', 'glide')) or (kind == 'det' and name == R['flow'].get('det')): parts.append(':not([data-theme])')
    if kind == 'mo' and name == 'silk': parts.append('[data-theme^="sig-"]')
    return ':root:is(%s)' % ', '.join(parts) if parts else ':root[data-vx-none]'
def kitsel(name, where):
    # Kits key off data-vx-kit, which vx.js mirrors from data-theme the moment it changes (one short selector per rule).
    sel_ = ':root[data-vx-kit]:not([data-vx-kit="none"])' if name == 'rails' else ':root[data-vx-kit="%s"]' % name
    return ':where(%s)' % sel_ if where else sel_
core = re.sub(r'@KITW\(([a-z]+)\)', lambda m: kitsel(m.group(1), True), core)
core = re.sub(r'@KIT\(([a-z]+)\)', lambda m: kitsel(m.group(1), False), core)
core = re.sub(r'@MO\(([a-z]+)\)', lambda m: grp('mo', m.group(1)), core)
core = re.sub(r'@DET\(([a-z]+)\)', lambda m: grp('det', m.group(1)), core)
out.append(core)
out.append(':root { --vx-gl: %s; --vx-gd: %s; }' % (GRAIN_LIGHT, GRAIN_DARK))
DARK = [i for i in IDS if BY[i]['mode'] == 'dark']; LIGHT = [i for i in IDS if BY[i]['mode'] != 'dark']
out.append(':root:not([data-theme]), :root:is(%s) { --vx-grain: .05; --vx-grain-img: var(--vx-gl); --vx-vig: .34; --vx-vig-c: 0,0,0; --vx-spec: rgba(255,255,255,.07); --vx-bounce: color-mix(in srgb, var(--accent) 11%%, transparent); }' % ', '.join('[data-theme="%s"]' % i for i in DARK))
out.append(':root:is(%s) { --vx-grain: .035; --vx-grain-img: var(--vx-gd); --vx-vig: .07; --vx-spec: rgba(255,255,255,.6); --vx-bounce: color-mix(in srgb, var(--accent) 5%%, transparent); }' % ', '.join('[data-theme="%s"]' % i for i in LIGHT))
out.append('@media (prefers-color-scheme: light) { :root:not([data-theme]) { --vx-grain: .035; --vx-grain-img: var(--vx-gd); --vx-vig: .07; --vx-spec: rgba(255,255,255,.6); --vx-bounce: color-mix(in srgb, var(--accent) 5%%, transparent); } }')
out.append('.tc-prev::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: var(--tcl, none); mix-blend-mode: var(--tcb, normal); }')
out.extend(p for p in (preview_css(i) for i in IDS) if p)
out.append(':root:not([data-theme]), %s { %s }' % (sel('flow'), recipe_css('flow')))
out.append('@media (prefers-color-scheme: light) { :root:not([data-theme]) { %s } }' % recipe_css('flowlight'))
for tid in IDS:
    if tid == 'flow': continue
    out.append('%s { %s }' % (sel(tid), recipe_css(tid)))
out.append('/* VX:CSS:END */')
CSS = '\n'.join(out)

KITMAP = 'var VX_KIT = %s;\n' % json.dumps({i: KIT[i] for i in IDS}, separators=(',', ':'))
JS = '/* VX:JS:BEGIN (generated by vx/build.py from vx/vx.js) */\n' + KITMAP + open(os.path.join(HERE, 'vx.js'), encoding='utf-8').read().strip() + '\n/* VX:JS:END */'
HTML = '<!-- VX:HTML --><div id="vxAtmo" aria-hidden="true"><b></b></div><div id="vxVig" aria-hidden="true"></div><div id="vxGrain" aria-hidden="true"></div><div id="vxTouch" aria-hidden="true"></div><!-- /VX:HTML -->'

new = html
if '/* VX:CSS:BEGIN' in new:
    new = re.sub(r'/\* VX:CSS:BEGIN.*?/\* VX:CSS:END \*/', lambda m: CSS, new, flags=re.S)
else:
    anchor = '\n</style>'
    i = new.index('.shell { position: relative; z-index: 1; }'); j = new.index(anchor, i)
    new = new[:j] + '\n' + CSS + new[j:]
if '/* VX:JS:BEGIN' in new:
    new = re.sub(r'/\* VX:JS:BEGIN.*?/\* VX:JS:END \*/', lambda m: JS, new, flags=re.S)
else:
    a = '  window.__applyThemeFont = applyThemeFont;\n'; i = new.index(a) + len(a)
    new = new[:i] + JS + '\n' + new[i:]
if '<!-- VX:HTML -->' in new:
    new = re.sub(r'<!-- VX:HTML -->.*?<!-- /VX:HTML -->', lambda m: HTML, new, flags=re.S)
else:
    new = new.replace('<div id="fxLayer" aria-hidden="true"></div>', HTML + '\n<div id="fxLayer" aria-hidden="true"></div>', 1)

if '--check' in sys.argv:
    if new != html: sys.exit('index.html is out of date: run python3 vx/build.py')
    print('vx up to date'); sys.exit(0)
if new != html:
    open(INDEX, 'w', encoding='utf-8').write(new)
print('vx built: %d themes, %d bytes CSS, %d bytes JS' % (len(IDS), len(CSS), len(JS)))
