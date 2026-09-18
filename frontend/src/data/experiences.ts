export interface Experience {
  org: string;
  role: string;
  /** Free text — "2022 – 2023", "2024", whatever reads best. */
  period: string;
  /** One sentence. */
  summary: string;
  /** Two to four short achievements. */
  points: string[];
  /** Hex colour; the depth scene's glow shifts to it while this card is read. */
  accent: string;
}

// Example content only — every entry is marked "(Contoh)". Replace all six with
// real experiences before shipping.
export const EXPERIENCES: Experience[] = [
  {
    org: 'Student Association (Contoh)',
    role: 'Head of Media',
    period: '2021 – 2022',
    summary: 'Led the creative team behind every public-facing channel.',
    points: ['Managed a team of 8 designers and writers', 'Doubled Instagram engagement', 'Wrote the first brand guideline'],
    accent: '#7FA7C9'
  },
  {
    org: 'Faculty Student Council (Contoh)',
    role: 'Communications Staff',
    period: '2022',
    summary: 'Handled communication and documentation for council programs.',
    points: ['Produced 40+ publication assets', 'Maintained the faculty website'],
    accent: '#8FB8A2'
  },
  {
    org: 'Developer Community (Contoh)',
    role: 'Event Coordinator',
    period: '2022 – 2023',
    summary: 'Coordinated monthly tech meetups and hands-on workshops.',
    points: ['Ran 12 events for 600+ attendees', 'Secured 5 sponsorship partners'],
    accent: '#A99BD6'
  },
  {
    org: 'Campus Festival Committee (Contoh)',
    role: 'Program Coordinator',
    period: '2023',
    summary: 'Built the rundown and led the program team for the yearly festival.',
    points: ['Led a committee of 20', 'Hosted 3,000+ visitors', 'Delivered on budget'],
    accent: '#C99A86'
  },
  {
    org: 'Research Club (Contoh)',
    role: 'Vice Chair',
    period: '2023 – 2024',
    summary: 'Shaped the direction of the student research program.',
    points: ['Mentored 3 paper competition teams', '2 teams reached the national finals'],
    accent: '#86B6C9'
  },
  {
    org: 'Volunteer Organization (Contoh)',
    role: 'Project Lead',
    period: '2024',
    summary: 'Led a community outreach program in a partner village.',
    points: ['Literacy program for 150 children', 'Raised Rp25 million in funding'],
    accent: '#BFA9C4'
  }
];
