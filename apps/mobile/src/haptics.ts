// Retour haptique discret (DESIGN.md §0) : envoi d'encouragement, acceptation d'ami, bascule de
// période. Volontairement minuscule et non bloquant (« fire and forget »).
import * as Haptics from "expo-haptics";

export function impactLight(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}
