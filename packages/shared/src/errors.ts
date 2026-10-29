export class MagnexisError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "MagnexisError";
  }
}

export class NotFoundError extends MagnexisError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} '${id}' not found` : `${resource} not found`,
      "NOT_FOUND",
      404,
    );
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends MagnexisError {
  constructor(message = "Authentication required") {
    super(message, "UNAUTHORIZED", 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends MagnexisError {
  constructor(message = "Insufficient permissions") {
    super(message, "FORBIDDEN", 403);
    this.name = "ForbiddenError";
  }
}

export class ProviderUnavailableError extends MagnexisError {
  constructor(provider: string, reason?: string) {
    super(
      reason
        ? `${provider} unavailable: ${reason}`
        : `${provider} is not configured or unavailable`,
      "PROVIDER_UNAVAILABLE",
      503,
      { provider },
    );
    this.name = "ProviderUnavailableError";
  }
}

export class ValidationError extends MagnexisError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "ValidationError";
  }
}
