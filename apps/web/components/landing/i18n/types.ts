import type { Role } from '@classpulse/shared';

/** The languages the product page is published in. English (/about) is the canonical page. */
export type Locale = 'en' | 'hi' | 'ta';

/** 'draft': machine-assisted first pass, not yet checked by a native speaker. 'reviewed': approved for search. */
export type TranslationStatus = 'draft' | 'reviewed';

/** The eleven languages on the language wall, by BCP-47 code. */
export type WallLanguage = 'en' | 'ta' | 'hi' | 'kn' | 'te' | 'pa' | 'bn' | 'ml' | 'mr' | 'or' | 'gu';

/** The story's chapters, in order (ids match CHAPTERS in story/chapters.ts). */
export type StoryChapterId = 'hero' | 'record' | 'understand' | 'quiz' | 'play' | 'insight';

/** Why a demo request couldn't be sent. */
export type DemoFailure = 'invalid' | 'rate' | 'unavailable' | 'network' | 'other';

/**
 * Templates: `{name}` placeholders are filled by `fill()` (plain text) or `fillNodes()` (React nodes) in
 * i18n/index.ts. Keep every placeholder when translating; move it wherever the sentence needs it.
 */
type Template = string;

interface Titled {
  title: string;
  body: string;
}

/**
 * Validation messages for the demo form, keyed by what went wrong. The shared zod schema
 * (DemoRequestInput in @classpulse/shared) speaks English; demo-form.tsx maps each of its messages here.
 */
export interface DemoFormErrors {
  required: { name: string; school: string; city: string };
  /** {max}: the field's character limit. */
  tooLong: Template;
  phoneRequired: string;
  phoneDigitsOnly: string;
  /** {n}: digits. */
  phoneMinDigits: Template;
  phoneMaxDigits: Template;
  email: string;
  wholeNumber: string;
  /** {n}: the smallest / largest number of classrooms. */
  minNumber: Template;
  maxNumber: Template;
}

/** The parts of the page that render in the browser (client components read these through context). */
export interface LandingClientCopy {
  locale: Locale;
  header: {
    nav: { howItWorks: string; tryQuestion: string; inside: string; faq: string };
    mainNavLabel: string;
    languageNavLabel: string;
    signIn: string;
    bookDemo: string;
    /** The phone header's compact button. */
    bookDemoShort: string;
    menu: string;
    menuDialogLabel: string;
    close: string;
    wordmarkLabel: string;
    notDecider: string;
    shareToManagement: string;
  };
  rail: {
    navLabel: string;
    /** Screen-reader prefix before the lesson timecode (keep the trailing space). */
    lessonTime: string;
    play: string;
    pause: string;
    playAnimation: string;
    pauseAnimation: string;
    /** Short chapter names, one per chapter in order. */
    labels: readonly [string, string, string, string, string, string];
  };
  tryQuestion: {
    title: string;
    /** {time}: the lecture timestamp. */
    intro: Template;
    saidLabel: string;
    /** The codemix line, in the reader's language. */
    codemixTranslation: string;
    wroteNote: string;
    appBar: string;
    questionCount: string;
    topic: string;
    readyTitle: readonly [string, string];
    readyBody: string;
    noLimitShort: readonly [string, string];
    seconds: string;
    noTimeLimit: string;
    start: string;
    untimedHint: string;
    timedHint: string;
    questionNumber: string;
    /** {time}: the lecture timestamp, rendered in mono. */
    fromLesson: Template;
    yourAnswer: string;
    answer: string;
    correct: string;
    notQuite: string;
    timesUp: string;
    /** {time}: the lecture timestamp. */
    explanation: Template;
    tryAgain: string;
    secondsLeft: string;
    /** The question in the reader's language, for screen-reader announcements. */
    prompt: string;
    /** Live-region announcements. {answer}, {choice}, {explanation}, {prompt}, {seconds}. */
    announce: {
      timesUp: Template;
      startUntimed: Template;
      startTimed: Template;
      correct: Template;
      wrong: Template;
    };
  };
  languageWall: {
    title: string;
    lede: string;
    hint: string;
    names: Record<WallLanguage, string>;
  };
  roles: {
    title: string;
    lede: string;
    tablistLabel: string;
    views: Record<
      Role,
      {
        tab: string;
        where: string;
        title: string;
        description: string;
        points: readonly string[];
        screenAlt: string;
      }
    >;
  };
  demoForm: {
    title: string;
    subtitle: string;
    fields: {
      name: string;
      phone: string;
      phoneHint: string;
      school: string;
      city: string;
      email: string;
      role: string;
      rolePlaceholder: string;
      classrooms: string;
      message: string;
    };
    optional: string;
    addDetails: string;
    fewerDetails: string;
    submit: string;
    sending: string;
    sendingAnnouncement: string;
    privacyNote: string;
    /** {email} */
    emailUs: Template;
    failures: Record<DemoFailure, { title: string; body: string }>;
    sent: {
      /** {name}: the visitor's first name. */
      titleNamed: Template;
      title: string;
      /** {phone} */
      body: Template;
      share: string;
      /** {email} */
      addSomething: Template;
    };
    /** null: show the shared schema's own (English) messages. */
    errors: DemoFormErrors | null;
  };
  /** The email fallback (mailto:) — what lands in BenX's inbox when a visitor writes instead. */
  mailto: {
    subject: string;
    labels: {
      schoolName: string;
      name: string;
      school: string;
      city: string;
      phone: string;
      role: string;
      classrooms: string;
      bestTime: string;
    };
  };
  share: {
    /** The note that goes with the link (WhatsApp / share sheet). */
    brief: string;
    label: string;
    copyLink: string;
    copied: string;
    /** Shown before the URL when the clipboard is blocked. */
    copyFailed: string;
  };
}

/** Every visible string, label and piece of metadata on the product page. */
export interface LandingCopy extends LandingClientCopy {
  meta: { title: string; description: string; ogImageAlt: string };
  story: {
    sectionLabel: string;
    chapters: Record<StoryChapterId, Titled>;
    /** Screen-reader prefix on each caption. {step}, {total}. */
    stepOf: Template;
    tryQuestion: string;
    codemixTranslation: string;
    questionLinked: string;
    questionPrompt: string;
  };
  bento: {
    title: string;
    lede: string;
    exams: Titled;
    homework: Titled;
    phones: Titled;
    studio: Titled;
  };
  faq: {
    title: string;
    /** {email} */
    askUs: Template;
    items: readonly { q: string; a: string; link?: { href: string; label: string; after: string } }[];
  };
  finale: {
    title: string;
    lede: string;
    stepsLabel: string;
    steps: readonly [Titled, Titled, Titled, Titled];
    asideLabel: string;
    preferEmail: string;
    emailHint: string;
    notDecider: string;
    notDeciderBody: string;
  };
  footer: {
    madeBy: string;
    navLabel: string;
    signIn: string;
    privacy: string;
    terms: string;
    backToTop: string;
    /** Shown only while the page's translation is a draft. */
    draftNote: string;
  };
}
