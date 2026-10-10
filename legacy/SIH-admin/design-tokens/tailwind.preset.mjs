/** @type {import('tailwindcss').Config} */
// ClassPulse — Editorial Brutalist / Swiss Monochrome Design System
// Extracted from DESIGN.md (Canonical Brand Source of Truth)
// Preset for Tailwind CSS v3
export default {
  theme: {
    // Utility breakpoints matching CSS media queries
    screens: {
      sm: '560px',
      md: '800px',
      lg: '1100px',
      xl: '1380px',
    },
    extend: {
      // Zero Radius Rule: all rounded-* utilities render square
      borderRadius: {
        none: '0',
        DEFAULT: '0',
        sm: '0',
        md: '0',
        lg: '0',
        xl: '0',
        '2xl': '0',
        '3xl': '0',
        full: '0',
      },
      // Strict Monochrome Palette
      colors: {
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
        muted: {
          DEFAULT: '#777777',
          2: '#888888',
          3: '#666666',
          4: '#555555',
          5: '#999999',
        },
        onink: {
          DEFAULT: '#bdbdbd',
          2: '#bbbbbb',
          eyebrow: '#aaaaaa',
          hover: '#dddddd',
        },
        line: {
          DEFAULT: '#d7d7d2',
          strong: '#111111',
          topbar: '#d5d5d0',
          input: '#cfcfca',
          soft: '#e2e2dd',
          faint: '#e8e8e3',
          ghost: '#ddddda',
          btn: '#ccccca',
        },
        track: '#e8e8e3',
      },
      // Inter-only typography
      fontFamily: {
        sans: ['Inter', 'Arial', 'Helvetica', 'sans-serif'],
        display: ['Inter', 'Arial', 'Helvetica', 'sans-serif'],
      },
      fontSize: {
        micro: ['8px', { lineHeight: '1.2' }],
        eyebrow: ['9px', { lineHeight: '1.2' }],
        label: ['10px', { lineHeight: '1.3' }],
        caption: ['11px', { lineHeight: '1.55' }],
        body: ['12px', { lineHeight: '1.6' }],
        lead: ['13px', { lineHeight: '1.6' }],
        stat: ['46px', { lineHeight: '1', letterSpacing: '-2px' }],
        display: ['clamp(42px, 6vw, 76px)', { lineHeight: '0.9', letterSpacing: '-4px' }],
        hero: ['clamp(58px, 7vw, 94px)', { lineHeight: '0.88', letterSpacing: '-5px' }],
      },
      letterSpacing: {
        eyebrow: '1.8px',
        stat: '1.5px',
        label: '1px',
        brand: '1.2px',
        tightest: '-2px',
      },
      // Hard un-blurred offset shadows
      boxShadow: {
        none: 'none',
        hard: '6px 6px 0 #111111',
        'hard-sm': '2px 2px 0 #111111',
        'hard-lg': '8px 8px 0 #111111',
        'hard-warm': '7px 7px 0 #bdbdb7',
        focus: '4px 4px 0 #dddddd',
        modal: '0 20px 60px rgba(0, 0, 0, 0.15)',
        DEFAULT: 'none',
        sm: 'none',
        md: 'none',
        lg: 'none',
        xl: 'none',
        '2xl': 'none',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
      maxWidth: {
        content: '1380px',
      },
    },
  },
};
