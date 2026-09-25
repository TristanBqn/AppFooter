// Émetteur minimal pour un toast affiché après un retour en arrière (ex. retrait/blocage d'un
// ami depuis sa fiche, DESIGN.md §0 « retour à la liste + Toast »). Même patron que
// src/api/authEvents.ts. Les écrans concernés s'abonnent et affichent le message avec leur propre
// `useToast` local : pas d'état global de toast, juste un signal.
export type ToastTone = "success" | "info" | "error";
type Listener = (message: string, tone: ToastTone) => void;

const listeners = new Set<Listener>();

export function onGlobalToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitGlobalToast(message: string, tone: ToastTone = "success"): void {
  for (const listener of listeners) listener(message, tone);
}
