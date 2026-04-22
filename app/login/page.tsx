"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleAuth = async () => {
    if (!email || !password) {
      toast.error("请填写邮箱和密码");
      return;
    }
    setLoading(true);
    const { error } = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isLogin ? "欢迎回来" : "注册成功，请查收邮件");
      if (isLogin) router.push("/create");
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("请先填写邮箱地址");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("重置邮件已发送，请查收");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-4">
      <Card className="w-full max-w-md border-[#D4AF37]/20 bg-zinc-950 text-white">
        <CardHeader className="space-y-1 text-center">
          <h1 className="text-3xl font-bold text-[#D4AF37]">ScriptFlow</h1>
          <h2 className="text-lg font-medium text-zinc-300">
            {isLogin ? "登录你的账号" : "创建新账号"}
          </h2>
          <p className="text-sm text-zinc-500">
            {isLogin ? "你心里的导演，等太久了" : "开始你的短剧之旅"}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="border-zinc-800"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              autoComplete={
                isLogin ? "current-password" : "new-password"
              }
              placeholder="••••••••"
              className="border-zinc-800"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button
            type="button"
            disabled={loading}
            onClick={() => void handleAuth()}
            className="h-11 w-full bg-[#D4AF37] font-semibold text-black hover:bg-[#B8962E]"
          >
            {loading ? "处理中…" : isLogin ? "登录" : "注册"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsLogin((v) => !v)}
            className="w-full text-zinc-400 hover:bg-zinc-900 hover:text-white"
          >
            {isLogin ? "没有账号？去注册" : "已有账号？去登录"}
          </Button>
          {isLogin && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => void handleForgotPassword()}
              className="text-xs text-zinc-500 hover:text-[#D4AF37]"
            >
              忘记密码
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
