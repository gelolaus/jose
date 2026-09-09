import { HttpException, HttpStatus, Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { loadJoseEnv } from "../config/env";
import { incrMetric } from "../observability/telemetry";

type Bucket = { count: number; resetAt: number };

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly buckets = new Map<string, Bucket>();

  use(req: Request, res: Response, next: NextFunction) {
    const env = loadJoseEnv(process.env);
    const { budget, kind } = classify(req);
    if (!budget) {
      next();
      return;
    }
    const limit =
      kind === "login"
        ? env.rateLimitLogin
        : kind === "attempt"
          ? env.rateLimitAttempt
          : env.rateLimitMutation;
    const key = `${kind}:${rateLimitClientKey(req)}`;
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + env.rateLimitWindowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader("x-ratelimit-limit", String(limit));
    res.setHeader("x-ratelimit-remaining", String(Math.max(0, limit - bucket.count)));
    res.setHeader("x-ratelimit-reset", String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > limit) {
      incrMetric("rate_limited", { kind });
      next(
        new HttpException(
          {
            message: "Too many requests. Try again shortly.",
            code: "RATE_LIMITED",
          },
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );
      return;
    }
    next();
  }
}

/**
 * Use the address Express already computed from the socket + trusted proxy hops.
 * Do not read X-Forwarded-For here: clients can spoof that header.
 */
export function rateLimitClientKey(req: Request): string {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function classify(req: Request): {
  budget: boolean;
  kind: "login" | "attempt" | "mutation" | "none";
} {
  const path = req.path || "";
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return { budget: false, kind: "none" };
  }
  if (/\/auth\/|\/login|\/callback/i.test(path)) {
    return { budget: true, kind: "login" };
  }
  if (/\/attempts|\/miss$|\/complete$|\/finish$/i.test(path)) {
    return { budget: true, kind: "attempt" };
  }
  if (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE") {
    return { budget: true, kind: "mutation" };
  }
  return { budget: false, kind: "none" };
}
