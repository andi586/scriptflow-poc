import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      question_1,
      question_2,
      question_3,
      question_4,
      question_5,
      question_6,
    } = body;

    // Validate required fields
    if (
      !email ||
      !question_1 ||
      !question_2 ||
      !question_3 ||
      !question_4 ||
      !question_5 ||
      !question_6
    ) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Insert survey response
    const { data, error } = await supabase
      .from("survey_responses")
      .insert({
        email,
        question_1,
        question_2,
        question_3,
        question_4,
        question_5,
        question_6,
      })
      .select("free_generation_token")
      .single();

    if (error) {
      console.error("Error inserting survey response:", error);
      return NextResponse.json(
        { error: "Failed to save survey response" },
        { status: 500 }
      );
    }

    const token = data.free_generation_token;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const generationLink = `${baseUrl}/create?token=${token}`;

    // Send email with generation link
    try {
      await sendSurveyEmail(email, generationLink);
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      // Don't fail the request if email fails - user still has the link
    }

    return NextResponse.json({
      success: true,
      generationLink,
      message: "Survey submitted successfully! Check your email for the link.",
    });
  } catch (error) {
    console.error("Error processing survey submission:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function sendSurveyEmail(email: string, generationLink: string) {
  // Check if Resend API key is configured
  const resendApiKey = process.env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    console.warn("RESEND_API_KEY not configured - skipping email send");
    return;
  }

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your FREE AI Movie Awaits! 🎬</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 32px; font-weight: bold;">🎬 Your Movie Awaits!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #333; font-size: 24px;">You're the Star Now! 🌟</h2>
              <p style="margin: 0 0 20px 0; color: #666; font-size: 16px; line-height: 1.6;">
                Thank you for completing our survey! We're excited to help you create your very own AI-generated movie.
              </p>
              <p style="margin: 0 0 30px 0; color: #666; font-size: 16px; line-height: 1.6;">
                Click the button below to start creating your FREE movie:
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${generationLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 18px 40px; border-radius: 50px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                      🎬 Create My Movie Now
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0 0; color: #999; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:<br>
                <a href="${generationLink}" style="color: #667eea; word-break: break-all;">${generationLink}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
                This link is unique to you and can only be used once.
              </p>
              <p style="margin: 0; color: #999; font-size: 12px;">
                © ${new Date().getFullYear()} ScriptFlow. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const emailText = `
Your FREE AI Movie Awaits! 🎬

Thank you for completing our survey! We're excited to help you create your very own AI-generated movie.

Click the link below to start creating your FREE movie:
${generationLink}

This link is unique to you and can only be used once.

© ${new Date().getFullYear()} ScriptFlow. All rights reserved.
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "ScriptFlow <onboarding@resend.dev>",
      to: email,
      subject: "🎬 Your FREE AI Movie Awaits!",
      html: emailHtml,
      text: emailText,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to send email: ${errorData}`);
  }

  return response.json();
}
