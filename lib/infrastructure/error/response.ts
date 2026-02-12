import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  AppError,
  
} from './index';

/**
 * Unified Error Response Formatter
 */

export function createErrorResponse(error: unknown): NextResponse {
  console.error('[API Error]', error);

  // Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.issues.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
      { status: 400 }
    );
  }

  // Our custom AppError
  if (error instanceof AppError) {
    return NextResponse.json(error.toJSON(), {
      status: error.statusCode,
    });
  }

  // Standard Error
  if (error instanceof Error) {
    // Don't expose internal errors in production
    const isDev = process.env.NODE_ENV === 'development';

    return NextResponse.json(
      {
        error: isDev ? error.message : 'An unexpected error occurred',
        code: 'INTERNAL_SERVER_ERROR',
        ...(isDev && { stack: error.stack }),
      },
      { status: 500 }
    );
  }

  // Unknown error type
  return NextResponse.json(
    {
      error: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
    },
    { status: 500 }
  );
}

/**
 * Higher-order function for API route handlers
 * Provides unified error handling and try-catch wrapper
 */
export function apiHandler(
  handler: (req: Request, context?: any) => Promise<NextResponse>
) {
  return async (req: Request, context?: any) => {
    try {
      return await handler(req, context);
    } catch (error) {
      return createErrorResponse(error);
    }
  };
}

/**
 * Success response helper
 */
export function createSuccessResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}
