import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ProjectCard } from "@/components/dashboard/ProjectCard"
import { LogoutButton } from "@/components/dashboard/LogoutButton"

import { createServerSupabaseClient } from "@/lib/supabase/server"

type ProjectStatus =
  | "draft"
  | "analyzing"
  | "ready"
  | "generating"
  | "completed"
  | "archived"

interface ProjectRow {
  id: string
  title: string
  status: ProjectStatus
  created_at: string
  user_id: string
}

interface AuthUser {
  id: string
  email?: string | null
}

async function createSessionSupabaseClientForServer(): Promise<
  ReturnType<typeof createServerClient>
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
  if (!anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY")

  const cookieStore = await cookies()
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      // Session refresh is handled by middleware. For server component reads, a no-op is OK.
      setAll: () => {},
    },
  })
}

export default async function DashboardPage() {
  const supabase = await createSessionSupabaseClientForServer()
  const { data, error } = await supabase.auth.getUser()
  const user = data?.user as unknown as AuthUser | null

  if (error || !user) {
    redirect("/login")
  }

  const db = createServerSupabaseClient()
  const { data: projectsData, error: projectsError } = await db
    .from("projects")
    .select("id,title,status,created_at,user_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (projectsError) {
    // Keep page renderable even when projects fail.
    console.error("Failed to load projects:", projectsError.message)
  }

  const projectList: ProjectRow[] =
    (projectsData ?? []) as unknown as ProjectRow[]
  const projectCount = projectList.length

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[#D4AF37]" />
            <span className="text-lg font-bold text-[#D4AF37]">
              ScriptFlow
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-zinc-400 sm:block">
              {user.email ?? ""}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto space-y-10 max-w-7xl px-6 py-10">
        {/* 欢迎区域 */}
        <section className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            你的短剧世界
          </h1>
          <p className="text-zinc-400">
            你目前已创建{" "}
            <span className="font-semibold text-[#D4AF37]">
              {projectCount}
            </span>{" "}
            个项目
          </p>
        </section>

        {/* 创作入口 */}
        <section>
          <Card className="border-[#D4AF37]/20 bg-gradient-to-br from-[#141414] to-[#101010]">
            <CardContent className="flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="inline-flex rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-3 py-1 text-xs font-medium text-[#D4AF37]">
                  快速开始
                </div>
                <h2 className="text-2xl font-semibold">
                  开始你的下一部短剧
                </h2>
                <p className="text-sm text-zinc-400">
                  一句话灵感 → 完整剧本 → 成片
                </p>
              </div>

              <Button
                asChild
                size="lg"
                className="h-12 bg-[#D4AF37] px-8 font-bold text-black hover:bg-[#c9a42d]"
              >
                <Link href="/create">+ 创作新短剧</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* 项目列表 */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">你的项目</h2>
            <span className="text-sm text-zinc-500">
              共 {projectCount} 个
            </span>
          </div>

          {projectList.length === 0 ? (
            <Card className="border-dashed border-zinc-700 bg-[#111111]">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 inline-flex rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-3 py-1 text-xs font-medium text-[#D4AF37]">
                  还没有项目
                </div>
                <h3 className="text-lg font-semibold text-white">
                  你的第一个短剧，正在等你开始
                </h3>
                <p className="mt-2 max-w-md text-sm text-zinc-400">
                  输入一句话灵感，ScriptFlow 帮你完成剧本与成片全流程。
                </p>
                <Button
                  asChild
                  className="mt-6 bg-[#D4AF37] text-black hover:bg-[#c9a42d]"
                >
                  <Link href="/create">立即创作</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {projectList.map((project) => (
                <ProjectCard
                  key={project.id}
                  id={project.id}
                  title={project.title}
                  status={project.status}
                  createdAt={project.created_at}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
