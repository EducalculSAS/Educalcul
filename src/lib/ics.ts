// Génération de fichiers .ics (iCalendar) pour export vers Google/Apple Calendar

export interface IcsEvent {
  id: string;
  title: string;
  description?: string | null;
  start_date: string; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD (inclus)
  start_time?: string | null; // HH:MM (heure de Paris)
  end_time?: string | null;
}

const formatDate = (d: string) => d.replace(/-/g, "");

const escapeText = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const formatTime = (t: string) => `${t.slice(0, 2)}${t.slice(3, 5)}00`;

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
    lines.push("BEGIN:VEVENT", `UID:${ev.id}@educalcul.fr`, `DTSTAMP:${now}`);
    if (ev.start_time) {
      // Événement à heure précise (heure de Paris).
      lines.push(
        `DTSTART;TZID=Europe/Paris:${formatDate(ev.start_date)}T${formatTime(ev.start_time)}`,
        `DTEND;TZID=Europe/Paris:${formatDate(ev.end_date || ev.start_date)}T${formatTime(ev.end_time || ev.start_time)}`,
      );
    } else {
      lines.push(
        `DTSTART;VALUE=DATE:${formatDate(ev.start_date)}`,
        `DTEND;VALUE=DATE:${formatDate(addOneDay(ev.end_date || ev.start_date))}`,
      );
    }
    lines.push(`SUMMARY:${escapeText(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
