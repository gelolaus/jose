import { redirect } from "next/navigation";

/** Legacy mailbox-verification URLs now return users to Microsoft sign-in. */
export default function LegacyMailboxVerificationPage() {
  redirect("/login");
}
