import { cn, statusColor } from "@/lib/utils";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] shadow-xs",
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      className={cn(
        "text-white ring-1 ring-black/5 dark:ring-white/10",
        statusColor(status)
      )}
    >
      {status}
    </Badge>
  );
}
