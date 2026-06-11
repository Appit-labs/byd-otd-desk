import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as Record<string, unknown>).message
              ? Array.isArray(
                  (exceptionResponse as Record<string, unknown>).message,
                )
                ? (
                    (exceptionResponse as Record<string, unknown>)
                      .message as string[]
                  ).join(', ')
                : (exceptionResponse as Record<string, unknown>).message as string
              : exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(status).send({
      success: false,
      data: null,
      error: message,
    });
  }
}
