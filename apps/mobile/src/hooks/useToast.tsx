// Toast contrôlé réutilisable (retour immédiat après une action, DESIGN.md §0).
import { useCallback, useState } from "react";
import { Toast, type ToastProps } from "@app/ui";

export function useToast() {
  const [state, setState] = useState<{ message: string; tone: NonNullable<ToastProps["tone"]> } | null>(null);

  const showToast = useCallback((message: string, tone: NonNullable<ToastProps["tone"]> = "error") => {
    setState({ message, tone });
  }, []);

  const toastElement = state ? (
    <Toast visible message={state.message} tone={state.tone} onHide={() => setState(null)} />
  ) : null;

  return { showToast, toastElement };
}
