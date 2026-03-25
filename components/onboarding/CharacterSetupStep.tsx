"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveOnboardingCharacters } from "@/actions/module-zero.actions";

type LocalCharacter = {
  name: string;
  reference_image_url: string;
  reference_image_path: string;
};

type PublicCharacter = {
  name: string;
  reference_image_url: string;
};

export function CharacterSetupStep({
  projectId,
  onNext,
}: {
  projectId: string;
  onNext: (chars: PublicCharacter[]) => void;
}) {
  const supabase = createClient();

  const [chars, setChars] = useState<LocalCharacter[]>([
    { name: "", reference_image_url: "", reference_image_path: "" },
  ]);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (index: number, file: File) => {
    setIsUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${projectId}/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from("scriptflow-characters")
        .upload(filePath, file);

      if (uploadErr) throw uploadErr;

      const {
        data: signed,
        error: signedErr,
      } = await supabase.storage
        .from("scriptflow-characters")
        .createSignedUrl(filePath, 3600);

      if (signedErr) throw signedErr;

      if (!signed?.signedUrl) {
        throw new Error("Missing signedUrl from Supabase Storage.");
      }

      setChars((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          reference_image_url: signed.signedUrl,
          reference_image_path: filePath,
        };
        return next;
      });
    } finally {
      setIsUploading(false);
    }
  };

  const isReady =
    chars.length > 0 && chars.every((c) => c.name.trim().length > 0 && !!c.reference_image_url);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Step 3: Character Setup</h3>
      {chars.map((char, i) => (
        <div
          key={i}
          className="space-y-4 p-4 border border-white/10 rounded-xl"
        >
          <Input
            placeholder="Character Name"
            value={char.name}
            onChange={(e) => {
              const n = [...chars];
              n[i] = { ...n[i], name: e.target.value };
              setChars(n);
            }}
          />
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImageUpload(i, f);
            }}
          />
          {char.reference_image_url ? (
            <p className="text-xs text-green-400">✅ Reference image uploaded</p>
          ) : null}
        </div>
      ))}

      <Button
        className="w-full"
        disabled={!isReady || isUploading}
        onClick={async () => {
          const result = await saveOnboardingCharacters({
            projectId,
            characters: chars.map((c) => ({
              name: c.name,
              reference_image_url: c.reference_image_url,
              reference_image_path: c.reference_image_path,
            })),
          });
          if (result.success) {
            onNext(
              chars.map((c) => ({
                name: c.name,
                reference_image_url: c.reference_image_url,
              })),
            );
          }
        }}
      >
        {isUploading ? "Uploading..." : "Confirm Characters →"}
      </Button>
    </div>
  );
}

