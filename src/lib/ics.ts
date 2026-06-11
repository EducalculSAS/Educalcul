// Génération de fichiers .ics (iCalendar) pour export vers Google/Apple Calendar

export interface IcsEvent {
  id: string;
  title: string;
  description?: string | null;
  start_date: string; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD (inclus)
}

const formatDate = (d: string) => d.replace(/-/g, "");

const escapeText = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

// Pour les événements "all day" .ics, DTEND est exclusif : on ajoute 1 jour
const addOneDay = (d: string) => {
  const date = new Date(d + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

export function generateIcs(events: IcsEvent[], calendarName = "Educalcul"): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Educalcul//Calendrier//FR",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];

  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  for (const ev of events) {
    const dtEnd = formatDate(addOneDay(ev.end_date || ev.start_date));
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.id}@educalcul.fr`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${formatDate(ev.start_date)}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${escapeText(ev.title)}`,
    );
    if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
