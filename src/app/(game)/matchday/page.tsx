import MatchdayClient from "./matchday-client";

interface MatchdayPageProps {
  searchParams: Promise<{
    matchId?: string | string[] | undefined;
  }>;
}

export default async function MatchdayPage({ searchParams }: MatchdayPageProps) {
  const resolvedSearchParams = await searchParams;
  const initialMatchId = (
    Array.isArray(resolvedSearchParams.matchId)
      ? resolvedSearchParams.matchId[0]
      : resolvedSearchParams.matchId
  )?.trim() ?? "";

  return <MatchdayClient initialMatchId={initialMatchId} />;
}
