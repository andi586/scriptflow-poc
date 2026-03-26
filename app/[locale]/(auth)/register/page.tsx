"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage(): React.JSX.Element {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }
    router.push("/en/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-white">
      <Card className="w-full max-w-md border-[#D4AF37]/20 bg-[#111111]">
        <CardHeader>
          <CardTitle className="text-center text-2xl text-[#D4AF37]">注册 ScriptFlow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-black border-white/10" />
          <Input type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-black border-white/10" />
          {error && <div className="text-sm text-red-400">{error}</div>}
          <Button onClick={handleRegister} disabled={loading} className="w-full bg-[#D4AF37] text-black hover:bg-[#c9a42d]">
            {loading ? "注册中..." : "注册"}
          </Button>
          <div className="text-center text-sm text-zinc-400">
            已有账号？ <Link href="/en/login" className="text-[#D4AF37]">去登录</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
