import { ROLE_CARDS } from '@/components/auth/role-cards';
import type { LandingCopy } from './types';

/**
 * English: the canonical copy of /about, and the source every translation is made from.
 * Change a string here and the matching string in hi.ts and ta.ts goes back to 'draft' (see i18n/index.ts).
 */
export const en: LandingCopy = {
  locale: 'en',
  meta: {
    title: 'ClassPulse: every lecture, turned into learning',
    description:
      'ClassPulse records the class, writes a quiz in the teacher’s language, and runs it on every student’s phone. Built for Indian schools.',
    ogImageAlt: 'ClassPulse: every lecture, turned into learning. For Indian schools.',
  },

  header: {
    nav: { howItWorks: 'How it works', tryQuestion: 'Try a question', inside: 'What’s inside', faq: 'FAQ' },
    mainNavLabel: 'Main',
    languageNavLabel: 'Language',
    signIn: 'Sign in',
    bookDemo: 'Book a demo',
    bookDemoShort: 'Book demo',
    menu: 'Menu',
    menuDialogLabel: 'Menu',
    close: 'Close',
    wordmarkLabel: 'ClassPulse, back to top',
    notDecider: 'Not the one who decides?',
    shareToManagement: 'Send this page to your management',
  },

  story: {
    sectionLabel: 'How ClassPulse works',
    chapters: {
      hero: {
        title: 'Every lecture, turned into learning.',
        body: 'ClassPulse listens to the lesson in Tamil, Hindi or English, mixed the way your teachers really speak. It writes a quiz from what was said and puts it on every student’s phone.',
      },
      record: {
        title: 'It starts with the lesson you already teach.',
        body: 'A small device on the teacher’s desk records the class. No device in the room? Upload a phone recording instead.',
      },
      understand: {
        title: 'It understands how your teachers actually speak.',
        body: 'Tamil, Hindi and eight more Indian languages, mixed with English the way real classrooms are. Subject terms stay in English.',
      },
      quiz: {
        title: 'Questions only from what was said.',
        body: 'AI writes multiple-choice questions from the lecture itself. Each one links to the moment it came from, and nothing reaches students until the teacher approves it.',
      },
      play: {
        title: 'Every phone in the room lights up.',
        body: 'Students answer on their own phones, at their own pace or as a live game-show round in class.',
      },
      insight: {
        title: 'See who understood, and what to teach again.',
        body: 'Results by student and by question, tagged by Bloom level, with a plan for what to re-teach tomorrow.',
      },
    },
    stepOf: 'Step {step} of {total}: ',
    tryQuestion: 'Try a question',
    codemixTranslation: 'In photosynthesis, it’s chlorophyll that absorbs sunlight.',
    questionLinked: 'Question linked to this moment',
    questionPrompt: 'In photosynthesis, what absorbs sunlight?',
  },

  rail: {
    navLabel: 'Story chapters',
    lessonTime: 'Lesson time ',
    play: 'Play',
    pause: 'Pause',
    playAnimation: 'Play animation',
    pauseAnimation: 'Pause animation',
    labels: ['Start', 'Record', 'Understand', 'Quiz', 'Play', 'Insight'],
  },

  tryQuestion: {
    title: 'Be the student for twenty seconds.',
    intro:
      'This question came from {time} into a Class 8B science lesson, taught in Tamil and English. Press Start and answer it the way a student would.',
    saidLabel: 'What the teacher said',
    codemixTranslation: 'In photosynthesis, it’s chlorophyll that absorbs sunlight.',
    wroteNote:
      'ClassPulse wrote the question from this line. The teacher approved it before any student saw it.',
    appBar: 'Class 8B science',
    questionCount: 'Q 1/1',
    topic: 'Photosynthesis',
    readyTitle: ['Your quiz', 'is ready.'],
    readyBody:
      'The same quiz students get after class, written from the lesson and approved by their teacher.',
    noLimitShort: ['No', 'limit'],
    seconds: 'seconds',
    noTimeLimit: 'No time limit',
    start: 'Start',
    untimedHint: 'Take as long as you need.',
    timedHint: 'The timer starts when you press Start.',
    questionNumber: 'Question 1',
    fromLesson: 'From the lesson at {time}',
    yourAnswer: 'Your answer',
    answer: 'Answer',
    correct: 'Correct.',
    notQuite: 'Not quite.',
    timesUp: 'Time’s up.',
    explanation: 'Chlorophyll in the leaf absorbs light energy. The teacher said it at {time}.',
    tryAgain: 'Try again',
    secondsLeft: 'Seconds left: ',
    prompt: 'In photosynthesis, what absorbs sunlight?',
    announce: {
      timesUp: 'Time’s up. The answer is {answer}. {explanation}',
      startUntimed: 'No time limit. {prompt}',
      startTimed: 'Timer started: {seconds} seconds. {prompt}',
      correct: 'Correct: {answer}. {explanation}',
      wrong: 'Not quite. You chose {choice}. The answer is {answer}. {explanation}',
    },
  },

  languageWall: {
    title: 'Eleven ways to say learning.',
    lede: 'ClassPulse understands lessons in ten Indian languages and English, including the mix of both that real classrooms run on.',
    hint: 'Point at a word, or tap it, to see the language. Subject terms stay in English, the way teachers say them.',
    names: {
      en: 'English',
      ta: 'Tamil',
      hi: 'Hindi',
      kn: 'Kannada',
      te: 'Telugu',
      pa: 'Punjabi',
      bn: 'Bengali',
      ml: 'Malayalam',
      mr: 'Marathi',
      or: 'Odia',
      gu: 'Gujarati',
    },
  },

  bento: {
    title: 'What else is inside.',
    lede: 'The quiz is where it starts. The same school account also runs exams, homework and lesson prep.',
    exams: {
      title: 'Secure, timed exams',
      body: 'One question at a time, in fullscreen, with answers saved as students go. Leaving the exam counts as a warning, and you watch it all live.',
    },
    homework: {
      title: 'Homework, marked faster',
      body: 'Students upload their work. AI suggests a grade and a comment, and you confirm or change it.',
    },
    phones: {
      title: 'Runs on the phones students already have',
      body: 'Any phone browser works, so there’s nothing to download from a store. Add it to the home screen and it opens like an app.',
    },
    studio: {
      title: 'Lesson prep, written with you',
      body: 'Lesson plans, worksheets, question papers and slides. Type what you need, or just say it.',
    },
  },

  roles: {
    title: 'One school, three views.',
    lede: 'The school buys ClassPulse once. Admins, teachers and students each sign in to their own part of it.',
    tablistLabel: 'ClassPulse views',
    views: {
      admin: {
        tab: 'Admin',
        where: 'The school office',
        title: 'Set the school up once',
        description: ROLE_CARDS.admin.description,
        points: [
          'Set up each class with its teacher, room and a join code for students.',
          'Add teachers one at a time or from a CSV file.',
          'Import students from a CSV and print their sign-in slips.',
        ],
        screenAlt:
          'The admin console, showing the Grade 8 - B class: its teacher, room, student join code and enrolled students',
      },
      teacher: {
        tab: 'Teacher',
        where: 'The classroom',
        title: 'Teach, then approve the quiz',
        description: ROLE_CARDS.teacher.description,
        points: [
          'Review each question the AI writes beside its timestamp. One tap plays the part of the lesson it came from.',
          'Approve, edit or reject it. Students see only what you approve.',
          'Run it live in class, or set it for students to take later.',
        ],
        screenAlt:
          'The teacher’s lesson page for a Class 8B photosynthesis lesson: AI-written questions waiting for review, each with the timestamp it came from',
      },
      student: {
        tab: 'Student',
        where: 'Their own phone',
        title: 'Learn on any phone',
        description: ROLE_CARDS.student.description,
        points: [
          'Take quizzes at their own pace and retake them as often as they like.',
          'Join a live quiz in class with a 6-digit PIN.',
          'Sit exams and hand in homework from the same phone.',
        ],
        screenAlt: 'The student portal on a phone, showing a quiz question in Tamil and English',
      },
    },
  },

  faq: {
    title: 'Questions schools ask.',
    askUs: 'Something else on your mind? Write to {email}.',
    items: [
      {
        q: 'Do teachers have to check every question?',
        a: 'Yes, and that’s on purpose. Nothing reaches students until the teacher approves it. Each question links to the moment in the lecture it came from, so checking is quick, and teachers can edit or reject any question before approving the rest.',
      },
      {
        q: 'Which languages does it understand?',
        a: 'English, Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi and Odia, including the way teachers mix them with English in the same sentence. Questions are written in the lesson’s language and in English, with subject terms kept in English.',
      },
      {
        q: 'What does a classroom need, and what if the internet drops?',
        a: 'One small recorder on the teacher’s desk, a plug point and the school’s Wi‑Fi. If the connection drops, the recording carries on: the device saves the class in 60‑second pieces and uploads each one once it can. A classroom without a recorder can still use ClassPulse, because teachers can upload a recording from their phone instead.',
      },
      {
        q: 'Do students need to install an app?',
        a: 'No. ClassPulse runs in the browser on any phone. Students can add it to their home screen if they like, and it then opens like an app.',
      },
      {
        q: 'Who can hear the recordings?',
        a: 'Inside the school, people see only what their role allows: teachers see their own lessons, and students can play the short part of a lesson that a quiz question came from. Schools can’t see each other’s data. Outside the school, Sarvam AI (India) turns the audio into text, and OpenAI (United States) writes the questions from that text. OpenAI gets the audio itself only if the school chooses it for speech-to-text, or as a fallback for English lessons. Children’s names and account details are not sent to AI providers, and children’s data is never used for advertising or to train AI models.',
      },
      {
        q: 'Where is our data kept, and for how long?',
        a: 'On ClassPulse’s servers, hosted by Oracle Cloud Infrastructure. Lesson audio is deleted automatically after 30 days, and transcripts after 365 days by default. Accounts, quizzes, exams and grades stay while your school uses ClassPulse. Encrypted backups are overwritten after about five weeks. If your school leaves, we give you an export of your data on request and then delete it.',
      },
      {
        q: 'Do we need parents’ consent?',
        a: 'Yes, for students under 18. Under the DPDP Act your school decides how the data is used, and we handle it on your behalf. Before a child uses ClassPulse, the school gets a parent’s or guardian’s consent and tells families that classes may be recorded. A parent can withdraw consent through the school.',
        link: { href: '/privacy', label: 'Read the privacy notice', after: '.' },
      },
    ],
  },

  finale: {
    title: 'Run a pilot at your school.',
    lede: 'Tell us about your school. We’ll show you ClassPulse working, then set it up with you in a few classrooms.',
    stepsLabel: 'How a pilot runs',
    steps: [
      {
        title: 'A device in each classroom',
        body: 'A Raspberry Pi 5 and a USB mic on the teacher’s desk. It needs a plug point and the school’s Wi‑Fi.',
      },
      {
        title: 'Accounts from two spreadsheets',
        body: 'One CSV of teachers, one of students. Every student gets a printable sign‑in slip.',
      },
      {
        title: 'Teachers shown how it works',
        body: 'We sit with each teacher to record a lesson, review its questions and start a quiz.',
      },
      {
        title: 'First quizzes in class',
        body: 'Students answer on their own phones. We aim for the first week.',
      },
    ],
    asideLabel: 'Other ways to reach us',
    preferEmail: 'Prefer email?',
    emailHint: 'Tell us your school’s name, city, how many classrooms, and a good time to call.',
    notDecider: 'Not the one who decides?',
    notDeciderBody: 'Send this page to your management, with a short note on what ClassPulse does.',
  },

  demoForm: {
    title: 'Book a demo',
    subtitle: 'We’ll call you to set up a time.',
    fields: {
      name: 'Your name',
      phone: 'Phone (WhatsApp)',
      phoneHint: 'We’ll call or message you here.',
      school: 'School',
      city: 'City',
      email: 'Email',
      role: 'Your role',
      rolePlaceholder: 'e.g. Principal',
      classrooms: 'Number of classrooms',
      message: 'Anything else?',
    },
    optional: '(optional)',
    addDetails: 'Add details',
    fewerDetails: 'Fewer details',
    submit: 'Request a demo',
    sending: 'Sending…',
    sendingAnnouncement: 'Sending your request…',
    privacyNote: 'We use these details only to arrange your demo.',
    emailUs: 'Email {email}',
    failures: {
      invalid: { title: 'Please check the highlighted fields.', body: 'Or send the same details by email.' },
      rate: {
        title: 'Too many requests from this connection.',
        body: 'Please try again in a while, or email us. Your details are already filled in.',
      },
      unavailable: {
        title: 'We can’t send requests from here right now.',
        body: 'Please email us instead. It reaches the same team, and your details are already filled in.',
      },
      network: {
        title: 'We couldn’t reach ClassPulse.',
        body: 'Check your connection and try again, or email us. Your details are already filled in.',
      },
      other: {
        title: 'Something went wrong sending your request.',
        body: 'Please try again, or email us. Your details are already filled in.',
      },
    },
    sent: {
      titleNamed: 'Thank you, {name}. Your request is in.',
      title: 'Thank you. Your request is in.',
      body: 'We’ll call or WhatsApp you on {phone} to set up a time. In the demo we’ll show you ClassPulse working and plan a pilot around your classrooms.',
      share: 'Share with your management',
      addSomething: 'Want to add something? Email {email}',
    },
    // English pages show the shared schema's own messages.
    errors: null,
  },

  mailto: {
    subject: 'ClassPulse demo for our school',
    labels: {
      schoolName: 'School name',
      name: 'Name',
      school: 'School',
      city: 'City',
      phone: 'Phone (WhatsApp)',
      role: 'Role',
      classrooms: 'Number of classrooms',
      bestTime: 'Best time to call',
    },
  },

  share: {
    brief:
      'ClassPulse records the class, writes a quiz in the teacher’s language and runs it on every student’s phone. Worth a look for our school:',
    label: 'Send to your management',
    copyLink: 'Copy link',
    copied: 'Link copied',
    copyFailed: 'Couldn’t copy. The link is',
  },

  footer: {
    madeBy: 'ClassPulse is made by BenX Solutions for schools in India.',
    navLabel: 'Footer',
    signIn: 'Sign in',
    privacy: 'Privacy',
    terms: 'Terms',
    backToTop: 'Back to top',
    draftNote: 'This translation is being reviewed.',
  },
};
