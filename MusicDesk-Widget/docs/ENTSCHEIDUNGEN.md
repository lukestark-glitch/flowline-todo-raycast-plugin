# Entscheidungen

Dieses Dokument hält fest, **was** bei MusicDesk wie gelöst wurde und **warum**. Neue Entscheidungen bitte unten anfügen.

---

## 1. NSAppleScript statt ScriptingBridge

**Entscheidung:** Die Kommunikation mit Apple Music läuft über `NSAppleScript`, nicht über ScriptingBridge (`SBApplication`).

**Warum:**
- ScriptingBridge braucht für Swift entweder generierte Header (`sdef | sdp`) oder unsauberes dynamisches Aufrufen per `value(forKey:)`/`perform` – beides fehleranfällig und schwer ohne Xcode zu pflegen.
- `SBApplication` startet die Ziel-App unter Umständen schon beim Zugriff auf Eigenschaften – genau das wollen wir nicht (siehe 2).
- Mit AppleScript bekommen wir **alle Werte in einem einzigen Aufruf** (Status, Titel, Künstler, Position, Dauer) statt fünf einzelner AppleEvents.

**Wie:**
- `NSAppleScript` ist nicht thread-sicher. Alle Skripte werden deshalb auf **einer eigenen seriellen Hintergrund-`DispatchQueue`** einmal kompiliert und dort wiederverwendet. Ergebnisse gehen zurück an den Main Actor. Die Oberfläche blockiert nie, auch wenn Music hängt.
- Das Abfrage-Skript gibt eine **AppleScript-Liste** `{state, name, artist, position, duration}` zurück. Diese wird als `NSAppleEventDescriptor`-Liste ausgelesen (`atIndex(1)` …, `doubleValue` für Zahlen). So umgehen wir Probleme mit Zahl→Text-Umwandlung (Dezimalkomma bei deutscher Systemsprache) und mit Trennzeichen im Songtitel.
- Der Status wird im Skript per Vergleich (`if ps is playing …`) zu `"playing"`/`"paused"`/`"stopped"` umgesetzt (unabhängig von der Systemsprache); der Zugriff auf `current track` ist in `try` gekapselt, weil es im Zustand „gestoppt“ keinen aktuellen Titel gibt.
- Fehlt die Erlaubnis (Fehler −1743), zeigt das Widget den Leerlauf-Zustand, meldet den Fehler nicht wiederholt und versucht es bei der nächsten Abfrage erneut.

## 2. Apple Music wird nie gestartet

**Entscheidung:** MusicDesk sendet nur dann AppleEvents an Music, wenn `NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.Music")` nicht leer ist.

**Warum:** Ein AppleEvent an eine nicht laufende App startet diese. Ein Desktop-Widget, das beim Anmelden oder jede Sekunde ungefragt Music öffnet, wäre extrem lästig. Läuft Music nicht, zeigt das Widget „Nichts läuft“; auch die Knöpfe starten Music bewusst nicht.

## 3. Benachrichtigung + 1-s-Abfrage + lokale Interpolation

**Entscheidung:** Drei Mechanismen kombiniert:
1. **`DistributedNotificationCenter`** mit `com.apple.Music.playerInfo` – Music meldet Titelwechsel, Play/Pause sofort. Die Daten aus `userInfo` (Name, Artist, Player State, Total Time) werden direkt übernommen, danach folgt eine vollständige Abfrage.
2. **Timer, 1 Sekunde** – fängt alles ab, was die Benachrichtigung nicht meldet (Spulen in Music selbst, verpasste Ereignisse) und gleicht die Position ab.
3. **Lokale Interpolation** – zwischen den Abfragen wird die Position aus `position + (jetzt − updatedAt)` hochgerechnet und ca. 30-mal pro Sekunde gezeichnet. Die Leiste läuft flüssig, ohne Music 30-mal pro Sekunde zu fragen.

Zusätzlich beobachtet `NSWorkspace` Start und Beenden von Music, damit das Widget sofort reagiert.

**Spulen:** Nach einem Sprung wird der Zustand sofort lokal („optimistisch“) gesetzt. Abfrage-Ergebnisse, die kurz danach (ca. 1 s Schonfrist) mit einer veralteten Position eintreffen, werden ignoriert – sonst springt der Regler kurz zurück.

## 4. Fenster: nicht aktivierendes NSPanel auf Schreibtisch-Symbol-Ebene + 1

**Entscheidung:** Randloses, transparentes `NSPanel` (`.nonactivatingPanel`), `isOpaque = false`, `backgroundColor = .clear`, kein Schatten, Ebene `CGWindowLevelForKey(.desktopIconWindow) + 1`, `collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]`.

**Warum:**
- Ebene *Schreibtisch-Symbole + 1* liegt genau **über Hintergrundbild und Symbolen**, aber **unter allen normalen Fenstern** – wie ein Teil des Schreibtischs.
- `canJoinAllSpaces` + `stationary`: auf allen Spaces sichtbar, bewegt sich bei Mission Control nicht mit.
- Nicht aktivierend: Ein Klick auf einen Knopf holt MusicDesk nicht nach vorn und nimmt der gerade benutzten App nicht den Fokus.
- `LSUIElement` + `.accessory`: kein Dock-Symbol, nicht im ⌘-Tab-Umschalter.

## 5. Klickflächen mit 0,011 Deckkraft

**Entscheidung:** Knöpfe und Fortschrittsleiste liegen auf einer fast unsichtbaren Fläche (`Color.black.opacity(0.011)`), die Leiste hat eine ca. 30 pt hohe Trefferzone, Knöpfe mindestens 36 × 36 pt.

**Warum:** macOS lässt Mausklicks bei transparenten Fenstern an **vollständig durchsichtigen Pixeln** durch das Fenster hindurch. Ohne Hintergrund müsste man exakt die dünne Linie oder das schmale Symbol treffen. Bei 0,011 Deckkraft ist die Fläche für das Auge unsichtbar, zählt für macOS aber als „getroffen“. Ein kleinerer Wert kann auf manchen Systemen auf 0 gerundet werden. Die übrigen leeren Flächen bleiben voll durchsichtig und damit durchklickbar. `ignoresMouseEvents` wird bewusst nicht gesetzt.

## 6. „First Mouse“

**Entscheidung:** Die Ansicht akzeptiert den ersten Mausklick (`acceptsFirstMouse` → `true`).

**Warum:** Da das Fenster nie aktiv ist, würde der erste Klick sonst nur das Fenster „aufwecken“ und nicht den Knopf auslösen – man müsste jeden Knopf zweimal klicken.

## 7. Autostart mit SMAppService beim ersten Start

**Entscheidung:** Beim allerersten Start (UserDefaults-Merker `didAttemptInitialLoginRegistration`) ruft die App `SMAppService.mainApp.register()` auf. Danach entscheidet nur noch der Nutzer (Menü oder Systemeinstellungen).

**Warum:**
- `SMAppService` (ab macOS 13) ist die aktuelle, von Apple vorgesehene API; keine Hilfs-App und keine veralteten `LSSharedFileList`-Aufrufe nötig. Der Eintrag erscheint sauber unter *Anmeldeobjekte*.
- Ein Desktop-Widget soll einfach immer da sein – daher standardmäßig an.
- Der Merker sorgt dafür, dass ein vom Nutzer abgeschalteter Autostart nicht bei jedem Start wieder eingeschaltet wird.
- Fehler werden mit `os.Logger` protokolliert, die App stürzt nie deswegen ab.

## 8. Ad-hoc-Signatur

**Entscheidung:** Die App wird mit `codesign --force --deep -s -` ad-hoc signiert; keine Beglaubigung (Notarisierung), kein Hardened Runtime, keine Sandbox.

**Warum:**
- Kein kostenpflichtiges Apple-Developer-Konto nötig.
- Apple-Silicon-Macs führen unsignierten Code gar nicht aus – eine Ad-hoc-Signatur reicht dafür aus.
- Die Sandbox würde AppleEvents an Music nur mit zusätzlichen Entitlements erlauben; ohne Sandbox genügt `NSAppleEventsUsageDescription`.
- **Nachteil:** Heruntergeladene Builds lösen einmalig die Gatekeeper-Warnung aus (siehe README). Außerdem ändert sich die Signatur bei jedem Build, daher fragt macOS nach einem Neubau ggf. erneut nach der Music-Erlaubnis.

## 9. Universal Binary über SPM mit Rückfallebene

**Entscheidung:** `swift build -c release --arch arm64 --arch x86_64`. Schlägt das fehl (manche Toolchain-Versionen), baut `build.sh` beide Architekturen einzeln (`--triple arm64-apple-macosx13.0` / `x86_64-apple-macosx13.0`) und fügt sie mit `lipo -create` zusammen. Am Ende prüft das Skript per `lipo -archs`, dass beide Architekturen enthalten sind.

**Warum:** Kein Xcode-Projekt nötig (reines Swift Package, baut auch nur mit den Command Line Tools), und eine einzige Datei läuft nativ auf Intel und Apple Silicon. Das App-Bundle (`Info.plist`, Icon) setzt `build.sh` selbst zusammen.

## 10. Programmatisch erzeugtes Icon

**Entscheidung:** `scripts/make_icon.py` zeichnet das App-Icon mit Pillow (weiße Note aus Grundformen auf rot-pinkem Verlauf, abgerundetes Quadrat) und schreibt `Resources/AppIcon.icns` und `AppIcon.png`.

**Warum:** Keine Fremd-Grafiken mit unklarer Lizenz, keine Abhängigkeit von Schriftarten, reproduzierbar und ohne Grafikprogramm änderbar. Bewusst „Apple-Music-ähnlich“, aber eigenständig.

## 11. Standardfarbe Schwarz

**Entscheidung:** Standard ist **Schwarz**; wählbar sind Schwarz, Weiß und Automatisch (folgt dem Erscheinungsbild von macOS).

**Warum:** Klare, vorhersagbare Darstellung ab dem ersten Start. „Automatisch“ richtet sich nach Hell/Dunkel-Modus, nicht nach dem Hintergrundbild – das wäre für helle Bilder im Dunkelmodus falsch. Wer ein dunkles Hintergrundbild hat, stellt auf Weiß um.

## 12. Projekt als Unterordner im bestehenden Repository + Build über GitHub Actions

**Entscheidung:** MusicDesk liegt vorerst im Ordner `MusicDesk-Widget/` des bestehenden Repositorys `lukestark-glitch/flowline-todo-raycast-plugin`. Gebaut wird ausschließlich auf einem **macOS-Runner von GitHub Actions** (`.github/workflows/musicdesk.yml`).

**Warum, ganz offen:** Die Umgebung, in der das Projekt entstanden ist, war ein **Linux-System ohne Xcode und ohne Swift-Compiler** – eine Mac-App lässt sich dort weder bauen noch testen. Außerdem konnte dort **kein neues GitHub-Repository angelegt** werden (kein `gh repo create` bzw. keine Berechtigung dafür). Der pragmatische Weg war daher: Code im vorhandenen Repository ablegen und den Build an einen macOS-Runner abgeben, der die App baut, prüft und als Release bzw. Artefakt bereitstellt.

**In ein eigenes Repository `MusicDesk-Widget` umziehen:**

*Variante A – mit Git-Historie (`git subtree`):*

```bash
cd flowline-todo-raycast-plugin
git subtree split --prefix=MusicDesk-Widget -b musicdesk
mkdir ../MusicDesk-Widget && cd ../MusicDesk-Widget
git init
git pull ../flowline-todo-raycast-plugin musicdesk
mkdir -p .github/workflows
cp ../flowline-todo-raycast-plugin/.github/workflows/musicdesk.yml .github/workflows/
# Workflow anpassen (siehe unten), dann:
git add .github && git commit -m "CI-Workflow übernehmen"
gh repo create MusicDesk-Widget --public --source=. --push
```

*Variante B – einfach kopieren (ohne Historie):* Den Ordner `MusicDesk-Widget/` und die Datei `.github/workflows/musicdesk.yml` in ein neues, leeres Repository kopieren (Workflow nach `.github/workflows/`), committen und pushen.

**Danach den Workflow anpassen:** Im neuen Repository liegt das Projekt im Wurzelverzeichnis. In `musicdesk.yml` daher
- die `paths`-Filter von `MusicDesk-Widget/**` auf das neue Layout ändern (oder ganz entfernen),
- Pfade wie `MusicDesk-Widget/scripts/build.sh` bzw. `MusicDesk-Widget/dist/…` zu `scripts/build.sh` bzw. `dist/…` ändern (oder `working-directory` entfernen),
- optional das Tag-Muster von `musicdesk-v*` auf `v*` vereinfachen.

Anschließend die Links im README (Releases, Actions, `git clone`) auf das neue Repository umstellen.
