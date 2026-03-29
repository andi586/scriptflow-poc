"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, Circle, Loader2, Play, Download, Film, Sparkles, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";

type StepStatus = "pending" | "loading" | "completed";

interface GenerationStep {
  id: string;
  label: string;
  sublabel?: string;
  status: StepStatus;
}

interface EpisodeGenerationPanelProps {
  projectId?: string;
  onComplete?: (videoUrl: string) => void;
}

export default function EpisodeGenerationPanel({ projectId, onComplete }: EpisodeGenerationPanelProps) {
  const [progress, setProgress] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [steps, setSteps] = useState<GenerationStep[]>([
    { id: "analyze", label: "Script analyzed", status: "completed" },
    { id: "video", label: "Generating videos...", sublabel: "Submitting to Kling...", status: "loading" },
    { id: "voice", label: "Voice acting", status: "pending" },
    { id: "merge", label: "Merging audio & video", status: "pending" },
  ]);

  const updateStep = (id: string, status: StepStatus, sublabel?: string) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, ...(sublabel !== undefined ? { sublabel } : {}) } : s));
  };

  useEffect(() => {
    if (!projectId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/status`);
        const data = await res.json();
        const status = data.generation_status;

        if (status === 'generating_video') {
          updateStep('video', 'loading', 'Processing with Kling...');
          updateStep('voice', 'completed');
          setProgress(40);
        } else if (status === 'merging') {
          updateStep('video', 'completed');
          updateStep('voice', 'completed');
          updateStep('merge', 'loading');
          setProgress(80);
        } else if (status === 'completed') {
          updateStep('video', 'completed');
          updateStep('voice', 'completed');
          updateStep('merge', 'completed');
          setProgress(100);
          setFinalVideoUrl(data.final_video_url);
          setIsFinished(true);
          if (data.final_video_url && onComplete) onComplete(data.final_video_url);
          clearInterval(interval);
        } else if (status === 'failed') {
          clearInterval(interval);
        }
      } catch (e) {
        console.error('Status poll failed:', e);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [projectId, onComplete]);

  return (
    <Card className="w-full max-w-md mx-auto bg-zinc-950 border-zinc-800 shadow-2xl overflow-hidden">
      <CardContent className="p-8">
        <AnimatePresence mode="wait">
          {!isFinished ? (
            <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
              <div className="text-center space-y-2">
                <div className="inline-flex p-3 rounded-full bg-purple-500/10 mb-2">
                  <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
                </div>
                <h2 className="text-xl font-bold text-zinc-100">Generating Your Episode</h2>
                <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Estimated: ~4 minutes</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-purple-400">
                  <span>PIPELINE_ACTIVE</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5 bg-zinc-800" />
              </div>
              <div className="space-y-4">
                {steps.map((step) => (
                  <div key={step.id} className="flex items-start gap-4">
                    <div className="mt-0.5">
                      {step.status === "completed" ? (
                        <CheckCircle2 className="w-5 h-5 text-purple-500" />
                      ) : step.status === "loading" ? (
                        <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                      ) : (
                        <Circle className="w-5 h-5 text-zinc-700" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${step.status === 'pending' ? 'text-zinc-600' : 'text-zinc-200'}`}>{step.label}</p>
                      {step.sublabel && step.status === "loading" && (
                        <p className="text-xs text-zinc-500 mt-0.5 italic">{step.sublabel}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div key="finished" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center space-y-8">
              <div className="space-y-4">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                  <Film className="w-10 h-10 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Your episode is ready!</h2>
                  <p className="text-zinc-400 text-sm mt-2">Audio and video merged successfully.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <Button variant="outline" className="h-12 border-zinc-700 hover:bg-zinc-800 text-zinc-300">
                  <Play className="w-4 h-4 mr-2" />Preview
                </Button>
                {finalVideoUrl ? (
                  <Button className="h-12 bg-purple-600 hover:bg-purple-700 text-white" asChild>
                    <a href={finalVideoUrl} download>
                      <Download className="w-4 h-4 mr-2" />Download MP4
                    </a>
                  </Button>
                ) : (
                  <Button className="h-12 bg-purple-600 hover:bg-purple-700 text-white">
                    <Download className="w-4 h-4 mr-2" />Download MP4
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
