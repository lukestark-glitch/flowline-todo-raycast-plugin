// Zugriff auf die REST-API des Backends (API-first: die Extension rechnet nichts selbst).
// Token und Adresse kommen aus den Raycast-Einstellungen; Raycast legt das Passwortfeld
// im Schlüsselbund ab.

import { getPreferenceValues } from "@raycast/api";

import {
  checkApiUrl,
  describeError,
  type Course,
  type Suggestion,
  type Task,
  type TaskCreate,
  type TaskUpdate,
} from "./lib/core";

type Preferences = {
  apiUrl: string;
  apiToken: string;
};

// Render Free schläft nach 15 Min.; der erste Aufruf danach braucht bis zu ~50 s
const TIMEOUT_MS = 60_000;

export function baseUrl(): string {
  return getPreferenceValues<Preferences>().apiUrl.trim().replace(/\/+$/, "");
}

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const base = baseUrl();
  const urlError = checkApiUrl(base);
  if (urlError) throw new Error(urlError);

  let response: Response;
  try {
    response = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${getPreferenceValues<Preferences>().apiToken}`,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new Error(`Server unter ${base} nicht erreichbar. Läuft das Backend?`);
  }

  if (response.status === 401) {
    throw new Error("API-Token abgelehnt. In den Einstellungen der Extension prüfen (⌘,).");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(describeError(response.status, data));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function listTasks(): Promise<Task[]> {
  return request<Task[]>("/api/tasks");
}

export function listInbox(): Promise<Task[]> {
  return request<Task[]>("/api/tasks?status=inbox&sort=created");
}

export function listCourses(): Promise<Course[]> {
  return request<Course[]>("/api/courses");
}

export function getSuggestion(): Promise<Suggestion | null> {
  return request<Suggestion | null>("/api/capture/suggestion");
}

export function createTask(data: TaskCreate | { title: string }): Promise<Task> {
  return request<Task>("/api/tasks", "POST", data);
}

export function updateTask(id: number, changes: TaskUpdate): Promise<Task> {
  return request<Task>(`/api/tasks/${id}`, "PATCH", changes);
}

export function completeTask(id: number): Promise<Task> {
  return request<Task>(`/api/tasks/${id}/complete`, "POST");
}

export function deleteTask(id: number): Promise<void> {
  return request<void>(`/api/tasks/${id}`, "DELETE");
}

/** Detailseite der Web-App (Login dort über das Passwort-Cookie). */
export function webUrl(taskId: number): string {
  return `${baseUrl()}/tasks/${taskId}`;
}
