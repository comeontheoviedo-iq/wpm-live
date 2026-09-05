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
          "interactive-press focus-ring inline-flex items-center justify-center gap-2 rounded-lg font-semibold tracking-tight disabled:opacity-50 disabled:pointer-events-none disabled:transform-none",
          variant === "primary" &&
            "bg-gradient-to-b from-teal-500 to-teal-600 text-white shadow-sm shadow-teal-900/20 hover:from-teal-400 hover:to-teal-500 hover:shadow-md hover:shadow-teal-900/25",
          variant === "secondary" &&
            "bg-slate-800 text-white shadow-sm hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600",
          variant === "ghost" &&
            "bg-transparent text-slate-700 hover:bg-slate-100/90 dark:text-slate-200 dark:hover:bg-slate-800/90",
          variant === "danger" &&
            "bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-sm shadow-rose-900/20 hover:from-rose-400 hover:to-rose-500",
          variant === "outline" &&
            "border border-slate-300/90 bg-white/80 text-slate-800 shadow-xs hover:border-teal-400/70 hover:bg-teal-50/50 dark:border-slate-600 dark:bg-slate-950/60 dark:text-slate-100 dark:hover:border-teal-500/50 dark:hover:bg-teal-950/30",
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
