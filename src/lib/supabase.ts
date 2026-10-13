import { createClient } from '@supabase/supabase-js';
import { ENV } from '../config/env';

// secret key(service_role) 사용 — RLS 전부 우회.
// 참여자/상태 검증은 BE가 기존 DB(Prisma)로 직접 하고, 통과한 값만 여기로 넣는다.
const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

export { supabase };
