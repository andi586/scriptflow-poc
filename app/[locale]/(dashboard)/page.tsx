import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Project = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  user_id: string;
};

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("zh-CN");
}

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/en/login");

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<Project[]>();

  const list = projects ?? [];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <Button asChild className="bg-[#D4AF37] text-black hover:bg-[#c9a42d]">
            <Link href="/en/create">+ 创建新短剧</Link>
          </Button>
        </div>
        {list.length === 0 ? (
          <Card className="bg-[#111111] border-white/10">
            <CardContent className="py-16 text-center">
              <p className="text-zinc-400 mb-4">还没有项目，开始你的第一部短剧吧</p>
              <Button asChild className="bg-[#D4AF37] text-black hover:bg-[#c9a42d]">
                <Link href="/en/create">立即创作</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {list.map((project) => (
              <Link key={project.id} href={`/en/project/${project.id}`}>
                <Card className="bg-[#111111] border-white/10 hover:border-[#D4AF37]/40 transition">
                  <CardHeader>
                    <CardTitle className="text-lg text-white">{project.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-zinc-400 space-y-2">
                    <div>创建时间：{formatDate(project.created_at)}</div>
                    <div>状态：{project.status}</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
