import { redirect } from "next/navigation";

/** Scorers folded into League aggregates — keep route for old links. */
export default async function ScorersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/match-day/${id}/league`);
}
