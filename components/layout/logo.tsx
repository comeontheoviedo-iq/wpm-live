import Link from "next/link";
import { Mic2 } from "lucide-react";

export function Logo({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2 focus-ring rounded-[2px]"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-[2px] bg-[var(--foreground)] text-[var(--surface)] shadow-xs ring-1 ring-[var(--border)] transition-transform duration-150 group-hover:scale-[1.03]">
        <Mic2 className="h-3.5 w-3.5" />
      </span>
      <span className="text-[15px] font-bold tracking-[-0.03em] text-[var(--foreground)]">
        <span className="text-[var(--brand)]">Co</span>
        <span className="text-[var(--muted-foreground)]">Comms</span>
      </span>
    </Link>
  );
}
