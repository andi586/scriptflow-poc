import { createHash, randomUUID } from 'node:crypto'

export const WATERMARK_PLATFORM = 'scriptflow' as const
export const WATERMARK_VERSION = 1 as const

export type UUIDString = string

export interface WatermarkSourceInput {
  creator_id: UUIDString
  project_id: UUIDString
  episode_id: UUIDString
  generated_at?: string
}

export interface ContentWatermarkPayload {
  v: typeof WATERMARK_VERSION
  platform: typeof WATERMARK_PLATFORM
  creator_id: UUIDString
  project_id: UUIDString
  episode_id: UUIDString
  generated_at: string
  nonce: string
  fingerprint: string
}

export interface ContentWatermarkEnvelope {
  payload: ContentWatermarkPayload
  checksum: string
}

export interface VerifiedWatermarkResult {
  valid: true
  raw: string
  payload: ContentWatermarkPayload
}

export interface InvalidWatermarkResult {
  valid: false
  raw: string
  reason: 'EMPTY_WATERMARK' | 'INVALID_BASE64' | 'INVALID_JSON' | 'INVALID_SHAPE' | 'INVALID_PLATFORM' | 'INVALID_VERSION' | 'CHECKSUM_MISMATCH'
}

export type WatermarkVerificationResult = VerifiedWatermarkResult | InvalidWatermarkResult

export interface DecodedWatermarkInfo {
  creator_id: string
  project_id: string
  episode_id: string
  generated_at: string
  platform: typeof WATERMARK_PLATFORM
  nonce: string
  fingerprint: string
  version: typeof WATERMARK_VERSION
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isIsoDateString(value: string): boolean {
  return !Number.isNaN(Date.parse(value))
}

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function stableSerializePayload(payload: ContentWatermarkPayload): string {
  return JSON.stringify({
    v: payload.v, platform: payload.platform,
    creator_id: payload.creator_id, project_id: payload.project_id,
    episode_id: payload.episode_id, generated_at: payload.generated_at,
    nonce: payload.nonce, fingerprint: payload.fingerprint,
  })
}

function buildFingerprint(params: { creator_id: string; project_id: string; episode_id: string; generated_at: string; nonce: string }): string {
  return sha256([WATERMARK_PLATFORM, params.creator_id, params.project_id, params.episode_id, params.generated_at, params.nonce].join('|'))
}

function buildChecksum(payload: ContentWatermarkPayload): string {
  return sha256(stableSerializePayload(payload))
}

function isValidPayloadShape(value: unknown): value is ContentWatermarkPayload {
  if (!value || typeof value !== 'object') return false
  const c = value as Partial<ContentWatermarkPayload>
  return c.v === WATERMARK_VERSION && c.platform === WATERMARK_PLATFORM &&
    isNonEmptyString(c.creator_id) && isNonEmptyString(c.project_id) &&
    isNonEmptyString(c.episode_id) && isNonEmptyString(c.generated_at) &&
    isIsoDateString(c.generated_at!) && isNonEmptyString(c.nonce) && isNonEmptyString(c.fingerprint)
}

export function generateContentWatermark(input: WatermarkSourceInput): string {
  if (!isNonEmptyString(input.creator_id)) throw new Error('creator_id is required')
  if (!isNonEmptyString(input.project_id)) throw new Error('project_id is required')
  if (!isNonEmptyString(input.episode_id)) throw new Error('episode_id is required')
  const generatedAt = input.generated_at ?? new Date().toISOString()
  if (!isIsoDateString(generatedAt)) throw new Error('generated_at must be a valid ISO date string')
  const nonce = randomUUID()
  const payload: ContentWatermarkPayload = {
    v: WATERMARK_VERSION, platform: WATERMARK_PLATFORM,
    creator_id: input.creator_id, project_id: input.project_id,
    episode_id: input.episode_id, generated_at: generatedAt, nonce,
    fingerprint: buildFingerprint({ creator_id: input.creator_id, project_id: input.project_id, episode_id: input.episode_id, generated_at: generatedAt, nonce }),
  }
  const envelope: ContentWatermarkEnvelope = { payload, checksum: buildChecksum(payload) }
  return toBase64Url(JSON.stringify(envelope))
}

export function verifyContentWatermark(watermark: string): WatermarkVerificationResult {
  if (!isNonEmptyString(watermark)) return { valid: false, raw: watermark, reason: 'EMPTY_WATERMARK' }
  let decoded: string
  try { decoded = fromBase64Url(watermark) } catch { return { valid: false, raw: watermark, reason: 'INVALID_BASE64' } }
  let parsed: unknown
  try { parsed = JSON.parse(decoded) } catch { return { valid: false, raw: watermark, reason: 'INVALID_JSON' } }
  if (!parsed || typeof parsed !== 'object') return { valid: false, raw: watermark, reason: 'INVALID_SHAPE' }
  const envelope = parsed as Partial<ContentWatermarkEnvelope>
  if (!envelope.payload || !isValidPayloadShape(envelope.payload)) return { valid: false, raw: watermark, reason: 'INVALID_SHAPE' }
  const payload = envelope.payload
  if (payload.platform !== WATERMARK_PLATFORM) return { valid: false, raw: watermark, reason: 'INVALID_PLATFORM' }
  if (payload.v !== WATERMARK_VERSION) return { valid: false, raw: watermark, reason: 'INVALID_VERSION' }
  if (!isNonEmptyString(envelope.checksum) || envelope.checksum !== buildChecksum(payload)) return { valid: false, raw: watermark, reason: 'CHECKSUM_MISMATCH' }
  return { valid: true, raw: watermark, payload }
}

export function decodeContentWatermark(watermark: string): DecodedWatermarkInfo {
  const result = verifyContentWatermark(watermark)
  if (!result.valid) throw new Error(`Invalid watermark: ${result.reason}`)
  return {
    creator_id: result.payload.creator_id, project_id: result.payload.project_id,
    episode_id: result.payload.episode_id, generated_at: result.payload.generated_at,
    platform: result.payload.platform, nonce: result.payload.nonce,
    fingerprint: result.payload.fingerprint, version: result.payload.v,
  }
}
