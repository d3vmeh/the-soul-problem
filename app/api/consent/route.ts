import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { setExpertCookie } from '@/lib/session';

export async function POST(req: Request) {
  const form = await req.formData();
  const token = String(form.get('token') ?? '');
  if (!token) return NextResponse.json({ error: 'missing token' }, { status: 400 });
  const db = supabaseService();
  const { data: expert, error } = await db
    .from('experts').select('id').eq('invite_token', token).single();
  if (error || !expert) return NextResponse.json({ error: 'invalid token' }, { status: 404 });
  await db.from('experts').update({ consent_at: new Date().toISOString() }).eq('id', expert.id);
  await setExpertCookie(expert.id);
  return NextResponse.redirect(new URL('/onboarding', req.url), { status: 303 });
}
