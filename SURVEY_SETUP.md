# Survey Page Setup Instructions

## Overview
A beautiful survey page has been created to collect user preferences and reward them with a free movie generation link.

## Files Created

1. **`app/survey/page.tsx`** - Survey page component with:
   - 6 engaging questions about movie preferences
   - Beautiful gradient UI with animations
   - Email collection
   - Thank you page with generation link

2. **`app/api/survey/submit/route.ts`** - API endpoint that:
   - Validates survey responses
   - Saves to Supabase
   - Generates unique token
   - Sends email with generation link (if configured)

3. **`supabase/migrations/20260503000001_create_survey_responses.sql`** - Database schema

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

### Optional (for email functionality)
- `RESEND_API_KEY` - Your Resend API key for sending emails
- `RESEND_FROM_EMAIL` - From email address (default: "ScriptFlow <onboarding@resend.dev>")
- `NEXT_PUBLIC_BASE_URL` - Your app's base URL (default: "http://localhost:3000")

## Features

### Survey Questions
1. What kind of story would you like to star in?
2. What's your dream role?
3. Pick your movie vibe
4. How do you want your character to look?
5. What's your character's superpower?
6. One word to describe your movie

### Database Schema
The `survey_responses` table includes:
- `id` - UUID primary key
- `email` - User's email
- `question_1` through `question_6` - Survey answers
- `free_generation_token` - Unique UUID for free generation
- `token_used` - Boolean flag to track if token was used
- `created_at` / `updated_at` - Timestamps

### Security
- Row Level Security (RLS) enabled
- Anonymous users can insert (for survey submission)
- Service role can read/update all records
- Unique token per submission

## Usage

1. Visit `/survey` to access the survey page
2. Users answer 6 questions
3. Users enter their email
4. System generates unique token and link
5. Email sent with generation link (if configured)
6. User can use link to create free movie

## Testing

To test locally:
```bash
npm run dev
```

Then visit: `http://localhost:3000/survey`

## Email Template

The email includes:
- Beautiful HTML template with gradient design
- Clear CTA button
- Plain text fallback
- Unique generation link
- Professional branding

## Next Steps

1. Apply the database migration
2. Configure environment variables (especially for email)
3. Test the survey flow
4. Implement token validation in `/create` page
5. Track token usage to prevent reuse
