import { json, urlencoded, type RequestHandler } from "express";

/**
 * Route-specific import body limit.
 * A valid 200_000 UTF-8 byte JMM source expands after JSON serialization:
 * every `"` and `\` gains a backslash, every newline becomes `\n` (2 bytes),
 * plus the `{"source":"..."}` envelope. Quote/backslash-heavy sources near
 * the limit need ~400KB+ on the wire, so imports get at least 512KB while
 * ordinary routes stay restrictive via JOSE_MAX_BODY_BYTES (default 256KB).
 */
export const IMPORT_BODY_LIMIT_BYTES = 512 * 1024;

export function isImportBodyPath(path: string): boolean {
  return path.startsWith("/teach/modules/import/");
}

export function importBodyLimitBytes(maxBodyBytes: number): number {
  return Math.max(maxBodyBytes, IMPORT_BODY_LIMIT_BYTES);
}

/** Express middleware pair: restrictive default, roomy import routes. */
export function createBodyLimitMiddleware(opts: {
  maxBodyBytes: number;
}): RequestHandler {
  const restrictiveJson = json({ limit: opts.maxBodyBytes });
  const restrictiveUrl = urlencoded({
    extended: true,
    limit: opts.maxBodyBytes,
  });
  const roomyJson = json({ limit: importBodyLimitBytes(opts.maxBodyBytes) });
  const roomyUrl = urlencoded({
    extended: true,
    limit: importBodyLimitBytes(opts.maxBodyBytes),
  });
  function sendBodyError(err: unknown, req: unknown, res: Parameters<RequestHandler>[1], next: Parameters<RequestHandler>[2]) {
    const anyErr = err as { status?: number; type?: string; message?: string };
    // Express body-parser uses 413 for entity.too.large; preserve it instead
    // of letting Nest's catch-all turn it into a 500.
    if (anyErr && (anyErr.status === 413 || anyErr.type === "entity.too.large")) {
      if (!res.headersSent) {
        res.status(413).json({ statusCode: 413, message: "Payload too large" });
        return;
      }
      return;
    }
    next(err as Error);
  }

  return (req, res, next) => {
    const path = (req as { path?: string }).path ?? req.url ?? "";
    // Express `req.path` strips query; fall back to url prefix match.
    const normalized = path.split("?")[0] ?? "";
    if (
      normalized.startsWith("/teach/modules/import/") ||
      normalized === "/teach/modules/import"
    ) {
      // Run JSON first, then urlencoded (only one will consume).
      roomyJson(req, res, (err?: unknown) => {
        if (err) {
          sendBodyError(err, req, res, next);
          return;
        }
        roomyUrl(req, res, (err2?: unknown) => {
          if (err2) {
            sendBodyError(err2, req, res, next);
            return;
          }
          next();
        });
      });
      return;
    }
    restrictiveJson(req, res, (err?: unknown) => {
      if (err) {
        sendBodyError(err, req, res, next);
        return;
      }
      restrictiveUrl(req, res, (err2?: unknown) => {
        if (err2) {
          sendBodyError(err2, req, res, next);
          return;
        }
        next();
      });
    });
  };
}
