export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message: string = 'Bad request') {
    return new AppError(message, 400);
  }

  static unauthorized(message: string = 'Unauthorized') {
    return new AppError(message, 401);
  }

  static forbidden(message: string = 'Forbidden') {
    return new AppError(message, 403);
  }

  static notFound(message: string = 'Resource not found') {
    return new AppError(message, 404);
  }

  static conflict(message: string = 'Conflict') {
    return new AppError(message, 409);
  }

  static internal(message: string = 'Internal server error') {
    return new AppError(message, 500, false);
  }

  /**
   * A third-party API (AI provider, mail relay, social platform) failed in a way
   * the operator needs to read verbatim — e.g. "OpenAI error: incorrect API key".
   *
   * Use this instead of a bare `Error` for upstream failures whose text should
   * reach the UI. The global error handler only forwards messages from
   * operational `AppError`s; anything else is replaced with a generic string to
   * avoid leaking internal details. Never pass a raw driver/ORM error message
   * through this — only text that is safe for a user to read.
   */
  static upstream(message: string) {
    return new AppError(message, 502);
  }
}
