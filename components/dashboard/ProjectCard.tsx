import Link from "next/link"
import { ChevronRight, Clapperboard } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"

type ProjectStatus =
  | "draft"
  | "analyzing"
  | "ready"
  | "generating"
  | "completed"
  | "archived"

interface ProjectCardProps {
  id: string
  title: string
  status: ProjectStatus
  createdAt: string
}

const STATUS_MAP: Record<
  ProjectStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "草稿",
    className: "border-zinc-700 bg-zinc-900 text-zinc-300",
  },
  analyzing: {
    label: "分析中",
    className: "border-purple-500/30 bg-purple-500/10 text-purple-300",
  },
  ready: {
    label: "可生成",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  generating: {
    label: "生成中",
    className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  },
  completed: {
    label: "已完成",
    className:
      "border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37]",
  },
  archived: {
    label: "已归档",
    className: "border-zinc-600 bg-zinc-800 text-zinc-400",
  },
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(dateString))
}

export function ProjectCard({ id, title, status, createdAt }: ProjectCardProps) {
  const { label, className } = STATUS_MAP[status] ?? STATUS_MAP.draft

  return (
    <Card className="group border-zinc-800 bg-[#111111] transition-all duration-200 hover:border-[#D4AF37]/40">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Badge variant="outline" className={className}>
          {label}
        </Badge>
        <span className="text-xs text-zinc-500">{formatDate(createdAt)}</span>
      </CardHeader>

      <Link href={`/project/${id}`} className="block">
        <CardContent className="pb-6 pt-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[#D4AF37]/10 p-2 text-[#D4AF37]">
              <Clapperboard size={18} />
            </div>
            <h3 className="line-clamp-2 text-base font-bold text-white transition-colors group-hover:text-[#D4AF37]">
              {title}
            </h3>
          </div>
        </CardContent>
      </Link>

      <CardFooter className="border-t border-zinc-900 bg-black/40 p-3">
        <Button
          asChild
          variant="ghost"
          className="w-full justify-between bg-transparent text-zinc-400 hover:bg-zinc-900 hover:text-[#D4AF37]"
        >
          <Link href={`/project/${id}`}>
            <span className="tracking-wide text-xs font-semibold uppercase">
              继续创作
            </span>
            <ChevronRight size={14} />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

