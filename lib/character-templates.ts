import type { CharacterRole } from "@/types";

export type CharacterTemplate = {
  id: string;
  label: string;
  role: CharacterRole;
  name: string;
  appearance: string;
  personality: string;
  language_fingerprint: string;
  reference_image_url: string;
};

export const CHARACTER_TEMPLATES: CharacterTemplate[] = [
  {
    id: "domineering-ceo-male",
    label: "霸总男主",
    role: "protagonist_male",
    name: "霸总男主",
    appearance: "Tall, sharp jawline, tailored black suit, cold gaze.",
    personality: "Dominant, restrained, strategic.",
    language_fingerprint: "Short, commanding sentences with controlled tone.",
    reference_image_url: "https://images.unsplash.com/photo-1560250097-0b93528c311a",
  },
  {
    id: "werewolf-male-lead",
    label: "狼人男主",
    role: "protagonist_male",
    name: "狼人男主",
    appearance: "Athletic, silver-gray eyes, faint scar, dark long coat.",
    personality: "Protective, volatile under stress, loyal.",
    language_fingerprint: "Low, clipped speech with hidden tenderness.",
    reference_image_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
  },
  {
    id: "ancient-general",
    label: "古装将军",
    role: "supporting",
    name: "古装将军",
    appearance: "Ancient armor, red-black cloak, stern expression.",
    personality: "Disciplined, honorable, calm under pressure.",
    language_fingerprint: "Formal diction, concise military phrasing.",
    reference_image_url: "https://images.unsplash.com/photo-1544717302-de2939b7ef71",
  },
  {
    id: "sweet-female-lead",
    label: "甜美女主",
    role: "protagonist_female",
    name: "甜美女主",
    appearance: "Soft makeup, bright eyes, pastel outfit, warm smile.",
    personality: "Optimistic, brave, emotionally transparent.",
    language_fingerprint: "Gentle but energetic rhythm, empathetic wording.",
    reference_image_url: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f",
  },
  {
    id: "elegant-female-lead",
    label: "御姐女主",
    role: "protagonist_female",
    name: "御姐女主",
    appearance: "Elegant silhouette, sharp eyeliner, monochrome wardrobe.",
    personality: "Composed, perceptive, high self-control.",
    language_fingerprint: "Precise and low-tempo phrasing, confident pauses.",
    reference_image_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
  },
  {
    id: "ancient-fairy",
    label: "古装仙女",
    role: "supporting",
    name: "古装仙女",
    appearance: "Flowing hanfu, translucent sleeves, luminous hair ornaments.",
    personality: "Graceful, distant, compassionate.",
    language_fingerprint: "Poetic diction, slow cadence, symbolic metaphors.",
    reference_image_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9",
  },
];
