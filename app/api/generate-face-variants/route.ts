import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"
import { v4 as uuidv4 } from "uuid"

// OpenAI initialized inside handler

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function uploadToStorage(buffer: Buffer, filename: string) {
  const { error } = await supabase.storage
    .from("recordings")
    .upload(filename, buffer, { contentType: "image/png", upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from("recordings").getPublicUrl(filename)
  return data.publicUrl
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const expressions = ["neutral", "surprised", "fear"] as const
    const results: Record<string, string> = {}

    await Promise.all(expressions.map(async (exp) => {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
      const { toFile } = await import('openai')
      const imageFile = await toFile(buffer, 'user.jpg', { type: 'image/jpeg' })
      const response = await openai.images.edit({
        model: "gpt-image-2",
        image: imageFile,
        prompt: `Keep this EXACT person's face and identity. Only change the facial expression to: ${exp.toUpperCase()}. Same lighting, same angle, same person, ultra realistic, cinematic portrait.`,
        size: "1024x1024",
      })
      const base64 = response.data?.[0]?.b64_json ?? ''
      const imgBuffer = Buffer.from(base64, "base64")
      const url = await uploadToStorage(imgBuffer, `face-variants/${uuidv4()}-${exp}.png`)
      results[exp] = url
    }))

    return NextResponse.json({ success: true, images: results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
