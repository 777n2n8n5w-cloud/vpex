# Card artwork for round two: one line-art motif per theme, drawn behind the lead card's top-right corner.
# Every motif is a 200x200 SVG drawn in strokes; the build tints it with the theme's accent at low strength.
import math

def _f(x): return ('%.1f' % x).rstrip('0').rstrip('.')
def circle(cx, cy, r, **a): return '<circle cx="%s" cy="%s" r="%s"%s/>' % (_f(cx), _f(cy), _f(r), _at(a))
def line(x1, y1, x2, y2, **a): return '<line x1="%s" y1="%s" x2="%s" y2="%s"%s/>' % (_f(x1), _f(y1), _f(x2), _f(y2), _at(a))
def path(d, **a): return '<path d="%s"%s/>' % (d, _at(a))
def poly(pts, close=True, **a): return '<%s points="%s"%s/>' % ('polygon' if close else 'polyline', ' '.join('%s,%s' % (_f(x), _f(y)) for x, y in pts), _at(a))
def rect(x, y, w, h, rx=0, **a): return '<rect x="%s" y="%s" width="%s" height="%s" rx="%s"%s/>' % (_f(x), _f(y), _f(w), _f(h), _f(rx), _at(a))
def ell(cx, cy, rx, ry, rot=0, **a): return '<ellipse cx="%s" cy="%s" rx="%s" ry="%s"%s%s/>' % (_f(cx), _f(cy), _f(rx), _f(ry), (' transform="rotate(%s %s %s)"' % (_f(rot), _f(cx), _f(cy))) if rot else '', _at(a))
def _at(a): return ''.join(' %s="%s"' % (k.replace('_', '-'), v) for k, v in a.items())
def pol(cx, cy, r, ang): a = math.radians(ang - 90); return cx + r * math.cos(a), cy + r * math.sin(a)
def star_pts(cx, cy, R, r, n=5, rot=0): return [pol(cx, cy, R if i % 2 == 0 else r, rot + i * 180 / n) for i in range(2 * n)]
def fill(s): return s.replace('<', '<', 1)

# ---- motifs ----
def rosette(): return ''.join(ell(100, 100, 92, 30, i * 7.5, stroke_width=.7) for i in range(24)) + circle(100, 100, 30) + circle(100, 100, 96)
def guilloche_rings(): return ''.join(circle(100 + 10 * math.cos(i), 100 + 10 * math.sin(i), 60 + i * 5, stroke_width=.6) for i in range(8))
def reticle():
    s = circle(100, 100, 92) + circle(100, 100, 64) + circle(100, 100, 36, stroke_dasharray='4 5') + circle(100, 100, 4)
    s += line(100, 0, 100, 76) + line(100, 124, 100, 200) + line(0, 100, 76, 100) + line(124, 100, 200, 100)
    s += ''.join(line(*pol(100, 100, 92, a), *pol(100, 100, 84 if a % 30 else 76, a)) for a in range(0, 360, 10))
    return s + path('M100 100 L%s %s A64 64 0 0 1 %s %s Z' % (_f(pol(100, 100, 64, 20)[0]), _f(pol(100, 100, 64, 20)[1]), _f(pol(100, 100, 64, 60)[0]), _f(pol(100, 100, 64, 60)[1])), stroke_width=.8)
def rays(n=36, r0=34, r1=98): return circle(100, 100, r0 - 6) + ''.join(line(*pol(100, 100, r0, a), *pol(100, 100, r1 if i % 2 == 0 else r1 - 18, a)) for i, a in enumerate(range(0, 360, 360 // n)))
def milled(): return ''.join(circle(100, 100, r, stroke_width=.7) for r in range(14, 100, 7)) + circle(100, 100, 6, stroke_width=2)
def seal():
    # An engraved seal, the way a share certificate or a banknote is lathe-cut: a guilloche band between two milled rings.
    s = ''.join(ell(100, 100, 88, 34, i * 6, stroke_width=.55) for i in range(30))
    s += circle(100, 100, 94, stroke_width=.8) + circle(100, 100, 97.5, stroke_width=.5, stroke_dasharray='1.2 2.2')
    return s + circle(100, 100, 30, stroke_width=.8) + circle(100, 100, 24, stroke_width=.5)
def flowlines(): return ''.join(path('M-10 %d C 50 %d, 120 %d, 210 %d' % (40 + i * 16, 10 + i * 16, 110 + i * 12, 60 + i * 15), stroke_width=1.1) for i in range(8))
def topo():
    s = ''
    for i in range(7):
        r = 14 + i * 13
        s += path('M %s Z' % ' L '.join('%s %s' % (_f(100 + (r + 6 * math.sin(a * 3 + i)) * math.cos(a)), _f(100 + (r * .8 + 5 * math.cos(a * 2 + i)) * math.sin(a))) for a in [k * math.pi / 24 for k in range(48)]), stroke_width=.9)
    return s
def gem():
    top = [(40, 70), (70, 40), (130, 40), (160, 70)]; s = poly(top + [(100, 170)])
    s += line(40, 70, 160, 70) + line(70, 40, 85, 70) + line(130, 40, 115, 70) + line(85, 70, 100, 40) + line(115, 70, 100, 40)
    return s + line(85, 70, 100, 170) + line(115, 70, 100, 170) + line(40, 70, 100, 170) + line(160, 70, 100, 170)
def snowflake():
    s = ''
    for a in range(0, 360, 60):
        s += line(100, 100, *pol(100, 100, 92, a))
        for d, l in ((34, 18), (58, 16), (78, 10)):
            x, y = pol(100, 100, d, a); s += line(x, y, *pol(x, y, l, a - 40)) + line(x, y, *pol(x, y, l, a + 40))
    return s + poly([pol(100, 100, 16, a) for a in range(0, 360, 60)])
def tree():
    s = poly([(100, 22), (60, 82), (140, 82)]) + poly([(100, 52), (46, 126), (154, 126)]) + poly([(100, 90), (34, 172), (166, 172)]) + rect(90, 172, 20, 20)
    return s + poly(star_pts(100, 18, 11, 4.5)) + ''.join(circle(x, y, 3.5) for x, y in ((80, 110), (120, 140), (70, 155), (128, 100), (100, 132)))
def firework():
    s = ''
    for cx, cy, R in ((92, 92, 70), (160, 50, 34), (150, 150, 28)):
        for a in range(0, 360, 20):
            x1, y1 = pol(cx, cy, R * .3, a); x2, y2 = pol(cx, cy, R, a); s += line(x1, y1, x2, y2, stroke_dasharray='3 4') + circle(*pol(cx, cy, R + 4, a), 1.6)
    return s
def heart(): return path('M100 168 C 30 118, 22 70, 52 48 C 76 30, 96 44, 100 62 C 104 44, 124 30, 148 48 C 178 70, 170 118, 100 168 Z', stroke_width=2) + path('M100 150 C 48 112, 42 76, 62 62 C 80 50, 94 60, 100 76', stroke_width=.8)
def stars_stripes(): return ''.join(poly(star_pts(x, y, 13, 5.5)) for x, y in ((50, 50), (95, 40), (140, 52), (70, 88), (118, 86))) + ''.join(path('M10 %d C 60 %d, 140 %d, 200 %d' % (120 + i * 16, 108 + i * 16, 136 + i * 16, 124 + i * 16), stroke_width=1.4 if i % 2 == 0 else .7) for i in range(5))
def pumpkin(): return ell(100, 118, 70, 58) + ell(100, 118, 42, 58) + ell(100, 118, 14, 58) + path('M100 60 C 98 44, 104 34, 116 28', stroke_width=3) + path('M104 46 C 124 38, 136 48, 140 58', stroke_width=1)
def leaf(): return path('M100 186 C 100 140, 100 100, 100 30 M100 30 C 150 60, 170 120, 100 170 C 30 120, 50 60, 100 30 Z', stroke_width=1.6) + ''.join(line(100, 60 + i * 20, 100 + (34 - i * 3) * (1 if i % 2 else -1), 46 + i * 20) for i in range(6))
def shamrock():
    s = ''
    for a in (0, 120, 240):
        x, y = pol(100, 96, 34, a)
        s += '<g transform="rotate(%d %s %s)">' % (a, _f(x), _f(y)) + path('M%s %s C %s %s, %s %s, %s %s C %s %s, %s %s, %s %s Z' % (_f(x), _f(y + 28), _f(x - 44), _f(y - 4), _f(x - 18), _f(y - 40), _f(x), _f(y - 16), _f(x + 18), _f(y - 40), _f(x + 44), _f(y - 4), _f(x), _f(y + 28)), stroke_width=1.6) + '</g>'
    return s + path('M100 120 C 104 150, 116 170, 132 186', stroke_width=2.4)
def lantern(): return rect(58, 50, 84, 104, 36) + ''.join(ell(100, 102, rx, 52) for rx in (14, 28)) + rect(78, 38, 44, 12, 3) + rect(78, 154, 44, 12, 3) + line(100, 10, 100, 38) + ''.join(line(92 + i * 4, 166, 90 + i * 5, 196) for i in range(5))
def mask(): return path('M20 92 C 40 64, 80 66, 100 84 C 120 66, 160 64, 180 92 C 170 126, 124 134, 100 112 C 76 134, 30 126, 20 92 Z', stroke_width=1.8) + ell(64, 96, 18, 10) + ell(136, 96, 18, 10) + path('M180 92 C 196 70, 190 40, 176 24 M170 88 C 190 60, 176 36, 162 20', stroke_width=1.2)
def egg(): return path('M100 22 C 150 22, 172 110, 160 146 C 150 176, 126 188, 100 188 C 74 188, 50 176, 40 146 C 28 110, 50 22, 100 22 Z', stroke_width=1.6) + poly([(36, 112), (52, 98), (68, 112), (84, 98), (100, 112), (116, 98), (132, 112), (148, 98), (164, 112)], close=False) + ''.join(circle(x, 140, 4) for x in (64, 100, 136))
def candles(n):
    s = line(16, 170, 184, 170, stroke_width=2) + line(100, 170, 100, 192, stroke_width=2) + line(70, 192, 130, 192, stroke_width=2)
    step = 168 / (n - 1)
    for i in range(n):
        x = 16 + i * step; top = 70 if (n == 9 and i == 4) else 92
        s += rect(x - 4.5, top, 9, 170 - top, 2) + path('M%s %s C %s %s, %s %s, %s %s C %s %s, %s %s, %s %s Z' % (_f(x), _f(top - 6), _f(x - 7), _f(top - 14), _f(x - 2), _f(top - 24), _f(x), _f(top - 30), _f(x + 2), _f(top - 24), _f(x + 7), _f(top - 14), _f(x), _f(top - 6)))
    return s
def crescent(): return path('M128 30 A 74 74 0 1 0 128 170 A 58 58 0 1 1 128 30 Z', stroke_width=1.8) + poly(star_pts(148, 82, 22, 9)) + ''.join(circle(x, y, 1.6) for x, y in ((40, 40), (170, 150), (60, 180), (180, 30)))
def flower(n=8, r=34): return ''.join(ell(*pol(100, 100, r, a), 16, r * .8, a) for a in range(0, 360, 360 // n)) + circle(100, 100, 16) + circle(100, 100, 9)
def poppy(): return ''.join(circle(*pol(100, 96, 30, a), 34) for a in (0, 90, 180, 270)) + circle(100, 96, 12) + ''.join(circle(*pol(100, 96, 20, a), 2) for a in range(0, 360, 45)) + path('M100 140 C 96 164, 104 180, 92 196', stroke_width=2)
def gear():
    pts = []
    for i in range(16):
        a0 = i * 22.5
        for a, r in ((a0 - 6, 78), (a0 - 3, 94), (a0 + 3, 94), (a0 + 6, 78)): pts.append(pol(100, 100, r, a))
    return poly(pts, stroke_width=1.6) + circle(100, 100, 34) + circle(100, 100, 12)
def apple(): return path('M100 58 C 70 40, 30 60, 36 110 C 42 160, 80 180, 100 166 C 120 180, 158 160, 164 110 C 170 60, 130 40, 100 58 Z', stroke_width=1.8) + path('M100 58 C 100 42, 108 30, 118 22') + path('M104 46 C 124 26, 150 30, 156 40 C 140 52, 118 52, 104 46 Z')
def diya(): return path('M30 130 C 50 170, 150 170, 170 130 Z', stroke_width=1.8) + path('M30 130 C 60 120, 140 120, 170 130') + path('M100 118 C 82 96, 92 70, 100 46 C 108 70, 118 96, 100 118 Z', stroke_width=1.6) + ''.join(line(*pol(100, 84, 46, a), *pol(100, 84, 60, a)) for a in range(-60, 61, 30))
def globe(): return circle(100, 100, 82) + ell(100, 100, 40, 82) + ell(100, 100, 14, 82) + line(18, 100, 182, 100) + ell(100, 100, 82, 30) + path('M60 40 C 80 60, 70 80, 90 90 C 110 100, 120 80, 140 70', stroke_width=2)
def football(): return path('M24 100 C 50 40, 150 40, 176 100 C 150 160, 50 160, 24 100 Z', stroke_width=1.8) + line(70, 100, 130, 100, stroke_width=2) + ''.join(line(x, 92, x, 108) for x in range(78, 128, 10)) + path('M44 76 C 56 88, 56 112, 44 124') + path('M156 76 C 144 88, 144 112, 156 124')
def basketball(): return circle(100, 100, 84) + line(16, 100, 184, 100) + line(100, 16, 100, 184) + path('M40 40 C 70 70, 70 130, 40 160') + path('M160 40 C 130 70, 130 130, 160 160')
def baseball(): return circle(100, 100, 84) + path('M52 30 C 82 70, 82 130, 52 170', stroke_dasharray='2 5', stroke_width=3) + path('M148 30 C 118 70, 118 130, 148 170', stroke_dasharray='2 5', stroke_width=3) + path('M52 30 C 82 70, 82 130, 52 170') + path('M148 30 C 118 70, 118 130, 148 170')
def rink(): return circle(100, 100, 70) + circle(100, 100, 6) + line(0, 100, 200, 100, stroke_width=2) + line(30, 0, 30, 200, stroke_dasharray='6 6') + ''.join(line(100 + dx * 70, 100 + dy * 24, 100 + dx * 70 + dx * 14, 100 + dy * 24) for dx in (-1, 1) for dy in (-1, 1))
def soccer():
    s = circle(100, 100, 84) + poly([pol(100, 100, 26, a) for a in range(0, 360, 72)], stroke_width=2)
    for a in range(0, 360, 72):
        x, y = pol(100, 100, 26, a); x2, y2 = pol(100, 100, 52, a); s += line(x, y, x2, y2) + poly([pol(x2, y2, 18, a + b) for b in range(36, 396, 72)])
    return s
def golf(): return line(100, 24, 100, 160, stroke_width=2) + poly([(100, 24), (160, 44), (100, 64)]) + ell(100, 162, 40, 10) + ell(100, 162, 70, 22, stroke_dasharray='4 6')
def checkered():
    s = ''
    for r in range(5):
        for c in range(7):
            if (r + c) % 2 == 0:
                x, y = 24 + c * 22, 40 + r * 22 + 6 * math.sin(c * .9)
                s += rect(x, y, 22, 22)
    return s + line(20, 40, 20, 196, stroke_width=3)
def ropes(): return ''.join(path('M10 %d C 70 %d, 130 %d, 190 %d' % (60 + i * 34, 72 + i * 34, 72 + i * 34, 60 + i * 34), stroke_width=2.2) for i in range(3)) + rect(4, 40, 12, 150, 3) + rect(184, 40, 12, 150, 3)
def tennis(): return circle(100, 100, 84) + path('M30 52 C 80 70, 80 130, 30 148', stroke_width=2) + path('M170 52 C 120 70, 120 130, 170 148', stroke_width=2)
def lanes(): return ''.join(path('M%d 200 C %d 120, %d 60, %d -10' % (20 + i * 26, 40 + i * 26, 120 + i * 16, 200 + i * 8), stroke_width=1.3) for i in range(6))
def palm(): return path('M110 196 C 112 150, 104 110, 92 74', stroke_width=3) + ''.join(path('M92 74 C %s %s, %s %s, %s %s' % (_f(pol(92, 74, 40, a)[0]), _f(pol(92, 74, 40, a)[1] - 10), _f(pol(92, 74, 70, a + 10)[0]), _f(pol(92, 74, 70, a + 10)[1]), _f(pol(92, 74, 86, a + 22)[0]), _f(pol(92, 74, 86, a + 22)[1] + 16)), stroke_width=2) for a in (-110, -60, -20, 30, 80)) + circle(148, 40, 18)
def neon_sun(): return circle(100, 92, 70) + ''.join(line(100 - math.sqrt(max(0, 70 ** 2 - (y - 92) ** 2)), y, 100 + math.sqrt(max(0, 70 ** 2 - (y - 92) ** 2)), y, stroke_width=3) for y in (112, 126, 140, 152)) + ''.join(line(0, 170 + i * 8, 200, 170 + i * 8) for i in range(3))
def martini(): return poly([(40, 40), (160, 40), (100, 110)]) + line(100, 110, 100, 176, stroke_width=2) + ell(100, 180, 34, 6) + circle(122, 64, 9) + line(122, 64, 150, 20) + line(44, 52, 156, 52)
def dice(): return rect(24, 50, 88, 88, 16, transform='rotate(-12 68 94)') + rect(100, 70, 76, 76, 14, transform='rotate(14 138 108)') + ''.join(circle(x, y, 5) for x, y in ((50, 74), (68, 94), (86, 114), (124, 92), (152, 96), (124, 124), (150, 128)))
def skyline(): return crescent() if False else path('M138 24 A 40 40 0 1 0 138 104 A 30 30 0 1 1 138 24 Z', stroke_width=1.6) + poly([(0, 200), (0, 140), (24, 140), (24, 120), (44, 120), (44, 150), (62, 150), (62, 104), (84, 104), (84, 160), (104, 160), (104, 130), (124, 130), (124, 150), (146, 150), (146, 116), (170, 116), (170, 146), (200, 146), (200, 200)], close=False, stroke_width=1.6)
def aurora_art(): return ''.join(path('M-10 %d C 40 %d, 90 %d, 210 %d' % (40 + i * 14, 0 + i * 18, 90 + i * 8, 30 + i * 16), stroke_width=1.2) for i in range(5)) + poly([(0, 200), (40, 140), (66, 168), (104, 112), (140, 160), (166, 132), (200, 176)], close=False, stroke_width=1.8)
def jelly(): return path('M50 90 C 50 40, 150 40, 150 90 C 130 84, 70 84, 50 90 Z', stroke_width=1.8) + ''.join(path('M%d 90 C %d 120, %d 140, %d 190' % (x, x - 10, x + 10, x - 6), stroke_width=1.1) for x in range(62, 142, 14)) + ''.join(circle(x, y, r) for x, y, r in ((170, 40, 6), (180, 70, 3), (30, 150, 4)))
def blossom(): return path('M0 180 C 60 150, 110 120, 200 40', stroke_width=2.4) + path('M100 128 C 110 150, 130 160, 150 162', stroke_width=1.4) + ''.join(''.join(ell(*pol(x, y, 9, a), 5, 8, a) for a in range(0, 360, 72)) + circle(x, y, 2.4) for x, y in ((150, 70), (110, 104), (176, 52), (64, 148), (150, 160)))
def dunes(): return circle(140, 60, 28) + ''.join(path('M-10 %d C 50 %d, 110 %d, 210 %d' % (120 + i * 22, 90 + i * 22, 150 + i * 22, 110 + i * 22), stroke_width=1.4) for i in range(4))
def monstera(): return path('M100 190 C 100 150, 100 110, 100 40 M100 40 C 170 50, 190 140, 100 170 C 10 140, 30 50, 100 40 Z', stroke_width=1.8) + ''.join(line(100, 60 + i * 22, 100 + 70 * s_, 56 + i * 22 + 12) for i in range(5) for s_ in (-1, 1))
def pines(): return ''.join(poly([(x, 200 - h), (x - h * .32, 200), (x + h * .32, 200)]) + line(x, 200 - h * .7, x - h * .18, 200 - h * .4) + line(x, 200 - h * .7, x + h * .18, 200 - h * .4) for x, h in ((50, 150), (110, 190), (166, 130)))
def wave(): return path('M0 150 C 40 150, 50 90, 100 90 C 150 90, 160 140, 130 150 C 110 156, 104 128, 122 124', stroke_width=2) + ''.join(path('M0 %d C 50 %d, 150 %d, 200 %d' % (166 + i * 10, 156 + i * 10, 176 + i * 10, 166 + i * 10)) for i in range(3))
def orbs(): return ''.join(circle(x, y, r) + path('M%s %s A %s %s 0 0 1 %s %s' % (_f(x - r * .6), _f(y - r * .3), _f(r * .7), _f(r * .7), _f(x - r * .1), _f(y - r * .7)), stroke_width=2) for x, y, r in ((110, 86, 62), (44, 160, 26), (176, 160, 18)))
def bento(): return ''.join(rect(x, y, w, h, 12) for x, y, w, h in ((10, 10, 100, 70), (120, 10, 70, 120), (10, 90, 50, 100), (70, 90, 40, 40), (70, 140, 120, 50)))
def sparkle(): return ''.join(path('M%s %s Q %s %s %s %s Q %s %s %s %s Q %s %s %s %s Q %s %s %s %s Z' % (_f(x), _f(y - r), _f(x), _f(y), _f(x + r), _f(y), _f(x), _f(y), _f(x), _f(y + r), _f(x), _f(y), _f(x - r), _f(y), _f(x), _f(y), _f(x), _f(y - r)), stroke_width=1.6) for x, y, r in ((100, 90, 70), (170, 30, 22), (40, 170, 18)))
def scrap(): return rect(60, 20, 120, 34, 2, transform='rotate(-8 120 37)') + path('M40 70 L40 170 C 40 190, 70 190, 70 170 L70 90 C 70 80, 56 80, 56 90 L56 160', stroke_width=2.4)
def collage(): return circle(70, 70, 46) + poly([(120, 40), (190, 150), (60, 150)]) + path('M20 180 C 40 160, 60 200, 80 180 C 100 160, 120 200, 140 180 C 160 160, 180 200, 200 180', stroke_width=2.4)
def quote(): return path('M40 120 C 40 80, 60 54, 92 46 L96 60 C 76 68, 66 82, 66 100 L92 100 L92 150 L40 150 Z', stroke_width=1.8) + path('M110 120 C 110 80, 130 54, 162 46 L166 60 C 146 68, 136 82, 136 100 L162 100 L162 150 L110 150 Z', stroke_width=1.8)
def swiss(): return circle(126, 74, 50, stroke_width=3) + line(0, 150, 200, 150, stroke_width=6) + line(30, 0, 30, 200, stroke_width=1) + line(0, 30, 200, 30, stroke_width=1)
def mandala(): return flower(12, 40) + rays(48, 72, 98)
def soft_rings(): return ''.join(circle(100 + i * 4, 100 - i * 3, 20 + i * 14, stroke_width=.9) for i in range(6))
def blobs(): return path('M60 40 C 110 20, 170 60, 150 110 C 130 160, 60 170, 40 120 C 24 84, 30 52, 60 40 Z', stroke_width=2) + path('M150 140 C 176 136, 190 160, 176 180 C 160 198, 130 190, 132 166 C 134 150, 140 142, 150 140 Z', stroke_width=2)
def crown(): return poly([(30, 150), (24, 70), (64, 110), (100, 46), (136, 110), (176, 70), (170, 150)], stroke_width=1.8) + line(30, 164, 170, 164, stroke_width=2) + ''.join(circle(x, y, 6) for x, y in ((24, 64), (100, 40), (176, 64))) + ''.join(circle(x, 132, 4) for x in (60, 100, 140))
def bars(): return ''.join(poly([(x, y + 26), (x + 14, y), (x + 74, y), (x + 88, y + 26)]) + line(x + 14, y, x + 20, y + 26) for x, y in ((20, 150), (108, 150), (64, 120), (152, 120), (108, 90)))
def chip(): return rect(40, 50, 120, 96, 16, stroke_width=1.8) + line(40, 82, 78, 82) + line(40, 114, 78, 114) + line(122, 82, 160, 82) + line(122, 114, 160, 114) + rect(78, 66, 44, 64, 8) + line(100, 50, 100, 66) + line(100, 130, 100, 146)
def wing(): return path('M10 120 C 70 112, 120 96, 196 40 C 170 90, 140 120, 120 130 L 180 150 L 160 156 L 100 138 C 70 146, 40 140, 10 120 Z', stroke_width=1.8) + ''.join(line(30 + i * 22, 122 - i * 4, 34 + i * 22, 132 - i * 4) for i in range(5))
def helm(): return circle(100, 100, 56) + circle(100, 100, 20) + ''.join(line(*pol(100, 100, 20, a), *pol(100, 100, 92, a), stroke_width=2.4) + circle(*pol(100, 100, 92, a), 6) for a in range(0, 360, 45))
def anchor(): return circle(100, 36, 14) + line(100, 50, 100, 176, stroke_width=3) + line(66, 76, 134, 76, stroke_width=3) + path('M30 130 C 40 176, 80 184, 100 184 C 120 184, 160 176, 170 130', stroke_width=3) + poly([(30, 130), (22, 150), (44, 144)]) + poly([(170, 130), (178, 150), (156, 144)])
def candlesticks():
    s = ''
    for i, (o, c, h, l) in enumerate([(120, 100, 90, 130), (100, 110, 92, 120), (110, 80, 70, 116), (80, 90, 60, 100), (90, 60, 50, 98), (60, 40, 30, 70)]):
        x = 20 + i * 30; s += line(x + 8, h, x + 8, l) + rect(x, min(o, c), 16, abs(o - c) + 4, 1)
    return s + path('M10 150 C 60 140, 120 100, 196 40', stroke_dasharray='4 5')
def columns(): return poly([(20, 60), (100, 20), (180, 60)]) + line(16, 64, 184, 64, stroke_width=2) + ''.join(rect(x, 72, 18, 100) + line(x + 6, 76, x + 6, 168) + line(x + 12, 76, x + 12, 168) for x in (34, 78, 122, 166 - 18 + 4)) + line(16, 178, 184, 178, stroke_width=2)
def laurel(): return ''.join(ell(*pol(100, 110, 70, a), 7, 16, a + 40 * (1 if a < 0 else -1)) for a in list(range(-150, -30, 18)) + list(range(48, 168, 18))) + path('M42 160 C 20 120, 30 70, 66 40') + path('M158 160 C 180 120, 170 70, 134 40')
def crest(): return path('M100 18 L 168 40 L 160 120 C 150 160, 120 180, 100 190 C 80 180, 50 160, 40 120 L 32 40 Z', stroke_width=1.8) + path('M100 34 L 152 52 L 146 118 C 138 150, 116 166, 100 174 C 84 166, 62 150, 54 118 L 48 52 Z', stroke_width=.8) + line(100, 34, 100, 174) + line(48, 92, 152, 92)
def moonstars(): return path('M120 30 A 66 66 0 1 0 170 140 A 52 52 0 1 1 120 30 Z', stroke_width=1.6) + ''.join(poly(star_pts(x, y, r, r * .4)) for x, y, r in ((160, 50, 10), (40, 60, 6), (60, 170, 8), (176, 110, 5)))
def rose(): return path('M100 60 C 126 60, 132 90, 112 100 C 92 110, 76 92, 86 80 C 94 70, 110 76, 106 88', stroke_width=1.6) + path('M100 60 C 60 56, 50 110, 80 126 C 110 142, 148 120, 142 88 C 138 64, 118 56, 100 60', stroke_width=1.4) + path('M70 120 C 50 140, 60 170, 96 168 C 136 166, 156 136, 140 112', stroke_width=1.2) + path('M100 168 C 100 180, 98 190, 96 198', stroke_width=2)
def filigree(): return rosette()
def dove(): return path('M30 120 C 60 110, 90 112, 110 96 C 120 70, 150 56, 176 62 C 160 72, 152 84, 150 98 C 170 100, 186 110, 194 124 C 160 120, 140 130, 120 140 C 90 154, 56 148, 30 120 Z', stroke_width=1.8) + path('M110 96 C 90 70, 70 50, 40 40 C 60 70, 72 90, 90 108', stroke_width=1.4) + circle(162, 72, 2.5)
def tie(): return poly([(84, 30), (116, 30), (108, 52), (92, 52)]) + poly([(92, 52), (108, 52), (128, 150), (100, 186), (72, 150)]) + ''.join(line(80 + i * 6, 70 + i * 22, 120 - i * 2, 60 + i * 22) for i in range(4))
def juneteenth(): return poly(star_pts(100, 100, 30, 12), stroke_width=1.8) + poly(star_pts(100, 100, 66, 46, n=12), stroke_width=1.2) + path('M0 150 C 60 120, 140 120, 200 150', stroke_width=2)
def hammer(): return gear()
def kinara(): return candles(7)
def menorah(): return candles(9)
def champagne(): return firework()

ART = {
    # everyday
    'flow': seal, 'flowlight': seal, 'midnight': moonstars, 'daylight': rays, 'slate': topo, 'forest': pines,
    'sunset': dunes, 'emerald': gem, 'ocean': wave, 'rosegold': rosette, 'arctic': snowflake, 'graphite': milled, 'sand': dunes,
    # money
    'wallstreet': candlesticks, 'ivory': laurel, 'royal': crown, 'terminal': reticle, 'oldmoney': crest, 'oxblood': rosette,
    'tickertape': candlesticks, 'nantucket': anchor, 'gilded': rosette, 'blackcard': chip, 'privatejet': wing, 'monaco': helm,
    'bullion': bars, 'chairman': columns,
    # miami
    'oceandrive': palm, 'kingpin': crown, 'neonnoir': skyline, 'synthwave': neon_sun, 'highroller': dice, 'velvet': martini, 'afterparty': martini,
    # nature
    'aurora': aurora_art, 'deepsea': jelly, 'sakura': blossom, 'desertdusk': dunes, 'rainforest': monstera,
    # tech
    'cybergrid': reticle, 'chrome': milled, 'missioncontrol': reticle,
    # holidays
    'christmas': tree, 'winter': snowflake, 'newyears': champagne, 'valentine': heart, 'july4': stars_stripes, 'halloween': pumpkin,
    'harvest': leaf, 'stpatricks': shamrock, 'hd_mlk': dove, 'hd_lunar': lantern, 'hd_pres': stars_stripes, 'hd_mardi': mask,
    'hd_easter': egg, 'hd_passover': laurel, 'hd_eid': crescent, 'hd_cinco': flower, 'hd_mom': flower, 'hd_memorial': poppy,
    'hd_dad': tie, 'hd_june': juneteenth, 'hd_labor': hammer, 'hd_rosh': apple, 'hd_diwali': diya, 'hd_veterans': stars_stripes,
    'hd_hanukkah': menorah, 'hd_kwanzaa': kinara, 'hd_earth': globe,
    # sports
    'gameday': football, 'courtside': basketball, 'diamond': baseball, 'centerice': rink, 'thepitch': soccer, 'fairway': golf,
    'poleposition': checkered, 'ringside': ropes, 'grandslam': tennis, 'trackfield': lanes,
    # design styles (themes with their own bespoke cards are left alone)
    'ethereal': soft_rings, 'bohemian': mandala, 'victorian': filigree, 'claymorphism': blobs, 'cybercore': reticle, 'scrapbook': scrap,
    'y2k': sparkle, 'glassmorphism': orbs, 'neumorphism': soft_rings, 'bentogrid': bento, 'editorial': quote, 'swiss': swiss,
    'maximalism': collage,
}

def svg_for(tid, color, alpha):
    f = ART.get(tid)
    if not f: return None
    body = f()
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><g fill="none" stroke="%s" stroke-opacity="%s" stroke-width="1.2" '
            'stroke-linecap="round" stroke-linejoin="round">%s</g></svg>') % (color, alpha, body)
