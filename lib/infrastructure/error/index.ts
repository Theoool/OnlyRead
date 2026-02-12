/**
 * Unified Error System
 * All custom errors extend from AppError
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_SERVER_ERROR',
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

// 4xx Errors
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', details?: any) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', details?: any) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', errors?: any[]) {
    super(message, 400, 'VALIDATION_ERROR', errors ? { errors } : undefined);
  }
}

export class FileTooLargeError extends AppError {
  constructor(maxSize: string) {
    super(
      `File too large. Maximum size: ${maxSize}`,
      413,
      'FILE_TOO_LARGE',
      { maxSize }
    );
  }
}

export class UnsupportedFormatError extends AppError {
  constructor(supportedFormats: string[]) {
    super(
      `Unsupported file format. Supported: ${supportedFormats.join(', ')}`,
      400,
      'UNSUPPORTED_FORMAT',
      { supportedFormats }
    );
  }
}

// 5xx Errors
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details, false);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database error', details?: any) {
    super(message, 500, 'DATABASE_ERROR', details, false);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string = 'External service error') {
    super(
      `${service}: ${message}`,
      502,
      'EXTERNAL_SERVICE_ERROR',
      { service },
      false
    );
  }
}
