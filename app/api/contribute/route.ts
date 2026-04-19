import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseService } from '@/lib/supabase';

const Payload = z.object({ response_id: z.number().int() });

export async function POST(req: Request) {
  const body = Payload.parse(await req.json());
  const db = supabaseService();

  // Only private human submissions can be flipped to public.
  // This prevents someone from pointing at an LLM response_id and rewriting its model field.
  const { data, error } = await db
    .from('responses')
    .update({ model: 'human:public' })
    .eq('id', body.response_id)
    .eq('model', 'human:private')
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not a private submission' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
