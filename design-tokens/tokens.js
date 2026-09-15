// ClassPulse — Editorial Brutalist Design Tokens JS Export
// Extracted from DESIGN.md (Canonical Brand Source of Truth)

export const colors = {
  canvas: '#f6f6f3',
  surface: {
    DEFAULT: '#ffffff',
    sunken: '#fafaf8',
    hover: '#f1f1ee',
    selected: '#f2f2ef',
  },
  ink: {
    DEFAULT: '#111111',
    hover: '#333333',
    2: '#444444',
  },
  text: {
    primary: '#111111',
    secondary: '#555555',
    muted: '#777777',
    muted2: '#888888',
    muted3: '#666666',
    faint: '#999999',
  },
  onInk: {
    DEFAULT: '#bdbdbd',
    eyebrow: '#aaaaaa',
    hover: '#dddddd',
  },
  border: {
    strong: '#111111',
    DEFAULT: '#d7d7d2',
    topbar: '#d5d5d0',
    input: '#cfcfca',
    soft: '#e2e2dd',
    faint: '#e8e8e3',
    ghost: '#ddddda',
    btn: '#ccccca',
  },
  track: '#e8e8e3',
};

export const typography = {
  fontFamily: {
    sans: 'Inter, Arial, Helvetica, sans-serif',
    display: 'Inter, Arial, Helvetica, sans-serif',
  },
  fontSize: {
    micro: '8px',
    eyebrow: '9px',
    label: '10px',
    caption: '11px',
    body: '12px',
    lead: '13px',
    stat: '46px',
    h3: '20px',
    h2: '31px',
    display: 'clamp(42px, 6vw, 76px)',
    hero: 'clamp(58px, 7vw, 94px)',
  },
  letterSpacing: {
    eyebrow: '1.8px',
    stat: '1.5px',
    label: '1px',
    brand: '1.2px',
    tightest: '-2px',
  },
};

export const borderRadius = {
  none: '0px',
  sm: '0px',
  md: '0px',
  lg: '0px',
  full: '0px',
};

export const shadows = {
  hard: '6px 6px 0 #111111',
  hardSm: '2px 2px 0 #111111',
  hardLg: '8px 8px 0 #111111',
  hardWarm: '7px 7px 0 #bdbdb7',
  focus: '4px 4px 0 #dddddd',
  modal: '0 20px 60px rgba(0, 0, 0, 0.15)',
};

export const screens = {
  sm: '560px',
  md: '800px',
  lg: '1100px',
  xl: '1380px',
};
