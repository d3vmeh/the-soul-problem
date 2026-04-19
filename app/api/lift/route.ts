import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseService } from '@/lib/supabase';
import { computeLift } from '@/lib/lift';

export const maxDuration = 60;

const Payload = z.object({
  response_id: z.number().int(),
});

export async function POST(req: Request) {
  const body = Payload.parse(await req.json());
  const db = supabaseService();

  const { data: response } = await db
    .from('responses')
    .select('id, scenario_id')
    .eq('id', body.response_id)
    .single();
  if (!response) {
    return NextResponse.json({ error: 'response not found' }, { status: 404 });
  }

  try {
    const result = await computeLift(response.scenario_id, response.id);
    if (!result) return NextResponse.json({ error: 'scenario missing' }, { status: 500 });
    return NextResponse.json(result);
  } catch (e) {
    console.error('lift failed:', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
