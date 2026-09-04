import { PacksClient } from "@/components/packs/packs-client";

export default async function PacksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PacksClient matchId={id} />;
}
