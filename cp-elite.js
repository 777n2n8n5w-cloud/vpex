/* VPEX Copilot Elite: the owner's closing playbook (index.html loads it only for the VPEX owner's own login; see cpElite()).
   Every answer follows the pattern the best closers share: name what the lead feels, find out if it's the real reason,
   bring them back to what they want in their own words, then close with two choices (never yes or no).
   Methods used: tactical empathy (label the feeling, mirror, calibrated "what/how" questions), isolate and confirm,
   problem-awareness questions (let the lead say why it matters), the no-pressure takeaway, cost of waiting, separating
   price from value, future pacing, feel/felt/found with a real story the rep fills in, the summary close and the
   assumptive two-choice close.
   Hard rules, because a rep who breaks them can lose their license and the office can be fined: no lies, no invented
   numbers or stories ([brackets] are for the rep's own real facts), no promised returns, approvals, savings or rates,
   no fake deadlines or scarcity, and a clear no or "take me off your list" is respected at once.
   Fill-ins: {first} the lead's first name, {me} the rep, {company} the office. Each variant has an id that never changes
   once used (the win rates on the owner's calls are counted by id). */
(function () {
  "use strict";
  // Extra things a lead says that the base Copilot doesn't listen for. Tested on the same cleaned text (lowercase, no punctuation).
  var IDEAS = [
    ["busy", /\b(i'?m|i am|we'?re) (really )?(busy|slammed|swamped|in the middle of something)\b|\bnow'?s not a good time\b|\bmake it (quick|fast)\b|\bi only have a (minute|second)\b/],
    ["what", /\bwhat is this (about|regarding)\b|\bwhat'?s this (about|regarding)\b|\bwho is this\b|\bwhat are you selling\b|\bwhat company (are you|is this|do you)\b/],
    ["decide", /\bnot the (decision maker|one who decides)\b|\b(my|the) (boss|partner|owner|business partner|board) (decides|has to|makes)\b|\bi (have|need) to (ask|check with) my (boss|partner|business partner)\b/],
    ["wait", /\b(want|going|like) to wait\b|\bwait (and see|until|for)\b|\b(rates|prices|the market) (will|might|could|are going to) (drop|come down|go down|crash|change)\b|\bnot the right market\b|\bafter the (holidays|new year|election)\b/],
    ["bad", /\b(bad|terrible|horrible) experience\b|\bgot (burned|ripped off|scammed)\b|\blast time (we|i)\b|\bnever again\b|\bdidn'?t work (out )?(for us|for me|last time)\b/],
    ["info", /\b(do|need to do) (some|my own|more) (research|homework)\b|\bneed more (info|information|details)\b|\blook (it|into it) (up|over)\b|\bread (up )?on it\b/],
    ["old", /\b(i'?m|i am) too old\b|\bat my age\b|\b(my )?health (isn'?t|is not) (great|good)\b|\bpre ?existing\b/],
    ["browse", /\bjust (looking|browsing|shopping around)\b|\bshopping around\b|\bgetting (other )?quotes\b|\bcompar(e|ing) (prices|quotes|offers)\b/],
    ["payment", /\bpayment(s)? (is|are|would be) too (high|much)\b|\bcan'?t (do|afford) (that|the) (payment|monthly)\b|\bdaily payments?\b|\bweekly payments?\b/],
    ["guarantee", /\bis it guaranteed\b|\bany guarantee\b|\bguaranteed (return|returns)\b|\bwhat if (it|the company) (fails|goes under|goes to zero)\b|\bcould i lose\b|\bhow risky\b/],
    ["liquid", /\b(lock ?up|lockup|locked up)\b|\bwhen (can|do) i get (my|the) money (back|out)\b|\bhow long (is|until) (my )?money\b|\bcan i (sell|get out) (early|anytime)\b|\b(i'?m|i am) not (very )?liquid|my (money|cash) is (all )?tied up/],
    ["stall", /\b(send|email) me the (contract|paperwork|agreement|docs|documents) and i'?ll (look|read|review)\b|\bi'?ll (call|get back to) you\b|\blet me get back to you\b|\bi'?ll let you know\b/]
  ];
  var LABEL = { busy: "I'm busy right now.", what: "What is this about?", decide: "I'm not the one who decides.", wait: "I want to wait.", bad: "I had a bad experience before.",
    info: "I need to do my own research.", old: "I'm too old for this.", browse: "I'm just shopping around.", payment: "The payment is too high.", guarantee: "Is it guaranteed?",
    liquid: "When can I get my money out?", stall: "I'll get back to you." };

  // The ask in each floor's next step. Two per floor; the win rates pick between them.
  var CLOSE = {
    insurance: [
      { id: "close-ins-a", t: "Let’s lock in your options while I have you. I just need your date of birth and a couple of health questions. Do you have two minutes now, or is right after dinner better?" },
      { id: "close-ins-b", t: "Here’s what I’d suggest: I run your numbers on two plans, the full one and a lighter one, and we pick together. Want me to start with the lower one, or show both side by side?" }],
    realestate: [
      { id: "close-re-a", t: "The best way to know what your home will really do is for me to walk it. Is tomorrow at 4 or Thursday at 10 better for you?" },
      { id: "close-re-b", t: "Let me put your numbers on paper: what you’d net, the timing and the plan. I can bring it by Wednesday evening or Saturday morning. Which works?" }],
    mca: [
      { id: "close-mca-a", t: "The fastest way to a real number is the one-page app and your last 3 bank statements. I’ll text you the link now. Can you send them in the next hour, or by end of day?" },
      { id: "close-mca-b", t: "Let’s find out exactly what you qualify for, no guessing. I’ll text the one-page app now. Do you want to fill it out together on the phone, or on your own and I’ll call you back at 3?" }],
    auto: [
      { id: "close-auto-a", t: "Let’s get you behind the wheel. Is today after work or Saturday morning better for a test drive?" },
      { id: "close-auto-b", t: "I’ll have it pulled up front and your numbers ready so you’re in and out. Do you want 5:30 today or 10 tomorrow?" }],
    solar: [
      { id: "close-sol-a", t: "The consultant will show you the exact numbers for your roof and your bill. I have Tuesday at 6 or Wednesday at 5. Which works for you and everyone on the title?" },
      { id: "close-sol-b", t: "Let’s get you the real numbers instead of guesses: your roof, your bill, your options. Evenings work best for most homeowners. Is 6 tomorrow or 6 Thursday better?" }],
    investments: [
      { id: "close-inv-a", t: "Let me send you the overview and set 15 minutes with our senior advisor to walk through it, risks included. Is tomorrow at 11 or Thursday at 2 better?" },
      { id: "close-inv-b", t: "The next step is simple: I send the deck and the key terms, you read them, and we get on a 15-minute call to answer every question. Do you want the call tomorrow morning or tomorrow afternoon?" },
      { id: "close-inv-title", t: "I’ll put you down for the [shares] shares. When you title your accounts, do you do them individually, joint or corporate?" }]
  };

  // Plays. steps: [what the step does, what to say]. close: an own close (else the floor's). tip: how to say it.
  // PLAYS[idea] = { all: [...], <industry>: [...] }: an industry's own variants come first, then the ones for every floor
  // (noAll: floors that use only their own, where a general answer would not be right).
  var P = {};
  P.price = {
    all: [
      { id: "price-a", m: "Separate price from value", steps: [["Name it", "Totally fair. Nobody wants to overpay, and you shouldn’t."], ["Ask", "Too expensive compared to what you’re doing now, or compared to what you had in mind?"], ["Isolate", "If the number worked for you, is there anything else that would stop you?"]],
        close: "Then let’s make it work. Do you want me to show you a lighter option, or adjust the one we talked about?", tip: "Slow down. Let the silence after the question work for you." },
      { id: "price-b", m: "Cost of waiting", steps: [["Name it", "It sounds like the price is what’s holding you back."], ["Ask", "What is it costing you right now to leave this the way it is?"], ["Bring it back", "So the real question isn’t the price, it’s whether fixing [what they just said] is worth it to you. Is it?"]],
        tip: "Ask, then stop talking. Their answer is the reason they buy." }],
    insurance: [
      { id: "price-ins", m: "Fit the coverage to the budget", steps: [["Name it", "I hear you. You want the protection, just not at a price that squeezes you."], ["Ask", "What would feel comfortable each month, honestly?"], ["Bring it back", "Let’s build it around that number. The worst plan is the one you can’t keep."]],
        tip: "Warm and calm. You’re on their side of the table." }],
    realestate: [
      { id: "price-re", m: "Net, not commission", steps: [["Name it", "Makes sense. You want to keep as much of your money as you can."], ["Ask", "What matters more to you: the lowest commission, or the most money in your pocket at closing?"], ["Bring it back", "Let me show you what you’d net with me, line by line, so you can judge on the number that counts."]],
        tip: "Confident, not defensive. Never apologize for your fee." }],
    mca: [
      { id: "price-mca", m: "Return on the money", steps: [["Name it", "I get it, nobody likes paying for money."], ["Ask", "If you had the capital this week, what would you do with it, and what would that bring in?"], ["Bring it back", "So the question is whether [what they said] brings in more than it costs. Let’s look at the real numbers together."]],
        tip: "Business owner to business owner. Short and direct." }],
    auto: [
      { id: "price-auto", m: "Payment, not price", steps: [["Name it", "Totally get it, it’s a big purchase."], ["Ask", "Is it the total, or the monthly payment that matters most to you?"], ["Bring it back", "Let’s build the numbers around a payment you’re comfortable with, then you decide."]],
        tip: "Easy and friendly. Never argue about price on the phone." }],
    solar: [
      { id: "price-sol", m: "Compare to the bill", steps: [["Name it", "Fair. It sounds like a big number."], ["Ask", "What are you paying the utility now, about how much a month?"], ["Bring it back", "You’re already paying for power every month. The consultation shows you whether owning it beats renting it from the utility, with your real numbers."]],
        tip: "Curious, not pushy. The bill makes the case for you." }],
    investments: [
      { id: "price-inv", m: "Terms, out loud", steps: [["Name it", "Good question to push on. You should know exactly what you’re paying."], ["Ask", "Is it the entry price per share or the fees you want to understand better?"], ["Bring it back", "Let me walk you through every number on the term sheet, so you can compare it to anything else you’re looking at."]],
        tip: "Transparent and unhurried. Openness is what earns the check." }]
  };
  P.money = {
    all: [
      { id: "money-a", m: "No-pressure takeaway", steps: [["Name it", "Understood, and I’m not going to push you into something that doesn’t fit."], ["Ask", "Is it that the money isn’t there right now, or that you’re not sure it’s worth it yet?"], ["Bring it back", "If it’s timing, let’s at least get you the facts now, so you’re ready the moment it makes sense."]],
        tip: "Relaxed. Taking the pressure off is what keeps them talking." },
      { id: "money-b", m: "Find the real number", steps: [["Name it", "Totally fair, money’s tight for a lot of people right now."], ["Ask", "If it fit your budget, would this be something you’d want?"], ["Isolate", "Then let’s see what fits. What could you do comfortably?"]], tip: "Gentle. Let them name the number." }],
    insurance: [
      { id: "money-ins", m: "Protect what matters first", steps: [["Name it", "I understand. When money’s tight, every dollar counts."], ["Ask", "If something happened to you tomorrow, how would your family handle [the costs they mentioned]?"], ["Bring it back", "That’s why we start small, with what protects them most, at a number you can keep."]],
        tip: "Soft and sincere. Never use fear; let them say why it matters." }],
    mca: [
      { id: "money-mca", m: "The reason they need it", steps: [["Name it", "That’s exactly why I called. When cash is tight, the right funding can give you room."], ["Ask", "What would you fix first if you had the capital this week?"], ["Bring it back", "Let’s see what you qualify for. It costs nothing to look, and you decide after."]],
        tip: "Upbeat and practical." }],
    investments: [
      { id: "money-inv", m: "Respect, then the minimum", steps: [["Name it", "I appreciate you being straight with me. Only invest money you can afford to have tied up."], ["Ask", "Is it the amount, or the timing of having it locked up?"], ["Bring it back", "Let me tell you the minimum and the timeline, and you tell me if it’s even worth a look."]],
        tip: "Respectful. The right investor feels you’re protecting them." }]
  };
  P.think = {
    all: [
      { id: "think-a", m: "Isolate and confirm", steps: [["Name it", "Of course, it’s a real decision."], ["Ask", "Usually when someone says that, there’s one part that isn’t sitting right. Which part is it for you?"], ["Isolate", "If we cleared that up right now, would you be ready to go ahead?"]],
        tip: "Curious, not pushy. Then be quiet and let them tell you." },
      { id: "think-b", m: "Summary close", steps: [["Name it", "That makes sense."], ["Recap", "Let me make sure I got it: you want [what they want], you’re worried about [their worry], and the timing is [their timing]. Did I miss anything?"], ["Ask", "So what would you need to see to feel good about it?"]],
        tip: "Use their exact words in the recap. People say yes to their own reasons." }],
    investments: [
      { id: "think-inv", m: "Give them what to think with", steps: [["Name it", "You should think about it. This is real money."], ["Ask", "What specifically do you want to think through: the company, the risk, or the timeline?"], ["Bring it back", "Let me send you exactly that, and let’s talk tomorrow once you’ve read it, so you’re thinking with the facts."]],
        tip: "Never rush an investor. Book the next call instead." }]
  };
  P.send = {
    all: [
      { id: "send-a", m: "Turn the brush-off into a meeting", steps: [["Agree", "Happy to."], ["Ask", "So I send the right thing and not a pile of paper: what’s the one thing you’d need to see to say yes?"], ["Bring it back", "Got it. I’ll send that now."]],
        close: "Let’s take 10 minutes to go over it together so you don’t have to dig through it. Tomorrow at 11, or 4?", tip: "Agree first. Fighting a brush-off ends the call." },
      { id: "send-b", m: "Find out if it's real", steps: [["Agree", "Sure, I can do that."], ["Ask", "Just so I’m not filling your inbox: if you like what you see, what would happen next on your end?"], ["Bring it back", "Then let’s set a quick time now, and if it’s not a fit after you read it, just tell me."]],
        tip: "Light and easy. You’re saving them time." }]
  };
  P.spouse = {
    all: [
      { id: "spouse-a", m: "Bring the decision-maker in", steps: [["Name it", "That makes sense. It’s a decision you make together."], ["Ask", "What do you think they’ll ask first?"], ["Bring it back", "Let’s get you both on the phone so you don’t have to relay it, and they can ask me directly."]],
        close: "Is tonight at 7 or tomorrow at 6 better for the two of you?", tip: "Respect the partnership. Never go around the spouse." },
      { id: "spouse-b", m: "Find out where they stand", steps: [["Name it", "Good, you should talk it over."], ["Ask", "Just between us: are you for it, and you want their OK, or are you on the fence yourself?"], ["Bring it back", "If you’re for it, let’s set a time when you’re both together and I’ll answer everything."]],
        tip: "If they’re on the fence, go back to their real objection." }]
  };
  P.decide = {
    all: [
      { id: "decide-a", m: "Make them the champion", steps: [["Name it", "Thanks for telling me. Who else would be part of the decision?"], ["Ask", "What would they need to see to say yes?"], ["Bring it back", "Let’s set 15 minutes with the two of you so you don’t have to sell it for me."]],
        close: "Does tomorrow morning or tomorrow afternoon work better for both of you?", tip: "Make them look good to the decision-maker." }]
  };
  P.advisor = {
    all: [
      { id: "advisor-a", m: "Make the advisor an ally", steps: [["Name it", "Good, you should have someone in your corner."], ["Ask", "What would your advisor want to see to be comfortable?"], ["Bring it back", "Let’s set a quick call with them so they hear it first-hand and can ask me anything."]],
        close: "Would tomorrow or Thursday work better for them?", tip: "Welcome the advisor. Good offers hold up to questions." }],
    investments: [
      { id: "advisor-inv", m: "Arm the advisor", steps: [["Name it", "I’d expect nothing less. A good advisor should look at this."], ["Ask", "Does your advisor usually look at private deals, or mostly public stocks?"], ["Bring it back", "I’ll send the term sheet and the risk disclosures so they have everything, and I’m happy to get on a call with them."]],
        close: "Should I set that call for tomorrow, or would later this week suit them better?", tip: "Confident. Saying 'look at the risks' builds more trust than hiding them." }]
  };
  P.already = {
    all: [
      { id: "already-a", m: "Find the gap", steps: [["Name it", "That’s great, it means you already see the value."], ["Ask", "If you could change one thing about what you have now, what would it be?"], ["Bring it back", "Then a quick side-by-side is worth 10 minutes. If yours is better, keep it and I’ll tell you so."]],
        close: "Today at 4 or tomorrow at 10?", tip: "Never knock the competition. Let them find the gap." },
      { id: "already-b", m: "Second opinion", steps: [["Name it", "Good, I’m glad you’re covered."], ["Ask", "When’s the last time someone reviewed it for you?"], ["Bring it back", "Most people never get a second opinion. Let me take a look, and if what you have is the best fit, you’ll know for sure."]], tip: "Easygoing. You’re offering a check-up, not a switch." }],
    insurance: [
      { id: "already-ins", m: "Review, not replace", steps: [["Name it", "Good, you took care of it, and that matters."], ["Ask", "Do you know when it renews, and whether the price is going up?"], ["Bring it back", "Let me run a quick comparison. If yours is better, keep it, and you’ll know it."]], tip: "Friendly and low-key." }],
    mca: [
      { id: "already-mca", m: "Renewal and the next round", steps: [["Name it", "Good, so you know how this works."], ["Ask", "How far along are you on paying it down, and is the payment working for you?"], ["Bring it back", "Depending on where you are, there may be better terms or more room. Worth a look with your statements."]], tip: "Peer to peer. They know the game." }],
    investments: [
      { id: "already-inv", m: "Diversify, not replace", steps: [["Name it", "Good, so you’re already investing."], ["Ask", "How much of what you hold is in private companies, before they go public?"], ["Bring it back", "This isn’t about replacing your advisor. It’s access to [the company] before it’s public, if it fits your plan."]], tip: "Curious about their portfolio, never critical." }]
  };
  P.later = {
    all: [
      { id: "later-a", m: "Pin down the real later", steps: [["Agree", "No problem."], ["Ask", "So I call at the right time: is it the time of day, or that you’re not ready yet?"], ["Bring it back", "Got it. I’ll put you down."]],
        close: "Tomorrow at 10, or is the afternoon better?", tip: "Book the exact time. 'Later' with no time is a no." },
      { id: "later-b", m: "30 seconds now", steps: [["Agree", "Totally understand, I’ll be quick."], ["Ask", "Give me 30 seconds on why I called, and you tell me if it’s worth a real call later. Fair?"], ["Bring it back", "[Your one-sentence reason]. Worth 10 minutes?"]], tip: "Then actually take 30 seconds. Keep the promise." }]
  };
  P.busy = {
    all: [
      { id: "busy-a", m: "Respect the time", steps: [["Agree", "I’ll be quick, I promise."], ["Ask", "I called because [your one-sentence reason]. Is that something you’d want to hear more about, yes or no?"], ["Bring it back", "Got it. When’s a better time for 10 minutes?"]],
        close: "Later today, or tomorrow morning?", tip: "Fast and friendly. Respecting their time earns the callback." },
      { id: "busy-b", m: "The pattern interrupt", steps: [["Agree", "Sounds like I caught you at a bad time."], ["Ask", "Should I hang up and call back, or give you the 20-second version right now?"]], tip: "Say it with a smile. Most people pick the 20 seconds." }]
  };
  P.what = {
    all: [
      { id: "what-a", m: "Clear reason, then a question", steps: [["Answer", "Sure. It’s {me} with {company}. I’m calling because [why you called them]."], ["Ask", "Quick question so I don’t waste your time: [one question about their situation]?"]],
        tip: "Name, company, reason, question. Under 15 seconds." }],
    insurance: [
      { id: "what-ins", m: "Clear reason, then a question", steps: [["Answer", "It’s {me} with {company}. You asked about [coverage they asked about], and I’m the one who can get you the numbers."], ["Ask", "Is that still something you’re looking at?"]], tip: "Upbeat. Remind them they reached out." }],
    realestate: [
      { id: "what-re", m: "Clear reason, then a question", steps: [["Answer", "It’s {me} with {company}. I’m calling about your home at [address]."], ["Ask", "Are you still thinking about selling, or did you decide to keep it?"]], tip: "Easy and direct." }],
    mca: [
      { id: "what-mca", m: "Clear reason, then a question", steps: [["Answer", "It’s {me} with {company}. We help businesses like yours get working capital fast."], ["Ask", "If you had extra capital this month, would you put it to work?"]], tip: "Quick, confident, owner to owner." }],
    investments: [
      { id: "what-inv", m: "Clear reason, then a question", steps: [["Answer", "It’s {me} with {company}. We give investors access to shares of private companies before they go public."], ["Ask", "Do you already invest in anything private, or mostly the stock market?"]], tip: "Calm and credible. No hype." }]
  };
  P.notint = {
    all: [
      { id: "notint-a", m: "Isolate it", steps: [["Agree", "Totally fair."], ["Ask", "So I don’t waste your time: is it the timing, or is it something you’d never look at?"], ["Bring it back", "If it’s timing, I’ll check back when it suits you. If it’s never, I’ll leave you alone."]],
        tip: "Sincere. Giving them an easy out is what makes them stay." },
      { id: "notint-b", m: "Curiosity", steps: [["Agree", "No problem, most people say that before they know why I called."], ["Ask", "Can I ask, what made you say that so fast? Have you heard from someone like us before?"], ["Bring it back", "Fair enough. I called because [your one-sentence reason]. Does that change anything?"]], tip: "Light, a little playful. Never argue." }]
  };
  P.number = {
    all: [
      { id: "number-a", m: "Honest, then one reason", steps: [["Answer", "Great question. It came from [where your list came from]."], ["Offer", "If you’d rather not hear from us, I’ll take you off right now."], ["Ask", "Before I do, can I give you the 20-second version of why I called?"]],
        tip: "Totally open. If they say take me off, do it right away." }]
  };
  P.trust = {
    all: [
      { id: "trust-a", m: "Earn trust out loud", steps: [["Name it", "Smart to ask. You should."], ["Prove it", "Look us up: {company}. I’ll text you my direct number and our details right now, and you can call me back on it."], ["Ask", "What would you need to see to feel comfortable?"]],
        close: "Once you’ve checked us out, let’s do 10 minutes. Today at 4 or tomorrow at 10?", tip: "Calm. Scammers rush; you slow down." },
      { id: "trust-b", m: "Invite the questions", steps: [["Name it", "I’d be skeptical too, there’s a lot of junk out there."], ["Ask", "What would a scam look like to you, so I can show you we’re not that?"], ["Prove it", "No money today, nothing signed on the phone. You check everything first."]], tip: "Agree with the caution. Never sound offended." }],
    investments: [
      { id: "trust-inv", m: "Due diligence welcome", steps: [["Name it", "You should ask. Anyone raising money should be checked."], ["Prove it", "Look up {company}, and ask me for the documents and disclosures. Read everything before a dollar moves."], ["Ask", "What would you want to verify first?"]], tip: "The more you invite scrutiny, the more they trust you." }]
  };
  P.credit = {
    all: [
      { id: "credit-a", m: "Shrink the problem", steps: [["Name it", "Thanks for being upfront, it helps me help you."], ["Ask", "Roughly where do you think you are, and did something specific happen?"], ["Bring it back", "Credit is one piece of the picture. The only way to know is to look."]],
        close: "Three quick questions and we’ll know where you stand. Do you want to do them now, or in 10 minutes when you’re free?", tip: "No judgment in your voice at all." }],
    mca: [
      { id: "credit-mca", m: "Revenue first", steps: [["Name it", "You’re not alone. A lot of good businesses have bumps in their credit."], ["Ask", "How are your monthly deposits running, roughly?"], ["Bring it back", "Your bank statements tell more of the story than a score. Let’s look."]], tip: "Reassuring, never promise approval." }],
    auto: [
      { id: "credit-auto", m: "Options for every situation", steps: [["Name it", "Thanks for telling me, that’s really common."], ["Ask", "Is there a payment range you’re trying to stay in?"], ["Bring it back", "We work with situations like yours every day. Let’s see what your real options are before you decide anything."]], tip: "Warm. No promises about approval or rate." }]
  };
  P.self = {
    all: [
      { id: "self-a", m: "Plan for the what-if", steps: [["Name it", "Plenty of owners start that way, and some do great."], ["Ask", "What’s your plan if it hasn’t sold in the next 30 days?"], ["Bring it back", "Let me show you what I’d do differently. If you still want to do it yourself, you’ll have a better plan."]],
        close: "20 minutes, tomorrow or Thursday?", tip: "Respect their choice. Offer a plan, not a pitch." }]
  };
  P.wait = {
    all: [
      { id: "wait-a", m: "Cost of waiting", steps: [["Name it", "I get it, timing matters."], ["Ask", "What would need to change for now to be the right time?"], ["Bring it back", "And what does waiting cost you in the meantime? Let’s look at both, and you decide."]],
        tip: "Never invent a deadline. Let them weigh it." }],
    realestate: [
      { id: "wait-re", m: "Plan now, list later", steps: [["Name it", "That’s a fair way to think about the market."], ["Ask", "If you waited, what would you be waiting to see?"], ["Bring it back", "Let’s at least get your numbers now, so when you’re ready, you’re ready on day one."]], tip: "Never predict prices or rates." }],
    solar: [
      { id: "wait-sol", m: "Know your numbers first", steps: [["Name it", "Makes sense not to rush."], ["Ask", "Is it the price of the system, or the technology you think will change?"], ["Bring it back", "The consultation is free and shows today’s real numbers, so if you wait, it’s a choice, not a guess."]], tip: "No claims about future incentives or prices." }]
  };
  P.bad = {
    all: [
      { id: "bad-a", m: "Let them vent", steps: [["Name it", "I’m sorry, that sounds frustrating."], ["Ask", "What happened, if you don’t mind me asking?"], ["Bring it back", "Thank you for telling me. Here’s what I’d do differently so that doesn’t happen: [how you handle that]."]],
        tip: "Listen fully. Don’t defend whoever burned them." }]
  };
  P.info = {
    all: [
      { id: "info-a", m: "Be the research", steps: [["Agree", "Good, you should research it."], ["Ask", "What are the two or three things you want to find out?"], ["Bring it back", "Let me answer those right now, and send you sources so you can check me."]], tip: "Helpful, never rushed." }]
  };
  P.old = {
    insurance: [
      { id: "old-ins", m: "Plans built for this", steps: [["Name it", "I hear that a lot, and it’s exactly who these plans are for."], ["Ask", "What would you want covered most: final expenses, or leaving something for family?"], ["Bring it back", "Let’s see what you qualify for. A few health questions and we’ll know."]], tip: "Patient and kind. Never promise acceptance." }],
    all: [
      { id: "old-a", m: "It's about them", steps: [["Name it", "I appreciate you saying that."], ["Ask", "What matters most to you at this point?"], ["Bring it back", "Then let’s see if this helps with that. If it doesn’t, I’ll tell you."]], tip: "Respectful and unhurried." }]
  };
  P.browse = {
    all: [
      { id: "browse-a", m: "Help them compare", steps: [["Agree", "Smart, you should compare."], ["Ask", "What are you comparing on, price, terms, or something else?"], ["Bring it back", "Let me give you my best numbers so you’re comparing real offers, not guesses."]], tip: "Be the easiest one to compare." }],
    auto: [
      { id: "browse-auto", m: "Narrow it down", steps: [["Agree", "Perfect, that’s the right way to do it."], ["Ask", "What are the two or three models on your list?"], ["Bring it back", "Come drive ours back to back with the others. Driving them is the fastest way to decide."]], tip: "Relaxed. No pressure on the phone." }]
  };
  P.payment = {
    all: [
      { id: "payment-a", m: "Build around their number", steps: [["Name it", "Understood, the payment has to work."], ["Ask", "What monthly number would feel comfortable?"], ["Bring it back", "Let’s look at what we can do around that, and you decide."]], tip: "Never promise a payment you haven’t worked out." }],
    mca: [
      { id: "payment-mca", m: "Match payments to cash flow", steps: [["Name it", "I hear you, daily payments can feel heavy."], ["Ask", "What would fit your cash flow better, weekly instead of daily, or a smaller amount?"], ["Bring it back", "Let’s look at the options with your statements, and you pick what works."]], tip: "Practical. Don't promise terms." }]
  };
  P.guarantee = {
    noAll: ["investments"],   // securities: only the answer that says plainly you can lose money
    investments: [
      { id: "guar-inv", m: "Honest about risk", steps: [["Name it", "No, and anyone who guarantees returns on a private company is someone to walk away from."], ["Explain", "You could lose some or all of it. That’s why it’s only for money you can afford to tie up."], ["Ask", "With that said, what would you want to see in the company to decide if the upside is worth it?"]],
        tip: "This honesty is your edge. Say it plainly." }],
    all: [
      { id: "guar-a", m: "Honest, then the value", steps: [["Name it", "Fair question, and I won’t promise what I can’t."], ["Ask", "What would you need to see to feel confident?"], ["Bring it back", "Let me show you exactly what you get, in writing."]], tip: "Plain and honest." }]
  };
  P.liquid = {
    noAll: ["investments"],
    investments: [
      { id: "liq-inv", m: "Clear on the lock-up", steps: [["Name it", "Important question, you should know before anything else."], ["Explain", "Private shares are usually locked up until the company goes public or is sold, and that may take years, or never happen."], ["Ask", "Is that timeline OK for this part of your money?"]], tip: "Never guess a timeline. Point to the documents." }],
    all: [
      { id: "liq-a", m: "Clear on the timeline", steps: [["Name it", "Good question."], ["Explain", "[The real terms from your documents]."], ["Ask", "Does that timeline work for you?"]], tip: "Read the real terms. Never guess." }]
  };
  P.stall = {
    all: [
      { id: "stall-a", m: "Book the next step", steps: [["Agree", "Sure, take your time."], ["Ask", "When you look it over, what are you going to look at most closely?"], ["Bring it back", "Let’s go over that part together so nothing gets missed."]],
        close: "Should I call you tomorrow at 11, or is 4 better?", tip: "Never leave without a time on the calendar." }]
  };
  P.rent = {
    all: [
      { id: "rent-a", m: "Respect the rule", steps: [["Answer", "Thanks for telling me. Only the homeowner can sign for this, so I won’t keep you."], ["Ask", "Do you know who owns the home?"]], close: "", tip: "Polite and quick. Don't pitch a renter." }]
  };
  P.roof = {
    all: [
      { id: "roof-a", m: "Turn it into the next step", steps: [["Name it", "Good to know now, it’s the first thing the site survey checks."], ["Ask", "How old is it, roughly?"], ["Bring it back", "The consultation tells you exactly where you stand with your roof before anything else."]], tip: "Helpful, never dismissive of the roof." }]
  };
  P.buy = {
    all: [
      { id: "buy-a", m: "Answer in one line, then close", steps: [["Answer", "[Answer their question in one sentence]."]], tip: "They’re ready. Stop selling and ask." },
      { id: "buy-b", m: "Confirm and close", steps: [["Confirm", "Sounds like this fits what you’re looking for. Am I reading that right?"]], tip: "Wait for the yes, then go straight to the close." }]
  };

  /* ----- The owner's own Closer's Playbook (investments floor): closes, rebuttals and raps, word for word except the
     firm's name ({company}) and the blanks ([brackets] for the rep to fill with true, compliance-approved facts).
     Each rap is one answer the win rates test against the others; rap = the whole text, said as written. ----- */
  var BOOK = "Your playbook";
  var R = function (id, m, rap, extra) { return Object.assign({ id: id, m: m, src: BOOK, rap: rap, steps: [], tip: "" }, extra || {}); };
  var RULES = [
    "Never promise or guarantee a return, percentage, or price. Sell the thesis, not an outcome.",
    "Only cite a track record you can document: {company}’s own placements, verified numbers.",
    "Every investor hears the risks: private shares are illiquid, the IPO may be delayed, may not happen, or may price lower, and they can lose the full amount.",
    "Accreditation is verified and the offering documents govern before any money moves.",
    "Never push anyone past what they can afford to lose, and never tell them to stretch.",
    "Titles, affiliations, and client names you mention must be true."
  ];
  var TITLE = "How do you usually title your accounts: individually, joint or corporate?";
  // Closes: "Ready to buy" (and after a rap) on the investments floor
  P.buy.noAll = ["investments"];
  P.buy.investments = [
    R("bk-close-2", "2nd Close", "{first}, have you ever been involved in an IPO before?\n\nIf no: Most people haven’t. The pre-IPO stage is usually reserved for institutions and insiders, and that’s exactly the access we work to open up for our clients. If yes: Then you already know the difference between getting in before the listing and paying up after it.\n\n[A {company} placement with documented entry and outcome, compliance-approved. Never cite companies we did not place.]\n\nNow, I’m not going to tell you what [company] will do. Nobody can promise that, and anyone who does isn’t someone you should trust with your money. What I can tell you is why we like it: [2-3 thesis points from the deck].\n\nSo let’s do this, because I’d rather see you own a smaller position at today’s valuation than sit on the sideline and pay whatever the public market asks later, if and when it lists. Let’s do half the position. It’s [shares] shares, a [$ amount] investment, an amount you’d be comfortable holding even if this takes longer than we expect.\n\nJust make me one promise: once you see how we operate, the communication, the transparency, the follow-through, next time out you take me a heck of a lot more seriously and we work in a size you and I are more accustomed to. But for now, I’ll put you down for the [shares] shares.\n\nNow when you title your accounts, do you do them individually, joint, corporate? How would you like to set this one up?"),
    R("bk-close-3", "3rd Close", "Had we worked together in the past, it wouldn’t even be a question whether you were getting involved here. The only question would be how many shares.\n\nNow in my seat, I have two jobs. Number one is obvious: to bring you opportunities I genuinely believe in. Number two, which is a bit tougher: to make you feel comfortable.\n\nSo in an effort to make you feel comfortable, let’s do this. Put your name on [shares] shares of [company]. It’s a cash outlay of just [$ amount]. That’s a lot less than what we just spoke about. If this plays out the way we believe, yes, you’ll make less in dollars, but the percentage is the same, and that’s how I want you to judge this account: on the quality of the opportunity and how I handle you. The biggest problem I see us having is that you didn’t know me well enough to start bigger. Fair enough?"),
    R("bk-close-4", "4th Close", "{first}, let me ask you something. How much do you currently have in the market in common stock?\n\nWhat do you do for a living?\n\nAll right, I’m sure you’ve worked very hard to get to your position, so my suggestion here is very simple. Do you know what a competitive account is? It’s when you set aside a piece of your portfolio for a different kind of opportunity, something your current broker can’t offer you, and see how it stacks up over time.\n\nPut your name on my firm’s minimum of [shares] shares of this company and measure it against everything else you own. I’m not going to promise you a number. This is a private company and there’s real risk, including that it takes longer to list, or doesn’t list at all. But if I don’t earn your trust with how this is handled, I give you my word as a businessman, you’ll never hear another pitch from me. On the flip side, when you see I do exactly what I say, next time around I expect you to step it up and work in a size I know you’re more accustomed to. With that being said, let me go to work for you on the [shares] shares."),
    R("bk-close-5", "5th Close", "Can I say this to you?\n\nI’ve opened accounts just like this one with investors just like you, starting small, and today [some of them are among our largest relationships, only if true]. It’s not because I sound good. It’s because I make sense, and I’m straight with my clients about the risk as well as the upside.\n\nBe honest with me: how would you feel if you’d been positioned in a company like this before it went public?\n\n[Optional: a {company} placement with verified results. Do not reference deals we weren’t part of.]\n\nThe only difference is you’re not one of my preferred clients yet… {first}, I have the ability and you have the opportunity to become one, and it all starts here. I’m going to put you down for [shares] shares to get started. Hold me to the standard I’m setting on this call: communication, transparency, follow-through. Do that, and you’ll be a client of mine for life.\n\nI’ll set up the account individually, in your name. I just need a few figures for the subscription documents and to confirm accreditation. Answer however you feel comfortable. What’s an estimate of your annual income?"),
    R("bk-close-6", "6th Close", "Can I ask you something?\n\nTell me it’s me, tell me you don’t like [company], but I want you to be completely honest with me… is it the fact that you don’t know me?\n\n[Let them answer.] That’s fair. You have to understand something: it takes years and years to develop a good relationship, and sometimes one or two lousy investments to screw that all up!\n\nI know first time out, if [company] disappoints and you lose money, there’s a pretty good chance our relationship is over. That’s exactly why I don’t bring things to clients lightly, and why I’m asking you to start small. Let me go to work and do what I do best. It’s only [shares] shares of [company]. I’ll set up the account in your name. What address do you want me to send the subscription agreement and offering documents to?"),
    R("bk-close-7", "7th Close", "I’m going to make a very bold statement, but I want you to hold me to it. I’m going to put you down for my firm’s minimum of [$ amount], and I want you to put me up against every other advisor and investment you have, not just on results, but on how you’re treated, how informed you are, and whether I do what I say. If I don’t measure up, you have my word: I won’t call you with another deal.\n\nBut on the flip side, when I do, I expect you to step it up next time out and never make me work this hard again just to earn your business. So for now, I’ll put you down for [shares] shares of [company]. It’s only [$ amount].\n\nAnd let’s get ready to get to work… OK?"),
    R("bk-close-8", "8th Close", "Can I say this to you? You may be asking yourself why someone like me is calling a gentleman like you over [shares] shares of stock, right?\n\nI’ll tell you why. I’ve started relationships just like this one on a small dollar amount, and [today some of them are among our most significant accounts, only if true]. It’s not because I sound good. It’s because I make sense, and I treat every client like a long-term relationship…\n\n{first}, I’ll put you down for just [shares] shares.\n\nNow when you usually title your accounts, do you take a middle initial?"),
    R("bk-close-9", "9th Close", "Listen, I don’t want you to misconstrue my enthusiasm for a pushy sale, but this is why my clients stay with me: I fight for the best entry I can get them. It may not seem like much on a small position, but on size, the price you get in at matters.\n\nAnyone you’re dealing with should be able to put $50,000 into a blue chip and earn a modest return. That’s not what I’m here to do. I’m here to give you access to something your regular account can’t: private companies before they go public, at private-market valuations. That’s a different risk profile and a different upside profile. Not overnight, but over time and with a series of well-chosen investments, that’s where I can make a real impact.\n\n{first}, if you knew me, and I mean really knew me, you’d be taking a bigger position. I’ll put you down for the [shares] shares. How would you like to set up this account? Individual, joint? What do you prefer?"),
    R("bk-close-10", "10th Close", "{first}, when you realize what I can do for you, we can start doing real business. But we’re not going to get there by me being wrong. I know that if this disappoints and you lose money, I’ll never earn another stitch of your business, so believe me, I don’t bring you anything I haven’t done the work on. I wouldn’t expect you to invest in size like my preferred clients just because I say so, but believe me when I tell you I’m going to work harder for your money than you do! Take my word on my pricing and timing on just [shares] shares of [company], and let’s get to work!", { close: TITLE })
  ];
  P.buy.investments.forEach(function (v) { if (v.close === undefined) v.close = ""; });   // each close ends on its own question
  P.trial = { investments: [
    R("bk-trial-a", "Trial close", "How do you usually title your accounts?"),
    R("bk-trial-b", "Trial close", "Putting the buying aside, does the idea make sense?"),
    R("bk-trial-c", "Trial close", "What’s holding you back?") ] };
  P.trial.investments.forEach(function (v) { v.close = ""; });
  // Rebuttals
  P.think.noAll = ["investments"];
  P.think.investments.push(
    R("bk-think", "Think About It", "I’m glad you want to think about it, {first}, because it shows me you’re really interested. Before I brought you this, my team and I did extensive work on the company: the financials, the industry, the management, the cap table, you name it. And before you send a dollar to anyone, you’ll have the full offering package on your doorstep, the PPM, the subscription agreement and the company materials, outlining everything I said in black and white, including the risks. Read it. That’s what it’s for.\n\nBut what you’re really going to judge me on, more than the paperwork, is the quality of the opportunity and how I handle you. That’s what’s going to solidify this relationship! Work with me on [shares] shares and {first}, let’s get the documents in front of you.", { close: TITLE }),
    R("bk-indecision", "Indecision", "I’ve seen more opportunities missed due to indecision than to making the wrong decision! I’d rather be a few weeks early than one second too late.", { close: TITLE }));
  var ACCT = R("bk-acct", "Speak to Accountant / Wife", "I respect that, and frankly I’d want you to. Let’s do this: I’ll send you the offering documents today, and let’s set a time for the three of us to get on the phone, you, your (accountant/wife) and me, so I can answer every question directly. Does tomorrow at [time] or [time] work better? In the meantime, [if the allocation allows] I’ll hold [shares] shares in your name so they’re there when you’re ready.", { close: "" });
  P.spouse.noAll = ["investments"]; P.spouse.investments = [ACCT];
  P.advisor.noAll = ["investments"]; P.advisor.investments.push(ACCT);
  P.bad.noAll = ["investments"];
  P.bad.investments = [R("bk-burnt", "Been Burnt", "Listen {first}, I’ve been burnt too. By plenty of doctors, plenty of lawyers, and a world full of mechanics. But you wanna know something? Today I have a family doctor, a lawyer I can trust, and a mechanic that looks to help and not hinder. And through the years, I too have learned to tell the crooks from the courageous, all through trial and error. And it’s the exact same thing! You may have to go through half a dozen, a dozen, maybe even a couple dozen guys before you find the one that consistently does right by you. And I’m telling you right now, I’m that guy!\n\nGive me the shot someone gave you one day, on just [shares] shares of [company]. Let me prove my worth to you, and let this be the stepping stone to a long-term relationship!", { close: TITLE })];
  P.realestate = { investments: [R("bk-re", "Real Estate", "Real estate’s a great investment! Plenty of the most successful investors I know combine real estate with a position in private, high-growth companies like the one I’m bringing you today. It’s a different kind of exposure, and that’s the whole point of diversifying.")] };
  P.already.noAll = ["investments"];
  P.already.investments.push(
    R("bk-broker-1", "Broker (1)", "Mr. [last name], some of my most successful clients work with more than one firm because no one firm sees everything. At {company}, we specialize in a very limited area: high-quality private growth companies on a path to going public. Having more than one source of opportunity usually means better diversification. That’s what you really want, isn’t it?", { close: TITLE }),
    R("bk-broker-2", "Broker (2)", "I’m sure your goal is to maximize your opportunities, isn’t it? Mr. [last name], the most astute investors understand that diversification is the key to success. What I’m suggesting is that for your own financial well-being, you need more perspective, and I can provide that perspective for you."),
    R("bk-local", "Local Broker Rap", "I don’t want to be your local broker. I’m not going to buy you a CD. I’m not going to handle your retirement money. This is what I do, 3 or 4 times a year: I find a private company with real upside potential that I believe is worth your attention."));
  // If the guy asks about me
  P.who = { investments: [
    R("bk-self-1", "Self #1", "I’m looking for a long-term relationship with an investor who wants access to opportunities outside the public markets. Everybody comes to you with ideas, but has anyone ever been straight with you about both the upside and the risk? I’m looking for one shot on [shares] shares, a total investment of [$ amount], an amount you can comfortably hold. I will not ask you for another dime, not another red cent, until you’ve seen how I operate on this one. But what I do ask is that when you see I do what I say, next time out we work in a size you and I are more accustomed to. Fair enough?"),
    R("bk-self-2", "Self #2", "{first}, this call is not about [company], and it’s not about the money. It’s about establishing a relationship with a firm that sources private, pre-IPO opportunities most investors never see. I’m the [actual title] at {company}, and [one true sentence about our deal access and relationships]."),
    R("bk-self-3", "Self #3", "I’m not the 900th guy on a 1,000-man team at a wire house. I’m not going to waste your time giving you 100 shares of something everybody already owns. I’m a [title] at a boutique firm focused on a small number of private placements a year, and if you’re a client of mine, I’ll take good care of you.", { close: TITLE }),
    R("bk-self-4", "Self #4", "We work on a small, select group of deals over the course of a year. We’re not a big bank making 500-600 recommendations a year. What do you think the chances are that most of those go up? The approach we take is a very methodical one. We do a tremendous amount of work on a handful of companies: the business, the management, the valuation, the path to liquidity. What we know, we know very well. We never buy haphazardly; we’re disciplined about entry price, because in private markets the valuation you buy at matters. If you hold off and hesitate, the round may close or the price may move, and I don’t want that for you."),
    R("bk-self-5", "Self #5", "Mr. [last name], if you work with me on [shares] shares of [company], you’ll be doing much more than buying a small piece of a phenomenal company. You’ll be getting someone who really cares about his clients. Believe me, I’m in early and out late working this business. This business means everything to me!\n\nUnderstand, my firm is not a wire house working on three hundred recommendations a year. We don’t claim to know everything, but what we do know, we know inside and out. I promise you, you will not find anyone more devoted to his clients than me. I do my homework! I pride myself on being smart enough to know who to listen to, but more importantly, who not to listen to."),
    R("bk-self-6", "Self #6 / Service", "A firm like ours has one commodity to offer beyond the deal itself, and that is service. I’ll handle and service your account the same way I would my own. I’ll be in touch with you as often as I need to be, and I’ll keep you updated as the company progresses: funding rounds, filings, and any news on the path to IPO. All I’m going to ask of you is that once you see how I operate, my next recommendation we pick up in a meaningful size, and maybe you send me a referral or two."),
    R("bk-self-7", "Self #7", "You don’t hire me because I read the Wall Street Journal better than you, or watch CNBC better than you. You hire me because of where I work and the private deal flow that comes across my desk, opportunities you can’t buy on an exchange!", { close: TITLE, tip: "Break-close: go straight to the close." }),
    R("bk-spectacular", "Spectacular Performance", "To get the most out of an opportunity, you must get in before the crowd. This is so obvious it’s a wonder the vast majority of investors don’t use this rule. But their crowd mentality is the very factor that creates the opportunity. The rule is simple: if you buy the same investment everybody else is buying at the same time, you get the same results as everybody else. This is why {company} is different. We focus on getting clients in at the private stage, before the public market sets the price.", { close: TITLE, note: "Any claim about our past performance must be documented and compliance-approved." }),
    R("bk-raps-1", "Raps #1", "We spend our time with the people who know these markets best: founders, operators and investors in the private space. That’s how we hear about the right companies early.", { note: "Use only if accurate. Never imply access to non-public research or inside information." }),
    R("bk-raps-2", "Raps #2", "The key to my success is simple. I don’t dibble, I don’t dabble. I don’t buy a little of this and a little of that hoping to come across a small profit. I am very selective about what I bring my clients, but when I find something I truly believe in, I commit to it. When you hunt for opportunities as tenaciously as I do, the right ones naturally come your way."),
    R("bk-key", "Key", "The key to making money in these types of situations:\n- Get positioned before the institutions and the IPO\n- Follow the trends (very closely)\n- Most importantly! I’d rather be a few days early than even one second too late!"),
    R("bk-raps-3", "Raps #3", "There’s no shortage of decent ideas in the public market. But I’m devoted to building a position in [company] because I believe the upside from today’s private valuation is significant, and I’ll walk you through exactly why, and exactly what the risks are."),
    R("bk-raps-4", "Raps #4", "{first}, you are currently in the market, correct? Understand something: we’re not a Goldman Sachs or a Merrill Lynch or some wire house making a thousand recommendations a year and calling you up with the stock pick of the day. We only get involved in 4 or 5 special situations a year. What I’d like to do is call you with my next recommendation. If you like it, maybe we’ll go on a small amount. If not, we’ll part as friends. Fair enough?") ] };
  P.trust.noAll = ["investments"];
  P.trust.investments.push(P.who.investments[1], P.who.investments[2]);
  P.conservative = { investments: [R("bk-conservative", "Conservative", "Let me ask you a question. You sound like a conservative guy, correct? Well, I’m conservative and very cautious as well. And I can assure you that I will never come to you with a situation and rant and rave about your upside potential without addressing your downside risk, because whether it’s 100 shares or 100,000 shares, bottom line… it’s your hard-earned money we’re talking about!\n\nHypothetically, let’s say I put you in [shares] shares and this doesn’t work out: the company stalls, the IPO is delayed or never happens, and you lose the [$ amount]. Is that going to make you a poor man? It shouldn’t, and if it would, this isn’t the right size for you and I’d rather you tell me now.\n\nOn the flip side, if the company executes and goes public the way we believe it can, it’s not going to make you rich overnight either. But what it will do is put a feather in my cap and show you the kind of access I can bring you. I’m telling you {first}, take the [shares] shares. I will not let you down on how this is handled.", { close: TITLE })] };
  P.send.noAll = ["investments"];
  P.send.investments = [R("bk-send", "Self (Send Information)", "You have to understand: you’ll receive the full offering package, the PPM, the subscription agreement and the company materials, outlining everything I told you in black and white, including the risks. Read it all. But what you’re really going to judge me on, beyond the paperwork, is the quality of the opportunity and how I handle you. This is the first time we’re working together, that’s why I’m suggesting we start so small. Let’s position ourselves with [shares] shares of [company] and let the relationship speak for itself!", { close: TITLE })];
  P.info.noAll = ["investments"];
  P.info.investments = [R("bk-look", "Self (I Want to Look at It)", "{first}, you want to look at it? Good, you should. Want to know what I’m looking at? [Real, verifiable facts from the deck: latest funding round, named lead investors if disclosed, revenue traction, valuation vs. comparables.] That’s why I’m being so persistent.\n\nAs opposed to playing phone tag while the allocation fills, let me reserve [shares] shares of [company] at [price] for you while you review the documents.")];
  P.watch = { investments: [R("bk-watch", "Watching Stock", "Let me say this. Watching a company go from [price] to [price] from the sidelines is a worthless academic exercise. Nobody makes money watching. {first}, we both know the only thing that will establish a track record between us is a position at [price], and more importantly, how it plays out.", { close: TITLE })] };
  P.phone = { investments: [R("bk-phone", "Self (Don’t Do Business Over the Phone)", "If I brought you an opportunity and you liked it after reading the documents, would you care whether it first came to you over the phone or any other way? Of course you wouldn’t! And nothing gets signed over the phone. You’ll have every document in front of you before a dollar moves.\n\nWorld leaders solve wars over the phone.", { close: TITLE })] };
  P.notint.noAll = ["investments"];
  P.notint.investments = [R("bk-no", "You Don’t Listen / No / Persistence", "If I took every first NO as final, there’d be no point in me even coming to work, because I’d be out of business. I’m here to bring you something worthwhile. I’ve done my due diligence on [company], and I’m MORE than confident in this company. Give me the shot and let me show you what I can do.", { close: TITLE, tip: "A clear no or “take me off your list” ends it: thank them and stop." })];
  // Illiquid raps
  var NL = [
    R("bk-liquid-1", "Not Liquid #1", "I hear you, and I respect that. Private shares are illiquid, your money can be tied up for years, so this should only ever be money you won’t need. Let’s right-size it. Instead of [shares] shares, what would you be comfortable putting away and not touching? Let’s start there."),
    R("bk-liquid-2", "Not Liquid #2", "Mr. [last name], liquidity is a relative concept. If an individual is usually liquid for $100K but now only has $10K, he doesn’t feel liquid. If he’s usually liquid for $1 million but today has $100K, he doesn’t feel liquid either. I get it. So let’s not stretch. Let’s find the number that fits where you are today, and when your liquidity comes back, we’ll talk about adding."),
    R("bk-liquid-3", "No Liquidity #3", "I work with a broad group of investors [professions, only if true]. What they have in common is they make decisions quickly when the opportunity is right, because they’ve done the homework and they know the allocation won’t wait.\n\nBut I never want a client stretching for a trade. So tell me honestly: what’s the amount you could put into this today without touching money you need? Let’s build around that number.") ];
  P.liquid.investments = P.liquid.investments.concat(NL);
  P.money.noAll = ["investments"]; P.money.investments = P.money.investments.concat(NL);
  // Call back raps
  var CB = [
    R("bk-cb-1", "Call Back #1", "Sir, I can give you my office number, my cell, my email, but you’re not going to call me back. You’re a busy man. You’re going to put the idea in the back of your mind and forget all about me and [company]. Not because you want to, because you have to. You’re hiring me as a professional. I watch your money like a hawk. Give me one shot on my pricing and timing. Don’t let this relationship die before it begins. Own the [company] at this level, and in a few months we’ll look back at this conversation and you’ll see exactly how I operate. Give me one shot."),
    R("bk-cb-2", "Call Back #2", "You know what, sir? Your worst nightmare is a rookie who brings you a good situation and is willing to play phone tag and mail tag with you. We don’t have time for it. The reason my clients work with me is my pricing and timing. Without those two tools, you’re tying my hands behind my back. I might as well be an order taker at Charles Schwab making 60 grand a year. If I was coming to you with a mutual fund, which is a long-term hold, I’d mail you packets of information, because obviously there’s no big rush. But when you position yourself in a situation like this, the most important factor is pricing and timing.", { close: TITLE, tip: "Then close, or keep the straight line." }),
    R("bk-cb-3", "Call Back #3", "{first}, I’ll be straight with you: if you hang up this phone, odds are we never get to this. Believe me, I know you didn’t wake up this morning planning to open another account. But if you knew this could be the start of a real relationship with a firm that brings you private opportunities you can’t get anywhere else, you’d take all of 60 seconds to open it. [Only if true:] This allocation is filling, with or without you, with or without me. Mr. [last name], I am not going to let you miss this one…", { close: TITLE }),
    R("bk-cb-4", "Call Back #4", "Your worst nightmare is a rookie willing to play phone tag with you over a couple hundred shares. Thank God for your sake, I’m not that guy. I’m in my office 12 hours a day talking with the people who know these companies, and that’s how I find what I bring my clients. The reason my clients work with me is my pricing and timing. Without those two tools, you’re tying my hands behind my back. I might as well be an order taker at Charles Schwab making 60 grand a year. But when you position yourself in a situation like this, the most important factor is pricing and timing. So work with me on the [shares] shares, and I give you my word, I’m going to show you a level of professionalism and an approach to this market like you’ve never seen before.", { close: TITLE }) ];
  P.later.noAll = ["investments"]; P.later.investments = CB.slice();
  P.stall.noAll = ["investments"]; P.stall.investments = CB.slice();
  P.notwork = { investments: [R("bk-notwork", "Don’t Think It’s Going to Work Out", "I respect your view. Let me ask you, what specifically do you think won’t work? [Listen.] I work this market 80 hours a week, and I wouldn’t have the audacity to bring you a company I haven’t done my due diligence on. Let me address that concern directly, and if the documents don’t answer it, don’t invest.")] };
  P.market = { investments: [
    R("bk-market", "Market Down / Volatility", "I agree with you, but I’m not asking you to buy the whole market. I’m asking you to invest in [company], a private company whose value is driven by its own execution, not the daily swings of the index. To be clear, it’s not immune; private valuations and IPO timing are affected by the market too. But when this company is ready to come public, I want you positioned at today’s valuation."),
    R("bk-private", "Private Markets Bullet", "More companies are staying private longer than ever, which means more of the growth happens before the IPO. Some of the largest names in asset management have been pointing investors toward private markets for exactly that reason. [Cite a specific, current source before using.]\n\nBy getting involved with private companies on a path to an IPO, you’re positioned at private-market valuations for when the window opens, while the average investor is buying after the pop. It’s not a hedge; private shares carry their own risk and are illiquid. But it’s access most investors never get.", { note: "Don’t attribute advice or endorsements to a named firm unless you can source it." }),
    R("bk-dynamics", "Buying Dynamics", "Now, one of the things I track closely is where institutional capital is going. What I’ve seen is a major shift of capital from the public markets into the private sector [cite current data]. That tells me the smart money is getting positioned as we speak.") ] };
  IDEAS.push(
    ["who", /\bwho are you( with)?\b|\btell me (a little |more )?about (you|yourself|your (firm|company))\b|\bwhy should i (trust|listen to|work with|invest with) you\b|\bwhat makes you (different|special)\b|\bwho do you work for\b|\bhow long have you been doing this\b/],
    ["realestate", /\b(i|we) (invest|put (my|our) money) in real estate\b|\b(i'?m|i am) (a |into )?real estate (investor|guy)?\b|\bi (own|buy) (rental|rentals|properties)\b|\bi prefer real estate\b/],
    ["conservative", /\b(i'?m|i am) (very |pretty )?(conservative|cautious|risk averse)\b|\btoo risky\b|\bsounds risky\b|\bseems risky\b/],
    ["watch", /\b(watch|track|follow|keep an eye on) (it|this|the (stock|company|deal))\b|\bsee how it (does|goes|plays out)\b/],
    ["phone", /\b(don'?t|do not|never) (do business|invest|buy (anything|stocks?)) (over|on) the phone\b|\bnot over the phone\b/],
    ["notwork", /\b(don'?t|do not) think (it'?s|it is|this is|that'?s) going to work\b|\bit won'?t work( out)?\b|\bnot going to make it\b/],
    ["market", /\bthe market('?s| is) (down|bad|crashing|volatile|shaky|too high)\b|\bvolatility\b|\brecession\b|\bbad time to (invest|buy)\b/]);
  LABEL.who = "Tell me about yourself."; LABEL.realestate = "I invest in real estate."; LABEL.conservative = "I'm conservative."; LABEL.watch = "I'll watch it for a while.";
  LABEL.phone = "I don't do business over the phone."; LABEL.notwork = "I don't think it's going to work out."; LABEL.market = "The market's down."; LABEL.trial = "Trial close";

  /* ----- More answers: the four new objections, and a second answer where a floor had only one (the win rates pick). ----- */
  var SELF7 = P.who.investments.filter(function (v) { return v.id === "bk-self-7"; })[0];
  var LOCAL = P.already.investments.filter(function (v) { return v.id === "bk-local"; })[0];
  var RAPS3 = P.who.investments.filter(function (v) { return v.id === "bk-raps-3"; })[0];
  var BROKER1 = P.already.investments.filter(function (v) { return v.id === "bk-broker-1"; })[0];
  var CLOSE3 = P.buy.investments.filter(function (v) { return v.id === "bk-close-3"; })[0];
  P.accredited = { noAll: ["investments"], investments: [
    { id: "accr-inv", m: "Respect the rule", steps: [["Answer", "Good question. These offerings are only for accredited investors, and that’s verified before any money moves."], ["Explain", "[In plain words, the income or net-worth test from the offering documents.]"], ["Ask", "Based on that, would you say you qualify?"]],
      close: "", tip: "If they don’t qualify, thank them and stop. Never help anyone around the rule." } ],
    all: [{ id: "accr-a", m: "Respect the rule", steps: [["Answer", "Good question. [What the rule is, from your documents.]"], ["Ask", "Based on that, would you say you qualify?"]], close: "", tip: "If they don’t qualify, stop there." }] };
  P.diy = { noAll: ["investments"], investments: [SELF7, LOCAL, RAPS3,
    { id: "diy-inv", m: "The one thing an app can’t do", steps: [["Name it", "Love that, you’re hands-on with your money."], ["Ask", "What do you mostly trade, public stocks?"], ["Bring it back", "Then you know the gap: you can’t buy a private company on an app before it lists. That’s the one thing I bring you."]], tip: "Respect their skill. You're adding access, not replacing them." } ],
    all: [{ id: "diy-a", m: "Add, don’t replace", steps: [["Name it", "Good, you like to stay in control."], ["Ask", "What’s the one thing you can’t do on your own today?"], ["Bring it back", "That’s exactly where I come in."]], tip: "Curious, never condescending." }] };
  P.elsewhere = { noAll: ["investments"], investments: [
    R("bk-else", "Diversify (your Real Estate rap)", "[What they own]’s a great investment! Plenty of the most successful investors I know combine it with a position in private, high-growth companies like the one I’m bringing you today. It’s a different kind of exposure, and that’s the whole point of diversifying."),
    BROKER1 ],
    all: [{ id: "else-a", m: "Diversify", steps: [["Name it", "Good, you’re already putting money to work."], ["Ask", "How much of it moves the same way when the market turns?"], ["Bring it back", "This is a different kind of exposure. That’s the point of diversifying."]], tip: "Agree first, then add." }] };
  P.size = { noAll: ["investments"], investments: [CLOSE3, NL[0],
    { id: "size-inv", m: "Right-size, then close", steps: [["Agree", "Absolutely, start where you’re comfortable."], ["Ask", "What amount would you be comfortable holding even if this takes longer than we expect?"]],
      close: "Let’s put you down for that. When you title your accounts, do you do them individually, joint or corporate?", tip: "They're sizing the order: this is a buying signal. Lock the number." } ],
    all: [{ id: "size-a", m: "Start where they’re comfortable", steps: [["Agree", "Of course, let’s start where you’re comfortable."], ["Ask", "What number works for you?"]], tip: "This is a buying signal. Get the number, then close." }] };
  // a second answer where the owner's floor had only one
  P.notint.investments.push({ id: "notint-inv", m: "Curiosity", steps: [["Agree", "Totally fair, most people say that before they know why I called."], ["Ask", "Is it private investments in general, or just the timing today?"], ["Bring it back", "If it’s timing, give me 60 seconds on why I called and you tell me if it’s worth a real look. Fair?"]], tip: "Easy and light. A clear no, you thank them and stop." });
  P.send.investments.push({ id: "send-inv", m: "Documents plus a time", steps: [["Agree", "Absolutely. I’ll send the deck and the key terms right now."], ["Ask", "So you know what to look for: is it the company, the terms or the risk you’d read first?"]], close: "Let’s take 15 minutes to go through it together so nothing gets missed. Tomorrow morning or tomorrow afternoon?", tip: "Never send without a time on the calendar." });
  P.bad.investments.push({ id: "bad-inv", m: "Let them vent, then show the difference", steps: [["Name it", "I’m sorry, that sounds like it really cost you."], ["Ask", "What happened, if you don’t mind me asking?"], ["Bring it back", "Here’s what’s different with me: you get every document and every risk in writing before a dollar moves, and we start small so you can judge how I operate."]], tip: "Listen all the way. Never defend whoever burned them." });
  P.info.investments.push({ id: "info-inv", m: "Be the research", steps: [["Agree", "Good, you should look at it."], ["Ask", "What are the two or three things you want to find out?"], ["Bring it back", "Let me answer those now and send you the documents so you can check every word."]], tip: "Make research easy, then book the follow-up." });
  P.watch.investments.push({ id: "watch-inv", m: "Private price vs public price", steps: [["Name it", "Makes sense to want to see it first."], ["Ask", "If it does list, would you rather own it at today’s private valuation or buy it at whatever the public market asks?"], ["Bring it back", "No promises on what it does, but watching is the one way that guarantees you’re not in it. Let’s start small."]], tip: "No predictions. Contrast the two choices and let them pick." });
  P.phone.investments.push({ id: "phone-inv", m: "Documents first", steps: [["Agree", "I respect that, and nothing gets signed over the phone."], ["Ask", "If the documents check out when you read them, would you care how it first reached you?"], ["Bring it back", "Then let’s get the documents in front of you today."]], tip: "Calm. The paperwork is your proof." });
  P.notwork.investments.push({ id: "notwork-inv", m: "Find the doubt", steps: [["Name it", "Fair, you should be skeptical."], ["Ask", "What’s the part you don’t see working?"], ["Bring it back", "Let me show you exactly what we looked at on that, and if it doesn’t answer it, don’t invest."]], tip: "Ask, then listen. Their doubt is your agenda." });
  P.conservative.investments.push(NL[0]);
  P.realestate.investments.push(BROKER1);
  LABEL.accredited = "Do I have to be accredited?"; LABEL.diy = "I do my own investing."; LABEL.elsewhere = "My money's in crypto / gold / bonds."; LABEL.size = "Can I start smaller?";

  /* ----- More ways people say it. Calls don't sound the same: these widen what Copilot hears for each objection (the
     lead's words as the phone's speech recognition writes them: lowercase, no punctuation, apostrophes sometimes
     dropped). Checked against tests/data/copilot_phrases.json, including everyday talk that must match nothing. ----- */
  var MORE = {
    notint: /\b(i'?m|we'?re|i am|we are) (good|fine|okay|ok|all set|set)( thanks| thank you| here)?\b(?! (with|to|for|at|on))|\bno (i'?m|we'?re) (good|fine|okay|ok)\b|\bnah\b|\b(i'?ll|i will|gonna|going to) pass\b|\bhard pass\b|\bpass on (that|it|this)\b|\b(we|i) (don'?t|do not) need (anything|it|that|this)\b|\b(isn'?t|is not|not) (something|anything) i'?d\b|\bnot (my thing|looking for anything|buying anything)\b|\b(i'?m|i am) not (looking|buying|in the market)\b|\bwe'?re not (looking|interested|buying)\b|\bi (don'?t|do not) think so\b|\b(don'?t|do not) want to (invest|buy|do (it|that|this|anything))\b|\bnot (into|interested in) (that|this|it|those|stuff|anything)\b|\bnot for us\b|\bnope\b|\b(we|i) (don'?t|do not) do (that|this|those|stuff like that|that kind of thing|things like that)\b|\b(not|never) going to do (that|this|it)\b|\bnot (doing|going to do) (that|this|it)\b|\bbut no\b|\b(say|saying) no\b|\bnot something (i'?m|we'?re|i am|we are) interested\b/,
    price: /\b(that'?s|thats|it'?s|its) (a lot|steep|pricey|expensive|too much)\b|\b(do|go) (better|lower) on (the )?price\b|\bprice range\b|\btoo rich for\b|\bpricey\b|\bsteep\b|\boverpriced\b|\bthe (minimum|min|valuation|buy ?in) is (too )?(high|steep|a lot)\b|\b(seems|sounds|looks|is|that'?s|it'?s) (a bit |kind of |really |way |too |pretty )?(expensive|steep|pricey|high)\b|\bfees? (are|is|sound|seem|look)s? (high|steep|a lot|crazy)\b|\b(lower|drop|cut|reduce) the (minimum|price|fees?|min)\b|\b(what are|what'?s|how much (are|is)) (your|the) (fees?|commission|cut|markup|spread)\b|\bhow (do|does) (you|your firm|your company) (get paid|make (your )?money)\b|\bhow much do you (guys )?(charge|make)\b|\bovervalued\b|\bvaluation('?s| is) (too |way too )?(high|crazy|rich)\b|\bprice per share is (too |way too )?(high|steep)\b|\b(big|huge) number\b|\blot of money\b/,
    money: /\b(i'?m|we'?re) broke\b|\bnot in (the|my|our) budget\b|\bbills to pay\b|\b(no|don'?t have (any)?) extra (cash|money)\b|\bbudget'?s? (is )?tight\b|\bfixed income\b|\b(don'?t|do not) have that (kind of )?(money|cash)\b|\bfunds are (low|tight)\b|\bmoney is tight\b|\b(just )?(don'?t|do not) have it( right now)?\b|\bnot in (a|the) position\b|\bjust bought a (house|home|car|boat)\b|\bkids in college\b|\btuition\b|\btapped out\b|\bowe (the irs|taxes)\b|\btax bill\b|\bpaycheck to paycheck\b|\bmoney'?s? (is )?(a little |kind of |pretty |really )?tight\b|\bstretched (thin|right now)\b|\b(don'?t|do not) have (the |any |that |enough )?(extra |spare )?(money|cash|funds)\b|\bthings are (really |pretty |very |so )?tight\b|\btight (for us|right now|this year|for me|these days)\b|\b(can'?t|cannot) (swing|do|afford) (it|that|this)( right now)?\b|\blying around\b|\bstrapped\b/,
    send: /\bsend (me )?(the |some )?(info|information|details|link|deck|stuff)\b|\bshoot me an? (email|text)\b|\btext me (the|some|it)\b|\bput it in writing\b|\bsend me a link\b|\b(do you have|what'?s) (a|your) website\b|\bemail me\b|\bemail (that|it|this)( over)?( to me)?\b|\bmail (it|that|this) to me\b|\bliterature\b|\b(something|anything) in writing\b|\bsend (it )?(over|me) (some |the |a little |any )?(info|information|details|stuff|something|materials?)\b/,
    advisor: /\b(money|wealth|portfolio) manager\b|\bmy (guy|broker|planner) (handles|does|takes care of)\b|\b(have|let|show (it|this|that) to|ask|check with) my (financial |money |investment |tax )?(guy|person|advisor|adviser|planner|accountant|cpa|attorney|lawyer)\b|\bmy (financial|money|investment|tax) guy\b|\bmy (accountant|cpa|advisor|adviser|attorney|lawyer) (would|has to|needs to|will)\b/,
    already: /\b(i|we) (already )?(work with|use|have|got) (someone|somebody|another (company|firm|broker|guy)|a guy)( already)?\b|\b(i'?ve|we'?ve) got a guy\b|\b(i'?m|we'?re) (with|at) (merrill|schwab|fidelity|vanguard|morgan stanley|edward jones|ameriprise|wells fargo|ubs|a broker)\b|\b(i'?m|we'?re) already (invested|covered|in|set up)\b|\bmy broker (takes care|handles)\b|\b(same|my) (broker|advisor|adviser|guy|agent|planner) for (\w+ )?(years|ever|a long time|decades)\b|\bcovered (through|by|at) (work|my job|my employer|the union)\b|\bthrough my (job|work|employer)\b|\bloyal to my\b|\balready have (a |an |my |the )?(policy|loan|line of credit|agent|realtor|lender|advisor|adviser|broker|guy|planner|financial advisor|someone|insurance|coverage)\b|\bi'?ve got (a|an) (financial )?(advisor|adviser|broker|planner|agent)( already)?\b|\b(broker|advisor|adviser|guy|planner|agent) (i'?m|we'?re) (happy|good|fine|comfortable) with\b|\bhappy with (my|our) (broker|advisor|adviser|guy|planner|agent)\b|\b(i|we) already (work|deal) with (an?|my|our|someone)\b|\balready (working|dealing) with\b/,
    later: /\btry me (later|tomorrow|next week|another time|back)\b|\bcan you call (me )?back\b|\breach out (in|next|later)\b|\bnow (isn'?t|is not|is not a|isn'?t a) (good|great)\b|\bnot right now\b|\bcatch me (another|later|some other)\b|\bcall (me )?(back )?in an? (hour|bit|few)\b|\bbad time\b|\b(isn'?t|is not|not) a (good|great) time\b|\b(about to|have to|got to) (walk into|go into|jump on|hop on|get on) (a )?(meeting|call|plane|flight)\b|\bi'?m (at|in) (the )?(doctor|dentist|hospital|gym|store|airport|church|lunch|dinner|a meeting|a funeral|work)\b|\bi'?m (eating|having) (dinner|lunch|breakfast)\b|\bcall (me )?(back )?(after|before|around) \w+\b|\bcan we (talk|chat|do this|speak) (tomorrow|later|another time|next week|monday|tuesday|wednesday|thursday|friday)\b|\b(can'?t|cannot) (talk|speak|do this)( right)?( now)?\b|\bnow'?s not (good|a good time|great)\b|\bwith a (customer|client|patient)\b|\bon the road\b/,
    number: /\bwhere'?d you get (my|this)\b|\bhow (do|did) you (have|get|find) (this|my|me)\b|\bhow'?d you (get|find)\b|\bwhy are you calling (me|here)\b|\bwho told you to call\b|\bwhere are you getting my (name|number|info|information)\b|\bdid i sign up for\b|\bhow did you get my (information|info|details|email)\b|\bhow (did|do|'?d) you (guys |people |all )?(get|find|have) (my|this|me)\b|\bget a ?hold of me\b|\bwhere did you (find|get) my\b/,
    trust: /\bhow do i know (you'?re|you are|this is) (real|legit|legitimate)\b|\b(you guys|you'?re|you are) (are )?crooks\b|\b(sounds|seems) (shady|fishy|sketchy|like a scam)\b|\bwhat'?s the catch\b|\b(are|is) (you|he) (even )?licensed\b|\bpump and dump\b|\bfinra\b|\bsec (registered|license)\b|\b(you'?re|you are) (just )?(a )?(salesman|salesperson|telemarketer|sales guy|cold caller)\b|\btrying to sell me\b|\bi (don'?t|do not) know (you|who you are|your (firm|company))\b|\bhow do i know (i can|to) trust\b|\b(are you|is your firm|is the company|is this) (registered|licensed|legit|real)\b|\bi (don'?t|do not) believe you\b|\bi (don'?t|do not) trust (brokers|salesmen|you guys)\b|\bi (don'?t|do not) know (anything|much|a thing) about (your|you|this|the) (company|firm|guys)\b|\b(you )?(sound|sounds) like (a |an )?(telemarketer|salesman|scammer|robot|cold caller|scam)\b|\bpeople i (don'?t|do not) know\b|\bis (this|it|that|your (firm|company)|the company) (even |really |actually )?(legit|legitimate|real|a real company)\b|\bis (this|it) a scam\b/,
    think: /\bthink (it|this|that) over\b|\bgive me (a few|some|a couple( of)?) (days|time|weeks)\b|\bmull (it|this) over\b|\b(i'?m|i am) not (so |too )?sure\b|\bon the fence\b|\bi (don'?t|do not) know about (this|that|it)\b|\b(need to |let me )?process (it|this)\b|\bweigh (it|my options)\b|\b(have to|need to|want to|got to|let me|i'?ll|i will|going to) think\b|\bstill thinking\b|\bundecided\b|\bchew on (it|this|that)\b|\b(can'?t|cannot) decide\b|\bgive me (a|one|two|a couple( of)?) (day|days|week|weeks)\b|\bneed (a|a couple|a few|some) (more )?(days|weeks|time)\b/,
    busy: /\b(i|i'?ve) (got|have) (two|2|a couple|five|5|one|1) (minutes|seconds|minute|second)\b|\bcaught me at a bad time\b|\b(don'?t|do not) have time\b|\brunning out the door\b|\bon my way out\b|\b(kind of|pretty|super|so|very|really) (busy|slammed|swamped)\b|\b(you'?ve got|you have|you got) (thirty|30|ten|10|sixty|60|two|2|one|1|five|5) (seconds|minutes|minute|second)\b|\bbusy\b|\bquickly what\b|\bmake it (fast|quick|snappy)\b|\b(you'?ve got|you have|you got|i'?ve got|i have|i got) (like |maybe |about |only |just )?(30|ten|10|sixty|60|two|2|one|1|five|5|a few|a couple of) (seconds|minutes|minute|second)\b/,
    what: /\bwhat do you want\b|\bwho'?s (calling|this)\b|\bwhat'?s this for\b|\bwhat is this\b(?! (company|stock|deal))|\bwhat'?s this\b(?! (company|stock|deal))|\bwhat (are you|is this|'?s this) (calling|call) about\b|\bwhat are you calling about\b|\bwho am i (speaking|talking) (with|to)\b|\bwhat are you trying to sell\b/,
    who: /\bwhat'?s your (background|track record|experience|title)\b|\bwhat firm (is this|are you)\b|\bwho do you work (for|with)\b|\btell me about your (company|firm|track record)\b|\bwhat'?s your (name and )?(firm|company)\b|\bwhere are you (located|based|calling from)\b|\bhow (big|large|old) is your (firm|company)\b|\b(are you|you'?re) a (broker|licensed broker|financial advisor|rep)\b|\bwhy should i (do business|work|invest|deal) with you\b|\bwhat makes your (firm|company) (special|different)\b|\bhow long has your (firm|company) been\b|\bwhat have you done for\b|\bwho do you (represent|work for)\b|\bwhat company did you say\b|\b(company|firm) (are you|you'?re) with\b|\bhow long have you been (a broker|doing this|in (this|the) business)\b/,
    wait: /\bmaybe next (year|quarter|month)\b|\bnot until (the )?(new year|next year|spring|summer|fall)\b|\brevisit (in|this|it)\b|\b(the )?timing (isn'?t|is not) right\b|\bhold off\b|\bwait (until|till) (things|the market|it) (settle|calm)|\brather wait\b|\bwait (till|until|til) next\b|\bwait (a while|a bit|on it)\b|\bin the (spring|summer|fall|new year)\b|\bafter the (first of the year|holidays|new year|election|summer)\b|\bafter tax (season|time)\b|\bnot this (year|quarter|month)\b|\bcircle back\b|\bafter my (cds?|bonus|stock|house|money) (mature|matures|comes|vests|sells|closes)\b|\bwhen my (bonus|cds?|money) (comes|matures|frees up)\b|\bnext (quarter|year)\b|\bwait (till|until|til) (spring|summer|fall|winter|next|after|the new year|january|february|march|april)\b/,
    bad: /\blost (money|my shirt|my ass|everything|a lot)\b|\b(the last|my last|last) (guy|broker|company|time) (screwed|burned|ripped|lost|took)\b|\bripped off\b|\bgot (taken|screwed|burned|scammed)\b|\blost (a bunch of|a ton of|some|all|all my|my|a lot of) (money|savings|shirt|investment)\b|\blost it all\b|\b(i|my|we) .{0,30}(tanked|went (under|bust|to zero|belly up)|never went public)\b|\b(was|got|been) scammed\b|\b(burned|burnt|screwed) by\b/,
    info: /\b(do|need to do|want to do) (my|some|more) (research|homework|due diligence)\b|\blook (into|at) it\b|\bgoogle (it|you|this)\b|\b(see|look at) the (numbers|financials|deck|documents)( first)?\b|\bmore information\b|\blook into (it|your|the|this|that)\b|\b(look at|look into|research|read up on|check out|look up) (the |this |that |their )?(company|firm|deal|financials|numbers|prospectus|documents|docs|offering)\b|\bsee the (prospectus|offering|financials|documents|docs)\b|\bread the (documents|docs|prospectus|ppm|offering)( first)?\b|\bdue diligence\b/,
    liquid: /\b(i'?m|i am) not liquid\b|\bmoney'?s? (is )?(all )?tied up\b|\bcan'?t touch (that|my) money\b|\bneed access to (my )?(money|cash)\b|\b(all|it'?s all|everything'?s?) (is )?(in|tied up in) (my )?(401 ?k|four oh one k|ira|real estate|the house|cds?|stocks)\b|\b(don'?t|do not) have (cash|money) available\b|\b(everything|it) is tied up\b|\bnot (very |that |too |super )?liquid\b|\b(all|most|everything) (of )?my (money|cash|savings)( is)? (in|tied up in) (the )?(market|stocks|real estate|cds?|my (401k|ira|retirement|house|business))\b|\bfully invested\b|\bmy cash is (all )?in\b|\b(locked|tied) up in (my )?(retirement|401k|ira|real estate|the market|cds?)\b|\bliquid cash\b|\bmoney (to be |needs to be )?accessible\b|\bhow long (would|will|is) (my|the) money (be )?(tied|locked)\b|\bwhen (could|can|would) i (sell|cash out|get out)\b|\bget out early\b|\bhow long until i (see|get) my money\b|\btied up in (the |my )?(business|house|market|property|stocks)\b|\bcash (free|available|on hand)\b/,
    guarantee: /\bwhat'?s (the|my) (risk|downside)\b|\bwhat if (they|it) (don'?t|doesn'?t|never) (go public|ipo|list)\b|\bcan you guarantee\b|\bwhat happens if (it|they) (doesn'?t|don'?t|fails|never)\b|\blose (all|everything|it all|my (money|investment|shirt))\b|\bwhat'?s the guarantee\b|\bhow safe\b|\bis (my money|it) safe\b|\bwhat are the risks\b|\bwhat if (the ipo|it|they) (gets delayed|is delayed|never lists|doesn'?t list|never happens)\b|\blose everything\b|\bany protection\b|\bworst case\b|\bdownside\b/,
    stall: /\bi'?ll reach out\b|\b(i'?ll|we'?ll) be in touch\b|\bgive me your (number|info|card) and i'?ll\b|\b(let me|i'?ll|i will|i can) call you back\b|\bleave me your (number|info|contact)\b|\bif i'?m interested i'?ll (call|reach)\b|\bcall you (if|when)\b|\bgive you a (call|ring|shout)( back)?\b|\bcall you back\b|\breach out to you\b/,
    conservative: /\bi (don'?t|do not) gamble\b|\bplay it safe\b|\b(only|just) do safe\b|\bi like (bonds|cds|safe)\b|\b(too |that'?s |sounds |it'?s )?speculative\b|\b(very |pretty )?cautious investor\b|\b(a |very |pretty )?conservative (investor|guy|person|with my money)\b|\b(don'?t|do not) like (risk|taking risks|risky)\b|\bblue chips?\b|\b(like|sounds like|that'?s|it'?s) gambling\b|\bconservative (with|about) my\b|\bconservative guy\b|\b(cautious|careful|conservative) (guy|person|investor|type)\b|\b(i'?m|i am) (a )?(pretty |very |really )?(cautious|careful)\b|\btoo much risk\b|\bnot a risk taker\b|\btake (chances|risks) with my money\b/,
    watch: /\b(wait|until|till) (it|they) (go|goes) public\b|\b(buy|get in|invest) (it |in )?(after|when) (the ipo|it lists|it goes public|it'?s public)\b|\bsee how it (performs|does)\b|\bwhen it lists\b|\b(wait|waiting) for (the )?ipo\b|\b(once|after|when) it'?s public\b|\bsee where it goes\b|\btrack it\b|\bafter it lists\b|\bkeep watching\b|\b(once|after|when) it (goes|gets|is) public\b/,
    phone: /\bcold call(s|ed|er|ers)?\b|\bmeet (you )?in person\b|\bface to face\b|\bcome (in|by) (your|the) office\b|\b(anything|business|deals?|investing) (over|on) the phone\b|\b(buy|invest|purchase|sign) (anything )?(over|on) the phone\b|\bpeople i (haven'?t|have not|never) met\b|\bmeet (you|in person|face to face)( first)?\b|\bcome (to|by|into) your office\b|\b(don'?t|do not|never|won'?t)\b.{0,30}\b(over|on) the phone\b/,
    notwork: /\b(don'?t|do not) think (it'?ll|it will|it'?s gonna|it'?s going to) work\b|\bnot going to work( out)?\b|\b(don'?t|do not) see it working\b|\bwon'?t make it\b|\b(don'?t|do not) (believe|buy) (in it|the story|it)\b|\b(it'?ll|it will|going to|gonna) fail\b|\b(don'?t|do not) think (they|it|that company|the company|this company|that|this)('?ll| will| is going to| are going to|'?s going to)? (make it|work|go public|succeed|happen)\b|\bdoubt (it|they|that)\b|\bnever going to happen\b|\b(don'?t|do not) (believe|trust) (in )?(that|the|this) company\b|\b(don'?t|do not) see (that|this|it) (working|happening)\b|\b(not|won'?t|don'?t)\b.{0,25}\bpan out\b/,
    market: /\bmarket (is|'?s) (crazy|down|bad|volatile|shaky|too high|overvalued)\b|\bvolatil(e|ity)\b|\brecession\b|\bbad time to (invest|buy)\b|\beconomy (is|'?s) (bad|terrible|shaky)\b|\bstocks are (falling|down|crashing)\b|\b(the )?election\b|\binterest rates\b|\bmarket'?s? (has )?been (crazy|rough|bad|down|volatile|shaky)\b|\b(with|because of) (interest )?rates\b|\brates (where they are|being so high|so high)\b|\bstocks are (way )?(down|falling|crashing)\b|\bscary market\b|\bworried about the (economy|market)\b|\beconomy'?s? (is )?(a mess|bad|terrible|shaky|rough)\b|\bwith everything going on\b|\bmarket'?s? (is )?(crashing|tanking)\b|\bmarket'?s? (has )?been (terrible|awful|horrible|brutal|ugly)\b|\buncertain\b.{0,20}\b(economy|market)\b|\b(economy|market)\b.{0,20}\buncertain\b/,
    realestate: /\b(i )?prefer (property|real estate)\b|\brather buy (property|real estate|land)\b|\binto real estate\b|\bi do real estate\b|\bown (rental|rentals|properties)\b|\bput (all )?(my|our) money (in|into) (real estate|property|properties|houses)\b|\b(invest|investing) in (property|properties|houses|land)\b|\bi (buy|flip|own) (houses|homes|apartments|buildings|properties)\b|\breal estate is my\b|\bstick (to|with) real estate\b|\binvest (in|into) (rental|rentals|real estate|property|properties|apartments|houses|land)\b|\brental propert(y|ies)\b|\breal estate'?s? (is )?where\b|\blandlord\b|\bi do rentals\b/,
    buy: /\bhow many shares\b|\bhow do i (get started|start|pay|wire|send (the )?money)\b|\bwhere do i sign\b|\blet'?s do (it|this)\b|\bcount me in\b|\bi'?m in\b(?= ?$| (let'?s|for (it|that|this)|on (it|that|this)|go ahead|sign me))|\bwhen (does|will|do) (it|they) (go public|ipo|list)\b|\bwhat'?s the (valuation|share price|price per share)\b|\bi like (it|that|this)\b|\b(do you|can i) (take|send) (a )?wire\b|\bwhat'?s the next step\b|\bhow (do|can|would) (we|i) (get started|start|do (this|it))\b|\bhow much do i need\b|\bminimum to get in\b|\bhow many shares can i\b|\bwhat company is it\b|\bwhat('?s| is) the (name of the )?company\b|\bwhat does (the|this|that) company do\b|\bwho (are|else is) the (other )?investors\b|\bwho else is in\b|\bhow much (have|has) (they|it|the company) raised\b|\bwhen'?s the ipo\b|\b(timeline|timing) (to|for|of) (the )?ipo\b|\bstill room\b|\bhow do i sign up\b|\bsend (me )?the (subscription|sub) (agreement|docs|documents)\b|\bsend (me )?the ppm\b|\bput me down\b|\bi'?ll take (it|some|them|the shares)\b|\bsign me up\b|\b(don'?t|do not) need to think( about it)?\b|\blet'?s get (started|going|it done)\b|\bwire the money\b|\bi want in\b|\b(can'?t|don'?t want to) wait\b|\bhow do i get in( on (it|this|that))?\b|\bwhat do i (need to|have to) do( to get started| next)?\b|\bwhen\b.{0,25}\b(go public|ipo|list)\b|\bwhat'?s next\b|\bwhat are the terms\b|\bhow much (is|are) (a|the|one) shares?\b|\bi think i'?m in\b/,
    dnc: /\blose my number\b|\bquit calling\b|\b(don'?t|do not|never) (ever )?call (me|here|this number)( again| anymore)?\b|\b(don'?t|do not) want (any )?(more )?calls\b|\bno more calls\b/,
    accredited: /\baccredited\b|\b(do i|would i|don'?t think i|i don'?t) qualify\b|\bqualified (investor|purchaser)\b|\baccreditation\b/,
    diy: /\b(i )?(do|manage|handle|pick|run) (my own|it all myself)\b|\bmy own (investing|trading|money|stocks|account|trades)\b|\brobinhood\b|\b(e ?trade|webull|td ameritrade|thinkorswim|interactive brokers)\b|\b(don'?t|do not) need a (broker|advisor|adviser|financial advisor)\b|\binvest on my own\b|\btrade (my own|on my own|myself)\b|\bdo it (all )?myself\b|\bself directed\b|\bmanage my own\b/,
    elsewhere: /\b(i'?m|i am) (into|in|all in) (crypto|bitcoin|gold|silver|bonds|index funds|etfs?|annuities)\b|\b(bitcoin|crypto|cryptocurrency|ethereum)\b|\bi (buy|own|have|like|keep my money in|only do|stick to) (gold|silver|precious metals|index funds|etfs?|annuities|cds|bonds|mutual funds)\b|\ball in bonds\b|\b(big on|heavy in|heavily in|mostly in|all in|into) (gold|silver|crypto|bitcoin|bonds|index funds|etfs?|annuities|cds)\b|\b(all|most) (of )?my money (is )?in (crypto|bitcoin|gold|silver|bonds|index funds|etfs|annuities)\b/,
    size: /\b(start|go|begin) (smaller|small|with less|lower)\b|\bsmallest (i can|amount|position|you can)\b|\b(could|can) i (do|put in|invest|start with) (less|half|a little|a smaller)\b|\bi could (maybe |only |probably )?do (\w+ )?(thousand|grand|k|hundred)\b|\bmore than i'?d (want to |like to )?(put in|invest|spend|do)\b|\bcan i do half\b|\bonly (want|do|put in) a (little|small)\b|\bsmall amount\b|\bput in less\b|\bthe least (i|you) can (put in|do|invest|start with)\b|\b(start|begin) with (a )?(smaller|lower|little|less)\b|\b(do|start with) (just )?a little\b|\bstart small\b/,
  };

  // the four new objections are heard through MORE only
  ["accredited", "diy", "elsewhere", "size"].forEach(function (k) { IDEAS.push([k, /(?!)/]); });
  // Speech-to-text writes people the way they talk: smooth that out before listening for objections.
  var NORM = [[/\bgonna\b/g, "going to"], [/\bwanna\b/g, "want to"], [/\bgotta\b/g, "got to"], [/\bkinda\b/g, "kind of"], [/\blemme\b/g, "let me"], [/\bgimme\b/g, "give me"],
    [/\b(um+|uh+|uhm|erm|hmm+|ah+)\b/g, " "], [/\bfour oh one k\b|\b401 k\b/g, "401k"], [/\bi r a\b/g, "ira"], [/\bo k\b/g, "ok"], [/\b(cuz|cause)\b/g, "because"], [/\bthirty\b/g, "30"]];
  // "Not" traps: the words are there but they mean the opposite (it's NOT too expensive, I'm NOT busy). That reading is dropped.
  var NEG = {
    notint: /\b(i'?m|i am|we'?re) (good|fine|great|well|okay|ok)( thanks| thank you)? (how are you|and you|how about you|how'?s it going|how you doing)\b/,
    price: /\b(not|isn'?t|wasn'?t|never) (too |that |so |very )?(expensive|pricey|steep|bad|high)\b|\bprice is (fine|good|great|fair|right|reasonable|not an issue)\b/,
    money: /\bmoney (isn'?t|is not|'?s not) (an|the) (issue|problem)\b|\bi (have|got) the money\b|\bnot about the money\b/,
    busy: /\bnot (that |too |very |really )?busy\b/,
    trust: /\bnot (a|saying (it'?s|this is) a) scam\b|\bi (do )?trust you\b|\b(it'?s|this is) not a scam\b/,
    advisor: /\b(don'?t|do not) (have|use|need) (an?|my) (advisor|adviser|accountant|planner|broker)\b|\bno (advisor|broker)\b/,
    already: /\b(don'?t|do not) (have|use|work with) (an?|any) (advisor|adviser|broker|agent|planner)\b|\bno (advisor|broker)\b/,
    think: /\b(don'?t|do not) (need|have) to think\b|\bnothing to think about\b/,
    wait: /\b(can'?t|don'?t want to|no need to|why) wait\b/,
    guarantee: /\bnot worried about (the )?(risk|losing)\b/,
    liquid: /\b(i'?m|i am) (very |pretty |quite )?liquid\b/,
    conservative: /\bnot (that |very )?conservative\b|\baggressive investor\b/,
    buy: /\bnot (something )?(i'?m|we'?re|i am|we are) interested\b|\bnot interested\b/,
    realestate: /\b(i'?m|i am) a realtor\b|\bwork in real estate\b|\breal estate (agent|broker|license)\b/
  };
  // When two readings overlap, the more specific one wins (the second is dropped when the first is heard).
  // Some of the base hearing is too loose for real calls ("my wife and I are retired" isn't an objection): replaced here.
  var BASE = {
    spouse: /\b(talk|speak|check|run it by|run this by|ask|discuss|consult|go over)\b.{0,25}\b(wife|husband|spouse|partner|other half)\b|\b(wife|husband|spouse|partner) (handles|makes|decides|would kill|has to|needs to|does (all )?the|takes care)\b|\bwithout (\w+ ){0,3}(my|the) (wife|husband|spouse|partner)\b|\b(wife|husband|spouse|partner) (would|will) (have to|need to|want to) (agree|sign off|be on board|approve|see it)\b/
  };
  var OVER = [["conservative", "price"], ["price", "buy"], ["advisor", "info"], ["conservative", "elsewhere"], ["size", "price"], ["size", "buy"], ["accredited", "buy"], ["trust", "buy"], ["stall", "buy"], ["watch", "wait"], ["liquid", "money"], ["guarantee", "conservative"], ["dnc", "notint"], ["dnc", "later"]];

  /* ----- Where the call is, and the next move toward the close. Copilot follows the call (opening, finding what
     matters, objections, agreement, buying signals) and always shows the next step, so every answer moves the lead
     one step closer to yes. ----- */
  // A lead going along with you (said alone, with no objection in it): after an objection that's the moment to trial close.
  var AGREE = /\b(yeah|yes|yep|yup|ok|okay|sure|right|true|exactly|absolutely|definitely|correct|fair enough|that'?s fair|makes sense|i hear you|i guess|i suppose|sounds (good|fair|interesting|reasonable)|i like (that|it)|interesting|not bad|good point|i agree|go on|tell me more)\b/;
  var FLOW = {
    open: { all: "Open: your name, {company}, why you called, in 15 seconds. Then ask a question and let them talk.",
      investments: "Open: your name, {company}, why you called. Then: “{first}, have you ever been involved in an IPO before?” Let them talk." },
    discover: { all: "Find what matters: what they have now, what they’d change, what it’s costing them. Then trial close.",
      investments: "Find what matters: what they own now, how much is in the market, what they’d want from a private deal. Then trial close." },
    objection: { all: "Answer it with the card below, then trial close: “Putting that aside, does this make sense for you?”",
      investments: "Answer it with the card below, then trial close: “Putting the buying aside, does the idea make sense?”" },
    isolate: { all: "Isolate it: “Other than {obj}, is there anything else stopping you from going ahead today?” If no, close." },
    again: { all: "Same objection twice: that’s the real one. Use the new answer below, then isolate it: “If we solve that, are you in?”" },
    trial: { all: "They’re going along with you. Trial close now. If they say yes, go straight to the close." },
    close: { all: "Close: ask for it, then stop talking. The first one to speak loses.",
      investments: "Close: put them down for the shares, then lock the details: how the account is titled, where to send the documents. Then stop talking." }
  };
  // How the objection reads in "Other than …, is there anything else…"
  var OBJ = { price: "the price", payment: "the payment", money: "the money", think: "thinking it over", spouse: "talking it over at home", decide: "who decides", advisor: "your advisor",
    already: "who you have now", later: "the timing", stall: "the timing", wait: "the timing", busy: "the timing", send: "the paperwork", info: "the research", trust: "trusting us",
    number: "how I got your number", notint: "that", credit: "credit", guarantee: "the risk", conservative: "the risk", liquid: "liquidity", market: "the market", watch: "waiting to see",
    phone: "doing it over the phone", notwork: "whether it works", bad: "what happened before", who: "who I am", realestate: "real estate", browse: "shopping around", old: "age", self: "selling it yourself", accredited: "qualifying", diy: "doing it yourself", elsewhere: "what you own now", size: "the amount" };
  P.trial.all = [
    R("trial-a", "Trial close", "Putting the price aside for a second, does this make sense for you?"),
    R("trial-b", "Trial close", "On a scale of 1 to 10, where are you right now? … What would make it a 10?"),
    R("trial-c", "Trial close", "What would you need to see to go ahead today?") ];
  P.trial.all.forEach(function (v) { v.src = ""; v.close = ""; });
  P.trial.noAll = ["investments"];   // the owner's floor uses his playbook's trial closes

  window.VPEXElite = { v: 3, IDEAS: IDEAS, LABEL: LABEL, CLOSE: CLOSE, PLAYS: P, RULES: { investments: RULES }, MORE: MORE, OVER: OVER, BASE: BASE, AGREE: AGREE, FLOW: FLOW, OBJ: OBJ, NORM: NORM, NEG: NEG };
})();
