import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/apiAuth';
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { fetchParentSubscriptionDetails } from '@/lib/parentSubscriptionDetails';

export async function GET(req: Request) {
  try {
    // Identity comes from the verified JWT, never from a client-supplied param.
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await fetchParentSubscriptionDetails(me.authId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: sanitizeErrorMessage(errMessage(error) || String(error)) },
      { status: 500 }
    );
  }
}
