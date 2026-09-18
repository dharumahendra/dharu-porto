// Contact details shown in the footer. Every value here is a placeholder —
// replace the email and each `href` with the real ones before shipping.
export const CONTACT_EMAIL = 'hello@example.com';

export type SocialKind = 'email' | 'linkedin' | 'instagram' | 'behance' | 'github';

export interface SocialLink {
  kind: SocialKind;
  /** Accessible name; also shown as the tooltip. */
  label: string;
  href: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  { kind: 'email', label: 'Email', href: `mailto:${CONTACT_EMAIL}` },
  { kind: 'linkedin', label: 'LinkedIn', href: '#' },
  { kind: 'instagram', label: 'Instagram', href: '#' },
  { kind: 'behance', label: 'Behance', href: '#' },
  { kind: 'github', label: 'GitHub', href: '#' }
];
