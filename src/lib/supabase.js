import { createBrowserClient } from '@supabase/ssr'

// We are now using your specific key name
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "CRITICAL ERROR: Environment variables not found. " +
    "Check that your .env.local file has NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY"
  );
}

export const supabase = createBrowserClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);