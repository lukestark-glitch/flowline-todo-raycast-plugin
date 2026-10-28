// Formular für neue und bestehende To-dos (To-do hinzufügen, Inbox einsortieren, Bearbeiten).
// Neu: Fach der laufenden Vorlesung vorausgewählt (GET /api/capture/suggestion).
// Bestehend: Werte des To-dos vorausgefüllt, Fokus im Fach-Feld; ein Inbox-To-do mit
// Fach setzt der Server beim Speichern auf „open“.

import {
  Action,
  ActionPanel,
  Form,
  Icon,
  popToRoot,
  showHUD,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useState } from "react";

import { createTask, getSuggestion, listCourses, updateTask } from "./api";
import {
  createPayload,
  deadlineError,
  deadlinePresets,
  estimateOptions,
  formatMinutes,
  initialDeadlineChoice,
  resolveDeadline,
  savedMessage,
  updatedMessage,
  updatePayload,
  type Task,
} from "./lib/core";

type Values = {
  title: string;
  estimate: string;
  notes: string;
};

type Props = {
  // Bestehendes To-do bearbeiten; ohne: neues anlegen
  task?: Task;
  // Aus einer Liste geöffnet: danach zurück und die Liste neu laden
  onDone?: () => void;
};

export function TaskForm({ task, onDone }: Props) {
  const { pop } = useNavigation();
  const { data, isLoading } = usePromise(
    async () => {
      // Beim Bearbeiten zählt die laufende Vorlesung nicht: Das To-do entstand früher
      const [courses, suggestion] = await Promise.all([listCourses(), task ? null : getSuggestion()]);
      return { courses, suggestion };
    },
    [],
    {
      // Vorschlag direkt beim Laden setzen (nicht erst über einen Effekt): Bis dahin
      // kann niemand ein Fach gewählt haben, die Liste enthält nur „Kein Fach“
      onData: ({ suggestion }) => {
        if (suggestion) setCourseId(String(suggestion.course_id));
      },
    },
  );
  const courses = data?.courses ?? [];
  const suggestion = data?.suggestion ?? null;

  const [presets] = useState(() => deadlinePresets(new Date()));
  const [courseId, setCourseId] = useState(task?.course_id != null ? String(task.course_id) : "");
  const [titleError, setTitleError] = useState<string | undefined>();
  // Deadline: "" = keine, ISO-Text = Schnellwahl, "custom" = Datumsfeld darunter
  const [deadlineChoice, setDeadlineChoice] = useState(() =>
    initialDeadlineChoice(task?.deadline ?? null, presets),
  );
  const [customDeadline, setCustomDeadline] = useState<Date | null>(
    task?.deadline ? new Date(task.deadline) : null,
  );
  const [deadlineProblem, setDeadlineProblem] = useState<string | undefined>();

  async function submit(values: Values) {
    if (values.title.trim() === "") {
      setTitleError("Titel fehlt");
      return;
    }
    const deadline = resolveDeadline(deadlineChoice, customDeadline);
    // Eine gespeicherte Deadline, die inzwischen vorbei ist, darf bleiben
    const unchanged = task?.deadline != null && deadline?.getTime() === new Date(task.deadline).getTime();
    const problem = unchanged ? undefined : deadlineError(deadline, new Date());
    if (problem) {
      setDeadlineProblem(problem);
      return;
    }
    const toast = await showToast({ style: Toast.Style.Animated, title: "Speichern …" });
    try {
      const formValues = { ...values, courseId, deadline };
      let message: string;
      if (task) {
        const saved = await updateTask(task.id, updatePayload(formValues));
        message = updatedMessage(task, saved, courses);
      } else {
        const saved = await createTask(createPayload(formValues, suggestion));
        message = savedMessage(saved, courses);
      }
      if (onDone) {
        toast.style = Toast.Style.Success;
        toast.title = message;
        onDone();
        pop();
      } else {
        await toast.hide();
        await showHUD(`✓ ${message}`);
        await popToRoot();
      }
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Nicht gespeichert";
      toast.message = error instanceof Error ? error.message : String(error);
    }
  }

  const suggestionChosen = suggestion !== null && courseId === String(suggestion.course_id);
  const title = !task ? "To-do hinzufügen" : task.status === "inbox" ? "Einsortieren" : "To-do bearbeiten";

  return (
    <Form
      isLoading={isLoading}
      navigationTitle={title}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Speichern" icon={task ? Icon.Check : Icon.Plus} onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="title"
        title="Titel"
        placeholder="Neues To-do"
        defaultValue={task?.title}
        autoFocus={!task}
        error={titleError}
        onChange={() => setTitleError(undefined)}
      />
      <Form.Dropdown
        id="course"
        title="Fach"
        value={courseId}
        autoFocus={task !== undefined}
        // Raycast meldet beim ersten Anzeigen den Startwert als Änderung („Kein Fach“, weil
        // die Fächer noch laden). Das würde den Vorschlag bzw. das gespeicherte Fach
        // überschreiben; erst nach dem Laden zählen Änderungen als Auswahl.
        onChange={(value) => {
          if (!isLoading) setCourseId(value);
        }}
      >
        {courses.map((course) => (
          <Form.Dropdown.Item
            key={course.id}
            value={String(course.id)}
            title={suggestion?.course_id === course.id ? `${course.name} (läuft gerade)` : course.name}
            keywords={[course.short_name]}
            icon={{ source: Icon.CircleFilled, tintColor: course.color }}
          />
        ))}
        <Form.Dropdown.Item value="" title="Kein Fach" icon={Icon.Circle} />
      </Form.Dropdown>
      {suggestionChosen && <Form.Description text={`Gehört zu ${suggestion.event_title}`} />}
      <Form.Dropdown
        id="deadlineChoice"
        title="Deadline"
        value={deadlineChoice}
        // Schnellwahl, die inzwischen vorbei ist (Formular über Mitternacht offen)
        error={deadlineChoice === "custom" ? undefined : deadlineProblem}
        onChange={(value) => {
          setDeadlineChoice(value);
          setDeadlineProblem(undefined);
        }}
      >
        <Form.Dropdown.Item value="" title="Keine" />
        {presets.map((preset) => (
          <Form.Dropdown.Item key={preset.value} value={preset.value} title={preset.title} />
        ))}
        <Form.Dropdown.Item value="custom" title="Anderes Datum …" icon={Icon.Calendar} />
      </Form.Dropdown>
      {deadlineChoice === "custom" && (
        <Form.DatePicker
          id="customDeadline"
          title="Datum"
          type={Form.DatePicker.Type.DateTime}
          min={startOfToday()}
          value={customDeadline}
          error={deadlineProblem}
          onChange={(value) => {
            setCustomDeadline(value);
            setDeadlineProblem(undefined);
          }}
        />
      )}
      <Form.Dropdown
        id="estimate"
        title="Dauer"
        defaultValue={task?.estimate_minutes != null ? String(task.estimate_minutes) : ""}
      >
        <Form.Dropdown.Item value="" title="Keine Angabe" />
        {estimateOptions(task?.estimate_minutes ?? null).map((minutes) => (
          <Form.Dropdown.Item key={minutes} value={String(minutes)} title={formatMinutes(minutes)} />
        ))}
      </Form.Dropdown>
      <Form.TextArea
        id="notes"
        title="Notizen"
        placeholder="Details, Links, Aufgabennummern"
        defaultValue={task?.notes ?? ""}
      />
    </Form>
  );
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
