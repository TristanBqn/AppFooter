// Émetteur minimal pour un toast affiché après un retour en arrière (ex. retrait/blocage d'un
// ami depuis sa fiche, DESIGN.md §0 « retour à la liste + Toast »). Même patron que
// src/api/authEvents.ts. Les écrans concernés s'abonnent et affichent le message avec leur propre
// `useToast` local : pas d'état global de toast, juste un signal.
export type ToastTone = "success" | "info" | "error";
type Listener = (message: string, tone: ToastTone) => void;
type PendingToast = { message: string; tone: ToastTone };

const listeners = new Set<Listener>();

// M3 : `emitGlobalToast` peut survenir avant que l'écran suivant ne se soit monté et abonné (ex.
// « Pas maintenant » du consentement, émis juste avant `router.replace` vers l'Accueil). Sans
// abonné au moment de l'émission, on garde le dernier message et on le délivre une seule fois,
// au premier abonnement suivant.
let pending: PendingToast | null = null;

export function onGlobalToast(listener: Listener): () => void {
  if (pending) {
    const { message, tone } = pending;
    pending = null;
    listener(message, tone);
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitGlobalToast(message: string, tone: ToastTone = "success"): void {
  if (listeners.size === 0) {
    pending = { message, tone };
    return;
  }
  for (const listener of listeners) listener(message, tone);
}
