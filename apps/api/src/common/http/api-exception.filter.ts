import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type {Request, Response} from 'express';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function getHttpExceptionMessage(exception: HttpException): string | string[] {
  const body: unknown = exception.getResponse();

  if (typeof body === 'string') {
    return body;
  }

  if (typeof body === 'object' && body !== null && 'message' in body) {
    const message = body.message;
    if (typeof message === 'string' || isStringArray(message)) {
      return message;
    }
  }

  return exception.message;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
        ? 'Internal server error'
        : exception instanceof HttpException
          ? getHttpExceptionMessage(exception)
          : 'Internal server error';

    response.status(statusCode).json({
      statusCode,
      message,
      path: request.path,
      timestamp: new Date().toISOString(),
    });
  }
}
