export type Difficulty = 'foundations' | 'intermediate' | 'advanced'

export type SubCategory =
  | 'personal-dating'
  | 'personal-general'
  | 'personal-family-friends'
  | 'personal-self-advocacy'
  | 'professional-colleague'
  | 'professional-general'
  | 'professional-manager-boss'

export type SlideType = 'content' | 'what-not-to-do' | 'safety' | 'section-check-in'

export type EducationalSlide = {
  title: string
  content?: string[]
  body?: string
  type: SlideType
  checkIn?: string
}

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

export type SkillModule = {
  id: string
  title: string
  description: string
  plan: 'pro'
  difficulty: Difficulty
  estimatedMinutes: number
  format: 'text' | 'in-person'
  medium?: string
  subCategories: SubCategory[]
  whyItsHard: string
  educationalSlides: EducationalSlide[]
  defaultPersona?: string
  defaultSituation?: string
  steps?: SkillStep[]
}

export const RECOMMENDED_IDS = ['small-talk-event', 'follow-up-email']

export const SKILL_MODULES: SkillModule[] = [

  // ── Personal — Dating ──────────────────────────────────────────────────────

  {
    id: 'ask-someone-out-text',
    title: 'Asking someone out (text)',
    description: 'How to move from chatting to suggesting a date — clearly, warmly, and without overthinking it.',
    plan: 'pro',
    difficulty: 'foundations',
    estimatedMinutes: 30,
    format: 'text',
    medium: 'Dating app message',
    subCategories: ['personal-dating'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [
      {
        title: 'Who you might want to ask out',
        type: 'content',
        content: [
          'TODO — compatibility thinking',
          'TODO — reading the vibe',
          'TODO — timing signals',
        ],
      },
      {
        title: 'Approaching it with confidence',
        type: 'content',
        content: [
          'TODO — what confidence actually looks like here',
          'TODO — low-pressure framing',
          'TODO — the simple direct ask',
        ],
      },
      {
        title: 'What tends to go wrong',
        type: 'what-not-to-do',
        content: [
          'TODO — moving too fast',
          'TODO — over-sharing early',
          'TODO — messages that read differently than intended',
        ],
      },
      {
        title: 'If you are doing this online',
        type: 'safety',
        content: [
          'TODO — tone is harder to read over text',
          'TODO — you are never obligated to send photos',
          'TODO — set up a video call before meeting',
          'TODO — choose a public location for a first meeting',
          'TODO — anything you send could be shared',
        ],
      },
      {
        title: 'Presenting yourself',
        type: 'content',
        content: [
          'TODO — practical notes on how to present yourself',
          'TODO — dress and hygiene',
        ],
      },
      {
        title: 'Before we practice',
        type: 'section-check-in',
        checkIn: 'Does any of this feel familiar — have you been in a situation like this before?',
      },
    ],
    defaultPersona: 'someone you matched with on a dating app three days ago',
    defaultSituation: 'you have been chatting about music and weekend plans and want to suggest meeting up',
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

  {
    id: 'text-someone-first-time',
    title: 'Texting someone for the first time',
    description: 'Breaking the ice over text without overthinking the opening message.',
    plan: 'pro',
    difficulty: 'foundations',
    estimatedMinutes: 30,
    format: 'text',
    medium: 'Text message',
    subCategories: ['personal-dating', 'personal-family-friends'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'someone you met recently and got the number of',
    defaultSituation: 'you want to reach out for the first time but are not sure how to start',
  },

  {
    id: 'making-plans-date',
    title: 'Making plans to hang out',
    description: 'Moving from interest to a confirmed plan without the back-and-forth spiral.',
    plan: 'pro',
    difficulty: 'foundations',
    estimatedMinutes: 30,
    format: 'text',
    medium: 'Text message',
    subCategories: ['personal-dating'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'someone you have been talking to who you want to make plans with',
    defaultSituation: 'you want to pin down a time and place without it becoming a long back-and-forth',
  },

  {
    id: 'ending-first-date',
    title: 'Ending a first date',
    description: 'Wrapping up gracefully — whether it went well or did not.',
    plan: 'pro',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    format: 'in-person',
    subCategories: ['personal-dating'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'someone you just went on a first date with',
    defaultSituation: 'the date is wrapping up and you need to navigate the goodbye',
  },

  {
    id: 'ending-relationship',
    title: 'Ending a relationship',
    description: 'Breaking up clearly and kindly, without dragging it out or going cold.',
    plan: 'pro',
    difficulty: 'advanced',
    estimatedMinutes: 50,
    format: 'in-person',
    subCategories: ['personal-dating'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a partner you have been with for several months',
    defaultSituation: 'you have decided to end the relationship and need to have the conversation',
  },

  {
    id: 'boundary-consent',
    title: 'Setting a boundary around consent',
    description: 'Communicating your limits directly and calmly, without apologizing for them.',
    plan: 'pro',
    difficulty: 'advanced',
    estimatedMinutes: 50,
    format: 'text',
    medium: 'Text message',
    subCategories: ['personal-dating'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'someone you are dating or have recently been physical with',
    defaultSituation: 'you need to communicate a limit or boundary clearly',
  },

  {
    id: 'telling-partner-bothered',
    title: 'Telling a partner something is bothering you',
    description: 'Raising something that is bothering you without it turning into a fight.',
    plan: 'pro',
    difficulty: 'advanced',
    estimatedMinutes: 50,
    format: 'text',
    medium: 'Text message',
    subCategories: ['personal-dating'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'your partner',
    defaultSituation: 'something they did recently has been bothering you and you want to bring it up',
  },

  {
    id: 'telling-someone-love-them',
    title: 'Telling someone you love them',
    description: 'Saying it — clearly, without over-engineering the moment.',
    plan: 'pro',
    difficulty: 'advanced',
    estimatedMinutes: 50,
    format: 'in-person',
    subCategories: ['personal-dating'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'someone you have been in a relationship with for a few months',
    defaultSituation: 'you want to tell them you love them for the first time',
  },

  {
    id: 'asking-emotional-support',
    title: 'Asking for emotional support',
    description: 'Reaching out when you need support without feeling like a burden.',
    plan: 'pro',
    difficulty: 'advanced',
    estimatedMinutes: 50,
    format: 'text',
    medium: 'Text message',
    subCategories: ['personal-dating', 'personal-family-friends'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a close friend or partner',
    defaultSituation: 'you are going through something hard and need to ask for support',
  },

  // ── Personal — General Communication ─────────────────────────────────────

  {
    id: 'saying-no-without-over-explaining',
    title: 'Saying no without over-explaining',
    description: 'Declining clearly and kindly, without a paragraph of justification.',
    plan: 'pro',
    difficulty: 'foundations',
    estimatedMinutes: 30,
    format: 'text',
    medium: 'Text message',
    subCategories: ['personal-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a friend or acquaintance asking you for a favor or to plans',
    defaultSituation: 'you need to decline without over-explaining or apologizing excessively',
  },

  {
    id: 'navigating-misunderstanding-text',
    title: 'Navigating a misunderstanding over text',
    description: 'Clearing up a miscommunication before it becomes a bigger issue.',
    plan: 'pro',
    difficulty: 'foundations',
    estimatedMinutes: 30,
    format: 'text',
    medium: 'Text message',
    subCategories: ['personal-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a friend who seems to have misread something you said',
    defaultSituation: 'a misunderstanding has come up over text and you need to address it calmly',
  },

  {
    id: 'introducing-yourself-event',
    title: 'Introducing yourself at an event',
    description: 'Starting a conversation with someone new without the awkward freeze.',
    plan: 'pro',
    difficulty: 'foundations',
    estimatedMinutes: 30,
    format: 'in-person',
    subCategories: ['personal-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a stranger at a social event',
    defaultSituation: 'you want to introduce yourself and start a conversation',
  },

  {
    id: 'small-talk-event',
    title: 'Small talk at an event',
    description: 'Keeping a conversation going naturally without running out of things to say.',
    plan: 'pro',
    difficulty: 'foundations',
    estimatedMinutes: 30,
    format: 'in-person',
    subCategories: ['personal-general', 'professional-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'someone you do not know well at a social or work event',
    defaultSituation: 'you are in a small talk situation and want to keep the conversation going naturally',
  },

  {
    id: 'navigating-group-dynamics',
    title: 'Navigating group dynamics',
    description: 'Finding your place in a group conversation without fading out or taking over.',
    plan: 'pro',
    difficulty: 'foundations',
    estimatedMinutes: 30,
    format: 'in-person',
    subCategories: ['personal-general', 'professional-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a group of people you know somewhat but not closely',
    defaultSituation: 'you are in a group setting and want to participate naturally',
  },

  {
    id: 'telling-someone-behavior-hurtful',
    title: 'Telling someone their behavior was hurtful',
    description: 'Naming what happened and how it landed — without attacking or shutting down.',
    plan: 'pro',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    format: 'text',
    medium: 'Text message',
    subCategories: ['personal-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a friend whose comment or action hurt you recently',
    defaultSituation: 'you want to tell them how their behavior landed without it turning into a fight',
  },

  {
    id: 'responding-passive-aggression-text',
    title: 'Responding to passive aggression over text',
    description: 'Addressing the subtext without escalating or pretending it did not happen.',
    plan: 'pro',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    format: 'text',
    medium: 'Text message',
    subCategories: ['personal-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a friend or family member being passive aggressive over text',
    defaultSituation: 'you have received a pointed or indirect message and need to respond',
  },

  {
    id: 'telling-someone-need-space',
    title: 'Telling someone you need space',
    description: 'Asking for space clearly without making the other person feel rejected.',
    plan: 'pro',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    format: 'text',
    medium: 'Text message',
    subCategories: ['personal-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a friend, partner, or family member who has been a lot lately',
    defaultSituation: 'you need to tell them you need some space or time to yourself',
  },

  {
    id: 'apologizing-after-wrong',
    title: 'Apologizing after saying something wrong',
    description: 'Giving a real apology that lands — not a non-apology dressed up as one.',
    plan: 'pro',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    format: 'text',
    medium: 'Text message',
    subCategories: ['personal-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'someone you said something hurtful or wrong to recently',
    defaultSituation: 'you need to apologize genuinely for something you said',
  },

  {
    id: 'addressing-said-in-anger',
    title: 'Addressing something you said in anger',
    description: 'Following up after losing your temper — taking ownership without spiraling.',
    plan: 'pro',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    format: 'text',
    medium: 'Text message',
    subCategories: ['personal-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'someone you said something harsh or unfair to during an argument',
    defaultSituation: 'you want to address what happened after saying something in anger',
  },

  {
    id: 'responding-manipulative',
    title: 'Responding to someone who is manipulative',
    description: 'Staying grounded when someone is using pressure, guilt, or gaslighting.',
    plan: 'pro',
    difficulty: 'advanced',
    estimatedMinutes: 50,
    format: 'text',
    medium: 'Text message',
    subCategories: ['personal-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'someone in your life who tends to use guilt or pressure to get what they want',
    defaultSituation: 'they are using a manipulative tactic and you need to respond without getting pulled in',
  },

  // ── Personal — Family and Friends ─────────────────────────────────────────

  {
    id: 'responding-cancelled-plans',
    title: 'Responding when someone cancels plans',
    description: 'Reacting gracefully when plans fall through — even when it is frustrating.',
    plan: 'pro',
    difficulty: 'foundations',
    estimatedMinutes: 30,
    format: 'text',
    medium: 'Text message',
    subCategories: ['personal-family-friends'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a friend who just cancelled plans you were looking forward to',
    defaultSituation: 'they have cancelled last minute and you want to respond without being passive aggressive',
  },

  {
    id: 'setting-a-boundary',
    title: 'Setting a boundary around your needs',
    description: 'Stating a limit clearly — without a lengthy explanation or apology.',
    plan: 'pro',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    format: 'text',
    medium: 'Text message',
    subCategories: ['personal-family-friends', 'personal-self-advocacy'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a friend or family member who keeps pushing past a limit you have',
    defaultSituation: 'you need to state a boundary clearly and hold it when they push back',
  },

  {
    id: 'checking-in-lost-touch',
    title: 'Checking in on a friend you have lost touch with',
    description: 'Reaching out after a gap without making it awkward or over-explaining.',
    plan: 'pro',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    format: 'text',
    medium: 'Text message',
    subCategories: ['personal-family-friends'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a friend you have not spoken to in several months',
    defaultSituation: 'you want to reach out and reconnect without making it feel weird',
  },

  {
    id: 'repairing-friendship-argument',
    title: 'Repairing a friendship after an argument',
    description: 'Reopening the door after a conflict — without rehashing everything.',
    plan: 'pro',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    format: 'text',
    medium: 'Text message',
    subCategories: ['personal-family-friends'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a friend you had a falling out with recently',
    defaultSituation: 'you want to repair the friendship and reach out first',
  },

  {
    id: 'conversation-parents-boundaries',
    title: 'Conversation with parents about boundaries',
    description: 'Having the boundaries conversation with a parent — calmly, directly.',
    plan: 'pro',
    difficulty: 'advanced',
    estimatedMinutes: 50,
    format: 'in-person',
    subCategories: ['personal-family-friends'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a parent who tends to overstep or not take your limits seriously',
    defaultSituation: 'you need to set or reinforce a boundary with a parent',
  },

  {
    id: 'addressing-recurring-conflict-friend',
    title: 'Addressing a recurring conflict with a friend',
    description: 'Naming a pattern that keeps coming up — without a blowup.',
    plan: 'pro',
    difficulty: 'advanced',
    estimatedMinutes: 50,
    format: 'in-person',
    subCategories: ['personal-family-friends'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a close friend where the same issue keeps coming up between you',
    defaultSituation: 'you want to address the pattern directly and try to resolve it',
  },

  {
    id: 'reconnecting-falling-out',
    title: 'Reconnecting after a falling out',
    description: 'Reaching back out after a serious rift — how to start without making it worse.',
    plan: 'pro',
    difficulty: 'advanced',
    estimatedMinutes: 50,
    format: 'text',
    medium: 'Text message',
    subCategories: ['personal-family-friends'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a friend you had a serious falling out with some time ago',
    defaultSituation: 'you want to reach out and try to reconnect after a significant rift',
  },

  // ── Personal — Self-Advocacy ───────────────────────────────────────────────

  {
    id: 'explaining-communication-style',
    title: 'Explaining your communication style',
    description: 'Telling someone new how you communicate best — without over-explaining.',
    plan: 'pro',
    difficulty: 'foundations',
    estimatedMinutes: 30,
    format: 'text',
    medium: 'Email',
    subCategories: ['personal-self-advocacy', 'professional-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a new colleague, collaborator, or person you are starting to work with',
    defaultSituation: 'you want to proactively share how you communicate best',
  },

  {
    id: 'asking-for-accommodation',
    title: 'Asking for an accommodation',
    description: 'Requesting what you need at school or work — directly and professionally.',
    plan: 'pro',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    format: 'text',
    medium: 'Email',
    subCategories: ['personal-self-advocacy', 'professional-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a manager, HR contact, or academic administrator',
    defaultSituation: 'you need to request an accommodation related to how you work or process information',
  },

  {
    id: 'how-to-receive-feedback',
    title: 'Telling someone how you prefer to receive feedback',
    description: 'Advocating for the feedback format that actually works for you.',
    plan: 'pro',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    format: 'text',
    medium: 'Email',
    subCategories: ['personal-self-advocacy', 'professional-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a manager or mentor who gives you feedback regularly',
    defaultSituation: 'you want to share how you process feedback best so future conversations go better',
  },

  // ── Professional — Colleague ───────────────────────────────────────────────

  {
    id: 'introducing-new-colleague',
    title: 'Introducing yourself to a new colleague',
    description: 'Making a good first impression without scripting yourself into stiffness.',
    plan: 'pro',
    difficulty: 'foundations',
    estimatedMinutes: 30,
    format: 'in-person',
    subCategories: ['professional-colleague'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a new colleague you are meeting for the first time',
    defaultSituation: 'you are starting a new role or project and introducing yourself',
  },

  {
    id: 'asking-colleague-reference',
    title: 'Asking for a reference',
    description: 'Making the ask clearly — and making it easy for them to say yes.',
    plan: 'pro',
    difficulty: 'foundations',
    estimatedMinutes: 30,
    format: 'text',
    medium: 'Email',
    subCategories: ['professional-colleague', 'professional-manager-boss'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a colleague or manager you have worked well with',
    defaultSituation: 'you are applying for a role and want to ask them to be a reference',
  },

  {
    id: 'colleague-taking-credit',
    title: 'Coworker keeps taking credit for your work',
    description: 'Addressing it directly without turning it into a drama.',
    plan: 'pro',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    format: 'text',
    medium: 'Slack message',
    subCategories: ['professional-colleague'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a colleague who has been taking credit for your contributions in meetings or with leadership',
    defaultSituation: 'you want to address the pattern directly and calmly',
  },

  {
    id: 'giving-constructive-feedback-peer',
    title: 'Giving constructive feedback to a peer',
    description: 'Telling a colleague something hard — without damaging the relationship.',
    plan: 'pro',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    format: 'text',
    medium: 'Slack message',
    subCategories: ['professional-colleague'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a peer whose work or behavior is having a negative impact on the team',
    defaultSituation: 'you want to give them honest feedback while preserving the relationship',
  },

  {
    id: 'navigating-conflict-peer',
    title: 'Navigating a conflict with a peer',
    description: 'Addressing a tension directly before it affects the team.',
    plan: 'pro',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    format: 'in-person',
    subCategories: ['professional-colleague'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a colleague you have been in conflict with over a project or decision',
    defaultSituation: 'you want to resolve the tension directly without escalating to management',
  },

  {
    id: 'reporting-workplace-issue-hr',
    title: 'Reporting a workplace issue to HR',
    description: 'Documenting and communicating a serious workplace concern clearly.',
    plan: 'pro',
    difficulty: 'advanced',
    estimatedMinutes: 50,
    format: 'text',
    medium: 'Email',
    subCategories: ['professional-colleague'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'an HR representative or People team contact',
    defaultSituation: 'you need to formally report a workplace issue and want to do it clearly and professionally',
  },

  // ── Professional — General Communication ──────────────────────────────────

  {
    id: 'follow-up-email',
    title: 'Sending a follow-up email after no response',
    description: 'Following up without being annoying — and actually getting a reply.',
    plan: 'pro',
    difficulty: 'foundations',
    estimatedMinutes: 30,
    format: 'text',
    medium: 'Email',
    subCategories: ['professional-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [
      {
        title: 'Why follow-ups feel so hard',
        type: 'content',
        content: [
          'TODO — overthinking vs. being persistent',
          'TODO — fear of being annoying',
          'TODO — what actually happens when you do not follow up',
        ],
      },
      {
        title: 'Timing and tone',
        type: 'content',
        content: [
          'TODO — when to follow up',
          'TODO — how to keep it brief',
          'TODO — what a good follow-up sounds like',
        ],
      },
      {
        title: 'What to avoid',
        type: 'what-not-to-do',
        content: [
          'TODO — passive-aggressive phrasing',
          'TODO — over-apologizing',
          'TODO — writing too long',
          'TODO — sending too soon or too late',
        ],
      },
      {
        title: 'Before we practice',
        type: 'section-check-in',
        checkIn: 'Have you ever held back from following up on something — even when you really should have?',
      },
    ],
    defaultPersona: 'a hiring manager who has not responded to your interview thank-you note',
    defaultSituation: 'it has been five days since your interview and you have not heard back',
    steps: [
      {
        label: 'Five days after your interview, still no response. You are writing the follow-up. How do you open?',
        aiSeed: '',
        options: [
          {
            text: 'Hi [Name], I hope your week is going well. I wanted to follow up on our conversation last Tuesday — I am still very excited about the opportunity.',
            quality: 'good',
            note: 'Specific, warm, and direct — references the actual conversation and states your interest without pressure.',
          },
          {
            text: 'Hi, just checking in on the role I interviewed for.',
            quality: 'okay',
            note: 'Functional but vague — no reference to when or what, and "just" softens it unnecessarily.',
          },
          {
            text: 'I am reaching out because I have not heard back and wanted to make sure my application was still being considered.',
            quality: 'avoid',
            note: 'The framing puts the burden on them and implies they dropped the ball — creates a defensive start.',
          },
        ],
      },
      {
        label: 'They reply.',
        aiSeed: 'Thanks for reaching out — we are still in the review process and will be in touch when we have an update.',
        options: [
          {
            text: 'Thank you for letting me know. I am happy to answer any questions or provide additional materials if that would be helpful.',
            quality: 'good',
            note: 'Closes gracefully while keeping the door open — leaves the ball in their court without pressure.',
          },
          {
            text: 'Okay, looking forward to hearing from you.',
            quality: 'okay',
            note: 'Simple and clean — not wrong, but a missed chance to restate your interest or offer something.',
          },
          {
            text: 'I do have another offer I am weighing, so any update on timeline would really help.',
            quality: 'avoid',
            note: 'Applying pressure here usually backfires — can come across as an ultimatum before they are ready.',
          },
        ],
      },
      {
        label: 'They follow up.',
        aiSeed: 'As we wrap up our review, is there anything else you would like to share before we make a decision?',
        options: [
          {
            text: 'I would love to reiterate how interested I am in the team and the direction of the work. I am confident I can contribute quickly and I am genuinely excited about this role.',
            quality: 'good',
            note: 'Specific, confident, and forward-looking — reinforces your candidacy without overselling.',
          },
          {
            text: 'Not really — I think the interview covered everything.',
            quality: 'okay',
            note: 'Missed opportunity — this is an invitation to reinforce your candidacy, not a quiz to pass.',
          },
          {
            text: 'I just really need this job and would be so grateful for the chance.',
            quality: 'avoid',
            note: 'Desperation shifts the dynamic and rarely helps — focus on value, not need.',
          },
        ],
      },
    ],
  },

  {
    id: 'asking-question-no-second-guessing',
    title: 'Asking a question without second-guessing yourself',
    description: 'Asking the thing you need to know — without the spiral of "is this a stupid question."',
    plan: 'pro',
    difficulty: 'foundations',
    estimatedMinutes: 30,
    format: 'text',
    medium: 'Slack message',
    subCategories: ['professional-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a colleague or manager you need to ask something of',
    defaultSituation: 'you have a question you need answered but keep second-guessing whether to send it',
  },

  {
    id: 'declining-meeting-professionally',
    title: 'Declining a meeting or request professionally',
    description: 'Saying no to a meeting or ask — clearly, without a guilt spiral.',
    plan: 'pro',
    difficulty: 'foundations',
    estimatedMinutes: 30,
    format: 'text',
    medium: 'Email',
    subCategories: ['professional-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a colleague or external contact who has sent a meeting request you cannot or should not accept',
    defaultSituation: 'you need to decline professionally without burning the relationship',
  },

  {
    id: 'linkedin-cold-outreach',
    title: 'LinkedIn cold outreach',
    description: 'Reaching out to someone you do not know — in a way that does not get ignored.',
    plan: 'pro',
    difficulty: 'foundations',
    estimatedMinutes: 30,
    format: 'text',
    medium: 'LinkedIn message',
    subCategories: ['professional-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a professional in your field you want to connect with or ask for advice',
    defaultSituation: 'you are reaching out cold on LinkedIn and want to make a good impression',
  },

  {
    id: 'networking-conversations',
    title: 'Networking conversations',
    description: 'Having a real conversation at a professional event — not just exchanging business cards.',
    plan: 'pro',
    difficulty: 'foundations',
    estimatedMinutes: 30,
    format: 'in-person',
    subCategories: ['professional-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a senior professional in your field at a conference or work event',
    defaultSituation: 'you want to introduce yourself and make a genuine connection',
  },

  {
    id: 'writing-email-frustrated',
    title: 'Writing an email when frustrated',
    description: 'Getting your point across when you are annoyed — without sending something you will regret.',
    plan: 'pro',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    format: 'text',
    medium: 'Email',
    subCategories: ['professional-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a colleague or stakeholder whose actions have frustrated you',
    defaultSituation: 'you need to write an email addressing the issue without letting your frustration take over',
  },

  {
    id: 'asking-clarification-no-incompetent',
    title: 'Asking for clarification without sounding incompetent',
    description: 'Getting the information you need without the spiral of "they will think I do not know what I am doing."',
    plan: 'pro',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    format: 'text',
    medium: 'Slack message',
    subCategories: ['professional-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a manager or senior colleague who gave you unclear instructions',
    defaultSituation: 'you need to ask for clarification on something without making yourself look bad',
  },

  {
    id: 'pushing-back-deadline',
    title: 'Pushing back on a deadline',
    description: 'Renegotiating a timeline — clearly and professionally, before it becomes a crisis.',
    plan: 'pro',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    format: 'text',
    medium: 'Slack message',
    subCategories: ['professional-general'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a manager who has set a deadline that is not realistic',
    defaultSituation: 'you need to push back on the timeline and propose an alternative',
  },

  // ── Professional — Manager and Boss ───────────────────────────────────────

  {
    id: 'follow-up-job-interview',
    title: 'Following up after a job interview',
    description: 'Sending the thank-you note that actually means something.',
    plan: 'pro',
    difficulty: 'foundations',
    estimatedMinutes: 30,
    format: 'text',
    medium: 'Email',
    subCategories: ['professional-manager-boss'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'the hiring manager you just interviewed with',
    defaultSituation: 'you want to send a follow-up note after your interview',
  },

  {
    id: 'asking-manager-feedback',
    title: 'Asking your manager for feedback on your work',
    description: 'Getting useful feedback — not just reassurance.',
    plan: 'pro',
    difficulty: 'foundations',
    estimatedMinutes: 30,
    format: 'text',
    medium: 'Slack message',
    subCategories: ['professional-manager-boss'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'your manager',
    defaultSituation: 'you want to ask for specific, useful feedback on your recent work',
  },

  {
    id: 'checking-in-new-role',
    title: 'Checking in after starting a new role',
    description: 'The first 1:1 check-in with a new manager — making it count.',
    plan: 'pro',
    difficulty: 'foundations',
    estimatedMinutes: 30,
    format: 'in-person',
    subCategories: ['professional-manager-boss'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'your new manager, a few weeks into the role',
    defaultSituation: 'you are checking in on how things are going and want to get aligned on expectations',
  },

  {
    id: 'responding-vague-feedback',
    title: 'Responding to vague or unclear feedback',
    description: 'Asking follow-up questions that turn "you need to communicate better" into something you can actually act on.',
    plan: 'pro',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    format: 'in-person',
    subCategories: ['professional-manager-boss'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'your manager who just gave you feedback that was too vague to be useful',
    defaultSituation: 'you want to ask clarifying questions to understand what they actually mean',
  },

  {
    id: 'negotiating-job-offer',
    title: 'Negotiating an initial job offer',
    description: 'Countering an offer professionally — without torpedoing it.',
    plan: 'pro',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    format: 'in-person',
    subCategories: ['professional-manager-boss'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'a hiring manager or recruiter who has just made you an offer',
    defaultSituation: 'you want to negotiate the offer without seeming ungrateful or difficult',
  },

  {
    id: 'asking-for-raise',
    title: 'Asking for a raise',
    description: 'Building the case, stating the ask, and handling pushback.',
    plan: 'pro',
    difficulty: 'advanced',
    estimatedMinutes: 50,
    format: 'in-person',
    subCategories: ['professional-manager-boss'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'your manager in a 1:1',
    defaultSituation: 'you are bringing up compensation for the first time and have a specific ask',
  },

  {
    id: 'telling-manager-overwhelmed',
    title: 'Telling your manager you are overwhelmed',
    description: 'Raising capacity issues before they become a performance issue.',
    plan: 'pro',
    difficulty: 'advanced',
    estimatedMinutes: 50,
    format: 'in-person',
    subCategories: ['professional-manager-boss'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'your manager in a 1:1',
    defaultSituation: 'you are at or past capacity and need to surface this before it gets worse',
  },

  {
    id: 'responding-negative-review',
    title: 'Responding to a negative performance review',
    description: 'Handling critical feedback professionally — without shutting down or getting defensive.',
    plan: 'pro',
    difficulty: 'advanced',
    estimatedMinutes: 50,
    format: 'in-person',
    subCategories: ['professional-manager-boss'],
    whyItsHard: 'TODO — add authored content',
    educationalSlides: [],
    defaultPersona: 'your manager delivering a performance review with significant criticism',
    defaultSituation: 'you are receiving feedback that feels unfair or surprising and need to respond professionally',
  },
]
