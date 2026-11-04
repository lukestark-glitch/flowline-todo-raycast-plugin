// „To-dos anzeigen“: offene To-dos in der Reihenfolge „Als Nächstes“ (wie die Web-App),
// filterbar nach Inbox oder Fach. Enter hakt ab (mit Rückgängig), ⌘E ändert das Fach,
// ⌘⇧E öffnet das Formular.

import { Action, ActionPanel, Color, Icon, Keyboard, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";

import { listCourses, listTasks, webUrl } from "./api";
import { formatMinutes, formatWhen, startByState, type Course, type Task } from "./lib/core";
import { CourseSubmenu, DeleteAction, useTaskActions } from "./task-actions";
import { TaskForm } from "./task-form";
import { useTokenCheck } from "./token-check";

export function accessories(task: Task, now: Date): List.Item.Accessory[] {
  const items: List.Item.Accessory[] = [];
  if (task.status === "inbox") items.push({ tag: { value: "Inbox", color: Color.Blue } });
  const state = startByState(task, now);
  if (task.start_by && (state === "overdue" || state === "soon")) {
    const text = `anfangen bis ${formatWhen(task.start_by, now)}`;
    items.push(
      state === "overdue"
        ? { tag: { value: text, color: Color.Red } }
        : { text: { value: text, color: Color.Blue } },
    );
  }
  if (task.deadline) {
    items.push({ text: `fällig ${formatWhen(task.deadline, now)}`, icon: Icon.Calendar });
  }
  if (task.estimate_minutes) items.push({ text: formatMinutes(task.estimate_minutes), icon: Icon.Clock });
  return items;
}

export function taskIcon(task: Task, course: Course | undefined): List.Item.Props["icon"] {
  if (course) return { source: Icon.CircleFilled, tintColor: course.color };
  return { source: task.status === "inbox" ? Icon.Tray : Icon.Circle, tintColor: Color.SecondaryText };
}

export default function Command() {
  // Erst den Token prüfen (widerrufen? dann eine klare Meldung), dann laden
  const token = useTokenCheck();
  const {
    data: tasks = [],
    isLoading,
    mutate,
    revalidate,
  } = useCachedPromise(listTasks, [], {
    keepPreviousData: true,
    execute: token.ready,
  });
  const { data: courses = [] } = useCachedPromise(listCourses, [], { execute: token.ready });
  // "all", "inbox" oder die ID eines Fachs
  const [filter, setFilter] = useState("all");
  const now = new Date();

  const courseById = new Map(courses.map((course) => [course.id, course]));
  const shown = tasks.filter((task) => {
    if (filter === "all") return true;
    if (filter === "inbox") return task.status === "inbox";
    return String(task.course_id) === filter;
  });
  const inboxCount = tasks.filter((task) => task.status === "inbox").length;

  const { complete, changeCourse, remove } = useTaskActions(mutate, courses);

  const addAction = (
    <Action.Push
      title="Neues To-do"
      icon={Icon.Plus}
      shortcut={Keyboard.Shortcut.Common.New}
      target={<TaskForm onDone={revalidate} />}
    />
  );

  return (
    <List
      isLoading={token.checking || isLoading}
      searchBarPlaceholder="To-dos durchsuchen"
      searchBarAccessory={
        <List.Dropdown tooltip="Anzeigen" storeValue onChange={setFilter}>
          <List.Dropdown.Item value="all" title="Alle" icon={Icon.List} />
          <List.Dropdown.Item value="inbox" title={`Inbox (${inboxCount})`} icon={Icon.Tray} />
          <List.Dropdown.Section title="Fächer">
            {courses.map((course) => (
              <List.Dropdown.Item
                key={course.id}
                value={String(course.id)}
                title={course.name}
                icon={{ source: Icon.CircleFilled, tintColor: course.color }}
              />
            ))}
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      <List.EmptyView
        icon={Icon.CheckCircle}
        title={filter === "inbox" ? "Die Inbox ist leer" : "Nichts offen"}
        description={filter === "inbox" ? "Alles einsortiert." : undefined}
        actions={<ActionPanel>{addAction}</ActionPanel>}
      />
      {shown.map((task) => {
        const course = task.course_id !== null ? courseById.get(task.course_id) : undefined;
        return (
          <List.Item
            key={task.id}
            title={task.title}
            subtitle={course?.short_name}
            keywords={course ? [course.name, course.short_name] : []}
            icon={taskIcon(task, course)}
            accessories={accessories(task, now)}
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  <Action title="Abhaken" icon={Icon.CheckCircle} onAction={() => complete(task)} />
                  <CourseSubmenu courses={courses} onPick={(courseId) => changeCourse(task, courseId)} />
                  <Action.Push
                    title="Bearbeiten"
                    icon={Icon.Pencil}
                    shortcut={{
                      macOS: { modifiers: ["cmd", "shift"], key: "e" },
                      Windows: { modifiers: ["ctrl", "shift"], key: "e" },
                    }}
                    target={<TaskForm task={task} onDone={revalidate} />}
                  />
                  <Action.OpenInBrowser
                    title="Im Browser öffnen"
                    url={webUrl(task.id)}
                    shortcut={Keyboard.Shortcut.Common.Open}
                  />
                </ActionPanel.Section>
                <ActionPanel.Section>
                  {addAction}
                  <Action
                    title="Neu laden"
                    icon={Icon.ArrowClockwise}
                    shortcut={Keyboard.Shortcut.Common.Refresh}
                    onAction={revalidate}
                  />
                </ActionPanel.Section>
                <ActionPanel.Section>
                  <DeleteAction onAction={() => remove(task)} />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
