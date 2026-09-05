import Link from "next/link";
import { Mic2 } from "lucide-react";

export function Logo({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-2 focus-ring rounded-lg">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-600 text-white shadow-md shadow-teal-900/30 ring-1 ring-white/30 transition-transform duration-150 group-hover:scale-[1.04] dark:ring-teal-300/20">
        <Mic2 className="h-4 w-4" />
      </span>
      <span className="font-bold tracking-tight text-slate-900 dark:text-white">
        Pitch
        <span className="bg-gradient-to-r from-teal-600 to-emerald-500 bg-clip-text text-transparent dark:from-teal-400 dark:to-emerald-300">
          line
        </span>
      </span>
    </Link>
  );
}
