export function formatDate(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateTime(timestamp: any): string {
  if (!timestamp) return '';
  return `${formatDate(timestamp)} at ${formatTime(timestamp)}`;
}

export function getRelativeTime(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  return formatDate(timestamp);
}

export function getDurationMinutes(start: any, end: any): number {
  if (!start || !end) return 0;
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.floor(diffMs / 60000);
}

/** Time-of-day greeting for the user's local clock. */
export function getGreeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const TITLES = new Set(['dr', 'prof', 'professor', 'mr', 'mrs', 'ms', 'miss', 'engr', 'rev', 'sir']);

/** Short name for greetings: "Ajayi Abdulsamad" -> "Ajayi", "Dr. Emma Okoro" -> "Dr. Emma". */
export function greetingName(fullName?: string | null): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'there';
  const isTitle = TITLES.has(parts[0].replace(/\.$/, '').toLowerCase());
  return isTitle && parts.length > 1 ? `${parts[0]} ${parts[1]}` : parts[0];
}
