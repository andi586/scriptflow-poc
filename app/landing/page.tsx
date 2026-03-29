import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Cpu, Coins, Lock, ArrowRight, CheckCircle2, Zap, Globe, Scale } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-purple-500/30">
      <section className="relative overflow-hidden pt-20 pb-16 md:pt-32 md:pb-24">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-purple-600/10 blur-[120px] rounded-full -z-10" />
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-4 bg-purple-500/10 text-purple-400 border-purple-500/20 px-3 py-1">Creator Sovereignty Platform</Badge>
          <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500">
            From one sentence to a <br />
            <span className="text-purple-500">published short drama</span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10">
            The world's first AI production platform that respects <b>Creator Sovereignty</b>. Build your IP Empire with automated narrative engineering.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white px-8 h-12 text-lg">
              Start Creating Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="border-zinc-600 text-zinc-300 hover:bg-zinc-800 hover:text-white h-12 text-lg">
              View Showcase
            </Button>
          </div>
        </div>
      </section>

      <section className="py-20 bg-zinc-900/50 border-y border-zinc-800">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-16">The ScriptFlow Moat</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-purple-500/50 transition-all group">
              <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Cpu className="text-purple-500" />
              </div>
              <h3 className="text-xl font-bold mb-3">NEL — Your Personal AI Director</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">Personalized style models that capture your unique narrative voice. Your DNA, your AI.</p>
            </div>
            <div className="p-8 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-purple-500/50 transition-all group">
              <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="text-purple-500" />
              </div>
              <h3 className="text-xl font-bold mb-3">HTS — Anti-AI Filter</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">8-rule human authenticity engine. Auto-blocks AI-flavored content before it kills your retention. Score below 6? We stop it before it goes live.</p>
            </div>
            <div className="p-8 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-purple-500/50 transition-all group">
              <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Lock className="text-purple-500" />
              </div>
              <h3 className="text-xl font-bold mb-3">F80 — 99.9% Uptime Guaranteed</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">99.9% uptime. $3.50 hard cap per episode. Auto-failover across Kling, Veo, and Runway. Your production never stops.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-4">Keep What You Earn</h2>
          <p className="text-center text-zinc-400 mb-12">ScriptFlow offers the most aggressive revenue share in the industry.</p>
          <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950/50">
            <Table>
              <TableHeader className="bg-zinc-900">
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-300">Platform</TableHead>
                  <TableHead className="text-zinc-300">Creator Share</TableHead>
                  <TableHead className="text-zinc-300">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-zinc-800 bg-purple-500/5">
                  <TableCell className="font-bold text-purple-400 text-lg">ScriptFlow</TableCell>
                  <TableCell className="font-bold text-purple-400 text-lg">65%</TableCell>
                  <TableCell className="text-zinc-300">Industry Leading</TableCell>
                </TableRow>
                <TableRow className="border-zinc-800">
                  <TableCell className="text-zinc-400">YouTube</TableCell>
                  <TableCell className="text-zinc-400">55%</TableCell>
                  <TableCell className="text-zinc-500">Standard</TableCell>
                </TableRow>
                <TableRow className="border-transparent">
                  <TableCell className="text-zinc-400">TikTok</TableCell>
                  <TableCell className="text-zinc-400">~30%</TableCell>
                  <TableCell className="text-zinc-500">Ad-Hoc</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      <section className="py-12 bg-zinc-900/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Scale className="text-purple-500" /> Creator Sovereignty
              </h2>
              <div className="space-y-6">
                {[
                  "ScriptFlow never claims ownership of your content.",
                  "Irrevocable right to export all IP bundles (JSON/MP4/PDF).",
                  "No training on your data for third-party sales without consent.",
                  "Wyoming-based legal protection for global creators.",
                  "Transparent algorithm scoring with full audit rights."
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <CheckCircle2 className="text-purple-500 shrink-0 h-6 w-6" />
                    <span className="text-zinc-300 font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 p-8 rounded-3xl shadow-2xl relative">
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-purple-500/20 blur-2xl rounded-full" />
              <pre className="text-xs font-mono text-zinc-500 overflow-hidden">{`{
  "contract_v": "3.1-WY",
  "jurisdiction": "Wyoming, USA",
  "creator_ownership": true,
  "revenue_share": 0.65,
  "data_portability": "Guaranteed"
}`}</pre>
              <div className="mt-6 pt-6 border-t border-zinc-800 italic text-sm text-zinc-400">
                "Our legal code is as robust as our software code."
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-16">Choose Your Production Tier</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle>Basic</CardTitle>
                <CardDescription>Perfect for hobbyists</CardDescription>
                <div className="mt-4 text-4xl font-bold text-white">$29<span className="text-sm text-zinc-500">/mo</span></div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-purple-500" /> 100 Monthly Credits</div>
                <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-purple-500" /> Standard Generation Speed</div>
                <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-purple-500" /> Basic Asset Access</div>
              </CardContent>
              <CardFooter><Button className="w-full border-zinc-600 text-zinc-300 hover:bg-zinc-800 hover:text-white" variant="outline">Get Started</Button></CardFooter>
            </Card>
            <Card className="bg-zinc-900 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)] scale-105">
              <CardHeader className="relative">
                <Badge className="absolute -top-3 right-4 bg-purple-600">Most Popular</Badge>
                <CardTitle>Professional</CardTitle>
                <CardDescription>For growing creators</CardDescription>
                <div className="mt-4 text-4xl font-bold text-white">$59<span className="text-sm text-zinc-500">/mo</span></div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-purple-500" /> 500 Monthly Credits</div>
                <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-purple-500" /> Priority Generation</div>
                <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-purple-500" /> NEL Custom Model Training</div>
                <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-purple-500" /> Advanced Analytics</div>
              </CardContent>
              <CardFooter><Button className="w-full bg-purple-600 hover:bg-purple-700">Go Pro</Button></CardFooter>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle>Studio</CardTitle>
                <CardDescription>Production-ready teams</CardDescription>
                <div className="mt-4 text-4xl font-bold text-white">$99<span className="text-sm text-zinc-500">/mo</span></div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-purple-500" /> Unlimited Credits</div>
                <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-purple-500" /> Multiple NEL Profiles</div>
                <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-purple-500" /> Team Collaboration</div>
                <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-purple-500" /> 24/7 Priority Support</div>
              </CardContent>
              <CardFooter><Button className="w-full border-zinc-600 text-zinc-300 hover:bg-zinc-800 hover:text-white" variant="outline">Contact Sales</Button></CardFooter>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-24 text-center bg-zinc-950 relative overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50" />
        <h2 className="text-4xl font-bold mb-8">Ready to own your future?</h2>
        <Button size="lg" className="bg-purple-600 hover:bg-purple-700 px-12 h-14 text-xl font-bold rounded-full">
          Start Creating Free
        </Button>
        <div className="mt-12 text-zinc-600 text-sm flex flex-col items-center gap-4">
          <div className="flex justify-center gap-8 items-center">
            <span className="flex items-center gap-1"><Globe className="h-4 w-4" /> Wyoming-Governed</span>
            <span className="flex items-center gap-1"><Coins className="h-4 w-4" /> Stripe Integrated</span>
            <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> EU AI Act Compliant</span>
          </div>
          <div className="flex gap-4 text-zinc-500">
            <a href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy Policy</a>
            <span>|</span>
            <a href="/terms" className="hover:text-zinc-300 transition-colors">Terms of Service</a>
          </div>
        </div>
      </section>
    </div>
  );
}
