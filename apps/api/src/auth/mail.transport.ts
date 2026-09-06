export type OutboundMail = {
  to: string;
  subject: string;
  text: string;
  /** Dev/test only — never log in production transports. */
  debugCode?: string;
};

export interface MailTransport {
  send(mail: OutboundMail): Promise<void>;
}

/** In-memory transport for tests and mock mode. Does not deliver mail. */
export class MemoryMailTransport implements MailTransport {
  readonly sent: OutboundMail[] = [];

  async send(mail: OutboundMail): Promise<void> {
    this.sent.push(mail);
  }

  lastCodeFor(email: string): string | undefined {
    for (let i = this.sent.length - 1; i >= 0; i -= 1) {
      const item = this.sent[i];
      if (item.to.toLowerCase() === email.toLowerCase() && item.debugCode) {
        return item.debugCode;
      }
    }
    return undefined;
  }

  clear() {
    this.sent.length = 0;
  }
}

/** Placeholder production transport until SMTP/Graph is wired. */
export class UnconfiguredMailTransport implements MailTransport {
  async send(): Promise<void> {
    throw new Error(
      "Mail delivery is not configured. Set JOSE_AUTH_MODE=mock for local verification, or configure a mail transport.",
    );
  }
}
