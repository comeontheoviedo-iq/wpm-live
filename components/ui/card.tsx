import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/70 dark:bg-slate-900/95",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-b border-slate-100/90 bg-gradient-to-b from-slate-50/80 to-transparent px-4 py-3 dark:border-slate-800 dark:from-slate-900/80",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-desk-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100",
        className
      )}
      {...props}
    />
  );
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}
