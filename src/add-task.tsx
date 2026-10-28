// „To-do hinzufügen“: Formular mit Fach-Dropdown. Das Fach der laufenden Vorlesung ist
// vorausgewählt (GET /api/capture/suggestion) und lässt sich vor dem Speichern ändern.

import { TaskForm } from "./task-form";

export default function Command() {
  return <TaskForm />;
}
