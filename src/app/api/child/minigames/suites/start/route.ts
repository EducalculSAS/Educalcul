import { startDailyGameSession } from "@/lib/minigames/dailyGameSession";

export async function POST(req: Request) {
  return startDailyGameSession("suites", req);
}
