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
    ["what", /\bwhat is this (about|regarding)\b|\bwhat'?s this (about|regarding)\b|\bwho is this\b|\bwho are you( with)?\b|\bwhat are you selling\b|\bwhat company\b/],
    ["decide", /\bnot the (decision maker|one who decides)\b|\b(my|the) (boss|partner|owner|business partner|board) (decides|has to|makes)\b|\bi (have|need) to (ask|check with) my (boss|partner|business partner)\b/],
    ["wait", /\b(want|going|like) to wait\b|\bwait (and see|until|for)\b|\b(rates|prices|the market) (will|might|could|are going to) (drop|come down|go down|crash|change)\b|\bnot the right market\b|\bafter the (holidays|new year|election)\b/],
    ["bad", /\b(bad|terrible|horrible) experience\b|\bgot (burned|ripped off|scammed)\b|\blast time (we|i)\b|\bnever again\b|\bdidn'?t work (out )?(for us|for me|last time)\b/],
    ["info", /\b(do|need to do) (some|my own|more) (research|homework)\b|\bneed more (info|information|details)\b|\blook (it|into it) (up|over)\b|\bread (up )?on it\b/],
    ["old", /\b(i'?m|i am) too old\b|\bat my age\b|\b(my )?health (isn'?t|is not) (great|good)\b|\bpre ?existing\b/],
    ["browse", /\bjust (looking|browsing|shopping around)\b|\bshopping around\b|\bgetting (other )?quotes\b|\bcompar(e|ing) (prices|quotes|offers)\b/],
    ["payment", /\bpayment(s)? (is|are|would be) too (high|much)\b|\bcan'?t (do|afford) (that|the) (payment|monthly)\b|\bdaily payments?\b|\bweekly payments?\b/],
    ["guarantee", /\bis it guaranteed\b|\bany guarantee\b|\bguaranteed (return|returns)\b|\bwhat if (it|the company) (fails|goes under|goes to zero)\b|\bcould i lose\b|\bhow risky\b/],
    ["liquid", /\b(lock ?up|lockup|locked up)\b|\bwhen (can|do) i get (my|the) money (back|out)\b|\bhow long (is|until) (my )?money\b|\bcan i (sell|get out) (early|anytime)\b/],
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
      { id: "close-inv-b", t: "The next step is simple: I send the deck and the key terms, you read them, and we get on a 15-minute call to answer every question. Do you want the call tomorrow morning or tomorrow afternoon?" }]
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

  window.VPEXElite = { v: 1, IDEAS: IDEAS, LABEL: LABEL, CLOSE: CLOSE, PLAYS: P };
})();
