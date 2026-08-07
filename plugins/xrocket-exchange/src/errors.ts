export class XrocketHttpError extends Error {
  constructor(
    readonly status: number,
    readonly details: unknown,
    readonly retryAfter?: string,
  ) {
    super(`xRocket API returned HTTP ${status}`);
    this.name = "XrocketHttpError";
  }
}

export class UnknownWriteOutcomeError extends Error {
  constructor(
    readonly operation: string,
    readonly clientId: string,
    readonly causeDescription: string,
  ) {
    super(
      `The ${operation} outcome is unknown. Do not retry automatically; reconcile using client ID ${clientId}.`,
    );
    this.name = "UnknownWriteOutcomeError";
  }
}

export class ApprovalReceiptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalReceiptError";
  }
}
