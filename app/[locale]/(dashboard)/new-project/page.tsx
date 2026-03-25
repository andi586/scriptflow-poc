"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepIndicator } from "@/components/onboarding/StepIndicator";
import { ScriptUploadStep } from "@/components/onboarding/ScriptUploadStep";
import { NELAnalysisStep } from "@/components/onboarding/NELAnalysisStep";
import { CharacterSetupStep } from "@/components/onboarding/CharacterSetupStep";
import { ConfirmSettingsStep } from "@/components/onboarding/ConfirmSettingsStep";
import { createProject } from "@/actions/module-zero.actions";
import { Card } from "@/components/ui/card";

export default function NewProjectPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [script, setScript] = useState("");

  const [settings] = useState({
    aspect_ratio: "9:16",
    video_duration_sec: 5,
  });

  const handleScriptSubmit = async (val: string) => {
    const result = await createProject({
      title: "Untitled Project",
      script_raw: val,
      status: "draft",
      aspect_ratio: "9:16",
      video_duration_sec: 5,
    });

    if (!result.success) {
      // Keep UX simple: show no navigation when project creation fails.
      return;
    }

    setProjectId(result.data.id);
    setScript(val);
    setCurrentStep(2);
  };

  const handleComplete = () => {
    if (!projectId) return;
    router.push(`/project/${projectId}`);
  };

  return (
    <div className="container max-w-2xl py-10 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Initialize Your Short Drama
        </h1>
        <p className="text-muted-foreground">Module Zero · Setup</p>
      </div>

      <StepIndicator current={currentStep} total={4} />

      <Card className="p-6 bg-zinc-950/40 border border-white/10">
        {currentStep === 1 ? (
          <ScriptUploadStep onNext={handleScriptSubmit} />
        ) : null}

        {currentStep === 2 && projectId ? (
          <NELAnalysisStep
            script={script}
            onContinue={(val) => {
              void val;
              setCurrentStep(3);
            }}
          />
        ) : null}

        {currentStep === 3 && projectId ? (
          <CharacterSetupStep
            projectId={projectId}
            onNext={() => setCurrentStep(4)}
          />
        ) : null}

        {currentStep === 4 && projectId ? (
          <ConfirmSettingsStep
            data={settings}
            onComplete={handleComplete}
          />
        ) : null}
      </Card>
    </div>
  );
}

