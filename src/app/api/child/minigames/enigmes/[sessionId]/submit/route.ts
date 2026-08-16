import { submitDailyGameSession } from "@/lib/minigames/dailyGameSession";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  return submitDailyGameSession("enigmes", sessionId, request);
}
