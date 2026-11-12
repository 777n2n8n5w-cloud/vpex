# Builds the five industry pages (vpexdialer.com/power-dialer-for-*/) from one template.
#   python3 tools/build_industry_pages.py . write   (rebuild)    python3 tools/build_industry_pages.py . check   (compare)
# The style block is read from the insurance page; every claim must exist in index.html (tests/industry_page.js checks).
import sys, re, html as H
REPO = sys.argv[1]
ins = open(REPO + '/power-dialer-for-insurance-agents/index.html').read()
STYLE = ins[ins.index('<style>'):ins.index('</style>') + 8]
if '.comp a,' not in STYLE: STYLE = STYLE.replace('  .comp {', '  .comp a, .fine a { display: inline-block; padding: 12px 0; margin: -12px 0; }\n  .comp {')
CAL = ('<li><b>Calling hours checked on every lead</b><span>Each lead shows their local time and their state\'s rule, including the 20 stricter states and the 3-calls-in-24-hours limit in Florida, Maryland, Oklahoma and Oregon. Call asks first when it\'s outside their hours.</span></li>')
SHARED = '<li><b>One list for the whole floor</b><span>No two {reps} dial the same lead. Setters hand leads to closers with the appointment time.</span></li>'
LIVE = '<li><b>See the floor live</b><span>A scoreboard, who\'s on a call and every call as it\'s logged, on a phone or a computer.</span></li>'
P = {
 'insurance': dict(dir='power-dialer-for-insurance-agents', demo='insurance', short='Insurance', reps='agents', rep='agent', office='agency',
   title='Power dialer for insurance agents: VPEX at $49 per agent (2026)',
   desc='A power dialer and CRM for final expense, Medicare, life and P&amp;C floors. Agents call from their own phones, quote details sit on every lead, calling hours are checked by state. $49 per agent a month, 7 days free.',
   ogt='The power dialer for insurance agents, at $49 per agent',
   ogd='Quote details on every lead, a Medicare reminder, calling hours by state, a shared list for the whole floor. Try the insurance demo, no sign-up.',
   h1='The power dialer for <em>insurance agents.</em>',
   lede='For final expense, Medicare, life and P&amp;C floors that call their own leads. Your agents dial from their own phones, every lead carries its quote details, and VPEX checks each state\'s calling hours before a call goes out. $49 per agent a month.',
   demotxt='Try the insurance demo', demosub='A sample agency with leads, no sign-up. Calls in the demo never leave the page.',
   cards=['<li><b>Quote details on every lead</b><span>Product (term, whole life, final expense, IUL, annuity, Medicare, home &amp; auto), age, coverage, monthly budget, tobacco, current carrier and renewal or X-date, one tap from the dial screen.</span></li>',
     '<li><b>Upload your lead list as it is</b><span>Columns like product, date of birth, coverage, premium, tobacco, carrier and X-date fill the quote details (date of birth becomes age). Every other column lands in the notes instead of being dropped.</span></li>',
     '<li><b>A reminder on Medicare calls</b><span>When the product is Medicare, the lead shows: get the Scope of Appointment on record before the sales meeting. The starter script leaves a spot for your required disclaimer before any plan benefits.</span></li>',
     CAL,
     '<li><b>Script and rebuttals for insurance</b><span>A starter script and answers to "I already have coverage", "It\'s too expensive", "Just mail me something" and more. Edit them for your agency.</span></li>',
     '<li><b>Follow-ups that come back on time</b><span>Callbacks and quote follow-ups land on the right agent with a phone alert, plus ready-to-send texts about the quote and the policy review.</span></li>',
     SHARED, LIVE]),
 'realestate': dict(dir='power-dialer-for-real-estate-agents', demo='realestate', short='Real estate', reps='agents', rep='agent', office='team',
   title='Power dialer for real estate agents: VPEX at $49 per agent (2026)',
   desc='A power dialer and CRM for real estate teams calling expireds, FSBOs and buyer and seller leads. Agents call from their own phones, calling hours are checked by state. $49 per agent a month, 7 days free.',
   ogt='The power dialer for real estate agents, at $49 per agent',
   ogd='Buyer and seller details on every lead, calling hours by state, a pipeline from appointment to closing. Try the real estate demo, no sign-up.',
   h1='The power dialer for <em>real estate agents.</em>',
   lede='For teams calling expired listings, FSBOs and buyer and seller leads. Your agents dial from their own phones, every lead carries what they\'re buying or selling, and VPEX checks each state\'s calling hours before a call goes out. $49 per agent a month.',
   demotxt='Try the real estate demo', demosub='A sample team with expired and FSBO leads, no sign-up. Calls in the demo never leave the page.',
   cards=['<li><b>Buyer and seller details on every lead</b><span>Buying or selling, property, price range, timeframe, financing, whether they have an agent and why they\'re moving, one tap from the dial screen.</span></li>',
     '<li><b>Upload your lead list as it is</b><span>Columns like property or listing address, price, timeframe and financing fill the lead\'s details. Every other column lands in the notes instead of being dropped.</span></li>',
     '<li><b>A reminder when they have an agent</b><span>When a lead is working with an agent, the lead shows: don\'t pitch your services while they\'re under an agreement with someone else.</span></li>',
     CAL,
     '<li><b>Script and rebuttals for real estate</b><span>A starter script and answers to "I\'m going to sell it myself", "Your commission is too high", "Call me in a few months" and more. Edit them for your team.</span></li>',
     '<li><b>A pipeline in your words</b><span>Appointment set, negotiating, under contract, sold, with closing steps from offer accepted through inspection and appraisal to closing.</span></li>',
     '<li><b>Follow-ups that come back on time</b><span>Callbacks and follow-ups land on the right agent with a phone alert, plus ready-to-send texts about their property and the appointment.</span></li>',
     SHARED, LIVE]),
 'mca': dict(dir='power-dialer-for-business-funding', demo='mca', short='Business funding', reps='reps', rep='rep', office='shop',
   title='Power dialer for MCA and business funding: VPEX at $49 per rep (2026)',
   desc='A power dialer and CRM for MCA and small-business funding floors calling UCC and aged leads. Reps call from their own phones, merchant details sit on every lead, calling hours are checked by state. $49 per rep a month, 7 days free.',
   ogt='The power dialer for business funding floors, at $49 per rep',
   ogd='Merchant details on every lead, a pipeline from app sent to funded, calling hours by state. Try the business funding demo, no sign-up.',
   h1='The power dialer for <em>business funding floors.</em>',
   lede='For MCA and small-business funding shops calling UCC and aged leads. Your reps dial from their own phones, every lead carries the merchant\'s numbers, and VPEX checks each state\'s calling hours before a call goes out. $49 per rep a month.',
   demotxt='Try the business funding demo', demosub='A sample funding shop with merchant leads, no sign-up. Calls in the demo never leave the page.',
   cards=['<li><b>Merchant details on every lead</b><span>Business, industry, monthly revenue, time in business, credit, open advances and amount needed, one tap from the dial screen.</span></li>',
     '<li><b>Upload your lead list as it is</b><span>Columns like revenue, time in business, credit score and amount requested fill the merchant details, and a business with no contact name is named after the business. Every other column lands in the notes.</span></li>',
     '<li><b>A pipeline in your words</b><span>App sent, negotiating, submitted, funded, with closing steps from approved and offer accepted to contract signed and funded.</span></li>',
     CAL,
     '<li><b>Script and rebuttals for funding</b><span>A starter script and answers to "I don\'t need money right now", "The rates are too high", "I already have an advance" and more. Edit them for your shop.</span></li>',
     '<li><b>Follow-ups that come back on time</b><span>Callbacks, renewals and follow-ups land on the right rep with a phone alert, plus ready-to-send texts about funding for their business and the funding call.</span></li>',
     SHARED, LIVE]),
 'auto': dict(dir='power-dialer-for-auto-sales', demo='auto', short='Auto', reps='salespeople', rep='salesperson', office='store',
   title='Power dialer for auto sales and BDC teams: VPEX at $49 per rep (2026)',
   desc='A power dialer and CRM for dealership sales and BDC teams calling website leads, service-drive and lease-end customers. Reps call from their own phones, calling hours are checked by state. $49 per rep a month, 7 days free.',
   ogt='The power dialer for auto sales teams, at $49 per rep',
   ogd='Vehicle, trade-in and payment on every lead, a pipeline from appointment to delivery, calling hours by state. Try the auto demo, no sign-up.',
   h1='The power dialer for <em>auto sales teams.</em>',
   lede='For dealership sales and BDC teams calling website leads, the service drive and lease-end customers. Your salespeople dial from their own phones, every lead carries the vehicle, trade and payment, and VPEX checks each state\'s calling hours before a call goes out. $49 per rep a month.',
   demotxt='Try the auto demo', demosub='A sample dealership with website and service-drive leads, no sign-up. Calls in the demo never leave the page.',
   cards=['<li><b>Vehicle and payment on every lead</b><span>Vehicle wanted, new or used, trade-in, payment budget, credit, when they\'re buying and when their lease or loan ends, one tap from the dial screen.</span></li>',
     '<li><b>Upload your lead list as it is</b><span>Columns like vehicle, trade-in, payment, credit and lease end fill the lead\'s details. Every other column lands in the notes instead of being dropped.</span></li>',
     '<li><b>A pipeline in your words</b><span>Appointment set, test drive, negotiating, sold, delivered, with closing steps from credit app in and approved to deal signed and delivered.</span></li>',
     CAL,
     '<li><b>Script and rebuttals for auto</b><span>A starter script and answers to "Just send me your best price", "My credit isn\'t great", "The price is too high" and more. Edit them for your store.</span></li>',
     '<li><b>Follow-ups that come back on time</b><span>Callbacks and follow-ups land on the right salesperson with a phone alert, plus ready-to-send texts about the vehicle they were looking at and their visit.</span></li>',
     SHARED, LIVE]),
 'solar': dict(dir='power-dialer-for-solar-sales', demo='solar', short='Solar', reps='setters', rep='rep', office='team',
   title='Power dialer for solar sales teams: VPEX at $49 per rep (2026)',
   desc='A power dialer and CRM for solar and home improvement setters and closers. Reps call from their own phones, homeowner details sit on every lead, calling hours are checked by state. $49 per rep a month, 7 days free.',
   ogt='The power dialer for solar sales teams, at $49 per rep',
   ogd='Homeowner details on every lead, a homeowner reminder, setter-to-closer handoffs, calling hours by state. Try the solar demo, no sign-up.',
   h1='The power dialer for <em>solar sales teams.</em>',
   lede='For solar and home improvement setters and closers. Your reps dial from their own phones, every lead carries the homeowner\'s bill, roof and credit, and VPEX checks each state\'s calling hours before a call goes out. $49 per rep a month.',
   demotxt='Try the solar demo', demosub='A sample solar team with homeowner leads, no sign-up. Calls in the demo never leave the page.',
   cards=['<li><b>Homeowner details on every lead</b><span>Owns the home, electric bill a month, utility, roof age, shade, credit 650+ and whether all owners will be at the appointment, one tap from the dial screen.</span></li>',
     '<li><b>Upload your lead list as it is</b><span>Columns like homeowner, electric bill, utility, roof and credit score fill the homeowner details. Every other column lands in the notes instead of being dropped.</span></li>',
     '<li><b>A reminder when they rent</b><span>When a lead doesn\'t own the home, the lead shows: only the homeowner can sign for solar, so set the appointment with them.</span></li>',
     CAL,
     '<li><b>Script and rebuttals for solar</b><span>A starter script and answers to "It\'s too expensive", "My roof is old", "I rent my home" and more. Edit them for your team.</span></li>',
     '<li><b>A pipeline in your words</b><span>Proposal sent, financing, signed, installed, activated, with closing steps from the cancel period and site survey through permit and install to permission to operate.</span></li>',
     '<li><b>Setters hand off to closers</b><span>The closer gets the lead with the appointment time, and the homeowner can get a ready-to-send confirmation of their solar consultation. No two setters dial the same lead.</span></li>',
     LIVE]),
}
ORDER = ['insurance', 'realestate', 'mca', 'auto', 'solar']
def page(k):
    d = P[k]; U = '/?utm_source=landing&amp;utm_medium=page&amp;utm_campaign=' + k + '&amp;utm_content='
    cards = '\n    '.join(c.replace('{reps}', d['reps']) for c in d['cards'])
    others = ''.join('<a href="/%s/">%s</a>' % (P[o]['dir'], P[o]['short']) for o in ORDER if o != k)
    rep = d['rep']; reps = d['reps']
    lacks = ['No call recording: calls run on your %s\' own phones.' % reps,
             'No voicemail drop and no predictive dialing that rings several numbers at once.',
             'No business or local-presence caller ID: %s call from their own numbers.' % reps,
             'It doesn\'t check the National Do Not Call Registry. It skips your %s\'s own Do Not Call list.' % d['office']]
    if k == 'insurance': head_comment = '''<!-- Industry page for insurance floors. Every feature named here is in index.html (QUALIFY.insurance, the insurance call script,
     the Medicare note, STATE_HOURS). Keep it that way: no claims the app doesn't back, no invented numbers or testimonials. -->'''
    else: head_comment = '''<!-- Industry page (%s). Every feature named here is in index.html (QUALIFY, INDUSTRIES, the call scripts, the lead notes,
     STATE_HOURS); tests/industry_page.js checks it. No claims the app doesn't back, no invented numbers or testimonials. -->''' % d['short']
    other_line = '\n\n  <h2>Other floors</h2>\n  <div class="demos">%s</div>' % ''.join('<a href="/%s/">%s</a>' % (P[o]['dir'], P[o]['short']) for o in ORDER if o != k)
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
{head_comment}
<title>{d['title']}</title>
<meta name="description" content="{d['desc']}">
<link rel="canonical" href="https://vpexdialer.com/{d['dir']}/">
<meta property="og:title" content="{d['ogt']}">
<meta property="og:description" content="{d['ogd']}">
<meta property="og:image" content="https://vpexdialer.com/vpex-og.jpg">
<meta property="og:url" content="https://vpexdialer.com/{d['dir']}/">
<meta name="theme-color" content="#0D1224">
<link rel="icon" href="/vpex-icon-64.png">
<link rel="apple-touch-icon" href="/vpex-icon-180.png">
<link rel="preload" href="/fonts/vpex-sans.woff2" as="font" type="font/woff2" crossorigin>
<meta http-equiv="Content-Security-Policy" content="script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; form-action 'self'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<script src="/consent.js"></script>
{STYLE}
</head>
<body>
<main>
  <div class="top"><a class="wm" href="{U}logo">VPEX</a><a class="topcta" data-cta="top" href="{U}top&amp;trial={k}">Start free trial</a></div>
  <h1>{d['h1']}</h1>
  <p class="lede">{d['lede']}</p>
  <div><a class="cta" data-cta="demo-{d['demo']}" href="{U}demo-{d['demo']}#demo-{d['demo']}">{d['demotxt']}</a></div>
  <p class="assure">{d['demosub']}</p>

  <h2>What your floor gets</h2>
  <ul class="feat">
    {cards}
  </ul>
  <p class="comp">Based on published state rules as of November 2026. Not legal advice. <a href="/calling-hours/">Check any state's calling hours</a>.</p>

  <h2>What VPEX doesn't do</h2>
  <ul class="list">
''' + ''.join('    <li>%s</li>\n' % x for x in lacks) + f'''  </ul>

  <section class="sell" aria-label="Try VPEX">
    <h2>One price, no lines to buy.</h2>
    <div class="card">
      <p class="price"><b>$49</b><span>per {rep} a month</span></p>
      <p class="fine" style="margin:0 0 14px">Billed monthly, no contract, no seat minimum. {reps[0].upper() + reps[1:]} use their own phone plan for calls. Coming from another dialer? <a href="/phoneburner-alternative/">PhoneBurner</a>, <a href="/batchdialer-alternative/">BatchDialer</a>, <a href="/mojo-dialer-alternative/">Mojo</a>.</p>
      <a class="cta" data-cta="trial" href="{U}trial&amp;trial={k}">Start my free trial</a>
      <p class="assure">7 days free. No card needed.</p>
    </div>
  </section>{other_line}

  <footer><a href="{U}footer">vpexdialer.com</a><a href="/calling-hours/">Calling hours by state</a><a href="/phoneburner-alternative/">VPEX vs PhoneBurner</a><a href="/batchdialer-alternative/">VPEX vs BatchDialer</a><a href="/mojo-dialer-alternative/">VPEX vs Mojo</a><a href="mailto:support@vpexdialer.com">support@vpexdialer.com</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/cookies/">Cookies</a><a href="/cookies/#settings" data-cookie-settings>Cookie settings</a></footer>
</main>
</body>
</html>
'''
mode = sys.argv[2] if len(sys.argv) > 2 else 'check'
if mode == 'check':
    bad = [k for k in ORDER if open(REPO + '/' + P[k]['dir'] + '/index.html').read() != page(k)]
    print('industry pages up to date' if not bad else 'out of date: ' + ', '.join(bad)); sys.exit(1 if bad else 0)
else:
    import os
    for k in ORDER:
        os.makedirs(REPO + '/' + P[k]['dir'], exist_ok=True); open(REPO + '/' + P[k]['dir'] + '/index.html', 'w').write(page(k))
    print('wrote', len(ORDER))
