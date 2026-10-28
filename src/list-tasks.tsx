// „To-dos anzeigen“: offene To-dos in der Reihenfolge „Als Nächstes“ (wie die Web-App),
// filterbar nach Inbox oder Fach. Enter hakt ab (mit Rückgängig), ⌘E ändert das Fach.

import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  Icon,
  Keyboard,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";

import { AddTaskForm } from "./add-task";
import { completeTask, deleteTask, listCourses, listTasks, updateTask, webUrl } from "./api";
import { formatMinutes, formatWhen, reopenStatus, startByState, type Course, type Task } from "./lib/core";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function accessories(task: Task, now: Date): List.Item.Accessory[] {
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

function taskIcon(task: Task, course: Course | undefined): List.Item.Props["icon"] {
  if (course) return { source: Icon.CircleFilled, tintColor: course.color };
  return { source: task.status === "inbox" ? Icon.Tray : Icon.Circle, tintColor: Color.SecondaryText };
}

export default function Command() {
  const {
    data: tasks = [],
    isLoading,
    mutate,
    revalidate,
  } = useCachedPromise(listTasks, [], {
    keepPreviousData: true,
  });
  const { data: courses = [] } = useCachedPromise(listCourses);
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

  async function complete(task: Task) {
    const toast = await showToast({ style: Toast.Style.Animated, title: "Abhaken …" });
    try {
      await mutate(completeTask(task.id), {
        optimisticUpdate: (current) => current?.filter((item) => item.id !== task.id),
      });
      toast.style = Toast.Style.Success;
      toast.title = `Abgehakt: ${task.title}`;
      toast.primaryAction = {
        title: "Rückgängig",
        shortcut: { modifiers: ["cmd"], key: "z" },
        onAction: async (current) => {
          current.hide();
          await reopen(task);
        },
      };
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Nicht abgehakt";
      toast.message = errorText(error);
    }
  }

  async function reopen(task: Task) {
    try {
      await mutate(updateTask(task.id, { status: reopenStatus(task) }));
      await showToast({ style: Toast.Style.Success, title: "Wieder offen" });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Nicht wieder geöffnet",
        message: errorText(error),
      });
    }
  }

  async function changeCourse(task: Task, courseId: number | null) {
    const course = courseId !== null ? courseById.get(courseId) : undefined;
    try {
      // Ein Inbox-To-do mit Fach ist einsortiert; den Status setzt der Server auf „open“
      await mutate(updateTask(task.id, { course_id: courseId }), {
        optimisticUpdate: (current) =>
          current?.map((item) => (item.id === task.id ? { ...item, course_id: courseId } : item)),
      });
      await showToast({
        style: Toast.Style.Success,
        title: course ? `Fach: ${course.short_name}` : "Ohne Fach",
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Fach nicht geändert",
        message: errorText(error),
      });
    }
  }

  async function remove(task: Task) {
    const confirmed = await confirmAlert({
      title: `„${task.title}“ löschen?`,
      message: "Unteraufgaben werden mitgelöscht.",
      primaryAction: { title: "Löschen", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;
    try {
      await mutate(deleteTask(task.id), {
        optimisticUpdate: (current) => current?.filter((item) => item.id !== task.id),
      });
      await showToast({ style: Toast.Style.Success, title: "Gelöscht" });
    } catch (error) {
      await showToast({ style: Toast.Style.Failure, title: "Nicht gelöscht", message: errorText(error) });
    }
  }

  const addAction = (
    <Action.Push
      title="Neues To-do"
      icon={Icon.Plus}
      shortcut={Keyboard.Shortcut.Common.New}
      target={<AddTaskForm onCreated={revalidate} />}
    />
  );

  return (
    <List
      isLoading={isLoading}
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
                  <ActionPanel.Submenu
                    title="Fach ändern"
                    icon={Icon.Book}
                    shortcut={Keyboard.Shortcut.Common.Edit}
                  >
                    {courses.map((option) => (
                      <Action
                        key={option.id}
                        title={option.name}
                        icon={{ source: Icon.CircleFilled, tintColor: option.color }}
                        onAction={() => changeCourse(task, option.id)}
                      />
                    ))}
                    <Action title="Kein Fach" icon={Icon.Circle} onAction={() => changeCourse(task, null)} />
                  </ActionPanel.Submenu>
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
                  <Action
                    title="Löschen"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={{ modifiers: ["ctrl"], key: "x" }}
                    onAction={() => remove(task)}
                  />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
