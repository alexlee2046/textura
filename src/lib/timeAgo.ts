export function timeAgo(
  dateStr: string,
  t: (key: string, values?: Record<string, number>) => string
): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return t("justNow");
  if (diffMin < 60) return t("minutesAgo", { count: diffMin });
  if (diffHr < 24) return t("hoursAgo", { count: diffHr });
  if (diffDay === 1) return t("yesterday");
  if (diffDay <= 7) return t("daysAgo", { count: diffDay });

  // Absolute date for > 7 days
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
