import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    // Fallback: If no authorization header is passed, we check if userId is in the body/query for backwards compatibility with the existing patterns (like queue/match API)
    try {
      const url = new URL(request.url);
      let userId = url.searchParams.get('userId');
      if (!userId && request.method !== 'GET') {
        const clonedReq = request.clone();
        const body = await clonedReq.json();
        userId = body.userId;
      }
      
      if (userId) {
        return { user: { id: userId } };
      }
    } catch (err) {
      // ignore JSON parse errors
    }
    
    return { user: null, error: new Error('Missing authorization header') };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) {
    return { user: null, error: error || new Error('Invalid token') };
  }
  
  return { user, error: null };
}
