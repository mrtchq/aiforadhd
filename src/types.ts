export interface WaitlistItem {
  email: string;
  timestamp: string;
  name?: string;
}

export interface HelpPoint {
  id: string;
  title: string;
  description: string;
  emoji: string;
  color: string; // Tailwind glow/border color (e.g., 'amber', 'cyan')
  tip: string; // ADHD-friendly immediate AI prompt or system tip
}

export interface StackComponent {
  title: string;
  subtitle: string;
  description: string;
  iconName: 'brain' | 'terminal' | 'server' | 'checkSquare' | 'bot' | 'database';
  badge?: string;
  accentColor: string;
  websiteUrl?: string;
}

export interface ClarityWeek {
  week: number;
  title: string;
  goal: string;
  description: string;
  steps: string[];
}
