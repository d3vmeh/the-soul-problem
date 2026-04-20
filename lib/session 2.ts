import { cookies } from 'next/headers';
import { supabaseService } from './supabase';
import type { Expert } from './types';

const COOKIE = 'expert_id';

export async function setExpertCookie(id: string) {
  const c = await cookies();
  c.set(COOKIE, id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
}

export async function getExpert(): Promise<Expert | null> {
  const c = await cookies();
  const id = c.get(COOKIE)?.value;
  if (!id) return null;
  const db = supabaseService();
  const { data } = await db.from('experts').select('*').eq('id', id).single();
  return (data as Expert) ?? null;
}
