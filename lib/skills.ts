export type Difficulty = 'low' | 'medium' | 'high'
export type Category = 'personal' | 'professional'
export type Format = 'text' | 'in-person'

export type StepOption = {
  text: string
  quality: 'good' | 'okay' | 'avoid'
  note: string
}

export type SkillStep = {
  label?: string
  aiSeed?: string
  options: StepOption[]
}

export type Scenario = {
  persona: string
  situation: string
  difficulty: Difficulty
  format: Format
  medium?: string
  steps?: SkillStep[]
}

export type SkillModule = {
  id: string
  title: string
  description: string
  frame: string
  plan: 'pro'
  category: Category
  tips: string[]
  scenarios: Scenario[]
}

export const SKILL_MODULES: SkillModule[] = [
  {
    id: 'ask-someone-out',
    title: 'How to ask someone out',
    description: 'Reading signals, phrasing the ask, responding gracefully to a no.',
    frame: `Asking someone out is one of the most universally nerve-wracking social moments — not because it is complicated, but because the stakes feel personal. The good news: most people respond well to a direct, low-pressure ask that gives them an easy out. What tends to go wrong is either over-engineering it (long preamble, obvious anxiety) or under-committing (so vague they are not sure you meant it). The goal is a clear ask, delivered warmly, that leaves both of you feeling okay regardless of the answer.`,
    plan: 'pro',
    category: 'personal',
    tips: [
      'The ask should be clear — "would you want to grab coffee?" works; burying it in hedges does not',
      'Give them an easy, graceful out — low pressure is more attractive than desperation',
      'Avoid over-explaining why you like them before asking — say the thing',
      'Ask after a few real exchanges, not on the first message',
      'Neurodivergent note: we often over-rehearse until it sounds stilted, or we bury the ask in layers of softening — simple and warm beats clever and overprepared',
    ],
    scenarios: [
      {
        persona: 'a colleague you have been friendly with for a few months',
        situation: 'asking them to get coffee sometime',
        difficulty: 'low',
        format: 'in-person',
      },
      {
        persona: 'someone you met at an event last week',
        situation: 'asking if they would want to hang out again',
        difficulty: 'medium',
        format: 'in-person',
      },
      {
        persona: 'someone you matched with on Hinge three days ago',
        situation: 'you have been chatting about music and weekend plans and want to suggest meeting up',
        difficulty: 'low',
        format: 'text',
        medium: 'Hinge message',
        steps: [
          {
            label: 'You have been chatting for a few days. Time to suggest meeting.',
            aiSeed: 'Okay so serious question — have you actually been to any of the places you keep recommending or are you just sending me yelp links',
            options: [
              {
                text: 'Ha — mostly the latter if I am honest. We should actually go to one. Coffee this weekend?',
                quality: 'good',
                note: 'Warm, self-aware, and direct — the ask lands naturally from the conversation.',
              },
              {
                text: 'I don\'t know if this is too forward but I was thinking maybe we could potentially meet up sometime if you wanted to',
                quality: 'avoid',
                note: 'The hedging signals anxiety and makes it awkward for both of you.',
              },
              {
                text: 'We should hang out sometime.',
                quality: 'okay',
                note: '"Should" and "sometime" are vague enough that they might not realize you are actually asking.',
              },
            ],
          },
          {
            label: 'They reply:',
            options: [
              {
                text: 'Yes, Saturday afternoon works for me — I was thinking around 2? There is a good spot near the park.',
                quality: 'good',
                note: 'Specific, proactive, and relaxed — you have taken the lead without being pushy.',
              },
              {
                text: 'Sure, whenever works for you honestly, I am flexible!',
                quality: 'okay',
                note: 'Agreeable but not helpful — they asked what you were thinking, so actually think of something.',
              },
              {
                text: 'Oh I don\'t know, maybe closer to the day we can figure it out?',
                quality: 'avoid',
                note: 'Delays the plan and creates unnecessary ambiguity right when momentum is highest.',
              },
            ],
          },
          {
            label: 'They say: "Saturday works! Let\'s figure out the spot."',
            options: [
              {
                text: 'Great! There is a place called Elm on the high street — around 2?',
                quality: 'good',
                note: 'Moves it forward with a concrete plan. Done.',
              },
              {
                text: 'You pick — I am easy either way!',
                quality: 'okay',
                note: 'Friendly, but puts all the effort on them after you suggested the whole thing.',
              },
              {
                text: 'Amazing, can\'t wait!! Let me know what you are thinking!!!',
                quality: 'avoid',
                note: 'Too much energy at the wrong moment — and still does not confirm a location.',
              },
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'set-work-boundary',
    title: 'Setting a boundary at work',
    description: 'Calm, professional, non-confrontational language for protecting your time and energy.',
    frame: `Setting a boundary at work is not about being difficult — it is about being sustainable. The challenge is that most people either over-explain (which invites pushback) or avoid the conversation entirely (which leads to resentment). The most effective boundaries are stated simply, without apology, and without a long justification. You are not asking for permission. You are letting someone know what works for you. Done well, it actually increases respect.`,
    plan: 'pro',
    category: 'professional',
    tips: [
      'You do not need to justify or over-explain your limits — a reason is helpful, a paragraph of apology is not',
      'State what you can do, not only what you cannot',
      'A calm, matter-of-fact tone is more effective than apologetic or defensive',
      'Do not invite negotiation unless you mean it — hedging signals that your boundary is soft',
      'Neurodivergent note: we often feel compelled to give lengthy explanations or apologize; this usually weakens the message and invites pushback',
    ],
    scenarios: [
      {
        persona: 'a colleague who keeps adding work to your plate',
        situation: 'telling them via Slack that you cannot take on more this week',
        difficulty: 'medium',
        format: 'text',
        medium: 'Slack message',
        steps: [
          {
            label: 'Your colleague sends you a Slack message:',
            aiSeed: 'Hey! Quick one — could you also take care of the client report this week? I am totally swamped.',
            options: [
              {
                text: 'I don\'t have capacity for that this week — what would be most helpful for me to deprioritize?',
                quality: 'good',
                note: 'Clear, professional, holds the limit while offering a real solution.',
              },
              {
                text: 'Sure, I will fit it in somehow.',
                quality: 'avoid',
                note: 'Agreeing when you cannot deliver sets up a bigger problem later.',
              },
              {
                text: 'Ugh I really can\'t, I am so sorry, I have so much on right now...',
                quality: 'okay',
                note: 'True, but the apology softens the limit and the ellipsis invites negotiation.',
              },
            ],
          },
          {
            label: 'They reply:',
            options: [
              {
                text: 'I understand it is urgent. I cannot add to this week, but I can help you find someone else or look at it Monday.',
                quality: 'good',
                note: 'Holds the limit while showing good faith — you are not just stonewalling.',
              },
              {
                text: 'Okay fine, just the first section then.',
                quality: 'avoid',
                note: 'Capitulating under pressure teaches them your limits are negotiable.',
              },
              {
                text: 'I already said I don\'t have capacity.',
                quality: 'okay',
                note: 'Accurate but sounds defensive; repeating without offering anything shuts the conversation down.',
              },
            ],
          },
          {
            label: 'They say: "I get it. I\'ll see if Jamie can help."',
            options: [
              {
                text: 'Thanks for understanding.',
                quality: 'good',
                note: 'Warm and clean — closes the exchange without reopening it.',
              },
              {
                text: 'Sorry again — I really wish I could help more.',
                quality: 'avoid',
                note: 'Re-litigating after the limit is accepted undermines it and makes you seem uncertain.',
              },
              {
                text: 'Okay, let me know if you need anything else.',
                quality: 'okay',
                note: 'Fine, but "anything else" could inadvertently reopen the door you just closed.',
              },
            ],
          },
        ],
      },
      {
        persona: 'your manager',
        situation: 'pushing back via Slack on a deadline that is not achievable',
        difficulty: 'high',
        format: 'text',
        medium: 'Slack message',
        steps: [
          {
            label: 'Your manager messages you:',
            aiSeed: 'Can we have the full analysis ready by EOD Thursday? Client is expecting it.',
            options: [
              {
                text: 'Thursday EOD is tight for the full analysis — I can have the core findings ready then and the complete version by Friday noon. Does that work?',
                quality: 'good',
                note: 'Offers a concrete alternative rather than a flat no — makes it easy for them to say yes.',
              },
              {
                text: 'Of course, I will make it work.',
                quality: 'avoid',
                note: 'Sets you up to either miss the deadline or burn out — and they will not know there was a problem until it is too late.',
              },
              {
                text: 'That might be hard... I will try my best.',
                quality: 'okay',
                note: 'Communicates difficulty but gives them nothing concrete to work with.',
              },
            ],
          },
          {
            label: 'They reply:',
            options: [
              {
                text: 'Got it. In that case, can we deprioritize the regional breakdown so I can focus on what the client actually needs?',
                quality: 'good',
                note: 'Shows you are solution-oriented while protecting your capacity — moves from problem to plan.',
              },
              {
                text: 'Understood. I will figure it out.',
                quality: 'avoid',
                note: 'You have caved and taken the pressure back on yourself with nothing resolved.',
              },
              {
                text: 'I will do my best but no promises.',
                quality: 'okay',
                note: 'Honest but not actionable — leaves everyone in uncertainty.',
              },
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'give-hard-feedback',
    title: 'Giving difficult feedback',
    description: 'Framing, tone, and timing for feedback that lands without damaging the relationship.',
    frame: `Difficult feedback is only as hard as the framing. When it feels personal, it lands badly. When it feels like you are on the same team, it can actually strengthen a relationship. The key is specificity over generality, observation over judgment, and genuine care over performance of care. People can tell the difference. The goal is not to make someone feel bad — it is to give them something they can actually use.`,
    plan: 'pro',
    category: 'professional',
    tips: [
      'Lead with observation, not judgment — "I noticed X" lands better than "You have been doing X"',
      'Be specific — vague feedback lands as a personal attack; specific feedback lands as useful information',
      'The goal is to give them something they can use, not to unburden yourself',
      'Care has to come through in the framing, not just the words',
      'Neurodivergent note: we can swing between over-softening (the message gets lost) and being too direct (coming across as harsh) — aim for specific and warm',
    ],
    scenarios: [
      {
        persona: 'a peer whose work quality has been slipping',
        situation: 'reaching out via Slack to check in and name what you have noticed',
        difficulty: 'medium',
        format: 'text',
        medium: 'Slack message',
        steps: [
          {
            label: 'You are opening the conversation. Write your first message.',
            aiSeed: '',
            options: [
              {
                text: 'Hey — I wanted to check in. I have noticed your last couple of deliverables have been late and had some errors. Is everything okay?',
                quality: 'good',
                note: 'Opens with care and specifics, invites them to share what is going on.',
              },
              {
                text: 'We need to talk about your work quality lately.',
                quality: 'avoid',
                note: 'Sounds like a performance review from a manager — creates defensiveness before they have said a word.',
              },
              {
                text: 'Hey, I hope this is not weird to bring up, but some things have felt a bit off lately with your work...',
                quality: 'okay',
                note: '"I hope this is not weird" signals discomfort and softens the message so much it can feel more unsettling than direct.',
              },
            ],
          },
          {
            label: 'They reply: "I didn\'t realize. Which deliverables specifically?"',
            options: [
              {
                text: 'The Tuesday report had three calculation errors and the client deck was a day late — those are the two I am most aware of.',
                quality: 'good',
                note: 'Specific, factual, not piled on — exactly what you promised when you said you had noticed.',
              },
              {
                text: 'Just generally things have felt a bit off.',
                quality: 'avoid',
                note: 'Reverting to vagueness after they asked for specifics loses credibility and trust.',
              },
              {
                text: 'Well, the report, and the deck, and a few other things...',
                quality: 'okay',
                note: 'Gets to specifics but the trailing "few other things" sounds like there is more being held back.',
              },
            ],
          },
          {
            label: 'They say: "Okay, that\'s fair. I\'ve had a lot going on personally."',
            options: [
              {
                text: 'I am sorry to hear that — I do not need details. If there is anything that would help on my end, let me know. The main thing I wanted was for us to catch these before they reach the client.',
                quality: 'good',
                note: 'Acknowledges the personal context while keeping the professional concern alive — you are on their side.',
              },
              {
                text: 'That is totally understandable, do not worry about it!',
                quality: 'avoid',
                note: 'Withdrawing the feedback entirely sends mixed signals and does not actually help them.',
              },
              {
                text: 'Right, well just try to make sure it does not happen again.',
                quality: 'avoid',
                note: 'Dismissive of what they just shared — ends the conversation in exactly the wrong way.',
              },
            ],
          },
        ],
      },
      {
        persona: 'a direct report who missed an important deadline',
        situation: 'giving feedback without demoralizing them',
        difficulty: 'high',
        format: 'in-person',
      },
    ],
  },

  {
    id: 'ask-for-raise',
    title: 'Asking for a raise or promotion',
    description: 'Building the case, handling objections, staying confident under pressure.',
    frame: `Most people either avoid this conversation or go into it underprepared. The ones who get what they want usually do one thing differently: they make it easy for their manager to say yes. That means arriving with a clear case (specific contributions, market context, a number), and anticipating the most likely objections before they come up. Confidence here is not about volume — it is about knowing your value and being willing to state it plainly.`,
    plan: 'pro',
    category: 'professional',
    tips: [
      'Arrive with a specific number or ask — "something more" is not a negotiating position',
      'Make it easy for them to say yes: specific contributions, timing context, and a reasonable ask',
      'Anticipate their most likely objection and have a response ready',
      'Confidence here is not about volume — it is about knowing your value and being willing to state it',
      'Neurodivergent note: we often either under-prepare and wing it (which shows) or over-prepare until the script sounds rehearsed — aim for clear and grounded',
    ],
    scenarios: [
      {
        persona: 'your manager in a 1:1',
        situation: 'bringing up compensation for the first time',
        difficulty: 'high',
        format: 'in-person',
      },
      {
        persona: 'your manager after they push back',
        situation: 'responding to "the budget is tight right now"',
        difficulty: 'high',
        format: 'in-person',
      },
    ],
  },

  {
    id: 'navigate-small-talk',
    title: 'Navigating small talk and networking',
    description: 'Starting conversations naturally, keeping them going, and exiting gracefully.',
    frame: `Small talk gets a bad reputation because most people do it badly — surface-level, performative, going nowhere. But it does not have to be that way. The best small talk is actually just genuine curiosity expressed efficiently. Ask one real question, listen to the answer, and follow the thread. The goal is not to impress anyone — it is to find the one interesting thing you have in common and spend two minutes on that. That is what people remember.`,
    plan: 'pro',
    category: 'personal',
    tips: [
      'One real question beats three surface-level ones — follow the thread rather than moving on',
      'You do not need to be interesting; you need to be interested',
      'Exits are part of the skill — a clean "it was great to meet you" is better than trailing off awkwardly',
      'You do not need to talk the whole time; being a good listener is the most underrated networking skill',
      'Neurodivergent note: we often either over-script (sounds stiff) or go too deep too fast (can unsettle people) — aim for genuine curiosity at a pace that matches the other person',
    ],
    scenarios: [
      {
        persona: 'someone you do not know at a work event',
        situation: 'starting a conversation and keeping it going for a few minutes',
        difficulty: 'low',
        format: 'in-person',
      },
      {
        persona: 'a senior person in your field at a conference',
        situation: 'introducing yourself and making a genuine connection',
        difficulty: 'medium',
        format: 'in-person',
      },
    ],
  },

  {
    id: 'handle-passive-aggression',
    title: 'Handling passive aggression',
    description: 'De-escalation, clarity, and staying grounded when someone is being indirect.',
    frame: `Passive aggression is hard because engaging with it directly can feel like overreacting, while ignoring it lets it continue. The most effective response is neither — it is a calm, direct acknowledgment that creates an opening without escalating. You are not calling them out aggressively. You are simply naming what you are observing and giving them a chance to be direct. This works because most passive-aggressive behavior is a protection mechanism, not malice — and direct, non-threatening clarity often defuses it.`,
    plan: 'pro',
    category: 'personal',
    tips: [
      'Naming the dynamic directly is more effective than pretending you did not notice or firing back',
      'The goal is to open a real conversation, not to win',
      'Stay calm and direct — escalating into defensiveness proves their point',
      'Passive aggression is often a signal that someone feels unheard; creating space for directness usually defuses it',
      'Neurodivergent note: we can struggle to know whether to address indirect digs or let them pass — address once, briefly, without drama; do not keep bringing it up',
    ],
    scenarios: [
      {
        persona: 'a colleague who sent you a pointed "per my last email" message',
        situation: 'responding via email in a way that de-escalates without being a pushover',
        difficulty: 'medium',
        format: 'text',
        medium: 'Email',
        steps: [
          {
            label: 'They sent you this email:',
            aiSeed: 'Hi, just following up — as mentioned in my previous email, the report needs to be submitted by end of week. Please confirm you have seen this.',
            options: [
              {
                text: 'Hi — I noticed the "as mentioned" and want to make sure we are communicating well. Did something get missed on my end that I should know about? Happy to sync if helpful. Report is on track for EOW.',
                quality: 'good',
                note: 'Addresses the subtext calmly, confirms you are on top of it, and opens the door to a real conversation.',
              },
              {
                text: 'Got it, will do.',
                quality: 'okay',
                note: 'Technically functional, but ignores the pointed tone — the tension will likely resurface.',
              },
              {
                text: 'I read your email. I do not appreciate the tone.',
                quality: 'avoid',
                note: 'Escalates immediately and makes it adversarial before giving them a chance to be direct.',
              },
            ],
          },
          {
            label: 'They reply:',
            options: [
              {
                text: 'Appreciate that — I am on track for EOW. And if there is ever something you feel got missed, it is always fine to say so directly.',
                quality: 'good',
                note: 'Closes cleanly, reaffirms you are reliable, and keeps the door to direct communication open.',
              },
              {
                text: 'Okay, good.',
                quality: 'avoid',
                note: 'Lets the conversation close without actually resolving anything.',
              },
              {
                text: 'To be honest, it felt a bit pointed. I just wanted to flag that.',
                quality: 'okay',
                note: 'Valid, but risks sounding like you are still relitigating it after they have already deflected.',
              },
            ],
          },
        ],
      },
      {
        persona: 'someone in a meeting who keeps making backhanded comments',
        situation: 'addressing it calmly in the moment',
        difficulty: 'high',
        format: 'in-person',
      },
    ],
  },
]
