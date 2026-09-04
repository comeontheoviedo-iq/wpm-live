import { redirect } from "next/navigation";

export default async function SpeaksRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/match-day/${id}/scripts`);
}
