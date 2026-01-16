import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '@/lib/infrastructure/error';

type ApiResponse<T> = {
  data?: T;
  error?: string;
  code?: string;
  details?: any;
};

export function createSuccessResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status }); // Flatten data for client convenience, or wrap in { data }? 
  // Existing API returns { article: ... } or { articles: ... }. 
  // To match existing behavior, we will pass the object directly.
  // But strictly, we should normalize. For now, let's keep it flexible.
}

export function createErrorResponse(error: unknown) {
  console.error('API Error:', error);

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.issues,
      },
      { status: 400 }
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof Error) {
    return NextResponse.json(
      {
        error: error.message,
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      error: 'An unexpected error occurred',
      code: 'INTERNAL_SERVER_ERROR',
    },
    { status: 500 }
  );
}

// Higher-order function for API handlers
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
