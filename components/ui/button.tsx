import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "interactive-press focus-ring inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-semibold tracking-tight disabled:opacity-50 disabled:pointer-events-none disabled:transform-none",
          variant === "primary" &&
            "bg-slate-900 text-white shadow-xs hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-500",
          variant === "secondary" &&
            "bg-slate-800 text-white shadow-xs hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600",
          variant === "ghost" &&
            "bg-transparent text-slate-700 hover:bg-[var(--surface-muted)] dark:text-slate-200",
          variant === "danger" &&
            "bg-[var(--live)] text-white shadow-xs hover:brightness-110",
          variant === "outline" &&
            "border border-[var(--border)] bg-[var(--surface)] text-slate-800 shadow-none hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] dark:text-slate-100",
          size === "sm" && "px-2.5 py-1.5 text-desk-xs",
          size === "md" && "px-3.5 py-2 text-desk-sm",
          size === "lg" && "px-5 py-2.5 text-sm",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
