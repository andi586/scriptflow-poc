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
      toast.error("请填写Email和Password");
      return;
    }
    setLoading(true);
    const { error } = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isLogin ? "Welcome back" : "Account created! Check your email.");
      if (isLogin) router.push("/create");
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Please enter your email first");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Reset email sent! Check your inbox.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-4">
      <Card className="w-full max-w-md border-[#D4AF37]/20 bg-zinc-950 text-white">
        <CardHeader className="space-y-1 text-center">
          <h1 className="text-3xl font-bold text-[#D4AF37]">ScriptFlow</h1>
          <h2 className="text-lg font-medium text-zinc-300">
            {isLogin ? "Login你的账号" : "创建新账号"}
          </h2>
          <p className="text-sm text-zinc-500">
            {isLogin ? "你心里的导演，等太久了" : "开始你的短剧之旅"}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
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
            <Label htmlFor="password">Password</Label>
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
            {loading ? "处理中…" : isLogin ? "Login" : "Sign Up"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsLogin((v) => !v)}
            className="w-full text-zinc-400 hover:bg-zinc-900 hover:text-white"
          >
            {isLogin ? "Don't have an account? 去Sign Up" : "Already have an account? 去Login"}
          </Button>
          {isLogin && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => void handleForgotPassword()}
              className="text-xs text-zinc-500 hover:text-[#D4AF37]"
            >
              忘记Password
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
