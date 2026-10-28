import assert from "node:assert/strict";
import { test } from "node:test";

import {
  checkApiUrl,
  createPayload,
  describeError,
  formatMinutes,
  formatWhen,
  reopenStatus,
  savedMessage,
  startByState,
  type Course,
  type FormValues,
  type Suggestion,
  type Task,
} from "./core.ts";

const BERLIN = "Europe/Berlin";
// Mittwoch, 4. Nov. 2026, 12:00 in Berlin (Winterzeit, UTC+1)
const NOW = new Date("2026-11-04T11:00:00Z");

function task(fields: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: "Blatt 3",
    notes: null,
    status: "inbox",
    course_id: null,
    event_id: null,
    deadline: null,
    estimate_minutes: null,
    start_by: null,
    created_at: "2026-11-01T10:00:00Z",
    completed_at: null,
    parent_id: null,
    ...fields,
  };
}

const AFE: Course = {
  id: 3,
  name: "Automaten, formale Sprachen und Entscheidbarkeit",
  short_name: "AFE",
  color: "#7048E8",
};

const SUGGESTION: Suggestion = {
  course_id: 3,
  course_name: AFE.name,
  short_name: "AFE",
  color: AFE.color,
  event_id: 42,
  event_title: "AFE Übung",
  event_start: "2026-11-04T10:00:00Z",
  event_end: "2026-11-04T11:30:00Z",
  running: true,
};

function form(fields: Partial<FormValues> = {}): FormValues {
  return { title: " Pumping-Lemma ", courseId: "", deadline: null, estimate: "", notes: "", ...fields };
}

// --- Server-Adresse ---------------------------------------------------------------

test("token goes only to https or localhost", () => {
  assert.equal(checkApiUrl("http://localhost:8000"), null);
  assert.equal(checkApiUrl("http://127.0.0.1:8000"), null);
  assert.equal(checkApiUrl("https://ads-todo.onrender.com"), null);
  assert.match(checkApiUrl("http://ads-todo.onrender.com") ?? "", /https/);
  assert.match(checkApiUrl("http://localhost.evil.example") ?? "", /https/);
  assert.match(checkApiUrl("localhost:8000") ?? "", /https|ungültig/);
  assert.match(checkApiUrl("kein url") ?? "", /ungültig/);
});

// --- Fehler -------------------------------------------------------------------------

test("error detail as text is shown as is", () => {
  assert.equal(describeError(404, { detail: "To-do 7 gibt es nicht" }), "To-do 7 gibt es nicht");
});

test("validation errors name the field", () => {
  const body = { detail: [{ loc: ["body", "estimate_minutes"], msg: "Dauer muss größer als 0 sein." }] };
  assert.equal(describeError(422, body), "estimate_minutes: Dauer muss größer als 0 sein.");
});

test("unknown error body falls back to the status", () => {
  assert.equal(describeError(502, null), "Fehler 502 vom Server");
  assert.equal(describeError(500, "<html>"), "Fehler 500 vom Server");
});

// --- Formular → Anfrage -------------------------------------------------------------

test("suggested course brings its event along", () => {
  assert.deepEqual(createPayload(form({ courseId: "3" }), SUGGESTION), {
    title: "Pumping-Lemma",
    course_id: 3,
    event_id: 42,
  });
});

test("other course drops the event", () => {
  assert.deepEqual(createPayload(form({ courseId: "5" }), SUGGESTION), {
    title: "Pumping-Lemma",
    course_id: 5,
  });
});

test("no course is sent as null so the server does not assign one", () => {
  assert.deepEqual(createPayload(form(), SUGGESTION), { title: "Pumping-Lemma", course_id: null });
});

test("optional fields only when filled", () => {
  const payload = createPayload(
    form({ deadline: new Date("2026-11-06T22:59:00Z"), estimate: "90", notes: "  Aufgabe 2 zuerst " }),
    null,
  );
  assert.deepEqual(payload, {
    title: "Pumping-Lemma",
    course_id: null,
    deadline: "2026-11-06T22:59:00.000Z",
    estimate_minutes: 90,
    notes: "Aufgabe 2 zuerst",
  });
});

// --- Texte --------------------------------------------------------------------------

test("saved message names the course or the inbox", () => {
  assert.equal(savedMessage(task({ course_id: 3, status: "open" }), [AFE]), "Gespeichert in AFE");
  assert.equal(savedMessage(task(), [AFE]), "In der Inbox gespeichert");
  assert.equal(savedMessage(task({ status: "open" }), [AFE]), "Gespeichert ohne Fach");
});

test("undo of completing goes back like in the web app", () => {
  assert.equal(reopenStatus(task({ course_id: 3, status: "done" })), "open");
  assert.equal(reopenStatus(task({ status: "done" })), "inbox");
});

test("start-by state", () => {
  assert.equal(startByState(task(), NOW), null);
  assert.equal(startByState(task({ start_by: "2026-11-04T10:00:00Z" }), NOW), "overdue");
  assert.equal(startByState(task({ start_by: "2026-11-06T10:00:00Z" }), NOW), "soon");
  assert.equal(startByState(task({ start_by: "2026-11-09T10:00:00Z" }), NOW), "later");
});

test("minutes like the web app", () => {
  assert.equal(formatMinutes(45), "45 Min.");
  assert.equal(formatMinutes(60), "1 Std.");
  assert.equal(formatMinutes(90), "1 Std. 30 Min.");
});

test("dates relative to today in local time", () => {
  assert.equal(formatWhen("2026-11-04T22:59:00Z", NOW, BERLIN), "heute 23:59");
  // 23:30 UTC ist in Berlin schon morgen
  assert.equal(formatWhen("2026-11-04T23:30:00Z", NOW, BERLIN), "morgen 00:30");
  assert.equal(formatWhen("2026-11-03T08:00:00Z", NOW, BERLIN), "gestern 09:00");
  assert.equal(formatWhen("2026-11-06T22:59:00Z", NOW, BERLIN), "Fr, 6. Nov. 23:59");
  assert.equal(formatWhen("2027-03-01T08:00:00Z", NOW, BERLIN), "Mo, 1. März 09:00");
});
