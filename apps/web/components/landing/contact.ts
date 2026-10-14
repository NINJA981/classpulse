export const CONTACT_EMAIL = 'admin@benxsolutions.in';

/** The words the email fallback is written in (the page's `mailto` copy in components/landing/i18n). */
export interface MailtoCopy {
  subject: string;
  labels: { schoolName: string; city: string; classrooms: string; bestTime: string };
}

/** Email fallback for booking a demo, in the page's language — shown beside the form, and used if the form can't be sent. */
export function demoMailto({ subject, labels }: MailtoCopy): string {
  const body = [labels.schoolName, labels.city, labels.classrooms, labels.bestTime].map((l) => `${l}:\n`).join('');
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** The English email fallback (/about). */
export const DEMO_MAILTO = demoMailto({
  subject: 'ClassIQ demo for our school',
  labels: {
    schoolName: 'School name',
    city: 'City',
    classrooms: 'Number of classrooms',
    bestTime: 'Best time to call',
  },
});

/** Every "Book a demo" button on /about jumps to the demo request form (in the finale, `id="book"`). */
export const DEMO_HREF = '#book';

export const SITE_URL = 'https://classpulse.benxsolutions.in';
