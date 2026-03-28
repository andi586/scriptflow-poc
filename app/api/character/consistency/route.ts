import { NextRequest, NextResponse } from "next/server";
import { getCharacterGenetics } from "@/lib/character-genetics/engine";
import {
  scoreConsistency,
  shouldRetry,
  type ConsistencyScore,
} from "@/lib/character-genetics/consistency-scorer";
import { compilePromptWithCharacter } from "@/lib/prompt-compiler/character-injection";

interface ConsistencyCheckRequest {
  characterId: string;
  generatedPrompt: string;
  generatedImageUrl?: string;
}

interface ConsistencyCheckResponse {
  score: ConsistencyScore;
  shouldRetry: boolean;
  compiledPrompt?: {
    original: string;
    compiled: string;
    injectedAnchors: string[];
    negativePrompt: string;
  };
}

/**
 * POST /api/character/consistency
 * 检查生成结果的角色一致性
 */
export async function POST(
  req: NextRequest,
): Promise<NextResponse<ConsistencyCheckResponse | { error: string }>> {
  try {
    const body = (await req.json()) as ConsistencyCheckRequest;

    if (!body.characterId || !body.generatedPrompt) {
      return NextResponse.json(
        { error: "Missing characterId or generatedPrompt" },
        { status: 400 },
      );
    }

    // 1. 获取角色genetics
    const genetics = await getCharacterGenetics(body.characterId);
    if (!genetics) {
      return NextResponse.json(
        { error: "Character genetics not found" },
        { status: 404 },
      );
    }

    // 2. 评分
    const score = scoreConsistency(
      genetics,
      body.generatedPrompt,
      body.generatedImageUrl,
    );

    // 3. 判断是否需要重试
    const needsRetry = shouldRetry(score);

    // 4. 如果需要重试，提供优化后的prompt
    let compiledPrompt;
    if (needsRetry) {
      compiledPrompt = compilePromptWithCharacter(
        body.generatedPrompt,
        genetics,
      );
    }

    return NextResponse.json({
      score,
      shouldRetry: needsRetry,
      compiledPrompt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/character/consistency?characterId=xxx
 * 获取角色的genetics配置（用于前端预览）
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const characterId = searchParams.get("characterId");

    if (!characterId) {
      return NextResponse.json(
        { error: "Missing characterId" },
        { status: 400 },
      );
    }

    const genetics = await getCharacterGenetics(characterId);
    if (!genetics) {
      return NextResponse.json(
        { error: "Character genetics not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ genetics });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
