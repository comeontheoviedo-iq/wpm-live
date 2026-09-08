import Link from "next/link";
import { Mic2 } from "lucide-react";

export function Logo({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2 focus-ring rounded-[var(--radius-sm)]"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--foreground)] text-[var(--surface)] shadow-xs ring-1 ring-[var(--border)] transition-transform duration-150 group-hover:scale-[1.03]">
        <Mic2 className="h-4 w-4" />
      </span>
      <span className="font-bold tracking-tight text-[var(--foreground)]">
        Co<span className="text-[var(--muted)]">Comms</span>
      </span>
    </Link>
  );
}
