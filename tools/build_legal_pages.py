# Builds the legal pages: vpexdialer.com/privacy/, /terms/ and /cookies/ from the text below, in one shared look.
#   python3 tools/build_legal_pages.py . write   (rebuild)    python3 tools/build_legal_pages.py . check   (compare)
# tests/privacy_consent.js checks the pages exist, link to each other and match what the code really does.
# Change the text here, bump EFFECTIVE, rebuild. A change to what's optional also needs VERSION in consent.js bumped.
import sys, os

EFFECTIVE = "November 10, 2026"
CONTACT = "support@vpexdialer.com"

SHELL = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title} · VPEX</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="https://vpexdialer.com/{slug}/">
<link rel="icon" href="/vpex-icon-64.png">
<link rel="apple-touch-icon" href="/vpex-icon-180.png">
<link rel="preload" href="/fonts/vpex-sans.woff2" as="font" type="font/woff2" crossorigin>
<style>@font-face {{ font-family: "VPEX Sans"; src: url("/fonts/vpex-sans.woff2") format("woff2"); font-weight: 200 900; font-stretch: 75% 125%; font-display: swap; }}</style>
<meta http-equiv="Content-Security-Policy" content="script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; form-action 'self'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<script src="/consent.js"></script>
<style>
  :root {{ --bg: #0D1224; --surface: #141B34; --border: #283258; --text: #EDF0FB; --dim: #A2AACB; --gold: #E8B94A; --focus: #E8B94A; color-scheme: dark; }}
  @media (prefers-color-scheme: light) {{ :root {{ --bg: #ECEFF7; --surface: #FFFFFF; --border: #D4DAEB; --text: #11172E; --dim: #4F5A7C; color-scheme: light; }} }}
  * {{ box-sizing: border-box; }}
  html {{ -webkit-text-size-adjust: 100%; }}
  body {{ margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 'VPEX Sans', system-ui, -apple-system, 'Segoe UI', sans-serif; }}
  main {{ max-width: 760px; margin: 0 auto; padding: calc(14px + env(safe-area-inset-top, 0px)) 16px calc(48px + env(safe-area-inset-bottom, 0px)); }}
  a {{ color: inherit; text-underline-offset: 2px; }}
  a:focus-visible, button:focus-visible {{ outline: 2px solid var(--focus); outline-offset: 3px; border-radius: 6px; }}
  .top {{ display: flex; align-items: center; justify-content: space-between; gap: 12px; }}
  .wm {{ display: inline-flex; align-items: center; min-height: 44px; font-weight: 850; font-stretch: 120%; font-size: 20px; text-decoration: none; }}
  .tabs {{ display: flex; flex-wrap: wrap; gap: 6px; margin: 18px 0 0; }}
  .tabs a {{ display: inline-flex; align-items: center; min-height: 44px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--border); text-decoration: none; font-weight: 650; font-size: 14.5px; }}
  .tabs a[aria-current] {{ background: var(--gold); color: #111827; border-color: var(--gold); }}
  h1 {{ font-size: clamp(30px, 8vw, 44px); line-height: 1.05; letter-spacing: -0.02em; font-weight: 850; margin: 22px 0 6px; }}
  .eff {{ color: var(--dim); font-size: 14px; margin: 0 0 18px; }}
  h2 {{ font-size: 21px; line-height: 1.25; font-weight: 800; margin: 34px 0 8px; scroll-margin-top: 12px; }}
  h3 {{ font-size: 16.5px; font-weight: 750; margin: 20px 0 4px; }}
  p, li {{ max-width: 44em; }}
  ul {{ padding-left: 22px; }} li {{ margin: 0 0 6px; }}
  .sum {{ background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; }}
  .sum p {{ margin: 0 0 8px; }} .sum p:last-child {{ margin: 0; }}
  .toc {{ columns: 2 220px; font-size: 14.5px; padding-left: 20px; }}
  .toc a {{ display: inline-block; padding: 6px 0; }}
  .tw {{ overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 8px -16px; padding: 0 16px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 14px; min-width: 560px; }}
  th, td {{ text-align: left; padding: 9px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }}
  th {{ font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--dim); }}
  td code {{ font-size: 12.5px; overflow-wrap: anywhere; }}
  .btn {{ display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 18px; border-radius: 12px; border: 0; background: var(--gold); color: #111827; font: inherit; font-weight: 800; cursor: pointer; }}
  .receipt {{ font-size: 14px; color: var(--dim); }}
  footer {{ margin-top: 48px; font-size: 13.5px; color: var(--dim); display: flex; flex-wrap: wrap; gap: 4px 16px; }}
  footer a {{ display: inline-flex; align-items: center; min-height: 44px; }}
  @media print {{ .tabs, footer, .btn {{ display: none; }} body {{ background: #fff; color: #000; }} }}
</style>
</head>
<body>
<main>
  <div class="top"><a class="wm" href="/">VPEX</a></div>
  <nav class="tabs" aria-label="Legal pages"><a href="/privacy/"{a_privacy}>Privacy Policy</a><a href="/terms/"{a_terms}>Terms of Service</a><a href="/cookies/"{a_cookies}>Cookie Policy</a></nav>
  <h1>{title}</h1>
  <p class="eff">Effective {effective}. Questions: <a href="mailto:{contact}">{contact}</a></p>
{body}
  <footer><a href="/">vpexdialer.com</a><a href="mailto:{contact}">{contact}</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/cookies/">Cookies</a><a href="/cookies/#settings" data-cookie-settings>Cookie settings</a></footer>
</main>
{script}
</body>
</html>
"""

SUBPROCESSORS = """<div class="tw"><table>
<thead><tr><th>Provider</th><th>What it does for VPEX</th><th>Data involved</th><th>Where</th></tr></thead>
<tbody>
<tr><td>Google (Firebase and Google Cloud)</td><td>Sign-in, the database, file storage, server code, phone notifications</td><td>Account data, Customer Data, notification tokens</td><td>United States</td></tr>
<tr><td>GitHub (Microsoft)</td><td>Hosts the website and app files (vpexdialer.com)</td><td>Visitors’ IP addresses and browser details in GitHub’s access logs</td><td>United States</td></tr>
<tr><td>Stripe</td><td>Subscriptions, payments, invoices and the billing portal</td><td>Billing contact, payment details (VPEX never sees card numbers), office reference</td><td>United States</td></tr>
<tr><td>Cloudflare</td><td>Runs the billing connector that keeps seats in step with Stripe and handles password resets</td><td>Office reference, login id, seat counts</td><td>Global network</td></tr>
<tr><td>Google Fonts</td><td>Typefaces on the website, only if you allow external fonts</td><td>IP address and browser details</td><td>Global</td></tr>
<tr><td>Email provider for {contact}</td><td>Support and privacy requests</td><td>What you send us</td><td>United States</td></tr>
</tbody></table></div>""".replace("{contact}", CONTACT)

PRIVACY = """  <div class="sum">
    <p><b>The short version.</b> VPEX is a power dialer and CRM for sales teams. We collect what we need to run your account and keep it secure. The leads and call records your team puts in VPEX belong to your company; we process them only to provide the service.</p>
    <p>We don’t sell personal information, don’t share it for advertising, and don’t use advertising cookies. Optional analytics and Google Fonts only run with your permission where the law requires it.</p>
  </div>
  <ol class="toc">
    <li><a href="#who">Who we are</a></li><li><a href="#roles">Your company’s data vs. ours</a></li><li><a href="#collect">What we collect</a></li>
    <li><a href="#use">How we use it</a></li><li><a href="#bases">Legal bases (EU/UK)</a></li><li><a href="#share">Who we share it with</a></li>
    <li><a href="#access">Who at VPEX can see it</a></li><li><a href="#keep">How long we keep it</a></li><li><a href="#security">Security</a></li>
    <li><a href="#rights">Your rights and choices</a></li><li><a href="#us-states">US state privacy rights</a></li><li><a href="#intl">International users</a></li>
    <li><a href="#leads">If you received a call</a></li><li><a href="#children">Children</a></li><li><a href="#changes">Changes</a></li><li><a href="#contact">Contact</a></li>
  </ol>

  <h2 id="who">1. Who we are</h2>
  <p>VPEX (“VPEX”, “we”, “us”) runs vpexdialer.com and the VPEX web app. This policy covers the website, the app, our server code and how we handle support and billing. Contact: <a href="mailto:""" + CONTACT + """">""" + CONTACT + """</a>.</p>

  <h2 id="roles">2. Your company’s data vs. ours</h2>
  <p><b>Customer Data</b> is what a customer’s team puts into VPEX: lead lists (names, phone numbers, emails, addresses, notes and the details for your industry, such as quote or property details), call outcomes and history, follow-ups, texts you open from VPEX, files attached to leads, Do Not Call lists, investor records in the Vault, scripts and settings. For Customer Data, the customer (the company that signed up) is the controller or “business”, and VPEX is its processor or “service provider”. We process Customer Data only to provide VPEX to that customer, as described in the <a href="/terms/#data">Terms of Service</a>.</p>
  <p><b>Account and website data</b> is information about the people who use or visit VPEX: account holders, reps, managers and website visitors. VPEX is the controller of this data, and this policy explains how we handle it.</p>

  <h2 id="collect">3. What we collect</h2>
  <h3>When you start a trial or are added to a team</h3>
  <ul>
    <li>Office or company name, industry, your name, mobile number, email address, username and password. Passwords are handled by Google’s Firebase Authentication and stored only in hashed form. When an admin resets a rep’s password, the new one is set through our billing connector and shown once to that admin to pass on; VPEX doesn’t keep it.</li>
    <li>Your role (admin, manager or rep), whether your login is active, and when you were last active.</li>
  </ul>
  <h3>When you use the app</h3>
  <ul>
    <li>Customer Data, as described above.</li>
    <li>If you turn on phone notifications: a notification token for your device, your device type and your time zone, so alerts arrive at the right local time.</li>
    <li>If you turn on the calendar feed: a secret link. We keep only a one-way hash of its key.</li>
    <li>App settings you choose, such as your theme and goals.</li>
  </ul>
  <h3>Billing</h3>
  <ul><li>Stripe processes payments. We receive your office reference, plan, whether payment succeeded, the paid-through date and the billing email. We never receive or store full card numbers.</li></ul>
  <h3>When you visit the website</h3>
  <ul>
    <li>Like any website host, GitHub (which hosts vpexdialer.com) receives your IP address and browser details to deliver the pages.</li>
    <li>With your permission (or, in the US, unless you opt out): anonymous visit statistics, meaning a count of steps such as “page seen”, “demo opened” or “trial started”, with the site or link that sent you, the industry demo and phone or computer. These counts contain no name, contact details, IP address, cookie or device ID.</li>
    <li>With your permission (or, in the US, unless you opt out): campaign attribution, meaning the link that brought you is remembered on your device for 30 days, so a later sign-up is credited to it. When an office signs up, its name is stored with that source.</li>
    <li>Your cookie choices, with a random ID and the date (see the <a href="/cookies/">Cookie Policy</a>).</li>
  </ul>
  <h3>When you contact us</h3>
  <ul><li>What you send us by email or phone, and our replies.</li></ul>
  <p>We don’t collect precise location, biometric data, or audio or transcripts of your calls. Calls are made from your own phone and VPEX doesn’t record them.</p>

  <h2 id="use">4. How we use it</h2>
  <ul>
    <li>To provide VPEX: sign-in, syncing your team’s list, follow-ups, notifications, reports and the calendar feed.</li>
    <li>To bill you and manage your subscription.</li>
    <li>To keep VPEX secure and working: preventing abuse, investigating problems and enforcing our Terms.</li>
    <li>To support you when you ask for help.</li>
    <li>To understand, in aggregate, how people find and use the website (only with the analytics choices described above).</li>
    <li>To send service messages about your account, such as trial reminders, billing notices and security alerts. We’ll ask before sending marketing messages where the law requires it, and you can opt out any time.</li>
    <li>To comply with the law and respond to lawful requests.</li>
  </ul>
  <p>We don’t sell personal information or share it for cross-context behavioral advertising. We don’t use Customer Data to train AI models or for any purpose of our own beyond providing, securing and supporting the service.</p>

  <h2 id="bases">5. Legal bases (EU, EEA, UK and Switzerland)</h2>
  <ul>
    <li><b>Contract:</b> running your account and the service you signed up for.</li>
    <li><b>Legitimate interests:</b> security, preventing fraud and abuse, and improving VPEX, balanced against your rights.</li>
    <li><b>Consent:</b> optional analytics, campaign attribution and Google Fonts. You can withdraw consent any time in <a href="/cookies/#settings" data-cookie-settings>Cookie settings</a>.</li>
    <li><b>Legal obligation:</b> tax, accounting and responding to lawful requests.</li>
  </ul>

  <h2 id="share">6. Who we share it with</h2>
  <p>We share personal information only with the service providers below, who process it for us under contract, and when the law requires it. We would also share it with a buyer if VPEX were sold or merged, under this policy.</p>
""" + SUBPROCESSORS + """
  <p>Inside a customer’s office, the office’s admins and managers can see the team’s activity, and reps share one lead list. That’s how the product works, and each customer controls who has a login.</p>

  <h2 id="access">7. Who at VPEX can see your data</h2>
  <p>Each office’s data is walled off from every other office by our database security rules. A small number of VPEX staff have technical access to all data, which is needed to operate the service. They use it only to provide support you ask for, keep VPEX secure, fix problems, or comply with the law, and never to contact your leads or for any purpose of their own.</p>

  <h2 id="keep">8. How long we keep it</h2>
  <ul>
    <li><b>Account and Customer Data:</b> while the office has an account. If an office stops paying, it is paused rather than deleted, so the team can come back or download its data. An office admin can ask us to delete the office and all its data at any time, and we’ll do it within 30 days of confirming the request. Copies in backups, if any, expire on their normal schedule.</li>
    <li><b>Phone notification tokens:</b> deleted after 120 days without use, or when you turn notifications off or sign out.</li>
    <li><b>“Message your floor” messages:</b> 2 days. Send receipts: 1 day.</li>
    <li><b>Notification delivery markers:</b> 30 days. Daily send and rate-limit marks: 14 days.</li>
    <li><b>Cookie consent records:</b> 3 years, so we can show what you chose.</li>
    <li><b>Anonymous visit counts:</b> kept as statistics. They don’t identify anyone.</li>
    <li><b>Billing records:</b> as long as tax and accounting law requires.</li>
    <li><b>Data cached on your device</b> for offline use is wiped when you sign out.</li>
  </ul>

  <h2 id="security">9. Security</h2>
  <p>All traffic uses HTTPS. Sign-in runs on Firebase Authentication. Every read and write is checked by database and file-storage rules that limit each login to its own office and role, and turned-off logins lose access right away. Calendar keys are stored only as hashes, files are limited to safe document and photo types, and paused offices become read-only. No system is perfectly secure. If a breach affects your personal information, we’ll notify you and the authorities as the law requires.</p>

  <h2 id="rights">10. Your rights and choices</h2>
  <ul>
    <li><b>Access and portability:</b> admins can download all of their office’s data any time (Settings › Data, or “Download my data” on a paused office). You can also ask us for a copy.</li>
    <li><b>Correction:</b> you can edit your details in the app, or ask us.</li>
    <li><b>Deletion:</b> ask us to delete your account or your office’s data.</li>
    <li><b>Withdraw consent and opt out:</b> use <a href="/cookies/#settings" data-cookie-settings>Cookie settings</a> on any page. We honor the Global Privacy Control (GPC) signal.</li>
    <li><b>Notifications and emails:</b> turn phone notifications off in Settings; unsubscribe from any marketing email.</li>
  </ul>
  <p>To make a request, email <a href="mailto:""" + CONTACT + """?subject=Privacy%20request">""" + CONTACT + """</a> with “Privacy request” in the subject. We’ll verify that the request comes from you, usually by replying from your account email or confirming with your office admin, and respond within 30 days (45 days where US state law allows). You can use an authorized agent where the law allows. We won’t treat you differently for using your rights. If we deny a request, you can appeal by replying to our answer. If your request concerns Customer Data, such as a lead list, we’ll pass it to the customer that controls that data and help them respond.</p>

  <h2 id="us-states">11. US state privacy rights</h2>
  <p>Residents of California and other states with comprehensive privacy laws (including Colorado, Connecticut, Virginia, Utah, Texas, Oregon, Montana, Delaware, Iowa, Nebraska, New Hampshire, New Jersey, Tennessee, Minnesota, Maryland, Indiana, Kentucky and Rhode Island) may have the rights to know, access, correct, delete and port their personal information, to opt out of sale, sharing, targeted advertising and profiling, and to appeal our decision. VPEX doesn’t sell or share personal information, doesn’t do targeted advertising, and doesn’t make decisions with legal or similarly significant effects by automated means. In the past 12 months, we collected the categories described in section 3 (identifiers, commercial information, internet activity in the limited form described, and professional information) from the sources and for the purposes described above, and disclosed them only to the service providers in section 6. We don’t knowingly collect sensitive personal information about account holders or website visitors. For Customer Data, we act as the customer’s service provider.</p>

  <h2 id="intl">12. International users</h2>
  <p>VPEX is built for US sales teams, and our providers store data in the United States. If you use VPEX from another country, your information is transferred to the US. Where the law requires it, we rely on appropriate safeguards for those transfers, such as our providers’ Standard Contractual Clauses. EU, EEA, UK and Swiss residents can also complain to their local data protection authority.</p>

  <h2 id="leads">13. If you received a call from a VPEX customer</h2>
  <p>VPEX doesn’t make calls or choose who gets called. Our customers do, from their own phones, using contact lists they provide. If you want to stop the calls or ask about your information, contact the company that called you and ask to be put on its Do Not Call list. You can also email us with the company’s name and your phone number, and we’ll forward your request to that customer.</p>

  <h2 id="children">14. Children</h2>
  <p>VPEX is a business tool for adults. It isn’t meant for anyone under 18, and we don’t knowingly collect information from children.</p>

  <h2 id="changes">15. Changes to this policy</h2>
  <p>If we make material changes, we’ll update the effective date and tell account admins in the app or by email before the changes take effect. Changes that affect optional cookies ask for your choice again.</p>

  <h2 id="contact">16. Contact</h2>
  <p>Email <a href="mailto:""" + CONTACT + """">""" + CONTACT + """</a>.</p>
"""

TERMS = """  <div class="sum">
    <p><b>The short version.</b> Your company pays monthly for each active rep, and can cancel any time. Your data is yours; you can download it whenever you like. You’re responsible for following calling and telemarketing laws: VPEX’s calling-hours and Do Not Call features help, but they aren’t legal advice and don’t replace your own compliance.</p>
  </div>
  <ol class="toc">
    <li><a href="#agree">Agreement</a></li><li><a href="#accounts">Accounts and logins</a></li><li><a href="#billing">Trial, billing and cancellation</a></li>
    <li><a href="#compliance">Calling laws: your responsibility</a></li><li><a href="#use">Acceptable use</a></li><li><a href="#data">Your data and data protection</a></li>
    <li><a href="#service">The service</a></li><li><a href="#ip">Ownership and license</a></li><li><a href="#end">Suspension and termination</a></li>
    <li><a href="#warranty">Disclaimers</a></li><li><a href="#liability">Limitation of liability</a></li><li><a href="#indemnity">Indemnity</a></li>
    <li><a href="#law">Governing law</a></li><li><a href="#misc">Everything else</a></li>
  </ol>

  <h2 id="agree">1. Agreement</h2>
  <p>These Terms are an agreement between VPEX (“VPEX”, “we”) and the company or organization that signs up for VPEX (“Customer”, “you”). The person who starts a trial confirms they have authority to bind the Customer. Each person using a login under the Customer’s account (a “User”) must also follow these Terms. Our <a href="/privacy/">Privacy Policy</a> and <a href="/cookies/">Cookie Policy</a> explain how we handle personal information. VPEX is for business use only and for people 18 and older.</p>

  <h2 id="accounts">2. Accounts and logins</h2>
  <ul>
    <li>The person who starts the trial becomes the office’s admin. Admins invite Users, set roles, turn logins off, reset passwords and control the office’s settings and data.</li>
    <li>Keep passwords and invite links confidential. Each login is for one person. You’re responsible for everything done under your account, and for turning off logins of people who leave.</li>
    <li>Tell us right away at <a href="mailto:""" + CONTACT + """">""" + CONTACT + """</a> if you suspect unauthorized access.</li>
  </ul>

  <h2 id="billing">3. Trial, billing and cancellation</h2>
  <ul>
    <li><b>Free trial.</b> New offices get a 7-day free trial with no payment card. When the trial ends, the office is paused (you can still sign in and download your data) until someone adds payment. You won’t be charged unless you subscribe.</li>
    <li><b>Price.</b> The subscription costs the per-rep monthly price shown when you subscribe (currently $49 per active rep per month, or a lower founding price if you were offered one), in US dollars, plus any applicable tax. An “active rep” is a login that’s turned on.</li>
    <li><b>Automatic renewal.</b> Your subscription is billed monthly in advance through Stripe and <b>renews automatically every month until you cancel</b>. When you add or turn off logins, the number of paid seats changes to match, and Stripe may prorate the charge or credit it on your next invoice.</li>
    <li><b>Cancel any time.</b> Cancel online in the billing portal (Settings in VPEX, or the link in your Stripe receipts), or email <a href="mailto:""" + CONTACT + """?subject=Cancel">""" + CONTACT + """</a>. Cancellation stops future renewals. Your access continues until the end of the period you’ve paid for. Fees already paid are not refundable, except where the law requires a refund.</li>
    <li><b>Failed payments.</b> If a payment fails, you have 7 days to fix it. After that, the office is paused until payment succeeds.</li>
    <li><b>Price changes.</b> We’ll give admins at least 30 days’ notice before a price change takes effect. If you don’t want to continue at the new price, you can cancel before it applies.</li>
  </ul>

  <h2 id="compliance">4. Calling and telemarketing laws are your responsibility</h2>
  <p>VPEX helps your team place calls from their own phones and organize follow-ups. You decide who to call, when, and what to say. You must comply with all laws that apply to your calls, texts and lead data, including:</p>
  <ul>
    <li>the Telephone Consumer Protection Act (TCPA) and FCC rules, the Telemarketing Sales Rule (TSR), and state telemarketing, “mini-TCPA” and registration laws;</li>
    <li>the National Do Not Call Registry, state Do Not Call lists, and your own internal Do Not Call list;</li>
    <li>calling-hour limits, call-frequency limits, caller ID and identification requirements;</li>
    <li>getting any consent the law requires before you call or text someone, and honoring requests to stop;</li>
    <li>call-recording consent laws if you record calls by other means, and the rules of your industry (for example, insurance and Medicare marketing rules, real estate rules, and securities rules for investment offerings).</li>
  </ul>
  <p>VPEX’s calling-hours checks, holiday warnings and Do Not Call tools are aids based on published rules as we understand them. They may be incomplete, out of date or wrong for your situation, and they aren’t legal advice. You’re responsible for confirming what applies to you, ideally with your own lawyer. VPEX doesn’t place automated or prerecorded calls, and you must not use VPEX with any system that does.</p>

  <h2 id="use">5. Acceptable use</h2>
  <p>You and your Users must not:</p>
  <ul>
    <li>upload or use contact data you don’t have the right to use, or call or text people in violation of the law or their stated wishes;</li>
    <li>use VPEX for fraud, harassment, deceptive or abusive sales practices, or anything illegal;</li>
    <li>store payment card numbers, Social Security numbers, bank account numbers, government ID numbers or health records in notes, fields or files, except where VPEX provides a field for that kind of information. VPEX isn’t designed for HIPAA-regulated health information or PCI-regulated card data;</li>
    <li>try to access another office’s data, probe or bypass our security, overload the service, or scrape it;</li>
    <li>copy, resell or reverse engineer VPEX, except as the law permits.</li>
  </ul>
  <p>To report a security vulnerability in good faith, email <a href="mailto:""" + CONTACT + """?subject=Security">""" + CONTACT + """</a>. Please don’t access other people’s data or disrupt the service while testing.</p>

  <h2 id="data">6. Your data and data protection</h2>
  <ul>
    <li><b>Your data is yours.</b> Customer Data (lead lists, call records, notes, files, scripts and everything else your team puts into VPEX) belongs to the Customer. You give VPEX permission to host, process and transmit it only to provide, secure and support the service for you.</li>
    <li><b>Your responsibilities.</b> You’re responsible for having a lawful basis and any required notices or consents for the Customer Data you put into VPEX, and for its accuracy.</li>
    <li><b>Our commitments as your processor/service provider.</b> We will: process Customer Data only on your documented instructions (these Terms and your use of the app); not sell it, share it for advertising, or use it outside our direct business relationship with you; ensure our staff and providers who handle it are bound by confidentiality; keep reasonable technical and organizational security measures; use only the providers listed in our <a href="/privacy/#share">Privacy Policy</a>, under written terms at least as protective, and tell admins before adding new ones; help you respond to requests from people about their data; notify you without undue delay, and where feasible within 72 hours, after we become aware of a breach affecting your Customer Data; and give you the information reasonably needed to show compliance.</li>
    <li><b>Export and deletion.</b> Admins can download all Customer Data at any time. After cancellation or closure, you can still sign in to download it while the office is paused. When an admin asks us to delete the office, we delete its Customer Data within 30 days, except where the law requires us to keep it.</li>
    <li>If you need a signed data processing agreement, email us.</li>
  </ul>

  <h2 id="service">7. The service</h2>
  <ul>
    <li>We work to keep VPEX available and to improve it. We may change or remove features. If a change materially reduces what you’re paying for, we’ll tell admins in advance, and you can cancel.</li>
    <li>VPEX depends on your devices, internet connection, phone carrier and third-party services, which we don’t control. We don’t promise a particular uptime unless we agree to it in writing.</li>
    <li>Keep your own copies of anything critical. The download feature is there for that.</li>
  </ul>

  <h2 id="ip">8. Ownership and license</h2>
  <p>VPEX and its software, design and content belong to VPEX. While your subscription or trial is active, we give you a non-exclusive, non-transferable right for your Users to use VPEX for your internal business. If you send us feedback, we may use it without any obligation to you.</p>

  <h2 id="end">9. Suspension and termination</h2>
  <p>You can stop using VPEX and cancel any time. We may suspend or end access if you seriously or repeatedly break these Terms, don’t pay, create legal risk for VPEX or others, or put the security of the service at risk. Where reasonable, we’ll warn you first and give you a chance to fix the problem. Sections 4, 6 (export and deletion), 10 to 14 and any amounts owed survive termination.</p>

  <h2 id="warranty">10. Disclaimers</h2>
  <p>To the extent the law allows, VPEX is provided “as is” and “as available”, without warranties of any kind, whether express or implied, including warranties of merchantability, fitness for a particular purpose and non-infringement. We don’t warrant that VPEX will be uninterrupted or error-free, or that calling-hours, Do Not Call or other compliance features are complete or correct.</p>

  <h2 id="liability">11. Limitation of liability</h2>
  <p>To the extent the law allows: (a) neither party is liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, revenue or data; and (b) each party’s total liability under these Terms is limited to the amount the Customer paid VPEX in the 12 months before the claim. These limits don’t apply to the Customer’s payment obligations, a party’s indemnity obligations, or liability that can’t be limited by law.</p>

  <h2 id="indemnity">12. Indemnity</h2>
  <p>The Customer will defend and indemnify VPEX against third-party claims, fines and penalties arising from the Customer’s calls, texts, lead data or sales practices, including claims under the TCPA, the TSR, Do Not Call rules or state telemarketing laws, or from the Customer’s breach of sections 4 or 5. VPEX will defend and indemnify the Customer against third-party claims that VPEX’s software, as we provide it, infringes their intellectual property rights.</p>

  <h2 id="law">13. Governing law and disputes</h2>
  <p>These Terms are governed by the laws of the State of Delaware, without regard to its conflict-of-law rules. Before filing a claim, each party will try to resolve the dispute informally for 30 days after written notice. Any lawsuit must be brought in the state or federal courts located in Delaware, and both parties consent to their jurisdiction. Either party may seek urgent injunctive relief in any competent court.</p>

  <h2 id="misc">14. Everything else</h2>
  <ul>
    <li><b>Changes to these Terms.</b> We may update these Terms. For material changes, we’ll update the effective date and notify admins at least 30 days in advance, unless the change is required by law sooner. If you keep using VPEX after changes take effect, the new Terms apply. If you don’t agree, you can cancel.</li>
    <li><b>Notices.</b> We send notices to the admin’s email or in the app. You send notices to <a href="mailto:""" + CONTACT + """">""" + CONTACT + """</a>.</li>
    <li>These Terms are the entire agreement on this subject. If any part is unenforceable, the rest stays in effect. A failure to enforce a part isn’t a waiver. Neither party may assign these Terms without the other’s consent, except to a successor in a merger or sale of its business. Neither party is responsible for delays caused by events beyond its reasonable control.</li>
  </ul>
"""

COOKIES = """  <div class="sum">
    <p><b>The short version.</b> vpexdialer.com doesn’t set HTTP cookies and uses no advertising or cross-site tracking. It stores some information on your device (in your browser’s local storage) so the site and app work. Three optional items, Google Fonts, visit statistics and campaign attribution, only run with your choice.</p>
  </div>
  <h2 id="settings">Your choices</h2>
  <p id="cookieNow" class="receipt">Your current choices appear here when the page has loaded.</p>
  <p><button class="btn" type="button" data-cookie-settings>Open cookie settings</button></p>
  <p>Outside the United States, nothing optional runs until you choose. In the US, the optional items are on unless you turn them off, and we treat your browser’s Global Privacy Control signal as a request to turn off statistics and attribution. We ask again after 12 months, or when this policy changes. Your choice applies to vpexdialer.com in this browser. Clearing your browser’s site data resets it.</p>

  <h2 id="what">What we store and why</h2>
  <h3>Essential (always on)</h3>
  <p>These are needed for something you asked for, like signing in, using the demo or keeping your settings. They can’t be turned off here; you can clear them in your browser, but VPEX may stop working properly.</p>
  <div class="tw"><table>
    <thead><tr><th>Name</th><th>Purpose</th><th>How long</th></tr></thead>
    <tbody>
      <tr><td><code>firebaseLocalStorageDb</code> (IndexedDB)</td><td>Keeps you signed in (Google Firebase Authentication)</td><td>Until you sign out</td></tr>
      <tr><td>Firestore cache (IndexedDB)</td><td>Your office’s data for offline use and speed, when signed in</td><td>Wiped when you sign out</td></tr>
      <tr><td><code>vpex_consent</code></td><td>Remembers your cookie choices, the date and a random ID</td><td>12 months</td></tr>
      <tr><td><code>vpex_office</code>, <code>vpex_join</code></td><td>The office you sign in to; a team invite you opened</td><td>Until changed</td></tr>
      <tr><td><code>vpex_team_*</code>, <code>dovetail_team_*</code>, <code>vpex_prefs_*</code></td><td>Your settings in the app (goals, views, sorting)</td><td>Until you clear them</td></tr>
      <tr><td><code>dovetail_suite_state_v1</code></td><td>Your leads and calls when you use VPEX without a team account (stored only on this device)</td><td>Until you clear them</td></tr>
      <tr><td><code>dovetail_dialer_theme_v1</code>, <code>dovetail_motion</code></td><td>Your look and motion settings</td><td>Until changed</td></tr>
      <tr><td><code>dovetail_demo*</code>, <code>vpex_demo_*</code></td><td>The demo office you opened and your progress in it</td><td>Until you leave the demo</td></tr>
      <tr><td><code>vpex_company</code>, <code>vpex_industry</code>, <code>vpex_signup_email</code>, <code>vpex_buy_now</code>, <code>vpex_paid_at</code></td><td>What you typed into the trial form, and checkout progress, so it isn’t lost</td><td>Until sign-up or checkout finishes</td></tr>
      <tr><td><code>vpex_push*</code>, <code>vpex_files</code>, <code>vpex_hist_*</code>, <code>vpex_floor_*</code>, <code>vpex_desk_scope</code>, <code>vpex_setup_*</code>, <code>vpex_contact_asked_*</code>, <code>vpex_oc_seen</code>, <code>vpex_support</code></td><td>Notification settings, files waiting to upload, and which tips and messages you’ve already seen</td><td>Until you clear them</td></tr>
      <tr><td><code>dovetail_update*</code>, <code>vpex_reloaded</code>, <code>dovetail_signout_log</code>, <code>dovetail_nt_last</code>, <code>dovetail_lock_*</code>, <code>vpex_wipe_cache</code>, <code>vpex_signout_msg</code> (session)</td><td>App updates, sign-out messages, the screen lock and finishing the offline-data wipe</td><td>Until no longer needed</td></tr>
      <tr><td>Service worker</td><td>Phone notifications, if you turn them on</td><td>Until you turn them off</td></tr>
    </tbody>
  </table></div>

  <h3>Optional</h3>
  <div class="tw"><table>
    <thead><tr><th>Choice</th><th>What it does</th><th>Stored on your device</th></tr></thead>
    <tbody>
      <tr><td>External fonts</td><td>Loads the site’s typefaces from Google Fonts. Your browser sends your IP address and browser details to Google; see <a href="https://policies.google.com/privacy" rel="noopener">Google’s Privacy Policy</a>. If this is off, your device’s fonts are used.</td><td>Nothing from VPEX (your browser may cache the fonts)</td></tr>
      <tr><td>Visit statistics</td><td>Sends one anonymous count per step (page seen, demo opened, first demo call, trial form opened, sign-up, app opened from the Home Screen, Instagram link page). Each count includes the link or site that sent you, the demo industry, and whether you’re on a phone or computer. No name, IP address or ID is kept.</td><td><code>vpex_hit_*</code> and <code>vpex_bio_view</code> (session only, so a step is counted once per visit); <code>vpex_hit_home</code></td></tr>
      <tr><td>Campaign attribution</td><td>Remembers which link or post brought you, so a sign-up within 30 days is credited to it.</td><td><code>vpex_attr</code>, for 30 days</td></tr>
    </tbody>
  </table></div>
  <p>Turning a choice off deletes what it stored. Fonts that have already loaded stay until you open the next page.</p>

  <h2 id="third">Third-party sites</h2>
  <p>When you pay, you’re taken to Stripe’s checkout or billing portal on stripe.com, which uses its own cookies under <a href="https://stripe.com/privacy" rel="noopener">Stripe’s Privacy Policy</a>. Links to Instagram, Facebook and other sites are governed by those sites’ policies.</p>

  <h2 id="records">Records of your choices</h2>
  <p>Each time you make a choice, a record goes to our server with a random ID, the policy version, what you chose, how you chose it (for example “Accept all”, “Reject all”, saved settings, withdrawn, or Global Privacy Control), whether your region asks for consent first, and phone or computer. It doesn’t include your IP address or anything else that identifies you. We keep these records for 3 years to show what was chosen. Your consent ID is shown above, so you can refer to it in a request.</p>

  <h2 id="more">More</h2>
  <p>See the <a href="/privacy/">Privacy Policy</a> for your rights, or email <a href="mailto:""" + CONTACT + """">""" + CONTACT + """</a>.</p>
"""

COOKIE_SCRIPT = """<script>
(function () {
  var C = window.VPEXConsent, box = document.getElementById("cookieNow");
  function show() {
    if (!C || !box) return;
    var c = C.choices(), r = C.get(), on = function (k) { return c[k] ? "on" : "off"; };
    box.textContent = "External fonts: " + on("fonts") + " \\u00b7 Visit statistics: " + on("stats") + " \\u00b7 Campaign attribution: " + on("attribution") +
      (r ? ". Chosen " + new Date(r.t).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) + " (consent ID " + r.id + ", policy " + r.v + ")." : ". You haven\\u2019t made a choice yet" + (C.region === "optout" ? ", so the US defaults apply." : ", so nothing optional is running."));
  }
  if (C) { C.onChange(show); show(); if (location.hash === "#settings") C.open(); window.addEventListener("hashchange", function () { if (location.hash === "#settings") C.open(); }); }
})();
</script>"""

PAGES = [
    ("privacy", "Privacy Policy", "How VPEX collects, uses, shares and protects personal information, and how to use your privacy rights.", PRIVACY, ""),
    ("terms", "Terms of Service", "The terms for using VPEX: accounts, billing and cancellation, calling-law compliance, data protection and liability.", TERMS, ""),
    ("cookies", "Cookie Policy", "What VPEX stores on your device, which items are optional, and how to change or withdraw your choices.", COOKIES, COOKIE_SCRIPT),
]


def page(slug, title, desc, body, script):
    cur = lambda s: ' aria-current="page"' if s == slug else ""
    return SHELL.format(title=title, desc=desc, slug=slug, effective=EFFECTIVE, contact=CONTACT, body=body.rstrip("\n"), script=script,
                        a_privacy=cur("privacy"), a_terms=cur("terms"), a_cookies=cur("cookies"))


if __name__ == "__main__":
    repo = sys.argv[1] if len(sys.argv) > 1 else "."
    mode = sys.argv[2] if len(sys.argv) > 2 else "check"
    bad = []
    for slug, title, desc, body, script in PAGES:
        path = os.path.join(repo, slug, "index.html")
        html = page(slug, title, desc, body, script)
        if mode == "write":
            os.makedirs(os.path.dirname(path), exist_ok=True)
            open(path, "w", encoding="utf-8").write(html)
        elif not os.path.exists(path) or open(path, encoding="utf-8").read() != html:
            bad.append(slug)
    if mode == "write":
        print("wrote", len(PAGES))
    else:
        print("legal pages up to date" if not bad else "out of date: " + ", ".join(bad))
        sys.exit(1 if bad else 0)
