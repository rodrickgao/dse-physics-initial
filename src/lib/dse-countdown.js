const hongKongDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function getDseCountdown(now = new Date()) {
  const parts = Object.fromEntries(hongKongDate.formatToParts(now).map(({ type, value }) => [type, value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  if (month === 4) return { examMonth: true, days: null };
  const targetYear = month >= 5 ? year + 1 : year;
  return { examMonth: false, days: (Date.UTC(targetYear, 3, 1) - Date.UTC(year, month - 1, day)) / 86400000 };
}
