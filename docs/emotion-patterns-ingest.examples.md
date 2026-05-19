# Emotion Patterns Ingest API

`POST /api/emotion-patterns/ingest`

Turns raw TikTok comments, hooks, golden lines, and meme replies into structured `emotion_patterns` rows via OpenRouter Claude.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role (insert + errors) |
| `EMOTION_PATTERN_INGEST_SECRET` | No | If set, require header `x-ingest-secret` |
| `EMOTION_PATTERN_INGEST_MODEL` | No | Default `anthropic/claude-sonnet-4-5` |

## Migrations (apply before use)

1. `supabase/migrations/20260519_create_emotion_patterns.sql`
2. `supabase/migrations/20260519_create_ingestion_errors.sql`

## Example request

```http
POST /api/emotion-patterns/ingest HTTP/1.1
Host: localhost:3000
Content-Type: application/json
x-ingest-secret: your-secret-if-configured

{
  "raw_text": "你吃鸡的时候有没有想过他们也有爸爸妈妈？\n我想过，但我一次吃不了那么多。"
}
```

```bash
curl -s -X POST http://localhost:3000/api/emotion-patterns/ingest \
  -H "Content-Type: application/json" \
  -d '{"raw_text":"你吃鸡的时候有没有想过他们也有爸爸妈妈？\n我想过，但我一次吃不了那么多。"}'
```

## Example success response (201)

```json
{
  "ok": true,
  "analysis": {
    "pattern_name": "Moral Reversal Dark Humor",
    "category": "dark_humor_reversal",
    "setup_structure": "道德施压，暗示对方应愧疚",
    "reversal_structure": "故意曲解关键词，荒诞降维",
    "emotion_trigger": "观众预期对方会进入道德反思",
    "retention_trigger": "认知预测崩塌，等待包袱落地",
    "viral_mechanism": [
      "expectation_collapse",
      "moral_reversal",
      "absurd_humor"
    ],
    "cognitive_pattern": "先建立严肃道德框架，再突然改变语义解释路径",
    "example_analysis": "通过故意误解“鸡”的含义，把道德审判反向劫持，形成黑色幽默。",
    "platform": "tiktok",
    "language": "zh",
    "universality_score": 9.2,
    "shareability_score": 8.8,
    "watchtime_score": 8.5,
    "tags": ["黑色幽默", "反预期", "道德绑架反杀"],
    "source_type": "tiktok_comment"
  },
  "pattern": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "pattern_name": "Moral Reversal Dark Humor",
    "category": "dark_humor_reversal",
    "setup_structure": "道德施压，暗示对方应愧疚",
    "reversal_structure": "故意曲解关键词，荒诞降维",
    "emotion_trigger": "观众预期对方会进入道德反思",
    "retention_trigger": "认知预测崩塌，等待包袱落地",
    "viral_mechanism": [
      "expectation_collapse",
      "moral_reversal",
      "absurd_humor"
    ],
    "cognitive_pattern": "先建立严肃道德框架，再突然改变语义解释路径",
    "example_text": "你吃鸡的时候有没有想过他们也有爸爸妈妈？\n我想过，但我一次吃不了那么多。",
    "example_analysis": "通过故意误解“鸡”的含义，把道德审判反向劫持，形成黑色幽默。",
    "platform": "tiktok",
    "language": "zh",
    "universality_score": 9.2,
    "shareability_score": 8.8,
    "watchtime_score": 8.5,
    "tags": ["黑色幽默", "反预期", "道德绑架反杀"],
    "source_type": "tiktok_comment",
    "created_at": "2026-05-19T12:00:00.000Z"
  }
}
```

## Example validation error (400)

```json
{
  "ok": false,
  "error": "raw_text is required",
  "stage": "validation",
  "ingestion_error_id": null
}
```

## Example AI validation failure (422)

```json
{
  "ok": false,
  "error": "AI output failed schema validation",
  "stage": "validation",
  "ingestion_error_id": "a1b2c3d4-e5f6-4789-a012-3456789abcde"
}
```

## Example database failure (500)

```json
{
  "ok": false,
  "error": "Database insert failed: relation \"emotion_patterns\" does not exist",
  "stage": "db_insert",
  "ingestion_error_id": "b2c3d4e5-f6a7-4890-b123-456789abcdef"
}
```

## Pipeline

```text
raw_text → Zod request
         → OpenRouter Claude (prompt.ts)
         → JSON parse → EmotionPatternAnalysisSchema (strict, no empty fields)
         → insert emotion_patterns (example_text = raw_text)
         → on any failure → ingestion_errors
```
