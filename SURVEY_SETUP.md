# Post-Movie Feedback Survey Setup

## Overview
A beautiful post-movie feedback survey that rewards users with 1 FREE movie credit for completing it.

## Files Created/Modified

1. **`app/survey/page.tsx`** - Survey page component with:
   - 5 feedback questions about the movie experience
   - Beautiful gradient UI with animations
   - Optional email collection
   - Thank you page with credit confirmation
   - Accepts `movieId` query parameter

2. **`app/api/survey/submit/route.ts`** - API endpoint that:
   - Validates survey responses
   - Saves to Supabase
   - Awards 1 credit to user automatically
   - Prevents duplicate submissions per movie

3. **`supabase/migrations/20260503000001_create_survey_responses.sql`** - Database schema

4. **`app/movie/[movieId]/page.tsx`** - Modified to show survey prompt after movie is unlocked

## Database Migration

To apply the migration, run:

```bash
npm run db:migrate:file supabase/migrations/20260503000001_create_survey_responses.sql
```

**Note:** You need to set `DATABASE_URL` in your `.env` file first:
```
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]
```

Or apply manually in Supabase SQL Editor by running the migration file.

## Environment Variables

### Required
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

## Features

### Survey Questions
1. **What would you like to create next?**
   - Another movie with different story
   - Same story, different character
   - Photo-to-video content
   - Music video
   - Series/Multiple episodes
   - Custom creative project

2. **What did you like most about your movie?**
   - The character/acting
   - The story/script
   - Visual quality
   - Voice/audio
   - Speed of creation
   - The price

3. **Was the price fair for what you got?**
   - Great value!
   - Fair price
   - A bit expensive
   - Too expensive
   - Would prefer subscription
   - Would pay more for premium

4. **How was the voice quality?**
   - Perfect!
   - Good enough
   - Could be better
   - Not great
   - Want to use my own voice
   - Prefer no voice

5. **Would you share this with friends?**
   - Already shared!
   - Yes, definitely
   - Maybe
   - Probably not
   - Too personal
   - After some edits

### Database Schema
The `survey_responses` table includes:
- `id` - UUID primary key
- `user_id` - References auth.users (from movie)
- `movie_id` - References movies table
- `email` - Optional user email
- `q1_create` through `q5_share` - Survey answers
- `credit_awarded` - Boolean flag (always true when submitted)
- `created_at` / `updated_at` - Timestamps

### Security
- Row Level Security (RLS) enabled
- Anonymous and authenticated users can insert
- Service role can read/update all records
- Prevents duplicate submissions per movie

### Credit System
- Uses existing `increment_user_credits` function
- Automatically awards 1 credit upon survey completion
- Credits are added to user's profile
- No credit awarded if user_id is not available

## User Flow

1. User creates and pays for a movie
2. After movie is unlocked, survey prompt appears on movie page
3. User clicks "Take Survey" button
4. User answers 5 questions
5. User optionally enters email
6. System saves responses and awards 1 credit
7. User sees thank you message with credit confirmation
8. User can immediately create a free movie with the credit

## Movie Page Integration

The survey prompt appears at the bottom of the movie page when:
- Movie is unlocked (`paid=true`)
- Beautiful gradient card with clear CTA
- Links to `/survey?movieId={movieId}`

## Testing

To test locally:
```bash
npm run dev
```

Then:
1. Create and unlock a movie
2. See survey prompt on movie page
3. Click "Take Survey"
4. Complete the survey
5. Check that credit was added to user profile

## Preventing Duplicate Submissions

The API checks if a survey response already exists for the given `movie_id` before allowing submission. This prevents users from gaming the system by submitting multiple surveys for the same movie.

## Next Steps

1. ✅ Apply the database migration
2. ✅ Test the survey flow end-to-end
3. ✅ Verify credit is awarded correctly
4. Consider adding analytics to track survey responses
5. Consider A/B testing different survey questions
6. Consider adding survey completion rate tracking
