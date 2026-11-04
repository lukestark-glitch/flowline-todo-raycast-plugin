// „To-do-Inbox“: noch nicht einsortierte To-dos, neueste zuerst. Enter öffnet das
// Formular (Fach, Deadline, Dauer, Notizen); mit Fach verlässt das To-do die Inbox.
// ⌘E sortiert ohne Formular nur per Fach ein.

import { Action, ActionPanel, Icon, Keyboard, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";

import { listCourses, listInbox } from "./api";
import { formatWhen } from "./lib/core";
import { CourseSubmenu, DeleteAction, useTaskActions } from "./task-actions";
import { TaskForm } from "./task-form";
import { useTokenCheck } from "./token-check";

export default function Command() {
  // Erst den Token prüfen (widerrufen? dann eine klare Meldung), dann laden
  const token = useTokenCheck();
  const {
    data: tasks = [],
    isLoading,
    mutate,
    revalidate,
  } = useCachedPromise(listInbox, [], {
    keepPreviousData: true,
    execute: token.ready,
  });
  const { data: courses = [] } = useCachedPromise(listCourses, [], { execute: token.ready });
  const { complete, changeCourse, remove } = useTaskActions(mutate, courses, { dropSortedIn: true });
  const now = new Date();

  return (
    <List
      isLoading={token.checking || isLoading}
      navigationTitle={`Inbox (${tasks.length})`}
      searchBarPlaceholder="Inbox durchsuchen"
    >
      <List.EmptyView icon={Icon.CheckCircle} title="Die Inbox ist leer" description="Alles einsortiert." />
      {tasks.map((task) => (
        <List.Item
          key={task.id}
          title={task.title}
          icon={Icon.Tray}
          accessories={[
            ...(task.notes ? [{ icon: Icon.Text, tooltip: task.notes }] : []),
            { text: `notiert ${formatWhen(task.created_at, now)}` },
          ]}
          actions={
            <ActionPanel>
              <ActionPanel.Section>
                <Action.Push
                  title="Einsortieren"
                  icon={Icon.Pencil}
                  target={<TaskForm task={task} onDone={revalidate} />}
                />
                <CourseSubmenu courses={courses} onPick={(courseId) => changeCourse(task, courseId)} />
                <Action
                  title="Abhaken"
                  icon={Icon.CheckCircle}
                  shortcut={{
                    macOS: { modifiers: ["cmd"], key: "d" },
                    Windows: { modifiers: ["ctrl"], key: "d" },
                  }}
                  onAction={() => complete(task)}
                />
              </ActionPanel.Section>
              <ActionPanel.Section>
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
      ))}
    </List>
  );
}
