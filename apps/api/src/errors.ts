// Erreur métier portant un code du contrat : capturée par le middleware d'erreur de `app.ts`
// et traduite dans l'enveloppe unique `{ error: { code, message, issues? } }`.
import type { ErrorCode } from "@app/contracts";
import { ERROR_STATUS } from "@app/contracts";

export interface AppErrorIssue {
  path: string;
  message: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly issues?: AppErrorIssue[];

  constructor(code: ErrorCode, message: string, issues?: AppErrorIssue[]) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.issues = issues;
  }
}
