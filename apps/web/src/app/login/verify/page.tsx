import type { Metadata } from "next";
import { MailboxVerifyPanel } from "@/components/mailbox-verify-panel";

export const metadata: Metadata = {
  title: "Verify mailbox",
};

export default function VerifyMailboxPage() {
  return <MailboxVerifyPanel />;
}
