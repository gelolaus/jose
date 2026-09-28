import { redirect } from "next/navigation";

/** Anonymous visitors belong on the landing page, where school sign-in lives. */
export function redirectToLanding(): never {
  redirect("/");
}
