import type { UsageTier } from './formatDuration';

export const LOW_USAGE_MESSAGES: string[] = [
  'Every shortcut starts somewhere.',
  'First command, first win.',
  'You’re warming up.',
  'Nice start.',
  'The command bar has entered the chat.',
  'Small clicks avoided. Respect.',
  'One less menu hunt.',
  'You found the fast lane.',
  'That’s how it begins.',
  'Early momentum detected.',
  'WordPress felt that.',
  'Getting familiar with the controls.',
  'A clean start.',
  'First sparks of admin speed.',
  'You typed. WordPress listened.',
  'Good first move.',
  'Your future self approves.',
  'One command closer to flow.',
  'Dashboard friction reduced.',
  'Keep typing strong.',
];

export const MEDIUM_USAGE_MESSAGES: string[] = [
  'Keep up the good work.',
  'Command rhythm unlocked.',
  'You’re getting efficient.',
  'Fewer clicks. Better flow.',
  'Admin speed is building.',
  'You’re making WordPress behave.',
  'Productivity streak forming.',
  'Menus are starting to fear you.',
  'Solid command work.',
  'You’re in the zone.',
  'This is how power users are made.',
  'Workflow upgraded.',
  'You’re saving clicks like a pro.',
  'WordPress admin: simplified.',
  'Strong typing energy.',
  'You’re moving faster now.',
  'That’s clean execution.',
  'Nice command streak.',
  'The dashboard is learning who’s boss.',
  'Keep commanding.',
];

export const HIGH_USAGE_MESSAGES: string[] = [
  'Power user.',
  'Command bar champion.',
  'You did it.',
  'Admin wizardry detected.',
  'WordPress never stood a chance.',
  'Peak command energy.',
  'You’re basically WP-CLI with better posture.',
  'Dashboard domination achieved.',
  'Serious operator mode.',
  'You are fluent in Flux.',
  'That’s elite admin work.',
  'Clicks avoided. Time recovered.',
  'Command streak: impressive.',
  'You have unlocked maximum flow.',
  'WordPress is now on your schedule.',
  'You’re running the dashboard, not chasing it.',
  'This is what efficient looks like.',
  'Full command mode activated.',
  'You just made admin work look easy.',
  'Flux power user status confirmed.',
];

let seededRoll: number | null = null;

function rollOnce(): number {
  if (seededRoll != null) return seededRoll;
  seededRoll = Math.random();
  return seededRoll;
}

export function pickTierMessage(tier: UsageTier): string {
  const list =
    tier === 'high' ? HIGH_USAGE_MESSAGES : tier === 'medium' ? MEDIUM_USAGE_MESSAGES : LOW_USAGE_MESSAGES;
  if (list.length === 0) return '';
  const r = rollOnce();
  const idx = Math.max(0, Math.min(list.length - 1, Math.floor(r * list.length)));
  return String(list[idx] || '');
}

