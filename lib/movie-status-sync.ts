import type { SupabaseClient } from '@supabase/supabase-js'

type MovieSyncTarget = {
  movieId?: string | null
  taskId?: string | null
  videoUrl?: string | null
}

const COMPLETE_MOVIE_STATUS = 'complete'

function buildCompletePayload(videoUrl: string) {
  return {
    final_video_url: videoUrl,
    status: COMPLETE_MOVIE_STATUS,
    error_message: null,
    updated_at: new Date().toISOString(),
  }
}

export async function syncMovieCompleteFromVideoUrl(
  db: SupabaseClient,
  target: MovieSyncTarget,
): Promise<void> {
  const videoUrl = target.videoUrl?.trim()
  if (!videoUrl) return

  const payload = buildCompletePayload(videoUrl)

  if (target.movieId) {
    const { error } = await db
      .from('movies')
      .update(payload)
      .eq('id', target.movieId)

    if (error) {
      console.warn('[movie-status-sync] movie id sync failed:', target.movieId, error.message)
    }
  }

  if (target.taskId) {
    const { error } = await db
      .from('movies')
      .update(payload)
      .eq('kling_task_id', target.taskId)

    if (error) {
      console.warn('[movie-status-sync] task id sync failed:', target.taskId, error.message)
    }
  }
}

export async function markMovieFailedIfNoVideo(
  db: SupabaseClient,
  target: Pick<MovieSyncTarget, 'movieId' | 'taskId'>,
): Promise<void> {
  const payload = {
    status: 'failed',
    updated_at: new Date().toISOString(),
  }

  if (target.movieId) {
    const { error } = await db
      .from('movies')
      .update(payload)
      .eq('id', target.movieId)
      .is('final_video_url', null)

    if (error) {
      console.warn('[movie-status-sync] movie id failed sync failed:', target.movieId, error.message)
    }
  }

  if (target.taskId) {
    const { error } = await db
      .from('movies')
      .update(payload)
      .eq('kling_task_id', target.taskId)
      .is('final_video_url', null)

    if (error) {
      console.warn('[movie-status-sync] task id failed sync failed:', target.taskId, error.message)
    }
  }
}
