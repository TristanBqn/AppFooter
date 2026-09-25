// Client HTTP/2 minimal pour l'API APNs (`node:http2`, pas de bibliothèque tierce). Interface
// injectable : les tests fournissent un client simulé (ADR 004, B12).
import { connect } from "node:http2";

export interface ApnsHttp2Response {
  status: number;
  body: string;
}

export interface ApnsHttp2Client {
  post(origin: string, path: string, headers: Record<string, string>, body: string): Promise<ApnsHttp2Response>;
}

export function createNodeHttp2Client(): ApnsHttp2Client {
  return {
    post(origin, path, headers, body) {
      return new Promise((resolve, reject) => {
        const session = connect(origin);
        session.on("error", reject);

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
          session.close();
          resolve({ status, body: responseBody });
        });
        req.on("error", (err) => {
          session.close();
          reject(err);
        });

        req.end(body);
      });
    },
  };
}
