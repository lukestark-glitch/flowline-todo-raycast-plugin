// „To-do hinzufügen“: Formular mit Fach-Dropdown. Das Fach der laufenden Vorlesung ist
// vorausgewählt (GET /api/capture/suggestion) und lässt sich vor dem Speichern ändern.

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
import { useEffect, useState } from "react";

import { createTask, getSuggestion, listCourses } from "./api";
import {
  createPayload,
  deadlineError,
  deadlinePresets,
  ESTIMATE_PRESETS,
  formatMinutes,
  resolveDeadline,
  savedMessage,
} from "./lib/core";

type Values = {
  title: string;
  estimate: string;
  notes: string;
};

/** Auch aus „To-dos anzeigen“ heraus (⌘N): dann zurück zur Liste und diese neu laden. */
export function AddTaskForm({ onCreated }: { onCreated?: () => void }) {
  const { pop } = useNavigation();
  const { data, isLoading } = usePromise(async () => {
    const [courses, suggestion] = await Promise.all([listCourses(), getSuggestion()]);
    return { courses, suggestion };
  });
  const courses = data?.courses ?? [];
  const suggestion = data?.suggestion ?? null;

  const [courseId, setCourseId] = useState("");
  const [courseTouched, setCourseTouched] = useState(false);
  const [titleError, setTitleError] = useState<string | undefined>();
  // Deadline: "" = keine, ISO-Text = Schnellwahl, "custom" = Datumsfeld darunter
  const [deadlineChoice, setDeadlineChoice] = useState("");
  const [customDeadline, setCustomDeadline] = useState<Date | null>(null);
  const [deadlineProblem, setDeadlineProblem] = useState<string | undefined>();
  const [presets] = useState(() => deadlinePresets(new Date()));

  // Vorschlag übernehmen, sobald er da ist, aber keine Auswahl überschreiben
  useEffect(() => {
    if (suggestion && !courseTouched) setCourseId(String(suggestion.course_id));
  }, [suggestion]);

  async function submit(values: Values) {
    if (values.title.trim() === "") {
      setTitleError("Titel fehlt");
      return;
    }
    const deadline = resolveDeadline(deadlineChoice, customDeadline);
    const problem = deadlineError(deadline, new Date());
    if (problem) {
      setDeadlineProblem(problem);
      return;
    }
    const toast = await showToast({ style: Toast.Style.Animated, title: "Speichern …" });
    try {
      const task = await createTask(createPayload({ ...values, courseId, deadline }, suggestion));
      const message = savedMessage(task, courses);
      if (onCreated) {
        toast.style = Toast.Style.Success;
        toast.title = message;
        onCreated();
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

  return (
    <Form
      isLoading={isLoading}
      navigationTitle="To-do hinzufügen"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Speichern" icon={Icon.Plus} onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="title"
        title="Titel"
        placeholder="Neues To-do"
        autoFocus
        error={titleError}
        onChange={() => setTitleError(undefined)}
      />
      <Form.Dropdown
        id="course"
        title="Fach"
        value={courseId}
        onChange={(value) => {
          setCourseId(value);
          setCourseTouched(true);
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
      <Form.Dropdown id="estimate" title="Dauer" defaultValue="">
        <Form.Dropdown.Item value="" title="Keine Angabe" />
        {ESTIMATE_PRESETS.map((minutes) => (
          <Form.Dropdown.Item key={minutes} value={String(minutes)} title={formatMinutes(minutes)} />
        ))}
      </Form.Dropdown>
      <Form.TextArea id="notes" title="Notizen" placeholder="Details, Links, Aufgabennummern" />
    </Form>
  );
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export default function Command() {
  return <AddTaskForm />;
}
