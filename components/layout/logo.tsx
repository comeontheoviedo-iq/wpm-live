import Link from "next/link";
import { Mic2 } from "lucide-react";

export function Logo({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 group">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-900/30">
        <Mic2 className="h-4 w-4" />
      </span>
      <span className="font-bold tracking-tight text-slate-900 dark:text-white">
        Pitch<span className="text-teal-600 dark:text-teal-400">line</span>
      </span>
    </Link>
  );
}
