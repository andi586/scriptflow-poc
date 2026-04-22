// Execution Authority Layer
// Converts Director suggestions into LOCKED execution commands

export const ARCHETYPE_EXECUTION_LOCK: Record<string, {
  bgmUrl: string
  bgmStyle: string
  klingStyle: string
  ffmpegVolume: number
}> = {
  pet_daily: {
    bgmUrl: "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Ukulele_Cat_Pants-ac740d3e-475d-46ff-aa30-b7d02ffdaa7f.mp3",
    bgmStyle: "playful ukulele",
    klingStyle: "bright natural light, fast cuts, playful",
    ffmpegVolume: 0.12
  },
  late_regret: {
    bgmUrl: "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/Broken_Metronome_new_A.mp3",
    bgmStyle: "sad piano",
    klingStyle: "cold blue light, slow push-in, melancholic",
    ffmpegVolume: 0.08
  },
  heartbreak: {
    bgmUrl: "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/Broken_Metronome_new_A.mp3",
    bgmStyle: "sad piano",
    klingStyle: "cold light, static, grief",
    ffmpegVolume: 0.08
  },
  lonely_reflection: {
    bgmUrl: "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Snowdrift_Loop-33fedaab-51b4-44d6-9fd3-b05079c609dc.mp3",
    bgmStyle: "lonely ambient",
    klingStyle: "desaturated, wide shots, empty space",
    ffmpegVolume: 0.06
  },
  unspoken_love: {
    bgmUrl: "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Fallen_Piano_Wax_A.mp3",
    bgmStyle: "romantic piano",
    klingStyle: "warm soft light, gentle close-up",
    ffmpegVolume: 0.10
  },
  hero_moment: {
    bgmUrl: "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Triumphant_No-Vocal-0249cc79-3054-483b-8a4f-8c211e555672.mp3",
    bgmStyle: "epic orchestral",
    klingStyle: "high contrast dramatic, slow motion",
    ffmpegVolume: 0.18
  },
  martial_arts: {
    bgmUrl: "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Triumphant_No-Vocal-0249cc79-3054-483b-8a4f-8c211e555672.mp3",
    bgmStyle: "rhythmic intense",
    klingStyle: "high contrast, fast cuts, dynamic",
    ffmpegVolume: 0.18
  },
  chase_escape: {
    bgmUrl: "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Trainyard_Countdown-09711e21-388c-4700-b84b-1f2db4ee0aa2.mp3",
    bgmStyle: "fast tension",
    klingStyle: "handheld, very fast, urgent",
    ffmpegVolume: 0.20
  },
  spring_festival: {
    bgmUrl: "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-鸭炉回响-a8dab44d-4f85-4524-8a21-194aaefc19c2.mp3",
    bgmStyle: "festive chinese",
    klingStyle: "warm festive, red elements",
    ffmpegVolume: 0.15
  },
  nostalgia: {
    bgmUrl: "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Sunken_Coral_Compass-8db70fdf-21b6-4142-9926-28e69bb532d5.mp3",
    bgmStyle: "nostalgic warm",
    klingStyle: "warm faded light, slow pan",
    ffmpegVolume: 0.10
  },
  prank_friend: {
    bgmUrl: "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Squeaky_Trombones_A.mp3",
    bgmStyle: "comedy silly",
    klingStyle: "bright, fast cuts, chaotic",
    ffmpegVolume: 0.15
  },
  wedding_memory: {
    bgmUrl: "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Fallen_Piano_Wax_A.mp3",
    bgmStyle: "romantic wedding",
    klingStyle: "warm soft romantic light",
    ffmpegVolume: 0.12
  },
  hope: {
    bgmUrl: "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Yellow_Piano_Steps-041a0105-3382-47b3-8fce-bab1e47d0c37.mp3",
    bgmStyle: "hopeful uplifting",
    klingStyle: "bright warm light, tilt up",
    ffmpegVolume: 0.14
  },
  bittersweet: {
    bgmUrl: "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Soft_Piano_Hush-3c6453eb-c53e-4b91-99f1-e8ac06cbec25.mp3",
    bgmStyle: "bittersweet gentle",
    klingStyle: "mixed warm cool light, linger",
    ffmpegVolume: 0.10
  },
  betrayal: {
    bgmUrl: "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Stringed_Oath_A.mp3",
    bgmStyle: "cold dramatic",
    klingStyle: "cold split light, sharp cuts",
    ffmpegVolume: 0.12
  },
  comfort: {
    bgmUrl: "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Soft_Piano_Hush-52bb0a31-bdff-4f15-b6b6-c193a05b7596.mp3",
    bgmStyle: "soothing comfort",
    klingStyle: "soft warm light, gentle close",
    ffmpegVolume: 0.10
  },
  graduation_memory: {
    bgmUrl: "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Triumphant_No-Vocal-e7389e64-1ccb-4a10-a8e1-b984437bb19f.mp3",
    bgmStyle: "inspiring graduation",
    klingStyle: "natural light, wide shots",
    ffmpegVolume: 0.14
  },
  baby_growth: {
    bgmUrl: "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Music_Box_Lullaby-93a39829-0964-440b-a11c-574383a53224.mp3",
    bgmStyle: "baby lullaby",
    klingStyle: "soft warm, low angle, gentle",
    ffmpegVolume: 0.08
  },
  fitness_journey: {
    bgmUrl: "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Neon_Sweat_Pump-44af055b-838a-4bbd-b2fe-198014def499.mp3",
    bgmStyle: "workout energetic",
    klingStyle: "hard contrast, fast rhythmic",
    ffmpegVolume: 0.18
  },
  comeback_story: {
    bgmUrl: "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Triumphant_No-Vocal-0249cc79-3054-483b-8a4f-8c211e555672.mp3",
    bgmStyle: "epic rise",
    klingStyle: "dark to light, build then explode",
    ffmpegVolume: 0.18
  },
}

// Default fallback
export const DEFAULT_BGM_URL = "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Ukulele_Cat_Pants-ac740d3e-475d-46ff-aa30-b7d02ffdaa7f.mp3"

export function getLockedBGM(archetype: string): string {
  return ARCHETYPE_EXECUTION_LOCK[archetype]?.bgmUrl || DEFAULT_BGM_URL
}

export function getLockedKlingStyle(archetype: string): string {
  return ARCHETYPE_EXECUTION_LOCK[archetype]?.klingStyle || "cinematic 9:16"
}

export function getLockedFFmpegVolume(archetype: string): number {
  return ARCHETYPE_EXECUTION_LOCK[archetype]?.ffmpegVolume || 0.12
}
