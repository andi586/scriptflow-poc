/**
 * 免版权背景音乐库
 * 情绪标签来自 NEL 分析的 beat.emotion 字段
 * URL 使用 pixabay 免版权音乐直链（无需 API key）
 */

export type EmotionTag = "tension" | "romance" | "action" | "calm";

export interface BGMTrack {
  id: string;
  name: string;
  emotion: EmotionTag;
  tags: string[];
  url: string;
  bpm: number;
}

export const BGM_LIBRARY: BGMTrack[] = [
  {
    id: "bgm_001",
    name: "Dark Tension",
    emotion: "tension",
    tags: ["suspense", "thriller", "dark", "fear", "dread"],
    url: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_7b39e8e78a.mp3",
    bpm: 75,
  },
  {
    id: "bgm_002",
    name: "Rising Danger",
    emotion: "tension",
    tags: ["angry", "conflict", "intense", "confrontation"],
    url: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d1718ab41b.mp3",
    bpm: 90,
  },
  {
    id: "bgm_003",
    name: "Tender Moment",
    emotion: "romance",
    tags: ["love", "tender", "soft", "longing", "warm"],
    url: "https://cdn.pixabay.com/download/audio/2021/11/25/audio_5e46eb6e2b.mp3",
    bpm: 72,
  },
  {
    id: "bgm_004",
    name: "Heartbeat",
    emotion: "romance",
    tags: ["emotional", "passionate", "yearning"],
    url: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3",
    bpm: 85,
  },
  {
    id: "bgm_005",
    name: "Urban Chase",
    emotion: "action",
    tags: ["fast", "aggressive", "chase", "power", "urgent"],
    url: "https://cdn.pixabay.com/download/audio/2022/10/25/audio_946b1ec4d0.mp3",
    bpm: 140,
  },
  {
    id: "bgm_006",
    name: "Battle Ready",
    emotion: "action",
    tags: ["fight", "epic", "heroic", "victory"],
    url: "https://cdn.pixabay.com/download/audio/2022/08/02/audio_884fe92c21.mp3",
    bpm: 128,
  },
  {
    id: "bgm_007",
    name: "Morning Mist",
    emotion: "calm",
    tags: ["peaceful", "ambient", "reflective", "quiet"],
    url: "https://cdn.pixabay.com/download/audio/2022/01/27/audio_d0c6ff1fda.mp3",
    bpm: 60,
  },
  {
    id: "bgm_008",
    name: "New Beginning",
    emotion: "calm",
    tags: ["hopeful", "resolution", "gentle", "ending"],
    url: "https://cdn.pixabay.com/download/audio/2021/08/09/audio_dc39bde7c1.mp3",
    bpm: 65,
  },
];

/**
 * NEL 原始情绪标签 → 标准分类映射
 */
const EMOTION_MAP: Record<string, EmotionTag> = {
  suspenseful: "tension",
  tense: "tension",
  fearful: "tension",
  angry: "tension",
  dangerous: "tension",
  confrontational: "tension",
  loving: "romance",
  romantic: "romance",
  tender: "romance",
  longing: "romance",
  passionate: "romance",
  emotional: "romance",
  excited: "action",
  urgent: "action",
  powerful: "action",
  intense: "action",
  determined: "action",
  peaceful: "calm",
  reflective: "calm",
  hopeful: "calm",
  resolved: "calm",
  quiet: "calm",
};

/**
 * 根据 beat.emotion 匹配背景音乐
 */
export function matchBGM(emotion: string): BGMTrack {
  const normalized = emotion.toLowerCase().trim();

  // 1. 精确标签匹配
  const exactMatch = BGM_LIBRARY.find((track) =>
    track.tags.includes(normalized),
  );
  if (exactMatch) return exactMatch;

  // 2. 情绪分类匹配
  const targetEmotion = EMOTION_MAP[normalized] ?? "calm";
  const categoryMatch = BGM_LIBRARY.find(
    (track) => track.emotion === targetEmotion,
  );
  if (categoryMatch) return categoryMatch;

  // 3. 最终兜底
  return BGM_LIBRARY[BGM_LIBRARY.length - 1];
}

