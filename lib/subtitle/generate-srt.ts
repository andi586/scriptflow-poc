export interface CharacterTimestampsInput {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}
export interface SubtitleEntry {
  index: number
  startSeconds: number
  endSeconds: number
  text: string
}
function pad2(n: number): string { return String(n).padStart(2, '0') }
function pad3(n: number): string { return String(n).padStart(3, '0') }
export function formatSrtTimestamp(s: number): string {
  const safe = Math.max(0, s)
  return `${pad2(Math.floor(safe/3600))}:${pad2(Math.floor((safe%3600)/60))}:${pad2(Math.floor(safe%60))},${pad3(Math.round((safe-Math.floor(safe))*1000))}`
}
export function timestampsToSubtitleEntries(input: CharacterTimestampsInput, options: { offsetSeconds?: number; startIndex?: number; maxCharsPerCue?: number; maxDurationSeconds?: number } = {}): SubtitleEntry[] {
  const chars = input.characters, starts = input.character_start_times_seconds, ends = input.character_end_times_seconds
  const offsetSeconds = options.offsetSeconds ?? 0, maxCharsPerCue = options.maxCharsPerCue ?? 22, maxDurationSeconds = options.maxDurationSeconds ?? 3.8, startIndex = options.startIndex ?? 1
  const entries: SubtitleEntry[] = []
  let buffer = '', cueStart = -1, cueEnd = -1, entryIndex = startIndex
  const flush = () => {
    const text = buffer.replace(/\s+/g, ' ').trim()
    if (!text || cueStart < 0) { buffer = ''; cueStart = -1; cueEnd = -1; return }
    entries.push({ index: entryIndex++, startSeconds: cueStart + offsetSeconds, endSeconds: cueEnd + offsetSeconds, text })
    buffer = ''; cueStart = -1; cueEnd = -1
  }
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (cueStart < 0) cueStart = starts[i]
    cueEnd = ends[i]; buffer += ch
    const ct = buffer.replace(/\s+/g, ' ').trim()
    if (/[。！？!?；;…\n]/.test(ch) || ct.length >= maxCharsPerCue || (cueEnd-cueStart) >= maxDurationSeconds) flush()
  }
  flush()
  return entries
}
export function entriesToSrt(entries: SubtitleEntry[]): string {
  return entries.map(e => `${e.index}\n${formatSrtTimestamp(e.startSeconds)} --> ${formatSrtTimestamp(e.endSeconds)}\n${e.text}`).join('\n\n')
}
export function generateSrt(input: CharacterTimestampsInput, options = {}): string {
  return entriesToSrt(timestampsToSubtitleEntries(input, options))
}
