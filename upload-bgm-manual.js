const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration
const SUPABASE_URL = 'https://ktrtheitjtwpdvdvnlzj.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0cnRoZWl0anR3cGR2ZHZubHpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg2OTQ1MSwiZXhwIjoyMDg5NDQ1NDUxfQ.I47eh0egTr929oE2aElyCSdOZKfeylS0TTYApemvrLs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Map templates to existing BGM or reuse similar ones
const templateBGMMapping = {
  'phone_3am': 'My_Workspace-Trainyard_Countdown-09711e21-388c-4700-b84b-1f2db4ee0aa2.mp3', // Tense/dramatic
  'future_warning': 'future_warning_1777949611664.mp3', // Already uploaded - sci-fi dark
  'friend_betrayal': 'friend_betrayal_1777949613234.mp3', // Already uploaded - dramatic
  'what_could_have_been': 'Broken_Metronome_new_A.mp3', // Sad/nostalgic
  'group_chat': 'My_Workspace-Snowdrift_Loop-33fedaab-51b4-44d6-9fd3-b05079c609dc.mp3', // Cold/ambient
  'dog_last_words': 'My_Workspace-Fallen_Piano_Wax_A.mp3', // Emotional piano
  'breaking_news': 'My_Workspace-Trainyard_Countdown-09711e21-388c-4700-b84b-1f2db4ee0aa2.mp3' // Dramatic/urgent
};

async function main() {
  console.log('🎵 Creating BGM mapping for templates...\n');
  
  const results = {};
  
  for (const [template, filename] of Object.entries(templateBGMMapping)) {
    const publicUrl = `https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/${filename}`;
    results[template] = publicUrl;
    console.log(`✅ ${template}: ${filename}`);
  }
  
  console.log('\n\n📋 Final BGM URLs:');
  console.log(JSON.stringify(results, null, 2));
  
  // Save results to file
  fs.writeFileSync(
    path.join(__dirname, 'bgm-results.json'),
    JSON.stringify(results, null, 2)
  );
  console.log('\n💾 Results saved to bgm-results.json');
  
  return results;
}

main().catch(console.error);
