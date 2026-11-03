// Reine Logik der Extension: Datentypen der API, Texte, Formular → Anfrage.
// Bewusst ohne Raycast-Importe, damit `npm test` sie mit node --test prüfen kann.

export type TaskStatus = "inbox" | "open" | "planned" | "in_progress" | "paused" | "done" | "archived";

export type Task = {
  id: number;
  title: string;
  notes: string | null;
  status: TaskStatus;
  course_id: number | null;
  event_id: number | null;
  deadline: string | null;
  estimate_minutes: number | null;
  start_by: string | null;
  created_at: string;
  completed_at: string | null;
  parent_id: number | null;
  // Kurz, was gespeichert wurde, z. B. „Mathe 1 · Übungsblatt · 1 Std. 30 Min. · fällig Fr 23:59“
  // (ältere Server ohne das Feld: undefined)
  summary?: string;
};

// Schnell-Syntax am Ende des Titels (Server: app/title_syntax.py), als Hinweis beim Tippen
export const SYNTAX_HINT =
  "Am Ende des Titels: #mat1 Fach (Kürzel) · #Übungsblatt Art · #d90 bzw. #d1h30 Dauer · " +
  "#Tmorgen, #Tfr, #T+3, #T31.10, #Tfr-14 Deadline · sonst #wichtig als Tag";

export type Course = {
  id: number;
  name: string;
  short_name: string;
  color: string;
};

// GET /api/capture/suggestion: laufende (oder höchstens 15 Min. vorbei) Vorlesung mit Fach
export type Suggestion = {
  course_id: number;
  course_name: string;
  short_name: string;
  color: string;
  event_id: number;
  event_title: string;
  event_start: string;
  event_end: string;
  running: boolean;
};

export type TaskCreate = {
  title: string;
  course_id: number | null;
  event_id?: number;
  deadline?: string;
  estimate_minutes?: number;
  notes?: string;
};

// PATCH /api/tasks/{id}: nur mitgeschickte Felder ändern sich, null löscht einen Wert
export type TaskUpdate = {
  title?: string;
  status?: TaskStatus;
  course_id?: number | null;
  deadline?: string | null;
  estimate_minutes?: number | null;
  notes?: string | null;
};

export type FormValues = {
  title: string;
  // Dropdown-Wert: ID als Text, "" = Kein Fach
  courseId: string;
  deadline: Date | null;
  // Dropdown-Wert: Minuten als Text, "" = keine Angabe
  estimate: string;
  notes: string;
};

export const ESTIMATE_PRESETS = [15, 30, 45, 60, 90, 120, 180];

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Server-Adresse aus den Einstellungen ohne Schrägstrich und ohne „/api“ am Ende (die Web-App
 *  zeigt die API-Adresse mit /api; die Extension hängt die Pfade selbst an). */
export function normalizeBaseUrl(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");
}

/** Fehlertext, wenn der Token über diese Adresse nicht geschickt werden darf, sonst null. */
export function checkApiUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Server-Adresse ungültig. Beispiel: http://localhost:8000";
  }
  if (parsed.protocol === "https:") return null;
  if (parsed.protocol === "http:" && LOCAL_HOSTS.has(parsed.hostname)) return null;
  return "Online nur mit https://, sonst kann jemand den API-Token mitlesen.";
}

/** Fehlermeldung aus einer FastAPI-Antwort ({"detail": "…"} oder Liste von Feldfehlern). */
export function describeError(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item: { loc?: unknown[]; msg?: string }) => {
        const field = item.loc?.[item.loc.length - 1];
        return typeof field === "string" ? `${field}: ${item.msg}` : (item.msg ?? "ungültig");
      })
      .join("; ");
  }
  return `Fehler ${status} vom Server`;
}

/** Antwort von GET /api/me: wer angemeldet ist; token = Name des persönlichen Tokens. */
export type Me = { auth: string; name: string; email: string; token: string | null };

const NEW_TOKEN_HINT =
  "In der Web-App unter Einstellungen → Integrationen einen Token erstellen und in den Einstellungen der Extension eintragen (⌘,).";

/** Verständliche Meldung, wenn der Server die Anmeldung ablehnt (401/403), sonst null.
 *  Persönliche Tokens beginnen mit adt_; alles andere ist der alte, globale API_TOKEN. */
export function authMessage(status: number, body: unknown, token: string): string | null {
  if (status === 401) {
    if (!token.trim()) return `Kein API-Token eingetragen. ${NEW_TOKEN_HINT}`;
    if (token.trim().startsWith("adt_")) return `Token ungültig oder widerrufen. ${NEW_TOKEN_HINT}`;
    return `Token abgelehnt. Bitte einen persönlichen Token verwenden (beginnt mit adt_). ${NEW_TOKEN_HINT}`;
  }
  if (status === 403) return `Anmeldung abgelehnt: ${describeError(status, body)}`;
  return null;
}

/** Formular → Anfrage für POST /api/tasks. course_id geht immer mit (null = bewusst ohne
 *  Fach), event_id nur, solange das vorgeschlagene Fach gewählt ist. */
export function createPayload(values: FormValues, suggestion: Suggestion | null): TaskCreate {
  const payload: TaskCreate = {
    title: values.title.trim(),
    course_id: values.courseId === "" ? null : Number(values.courseId),
  };
  if (suggestion && String(suggestion.course_id) === values.courseId) payload.event_id = suggestion.event_id;
  if (values.deadline) payload.deadline = values.deadline.toISOString();
  if (values.estimate !== "") payload.estimate_minutes = Number(values.estimate);
  if (values.notes.trim() !== "") payload.notes = values.notes.trim();
  return payload;
}

/** Rückmeldung nach dem Speichern: die Zusammenfassung des Servers („Gespeichert: Mathe 1 ·
 *  Übungsblatt · 1 Std. 30 Min.“), bei älteren Servern z. B. „Gespeichert in AFE“. */
export function savedMessage(task: Task, courses: Course[]): string {
  if (task.summary) return `Gespeichert: ${task.summary}`;
  const course = courses.find((item) => item.id === task.course_id);
  if (course) return `Gespeichert in ${course.short_name}`;
  return task.status === "inbox" ? "In der Inbox gespeichert" : "Gespeichert ohne Fach";
}

/** Status beim Rückgängigmachen des Abhakens: wie in der Web-App, mit Fach offen, sonst Inbox. */
export function reopenStatus(task: Task): TaskStatus {
  return task.course_id !== null ? "open" : "inbox";
}

/** "anfangen bis" ist vorbei, bald (innerhalb von zwei Tagen) oder später. */
export function startByState(task: Task, now: Date): "overdue" | "soon" | "later" | null {
  if (!task.start_by) return null;
  const startBy = new Date(task.start_by).getTime();
  if (startBy < now.getTime()) return "overdue";
  return startBy - now.getTime() <= 2 * 24 * 60 * 60 * 1000 ? "soon" : "later";
}

/** 45 → "45 Min.", 90 → "1 Std. 30 Min." (wie die Web-App). */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} Std. ${rest} Min.` : `${hours} Std.`;
}

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONTHS = [
  "Jan.",
  "Feb.",
  "März",
  "Apr.",
  "Mai",
  "Juni",
  "Juli",
  "Aug.",
  "Sept.",
  "Okt.",
  "Nov.",
  "Dez.",
];

function localParts(date: Date, timeZone: string | undefined) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** Zeitpunkt kurz und relativ: "heute 23:59", "morgen 10:00", "Fr, 6. Nov. 23:59".
 *  timeZone nur für Tests; sonst die Zeitzone des Macs. */
export function formatWhen(iso: string, now: Date, timeZone?: string): string {
  const target = localParts(new Date(iso), timeZone);
  const today = localParts(now, timeZone);
  const offset = Math.round(
    (Date.UTC(target.year, target.month - 1, target.day) - Date.UTC(today.year, today.month - 1, today.day)) /
      86_400_000,
  );
  const clock = `${String(target.hour).padStart(2, "0")}:${String(target.minute).padStart(2, "0")}`;
  if (offset === 0) return `heute ${clock}`;
  if (offset === 1) return `morgen ${clock}`;
  if (offset === -1) return `gestern ${clock}`;
  const weekday = WEEKDAYS[new Date(Date.UTC(target.year, target.month - 1, target.day)).getUTCDay()];
  return `${weekday}, ${target.day}. ${MONTHS[target.month - 1]} ${clock}`;
}

export type DeadlinePreset = { title: string; value: string };

/** Schnellwahl wie in der Web-App: heute, morgen, nächster Freitag, in einer Woche,
 *  jeweils 23:59 Ortszeit (Zeitzone des Macs). value ist der Zeitpunkt als ISO-Text. */
export function deadlinePresets(now: Date): DeadlinePreset[] {
  const fridayOffset = (5 - now.getDay() + 7) % 7 || 7;
  const presets = new Map<string, DeadlinePreset>();
  for (const offset of [0, 1, fridayOffset, 7]) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 23, 59);
    if (day <= now) continue;
    const label = formatWhen(day.toISOString(), now);
    // Doppelte (z. B. morgen ist Freitag) nur einmal
    presets.set(day.toISOString(), {
      title: label[0].toUpperCase() + label.slice(1),
      value: day.toISOString(),
    });
  }
  return [...presets.values()];
}

/** Dropdown "deadline" ("" = keine, "custom" = Datumsfeld, sonst ISO) → Zeitpunkt. */
export function resolveDeadline(choice: string, custom: Date | null): Date | null {
  if (choice === "") return null;
  if (choice === "custom") return custom;
  return new Date(choice);
}

/** Fehlertext für eine Deadline, die schon vorbei ist, sonst undefined. */
export function deadlineError(deadline: Date | null, now: Date): string | undefined {
  return deadline && deadline.getTime() < now.getTime() ? "Liegt in der Vergangenheit" : undefined;
}

/** Formular → Anfrage für PATCH beim Bearbeiten: alle Felder, Leeres löscht den Wert.
 *  Ein Inbox-To-do mit Fach setzt der Server dabei auf „open“ (einsortiert). */
export function updatePayload(values: FormValues): TaskUpdate {
  return {
    title: values.title.trim(),
    course_id: values.courseId === "" ? null : Number(values.courseId),
    deadline: values.deadline ? values.deadline.toISOString() : null,
    estimate_minutes: values.estimate === "" ? null : Number(values.estimate),
    notes: values.notes.trim() === "" ? null : values.notes.trim(),
  };
}

/** Rückmeldung nach dem Bearbeiten: „Einsortiert in AFE“, wenn es die Inbox verlassen hat. */
export function updatedMessage(before: Task, after: Task, courses: Course[]): string {
  const course = courses.find((item) => item.id === after.course_id);
  if (before.status === "inbox" && after.status !== "inbox" && course)
    return `Einsortiert in ${course.short_name}`;
  return "Gespeichert";
}

/** Startwert des Deadline-Dropdowns für ein bestehendes To-do. */
export function initialDeadlineChoice(deadline: string | null, presets: DeadlinePreset[]): string {
  if (!deadline) return "";
  const time = new Date(deadline).getTime();
  return presets.find((preset) => new Date(preset.value).getTime() === time)?.value ?? "custom";
}

/** Dauer-Auswahl: Schnellwahl plus ein abweichender gespeicherter Wert (z. B. 50 Min.). */
export function estimateOptions(current: number | null): number[] {
  if (current === null || ESTIMATE_PRESETS.includes(current)) return ESTIMATE_PRESETS;
  return [...ESTIMATE_PRESETS, current].sort((a, b) => a - b);
}
