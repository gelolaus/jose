import { APC_ADMISSION_DOMAINS } from "@jose/shared";

export type MailboxParseResult =
  | { ok: true; local: string; domain: string; normalized: string }
  | { ok: false; reason: "malformed" };

/**
 * Parse a single mailbox and normalize the domain to lowercase.
 * Rejects multiple addresses, display-name forms, and empty local parts.
 */
export function parseMailbox(raw: string | null | undefined): MailboxParseResult {
  if (raw == null) return { ok: false, reason: "malformed" };
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed) || trimmed.includes("<") || trimmed.includes(">")) {
    return { ok: false, reason: "malformed" };
  }
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at !== trimmed.indexOf("@")) {
    return { ok: false, reason: "malformed" };
  }
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase();
  if (!local || !domain || domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) {
    return { ok: false, reason: "malformed" };
  }
  // Basic DNS-label shape; rejects spaces and most junk.
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
    return { ok: false, reason: "malformed" };
  }
  return {
    ok: true,
    local,
    domain,
    normalized: `${local}@${domain}`,
  };
}

/** Exact domain equality against APC admission domains — never suffix/includes matching. */
export function isAllowedApcDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase();
  return (APC_ADMISSION_DOMAINS as readonly string[]).includes(normalized);
}

export type AdmissionEmailDecision =
  | { kind: "admit_candidate"; email: string; domain: string }
  | { kind: "reject_switch_account"; email: string; domain: string }
  | { kind: "reject_malformed"; raw: string }
  | { kind: "missing" };

/**
 * Treat a Microsoft email-like claim as a candidate admission address only.
 * Present non-APC domains are rejected; missing/ambiguous claims need recovery.
 */
export function evaluateMicrosoftEmailClaim(
  claim: string | null | undefined,
): AdmissionEmailDecision {
  if (claim == null || String(claim).trim() === "") {
    return { kind: "missing" };
  }
  const parsed = parseMailbox(claim);
  if (!parsed.ok) {
    return { kind: "reject_malformed", raw: String(claim) };
  }
  if (!isAllowedApcDomain(parsed.domain)) {
    return {
      kind: "reject_switch_account",
      email: parsed.normalized,
      domain: parsed.domain,
    };
  }
  return {
    kind: "admit_candidate",
    email: parsed.normalized,
    domain: parsed.domain,
  };
}

export function evaluateChosenMailbox(email: string): AdmissionEmailDecision {
  return evaluateMicrosoftEmailClaim(email);
}
