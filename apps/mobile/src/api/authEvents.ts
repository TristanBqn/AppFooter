// Petit pub-sub découplé de la navigation : le client HTTP (http.ts) prévient qu'une session
// a expiré (401), l'écran racine (câblé en M4 avec les écrans de connexion) s'abonne pour
// ramener l'utilisateur à l'écran de connexion.
type Listener = () => void;

const listeners = new Set<Listener>();

export function onUnauthorized(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitUnauthorized(): void {
  for (const listener of listeners) listener();
}
