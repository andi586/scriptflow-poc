import Link from "next/link";

export function ScriptflowNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-sm font-extrabold tracking-tight text-white transition-colors hover:text-amber-400"
        >
          ScriptFlow
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/character-templates"
            className="text-white/70 transition-colors hover:text-amber-400"
          >
            Characters
          </Link>
        </nav>
      </div>
    </header>
  );
}
