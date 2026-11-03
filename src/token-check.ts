// Prüft beim Start eines Befehls den Token (GET /api/me), bevor Daten geladen werden. Abgelehnt
// (z. B. widerrufen): eine Meldung mit Knopf zu den Einstellungen statt eines leeren Fehlers.

import { openExtensionPreferences, showToast, Toast } from "@raycast/api";
import { usePromise } from "@raycast/utils";

import { getMe } from "./api";

export function useTokenCheck() {
  const { data, isLoading, error } = usePromise(getMe, [], {
    onError: async (failure) => {
      await showToast({
        style: Toast.Style.Failure,
        title: "Anmeldung fehlgeschlagen",
        message: failure.message,
        primaryAction: { title: "Einstellungen öffnen", onAction: () => openExtensionPreferences() },
      });
    },
  });
  return { ready: data !== undefined, checking: isLoading, failed: error !== undefined };
}
