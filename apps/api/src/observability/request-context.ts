import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  NestMiddleware,
} from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { Observable, tap } from "rxjs";
import {
  createSupportReference,
  newRequestId,
  observeLatencyMs,
  writeStructuredLog,
} from "./telemetry";

export type RequestContext = {
  requestId: string;
  supportRef: string;
};

declare module "express-serve-static-core" {
  interface Request {
    jose?: RequestContext;
  }
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = newRequestId(req.headers["x-request-id"]);
    const supportRef = createSupportReference(requestId);
    req.jose = { requestId, supportRef };
    res.setHeader("x-request-id", requestId);
    res.setHeader("x-jose-support-ref", supportRef);
    next();
  }
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const started = Date.now();
    const path = req.originalUrl ?? req.url;
    const method = req.method;

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - started;
          observeLatencyMs(
            { method, route: routeLabel(path), status: String(res.statusCode) },
            durationMs,
          );
          writeStructuredLog({
            level: "info",
            msg: "request.completed",
            requestId: req.jose?.requestId,
            supportRef: req.jose?.supportRef,
            method,
            path: routeLabel(path),
            status: res.statusCode,
            durationMs,
          });
        },
        error: (error: unknown) => {
          const durationMs = Date.now() - started;
          const status =
            typeof error === "object" &&
            error &&
            "status" in error &&
            typeof (error as { status: unknown }).status === "number"
              ? (error as { status: number }).status
              : 500;
          observeLatencyMs(
            { method, route: routeLabel(path), status: String(status) },
            durationMs,
          );
          writeStructuredLog({
            level: status >= 500 ? "error" : "warn",
            msg: "request.failed",
            requestId: req.jose?.requestId,
            supportRef: req.jose?.supportRef,
            method,
            path: routeLabel(path),
            status,
            durationMs,
            error: {
              name: error instanceof Error ? error.name : "Error",
            },
          });
        },
      }),
    );
  }
}

function routeLabel(path: string): string {
  return path.split("?")[0]?.replace(/\/[0-9a-f-]{8,}/gi, "/:id") ?? path;
}
