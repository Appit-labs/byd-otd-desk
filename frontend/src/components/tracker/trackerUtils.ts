export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const day = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return `${time} ${day}`;
}
