import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = typeof body === "object" && body && "message" in body ? (body as { message: string }).message : "Terjadi kesalahan.";
    const code = typeof body === "object" && body && "code" in body ? (body as { code: string }).code : "INTERNAL_ERROR";

    response.status(status).json({
      success: false,
      error: { code, message: Array.isArray(message) ? message.join(", ") : message },
      meta: { requestId: null }
    });
  }
}
