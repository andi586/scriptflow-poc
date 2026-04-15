import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const sql = `
ALTER TABLE movie_shots ADD COLUMN IF NOT EXISTS narrative JSONB;
ALTER TABLE movie_shots ADD COLUMN IF NOT EXISTS shot_type TEXT DEFAULT 'face';
`

const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
  method: 'GET',
  headers: {
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  }
})
console.log('Supabase reachable:', res.status)

// Use the pg endpoint via supabase management API or direct SQL
// Try inserting a dummy row to check columns exist first
const { data: cols, error: colErr } = await supabase
  .from('movie_shots')
  .select('narrative, shot_type')
  .limit(1)

if (!colErr) {
  console.log('Columns already exist!')
  process.exit(0)
}

console.log('Columns missing, need to add via Supabase dashboard SQL editor:')
console.log(sql)
console.log('\nError was:', colErr?.message)
