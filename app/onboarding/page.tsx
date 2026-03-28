"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { StepIndicator } from "@/components/onboarding/StepIndicator"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ArrowRight, Sparkles, Wand2, Rocket } from "lucide-react"

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    nickname: "", bio: "", genre: [] as string[], nelPrompts: ["", "", ""],
  })

  const nextStep = () => setStep(s => Math.min(s + 1, 4))
  const prevStep = () => setStep(s => Math.max(s - 1, 1))
  const toggleGenre = (g: string) => setFormData(prev => ({
    ...prev, genre: prev.genre.includes(g) ? prev.genre.filter(i => i !== g) : [...prev.genre, g]
  }))
  const updateNel = (index: number, val: string) => {
    const p = [...formData.nelPrompts]; p[index] = val; setFormData({ ...formData, nelPrompts: p })
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-2xl">
        <StepIndicator currentStep={step} totalSteps={4} />
        <div className="transition-all duration-500">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">Welcome, Creator</h1>
                <p className="text-zinc-400">Let's set up your production identity.</p>
              </div>
              <Card className="bg-zinc-900 border-zinc-800 p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Creator Nickname</label>
                  <Input placeholder="e.g. Neo Noir Master" className="bg-zinc-950 border-zinc-800"
                    value={formData.nickname} onChange={e => setFormData({ ...formData, nickname: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Short Bio</label>
                  <Textarea placeholder="Tell the world about your narrative vision..." className="bg-zinc-950 border-zinc-800 h-24"
                    value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} />
                </div>
              </Card>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">Pick Your Poison</h1>
                <p className="text-zinc-400">Which genres define your storytelling?</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {["Suspense", "Romance", "Comedy", "Action", "Sci-Fi", "Drama"].map(g => (
                  <button key={g} onClick={() => toggleGenre(g)}
                    className={cn("p-6 rounded-xl border-2 transition-all text-center font-bold",
                      formData.genre.includes(g) ? "border-purple-500 bg-purple-500/10 text-purple-400" : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700")}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="flex justify-center mb-2"><Sparkles className="text-purple-500 h-8 w-8 animate-pulse" /></div>
                <h1 className="text-3xl font-bold">NEL Style Calibration</h1>
                <p className="text-zinc-400 text-sm max-w-md mx-auto">Describe your aesthetic voice in 3 prompts. Our AI will use this to calibrate your personal production model.</p>
              </div>
              <div className="space-y-4">
                {formData.nelPrompts.map((p, i) => (
                  <div key={i} className="space-y-2">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-widest">Sample {i + 1}</label>
                    <Input placeholder="e.g. Gritty urban shadows with high-contrast neon lighting..."
                      className="bg-zinc-900 border-zinc-800 focus:border-purple-500"
                      value={p} onChange={e => updateNel(i, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-8 text-center py-8">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-purple-500 blur-3xl opacity-20 animate-pulse" />
                <Rocket className="h-20 w-20 text-purple-500 relative z-10 mx-auto" />
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl font-black italic tracking-tighter uppercase">Protocol Activated</h1>
                <p className="text-zinc-400">Your Wyoming-governed Creator Hub is ready.</p>
              </div>
              <Card className="bg-zinc-900 border-zinc-800 p-6 max-w-sm mx-auto">
                <div className="flex items-center gap-4 text-left">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500" />
                  <div>
                    <h3 className="font-bold">{formData.nickname || "Anonymous Creator"}</h3>
                    <div className="flex gap-1 mt-1">
                      {formData.genre.slice(0, 2).map(g => (
                        <Badge key={g} variant="secondary" className="text-[9px] h-4 bg-zinc-800">{g}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
        <div className="mt-12 flex justify-between gap-4">
          <Button variant="ghost" onClick={prevStep} disabled={step === 1}
            className={cn("text-zinc-500 hover:text-white", step === 1 && "opacity-0")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          {step < 4 ? (
            <Button className="bg-purple-600 hover:bg-purple-700 px-8" onClick={nextStep}
              disabled={step === 1 && !formData.nickname}>
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 px-12 font-bold"
              onClick={() => router.push("/dashboard")}>
              Enter Dashboard <Wand2 className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
