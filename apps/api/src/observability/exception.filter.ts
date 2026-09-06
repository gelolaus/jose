import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { incrMetric, writeStructuredLog } from "./telemetry";

@Catch()
export class SanitizedExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message = "Something went wrong";
    let code: string | undefined;
    if (typeof raw === "string") {
      message = raw;
    } else if (raw && typeof raw === "object") {
      const body = raw as Record<string, unknown>;
      if (typeof body.message === "string") message = body.message;
      else if (Array.isArray(body.message)) message = body.message.map(String).join("; ");
      if (typeof body.code === "string") code = body.code;
    } else if (exception instanceof Error && status < 500) {
      message = exception.message;
    }

    if (status >= 500) {
      message = "Something went wrong. Use the support reference when contacting help.";
      incrMetric("database_errors", {
        reason:
          exception instanceof Error && /database|libsql|sqlite/i.test(exception.message)
            ? "database"
            : "server",
      });
    }

    if (/save|attempt|complete|finish/i.test(req.path) && status >= 500) {
      incrMetric("save_failures", { path: routeOnly(req.path) });
    }
    if (/auth|callback|login|oauth/i.test(req.path) && status >= 400) {
      incrMetric("callback_failures", { status: String(status) });
    }

    const supportRef = req.jose?.supportRef;
    const requestId = req.jose?.requestId;

    writeStructuredLog({
      level: status >= 500 ? "error" : "warn",
      msg: "request.exception",
      requestId,
      supportRef,
      path: routeOnly(req.originalUrl ?? req.path),
      method: req.method,
      status,
      error: {
        name: exception instanceof Error ? exception.name : "Error",
      },
    });

    res.status(status).json({
      statusCode: status,
      message,
      ...(code ? { code } : {}),
      supportRef,
      requestId,
    });
  }
}

function routeOnly(path: string): string {
  return path.split("?")[0] ?? path;
}
