import { normalizeAuthReturnLocation } from "@/lib/auth-return";
import { resolveWebApiOrigin } from "@/lib/root-env";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Proxy the Microsoft callback on this origin so the session cookie is
 * first-party. A rewrite can drop Set-Cookie on the 302, which is why a
 * finished login came back as `/?signedIn=1` with no session.
 */
export async function GET(request: NextRequest) {
  const target = new URL("/auth/microsoft/callback", resolveWebApiOrigin());
  target.search = request.nextUrl.search;

  const upstream = await fetch(target, {
    redirect: "manual",
    cache: "no-store",
    headers: {
      accept: request.headers.get("accept") ?? "*/*",
      cookie: request.headers.get("cookie") ?? "",
    },
  });

  const headers = new Headers();
  headers.set("cache-control", "private, no-store");
  const location = upstream.headers.get("location");
  if (location) {
    headers.set("location", normalizeAuthReturnLocation(location, request.nextUrl.origin));
  }

  const redirecting = upstream.status >= 300 && upstream.status < 400;
  const response = new NextResponse(redirecting ? null : upstream.body, {
    status: upstream.status,
    headers,
  });
  const setCookies =
    typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
  for (const cookie of setCookies) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}
