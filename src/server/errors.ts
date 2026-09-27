/**
 * Typed application errors. Services throw these; the API boundary converts them
 * to safe HTTP responses. Internal details never reach the client in production.
 */

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "DEPENDENCY"
  | "INTERNAL";

const STATUS: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  DEPENDENCY: 502,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** Safe, user-facing message. Falls back to the base message. */
  readonly userMessage: string;
  /** Optional field-level validation details. */
  readonly details?: Record<string, string[]>;

  constructor(
    code: AppErrorCode,
    userMessage: string,
    options?: { cause?: unknown; details?: Record<string, string[]> },
  ) {
    super(userMessage, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.userMessage = userMessage;
    this.details = options?.details;
  }
}

export const Errors = {
  unauthenticated: (msg = "You need to sign in to continue.") =>
    new AppError("UNAUTHENTICATED", msg),
  forbidden: (msg = "You do not have permission to do that.") =>
    new AppError("FORBIDDEN", msg),
  notFound: (msg = "The requested item was not found.") =>
    new AppError("NOT_FOUND", msg),
  validation: (msg = "Some fields need attention.", details?: Record<string, string[]>) =>
    new AppError("VALIDATION", msg, { details }),
  conflict: (msg = "That action conflicts with the current state.") =>
    new AppError("CONFLICT", msg),
  rateLimited: (msg = "Too many attempts. Please wait and try again.") =>
    new AppError("RATE_LIMITED", msg),
  dependency: (msg = "A required service is unavailable. Try again shortly.") =>
    new AppError("DEPENDENCY", msg),
  internal: (msg = "Something went wrong on our side.") =>
    new AppError("INTERNAL", msg),
} as const;

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/**
 * Convert any thrown value into a safe serialised error body for the client.
 * Non-AppError values are treated as internal errors and their details hidden.
 */
export function toErrorResponse(e: unknown): {
  status: number;
  body: { error: { code: AppErrorCode; message: string; details?: Record<string, string[]> } };
} {
  if (isAppError(e)) {
    return {
      status: e.status,
      body: {
        error: {
          code: e.code,
          message: e.userMessage,
          ...(e.details ? { details: e.details } : {}),
        },
      },
    };
  }
  return {
    status: 500,
    body: { error: { code: "INTERNAL", message: "Something went wrong on our side." } },
  };
}
