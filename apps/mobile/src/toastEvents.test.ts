import { describe, expect, it, vi } from "vitest";
import { emitGlobalToast, onGlobalToast } from "./toastEvents";

// État module-level (`pending`/`listeners`) : chaque test s'abonne/se désabonne pour repartir
// d'un état propre à la fin (pas de `beforeEach` possible sans exposer un reset de production).
describe("toastEvents", () => {
  it("émission avec abonné actif : reçu immédiatement", () => {
    const listener = vi.fn();
    const unsubscribe = onGlobalToast(listener);
    emitGlobalToast("Salut", "success");
    expect(listener).toHaveBeenCalledWith("Salut", "success");
    unsubscribe();
  });

  it("M3 : émission sans abonné, puis abonnement -> reçu une fois ; second abonnement -> rien", () => {
    emitGlobalToast("Pas de souci.", "info");

    const first = vi.fn();
    const unsubscribeFirst = onGlobalToast(first);
    expect(first).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith("Pas de souci.", "info");
    unsubscribeFirst();

    const second = vi.fn();
    const unsubscribeSecond = onGlobalToast(second);
    expect(second).not.toHaveBeenCalled();
    unsubscribeSecond();
  });

  it("seul le dernier toast émis sans abonné est conservé", () => {
    emitGlobalToast("Premier", "info");
    emitGlobalToast("Second", "error");

    const listener = vi.fn();
    const unsubscribe = onGlobalToast(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("Second", "error");
    unsubscribe();
  });

  it("désabonnement : n'est plus notifié", () => {
    const stillSubscribed = vi.fn();
    const unsubscribedListener = vi.fn();

    const unsubscribeStill = onGlobalToast(stillSubscribed);
    const unsubscribeGone = onGlobalToast(unsubscribedListener);
    unsubscribeGone();

    emitGlobalToast("Toujours là");

    expect(stillSubscribed).toHaveBeenCalledWith("Toujours là", "success");
    expect(unsubscribedListener).not.toHaveBeenCalled();
    unsubscribeStill();
  });
});
