import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { getExpert } from '@/lib/session';

export async function POST(req: Request) {
  const expert = await getExpert();
  if (!expert) return NextResponse.redirect(new URL('/', req.url), { status: 303 });
  const form = await req.formData();
  const name = String(form.get('name') ?? '').trim();
  const background = String(form.get('background') ?? '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const db = supabaseService();
  await db.from('experts').update({ name, background }).eq('id', expert.id);
  return NextResponse.redirect(new URL('/screener', req.url), { status: 303 });
}
