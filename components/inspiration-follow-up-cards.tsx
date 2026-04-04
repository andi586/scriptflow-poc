"use client";

import { useCallback, useState, type ReactNode } from "react";
import {
  detectInspirationGaps,
  inspirationNeedsMoreLength,
  type InspirationFollowUpAnswers,
  type InspirationFollowUpDimension,
  type InspirationGaps,
} from "@/lib/inspiration-follow-up";

const DIMENSION_ORDER: InspirationFollowUpDimension[] = [
  "character",
  "conflict",
  "ending",
];

const GAP_KEY: Record<
  InspirationFollowUpDimension,
  keyof InspirationGaps
> = {
  character: "needsCharacter",
  conflict: "needsConflict",
  ending: "needsEnding",
};

const CARD_META: Record<
  InspirationFollowUpDimension,
  { title: string; subtitle: string; chips: string[] }
> = {
  character: {
    title: "Who is the main character?",
    subtitle: "",
    chips: [],
  },
  conflict: {
    title: "What's the central conflict?",
    subtitle: "",
    chips: [],
  },
  ending: {
    title: "How does it end?",
    subtitle: "",
    chips: [],
  },
};

type InspirationFollowUpCardsProps = {
  /** Raw textarea only — used to decide which dimensions still need a prompt. */
  storyIdeaRaw: string;
  answers: InspirationFollowUpAnswers;
  onSetAnswer: (
    dimension: InspirationFollowUpDimension,
    question: string,
    answer: string,
  ) => void;
};

export function InspirationFollowUpCards({
  storyIdeaRaw,
  answers,
  onSetAnswer,
}: InspirationFollowUpCardsProps) {
  // Component is disabled — return null to hide all follow-up cards and hints
  return null;
}
