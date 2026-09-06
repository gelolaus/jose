import { redirect } from "next/navigation";

type Props = { params: Promise<{ type: string }> };

/** Legacy `/practice/:type` redirects into the Try games lab. */
export default async function LegacyPracticeTypeRedirect({ params }: Props) {
  const { type } = await params;
  redirect(`/practice/lab/${type}`);
}
