const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = 'https://ktrtheitjtwpdvdvnlzj.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0cnRoZWl0anR3cGR2ZHZubHpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg2OTQ1MSwiZXhwIjoyMDg5NDQ1NDUxfQ.I47eh0egTr929oE2aElyCSdOZKfeylS0TTYApemvrLs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Free music URLs from various sources (royalty-free)
// Using direct download links from free music archives
const tracks = [
  { 
    name: 'phone_3am',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_4037f4e1e5.mp3?filename=cinematic-time-lapse-115672.mp3',
    description: 'Cinematic tension track'
  },
  { 
    name: 'future_warning',
    url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=deep-future-garage-royalty-free-music-163081.mp3',
    description: 'Sci-fi dark atmosphere'
  },
  { 
    name: 'friend_betrayal',
    url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_12b0c7443c.mp3?filename=sad-drama-110923.mp3',
    description: 'Dramatic betrayal theme'
  },
  { 
    name: 'what_could_have_been',
    url: 'https://cdn.pixabay.com/download/audio/2022/08/02/audio_4e5a0e1c8e.mp3?filename=sad-piano-solo-116594.mp3',
    description: 'Nostalgic piano melody'
  },
  { 
    name: 'group_chat',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8a5d2e8e5.mp3?filename=cold-cinematic-percussion-115775.mp3',
    description: 'Cold digital atmosphere'
  },
  { 
    name: 'dog_last_words',
    url: 'https://cdn.pixabay.com/download/audio/2022/10/27/audio_9b5156c3e0.mp3?filename=emotional-piano-sad-background-music-for-videos-149386.mp3',
    description: 'Emotional sad piano'
  },
  { 
    name: 'breaking_news',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/24/audio_c8c5d5e0e3.mp3?filename=news-intro-116610.mp3',
    description: 'News broadcast dramatic'
  }
];

// Helper function to download file
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);
    
    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close();
        fs.unlinkSync(filepath);
        return downloadFile(response.headers.location, filepath).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(filepath);
        return reject(new Error(`Failed to download: ${response.statusCode}`));
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    });
    
    request.on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
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
      console.log(`\n📥 Downloading: ${track.description}`);
      console.log(`   Template: ${track.name}`);
      
      const fileName = `${track.name}_${Date.now()}.mp3`;
      const filePath = path.join(tempDir, fileName);
      
      // Download the file
      await downloadFile(track.url, filePath);
      console.log(`✅ Downloaded to: ${filePath}`);
      
      // Check file size
      const stats = fs.statSync(filePath);
      console.log(`   File size: ${(stats.size / 1024).toFixed(2)} KB`);
      
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
      results[track.name] = publicUrl;
      
      // Clean up temp file
      fs.unlinkSync(filePath);
      
    } catch (error) {
      console.error(`❌ Error processing "${track.name}":`, error.message);
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
