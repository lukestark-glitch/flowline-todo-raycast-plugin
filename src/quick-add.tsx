// Blitz-Erfassen: nur Titel, kein Fenster. Das Fach der laufenden Vorlesung ordnet der
// Server zu (POST /api/tasks ohne course_id); korrigieren über „To-dos anzeigen“.
// Schnell-Syntax am Ende des Titels (#mat1 #d90 #Tfr) wertet ebenfalls der Server aus.

import { LaunchProps, showHUD } from "@raycast/api";

import { createTask, listCourses } from "./api";
import { savedMessage } from "./lib/core";

export default async function Command(props: LaunchProps<{ arguments: { title: string } }>) {
  const title = props.arguments.title.trim();
  if (title === "") {
    await showHUD("✗ Kein Titel");
    return;
  }
  try {
    const task = await createTask({ title });
    // Ältere Server ohne summary: Fach für die Meldung selbst holen
    const courses = !task.summary && task.course_id !== null ? await listCourses() : [];
    await showHUD(`✓ ${savedMessage(task, courses)}`);
  } catch (error) {
    await showHUD(`✗ Nicht gespeichert: ${error instanceof Error ? error.message : String(error)}`);
  }
}
