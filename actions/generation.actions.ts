"use server";

import type { Beat, CostEstimate, Project } from "@/types";

const CREDITS_PER_SECOND = 0.14;
const USD_PER_CREDIT = 0.0014;

export async function estimateAllCosts(input: {
  project: Project;
  beats: Beat[];
}): Promise<CostEstimate> {
  const { project, beats } = input;
  const duration = project.video_duration_sec;

  let totalCredits = 0;
  const breakdownLines: string[] = [];

  for (const beat of beats) {
    const credits = duration * CREDITS_PER_SECOND;
    totalCredits += credits;
    breakdownLines.push(
      `Beat ${beat.beat_number}: ${duration}s × ${CREDITS_PER_SECOND} = ${credits.toFixed(3)} credits`,
    );
  }

  const totalUSD = Number((totalCredits * USD_PER_CREDIT).toFixed(4));

  return {
    credits: totalCredits,
    usd: totalUSD,
    breakdown: breakdownLines.join("\n"),
  };
}

