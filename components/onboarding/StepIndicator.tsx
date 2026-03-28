import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

interface StepIndicatorProps { 
  currentStep?: number
  current?: number
  totalSteps?: number
  total?: number
}

export function StepIndicator({ currentStep, current, totalSteps, total }: StepIndicatorProps) {
  const step = currentStep ?? current ?? 1
  const totalCount = totalSteps ?? total ?? 4
  const steps = ["Profile", "Genre", "NEL Init", "Ready"]
  return (
    <div className="flex items-center justify-between w-full max-w-md mx-auto mb-12">
      {steps.map((label, i) => {
        const stepNum = i + 1
        const isActive = stepNum <= step
        const isCompleted = stepNum < step
        return (
          <div key={label} className="flex flex-col items-center relative flex-1">
            <div className={cn("w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 z-10",
              isActive ? "border-purple-500 bg-purple-500 text-white" : "border-zinc-800 bg-zinc-900 text-zinc-500",
              isCompleted && "bg-emerald-500 border-emerald-500")}>
              {isCompleted ? <Check className="h-4 w-4" /> : <span className="text-xs font-bold">{stepNum}</span>}
            </div>
            <span className={cn("text-[10px] mt-2 font-medium uppercase tracking-wider", isActive ? "text-purple-400" : "text-zinc-600")}>{label}</span>
            {i < steps.length - 1 && (
              <div className={cn("absolute top-4 left-1/2 w-full h-[2px] -z-0 transition-all duration-500", stepNum < step ? "bg-emerald-500" : "bg-zinc-800")} />
            )}
          </div>
        )
      })}
    </div>
  )
}
