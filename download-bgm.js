const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const PIXABAY_API_KEY = '55248288-f482df54dfeac12f1a7086ea5';
const SUPABASE_URL = 'https://ktrtheitjtwpdvdvnlzj.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0cnRoZWl0anR3cGR2ZHZubHpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg2OTQ1MSwiZXhwIjoyMDg5NDQ1NDUxfQ.I47eh0egTr929oE2aElyCSdOZKfeylS0TTYApemvrLs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Track definitions with template mappings
const tracks = [
  { query: 'cinematic tension', template: 'phone_3am' },
  { query: 'sci-fi dark', template: 'future_warning' },
  { query: 'dramatic betrayal', template: 'friend_betrayal' },
  { query: 'nostalgic piano', template: 'what_could_have_been' },
  { query: 'cold digital', template: 'group_chat' },
  { query: 'emotional sad piano', template: 'dog_last_words' },
  { query: 'news broadcast dramatic', template: 'breaking_news' }
];

// Helper function to download file
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);
    
    protocol.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        file.close();
        fs.unlinkSync(filepath);
        return downloadFile(response.headers.location, filepath).then(resolve).catch(reject);
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

// Helper function to search Pixabay Audio API
function searchPixabay(query) {
  return new Promise((resolve, reject) => {
    // Use the audio-specific endpoint
    const url = `https://pixabay.com/api/music/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&per_page=3`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Main function
async function main() {
  console.log('🎵 Starting BGM download and upload process...\n');
  
  const results = {};
  const tempDir = path.join(__dirname, 'temp_bgm');
  
  // Create temp directory
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
  
  for (const track of tracks) {
    try {
      console.log(`\n📡 Searching Pixabay for: "${track.query}"`);
      
      // Search Pixabay
      const searchResults = await searchPixabay(track.query);
      
      if (!searchResults.hits || searchResults.hits.length === 0) {
        console.log(`❌ No results found for "${track.query}"`);
        continue;
      }
      
      // Get the first result
      const audio = searchResults.hits[0];
      const audioUrl = audio.previewURL || audio.url; // Use preview URL for download
      const fileName = `${track.template}_${Date.now()}.mp3`;
      const filePath = path.join(tempDir, fileName);
      
      console.log(`📥 Downloading: ${audio.tags || 'Unknown'} (${audio.duration || 0}s)`);
      console.log(`   URL: ${audioUrl}`);
      console.log(`   Artist: ${audio.artist || 'Unknown'}`);
      
      // Download the file
      await downloadFile(audioUrl, filePath);
      console.log(`✅ Downloaded to: ${filePath}`);
      
      // Read file for upload
      const fileBuffer = fs.readFileSync(filePath);
      
      // Upload to Supabase
      console.log(`☁️  Uploading to Supabase storage...`);
      const { data, error } = await supabase.storage
        .from('music')
        .upload(fileName, fileBuffer, {
          contentType: 'audio/mpeg',
          upsert: true
        });
      
      if (error) {
        console.error(`❌ Upload error:`, error);
        continue;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('music')
        .getPublicUrl(fileName);
      
      const publicUrl = urlData.publicUrl;
      console.log(`✅ Uploaded! Public URL: ${publicUrl}`);
      
      // Store result
      results[track.template] = publicUrl;
      
      // Clean up temp file
      fs.unlinkSync(filePath);
      
    } catch (error) {
      console.error(`❌ Error processing "${track.query}":`, error.message);
    }
  }
  
  // Clean up temp directory
  try {
    fs.rmdirSync(tempDir);
  } catch (e) {
    // Ignore
  }
  
  console.log('\n\n🎉 Download and upload complete!\n');
  console.log('📋 Results:');
  console.log(JSON.stringify(results, null, 2));
  
  // Save results to file
  fs.writeFileSync(
    path.join(__dirname, 'bgm-results.json'),
    JSON.stringify(results, null, 2)
  );
  console.log('\n💾 Results saved to bgm-results.json');
  
  return results;
}

// Run the script
main().catch(console.error);
