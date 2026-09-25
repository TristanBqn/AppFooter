// Client HTTP/2 minimal pour l'API APNs (`node:http2`, pas de bibliothèque tierce). Interface
// injectable : les tests fournissent un client simulé (ADR 004, B12).
import { type ClientHttp2Session, connect } from "node:http2";

export interface ApnsHttp2Response {
  status: number;
  body: string;
}

export interface ApnsHttp2Client {
  post(origin: string, path: string, headers: Record<string, string>, body: string): Promise<ApnsHttp2Response>;
}

/**
 * Borne la connexion ET la requête (sur le modèle de `AppleTokenClient`, `token-client.ts`) : si
 * Apple n'envoie jamais ni `response` ni `error`, l'appel doit échouer plutôt que bloquer
 * indéfiniment le flush des notifications.
 */
export const APNS_REQUEST_TIMEOUT_MS = 10_000;

export function createNodeHttp2Client(
  connectFn: (origin: string) => ClientHttp2Session = connect,
): ApnsHttp2Client {
  return {
    post(origin, path, headers, body) {
      return new Promise((resolve, reject) => {
        const session = connectFn(origin);
        let settled = false;

        function settle(action: () => void): void {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          action();
        }

        const timer = setTimeout(() => {
          settle(() => {
            // La session ne répond pas : `close()` (GOAWAY) attendrait une confirmation qui ne
            // viendra jamais, `destroy()` la termine immédiatement sans lever d'erreur superflue.
            session.destroy();
            reject(new Error(`APNs : délai d'expiration dépassé (${APNS_REQUEST_TIMEOUT_MS} ms)`));
          });
        }, APNS_REQUEST_TIMEOUT_MS);

        session.on("error", (err) => settle(() => reject(err)));

        const req = session.request({ ":method": "POST", ":path": path, ...headers });
        req.setEncoding("utf8");
        let status = 0;
        let responseBody = "";

        req.on("response", (responseHeaders) => {
          status = Number(responseHeaders[":status"]);
        });
        req.on("data", (chunk: string) => {
          responseBody += chunk;
        });
        req.on("end", () => {
          settle(() => {
            session.close();
            resolve({ status, body: responseBody });
          });
        });
        req.on("error", (err) => {
          settle(() => {
            session.close();
            reject(err);
          });
        });

        req.end(body);
      });
    },
  };
}
