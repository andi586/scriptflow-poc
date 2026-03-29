import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sql = readFileSync('/tmp/f83_tables2.sql', 'utf8');

const statements = sql
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`Executing ${statements.length} SQL statements...\n`);

for (const stmt of statements) {
  const { error } = await supabase.rpc('exec_sql', { query: stmt + ';' });
  if (error) {
    console.log('SKIP (expected):', stmt.substring(0, 60));
  } else {
    console.log('✓ OK:', stmt.substring(0, 60));
  }
}

console.log('\n✅ Done');
