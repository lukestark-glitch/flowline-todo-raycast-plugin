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
import { createPayload, ESTIMATE_PRESETS, formatMinutes, savedMessage } from "./lib/core";

type Values = {
  title: string;
  deadline: Date | null;
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

  // Vorschlag übernehmen, sobald er da ist, aber keine Auswahl überschreiben
  useEffect(() => {
    if (suggestion && !courseTouched) setCourseId(String(suggestion.course_id));
  }, [suggestion]);

  async function submit(values: Values) {
    if (values.title.trim() === "") {
      setTitleError("Titel fehlt");
      return;
    }
    const toast = await showToast({ style: Toast.Style.Animated, title: "Speichern …" });
    try {
      const task = await createTask(createPayload({ ...values, courseId }, suggestion));
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
      <Form.DatePicker id="deadline" title="Deadline" type={Form.DatePicker.Type.DateTime} />
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

export default function Command() {
  return <AddTaskForm />;
}
