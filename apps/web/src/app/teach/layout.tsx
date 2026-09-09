import { TeachShell } from "@/components/teach-shell";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Teacher area",
};

export default function TeachLayout({ children }: { children: ReactNode }) {
  return <TeachShell>{children}</TeachShell>;
}
