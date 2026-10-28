// Aktionen an einem To-do, gemeinsam für „To-dos anzeigen“ und „To-do-Inbox“:
// Abhaken (mit Rückgängig), Fach ändern, Löschen. Die Liste wird sofort angepasst
// (optimistisch) und danach vom Server neu geladen.

import { Action, ActionPanel, Alert, confirmAlert, Icon, Keyboard, showToast, Toast } from "@raycast/api";
import type { MutatePromise } from "@raycast/utils";

import { completeTask, deleteTask, updateTask } from "./api";
import { reopenStatus, type Course, type Task } from "./lib/core";

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type Options = {
  // Inbox: Ein To-do mit Fach ist einsortiert und verschwindet aus der Liste
  dropSortedIn?: boolean;
};

export function useTaskActions(
  mutate: MutatePromise<Task[] | undefined>,
  courses: Course[],
  options: Options = {},
) {
  const without = (task: Task) => (current: Task[] | undefined) =>
    current?.filter((item) => item.id !== task.id);

  async function complete(task: Task) {
    const toast = await showToast({ style: Toast.Style.Animated, title: "Abhaken …" });
    try {
      await mutate(completeTask(task.id), { optimisticUpdate: without(task) });
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
    const course = courses.find((item) => item.id === courseId);
    try {
      // Ein Inbox-To-do mit Fach ist einsortiert; den Status setzt der Server auf „open“
      await mutate(updateTask(task.id, { course_id: courseId }), {
        optimisticUpdate:
          options.dropSortedIn && courseId !== null
            ? without(task)
            : (current) =>
                current?.map((item) => (item.id === task.id ? { ...item, course_id: courseId } : item)),
      });
      const label = course ? course.short_name : "ohne Fach";
      await showToast({
        style: Toast.Style.Success,
        title: task.status === "inbox" && course ? `Einsortiert in ${label}` : `Fach: ${label}`,
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
      await mutate(deleteTask(task.id), { optimisticUpdate: without(task) });
      await showToast({ style: Toast.Style.Success, title: "Gelöscht" });
    } catch (error) {
      await showToast({ style: Toast.Style.Failure, title: "Nicht gelöscht", message: errorText(error) });
    }
  }

  return { complete, changeCourse, remove };
}

export function CourseSubmenu({
  courses,
  onPick,
}: {
  courses: Course[];
  onPick: (courseId: number | null) => void;
}) {
  return (
    <ActionPanel.Submenu title="Fach ändern" icon={Icon.Book} shortcut={Keyboard.Shortcut.Common.Edit}>
      {courses.map((course) => (
        <Action
          key={course.id}
          title={course.name}
          icon={{ source: Icon.CircleFilled, tintColor: course.color }}
          onAction={() => onPick(course.id)}
        />
      ))}
      <Action title="Kein Fach" icon={Icon.Circle} onAction={() => onPick(null)} />
    </ActionPanel.Submenu>
  );
}

export function DeleteAction({ onAction }: { onAction: () => void }) {
  return (
    <Action
      title="Löschen"
      icon={Icon.Trash}
      style={Action.Style.Destructive}
      shortcut={Keyboard.Shortcut.Common.Remove}
      onAction={onAction}
    />
  );
}
