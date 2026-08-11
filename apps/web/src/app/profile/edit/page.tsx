import { AppShell } from "@/components/learning-shell";
import { ProfileEditForm } from "@/components/profile-edit-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit explorer",
};

export default function ProfileEditPage() {
  return (
    <AppShell>
      <ProfileEditForm />
    </AppShell>
  );
}
