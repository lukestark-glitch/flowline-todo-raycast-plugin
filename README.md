# Flowline ToDo für Raycast

To-dos fürs Studium direkt aus [Raycast](https://raycast.com) notieren, ansehen und abhaken. Die Extension ist ein Begleiter zur Web-App **Flowline ToDo**: Alles wird dort gespeichert, die Extension spricht nur mit deinem Konto.

## Befehle

| Befehl | Was er macht |
| --- | --- |
| **Blitz-Erfassen** | To-do nur mit Titel notieren, ohne Fenster. Läuft gerade eine Vorlesung, bekommt es deren Fach. |
| **To-do hinzufügen** | Formular mit Fach (vorausgewählt), Deadline, Dauer und Notizen. |
| **To-dos anzeigen** | Offene To-dos in der Reihenfolge, in der du anfangen musst. Enter hakt ab (mit Rückgängig), ⌘E (Windows: Strg+E) ändert das Fach. |
| **To-do-Inbox** | Noch nicht einsortierte To-dos; Enter öffnet das Formular zum Einsortieren. |

Schnell-Syntax am Ende des Titels: `#mat1` Fach, `#d90` Dauer in Minuten, `#Tfr` Deadline (Freitag), `#Übungsblatt` Art. Beispiel: `Blatt 4 abgeben #mat1 #d90 #Tfr`.

## Einrichten

Du brauchst ein Konto in der Web-App Flowline ToDo.

1. In der Web-App **Einstellungen → Integrationen** öffnen und einen Token erstellen, z. B. „Raycast MacBook“. Der Token beginnt mit `adt_` und wird nur einmal angezeigt; gleich kopieren.
2. In Raycast einen der Befehle öffnen. Beim ersten Start fragt Raycast nach den Einstellungen (später: ⌘, im Befehl, unter Windows Strg+,):
   - **Server-Adresse:** die Adresse der Web-App, z. B. `https://flowline.example.com` (ohne `/api` am Ende).
   - **API-Token:** der kopierte Token. Raycast legt ihn im Schlüsselbund ab.
3. Fertig. Meldet ein Befehl „Token ungültig oder widerrufen“, in der Web-App einen neuen Token erstellen und hier eintragen.

Der Token geht nur über `https://` an den Server (lokal auch `http://localhost`), damit ihn niemand mitlesen kann. Unter **Einstellungen → Integrationen** siehst du, wann ein Token zuletzt benutzt wurde, und kannst ihn jederzeit widerrufen.

## Ohne Raycast Store installieren

Läuft mit Raycast auf dem Mac und mit [Raycast für Windows](https://www.raycast.com/windows) (Windows 10 ab 21H2 oder Windows 11; Manifest `"platforms": ["macOS", "Windows"]`).

1. [Node.js](https://nodejs.org) ab Version 22.22 installieren (unter Windows den LTS-Installer `.msi`, Standardeinstellungen).
2. Dieses Repo herunterladen (grüner Knopf **Code → Download ZIP**, entpacken) oder klonen.
3. Im Terminal in den Ordner wechseln (Windows: im Explorer im Ordner Rechtsklick → **In Terminal öffnen**) und `npm install`, dann `npm run dev` ausführen. Raycast lädt die Extension; danach kann das Terminal zu.

## Entwickeln

```sh
npm install      # Abhängigkeiten
npm run dev      # in Raycast laden, Änderungen live
npm test         # reine Logik in src/lib (node --test)
npm run lint     # ray lint (ESLint, Prettier, Manifest)
```

Aufbau: `src/api.ts` spricht mit der REST-API der Web-App (Adresse und Token aus den Raycast-Einstellungen), `src/lib/core.ts` enthält die Logik ohne Raycast-Importe (getestet mit `node --test`), `src/task-form.tsx` das Formular für neue und bestehende To-dos, `src/task-actions.tsx` die Aktionen an einem To-do.

## Lizenz

MIT, siehe [LICENSE](LICENSE).
