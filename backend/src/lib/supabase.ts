import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️  Supabase credentials not configured. User settings will not be loaded.');
  console.warn('   SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.warn('   SUPABASE_SERVICE_KEY:', supabaseServiceKey ? 'SET' : 'MISSING');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
