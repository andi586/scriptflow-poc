import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      movieId,
      email,
      q1_create,
      q2_preference,
      q3_price,
      q4_voice,
      q5_share,
    } = body;

    // Validate required fields
    if (
      !q1_create ||
      !q2_preference ||
      !q3_price ||
      !q4_voice ||
      !q5_share
    ) {
      return NextResponse.json(
        { error: "All questions must be answered" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Get user_id from movie if movieId is provided
    let userId: string | null = null;
    if (movieId) {
      const { data: movieData } = await supabase
        .from("movies")
        .select("user_id")
        .eq("id", movieId)
        .single();
      
      userId = movieData?.user_id || null;
    }

    // Check if user already submitted survey for this movie
    if (movieId) {
      const { data: existingSurvey } = await supabase
        .from("survey_responses")
        .select("id")
        .eq("movie_id", movieId)
        .maybeSingle();

      if (existingSurvey) {
        return NextResponse.json(
          { error: "You've already submitted feedback for this movie" },
          { status: 400 }
        );
      }
    }

    // Insert survey response
    const { data, error } = await supabase
      .from("survey_responses")
      .insert({
        user_id: userId,
        movie_id: movieId || null,
        email: email || null,
        q1_create,
        q2_preference,
        q3_price,
        q4_voice,
        q5_share,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error inserting survey response:", error);
      return NextResponse.json(
        { error: "Failed to save survey response" },
        { status: 500 }
      );
    }

    // Award 1 credit to user if userId exists
    if (userId) {
      try {
        const { error: creditError } = await supabase.rpc(
          "increment_user_credits",
          {
            user_id: userId,
            credit_amount: 1,
          }
        );

        if (creditError) {
          console.error("Error awarding credit:", creditError);
          // Don't fail the request - survey was saved successfully
        }
      } catch (creditError) {
        console.error("Error calling increment_user_credits:", creditError);
        // Don't fail the request - survey was saved successfully
      }
    }

    return NextResponse.json({
      success: true,
      message: "Thank you for your feedback! You've earned 1 free credit.",
    });
  } catch (error) {
    console.error("Error processing survey submission:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
