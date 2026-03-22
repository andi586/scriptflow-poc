/**
 * GET https://api.piapi.ai/api/kling/v1/video/{task_id}
 * Override with KLING_VIDEO_STATUS_BASE (no trailing slash).
 */
export function getKlingVideoStatusPollUrl(taskId: string): string {
  const base = (
    process.env.KLING_VIDEO_STATUS_BASE ?? "https://api.piapi.ai/api/kling/v1"
  ).replace(/\/$/, "");
  return `${base}/video/${encodeURIComponent(taskId)}`;
}
