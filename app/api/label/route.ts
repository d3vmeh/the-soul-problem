import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getExpert } from '@/lib/session';
import { supabaseService } from '@/lib/supabase';

const Payload = z.object({
  response_id: z.number().int(),
  accountability: z.number().int().min(1).max(5),
  specificity: z.number().int().min(1).max(5),
  warmth: z.number().int().min(1).max(5),
  reasoning: z.string().optional().default(''),
});

export async function POST(req: Request) {
  const expert = await getExpert();
  if (!expert) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = Payload.parse(await req.json());
  const db = supabaseService();
  const { error } = await db.from('labels').upsert(
    { expert_id: expert.id, ...body },
    { onConflict: 'expert_id,response_id' }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
