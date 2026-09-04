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
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50 disabled:pointer-events-none",
          variant === "primary" &&
            "bg-teal-600 text-white hover:bg-teal-500 shadow-sm shadow-teal-900/20",
          variant === "secondary" &&
            "bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-700",
          variant === "ghost" &&
            "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200",
          variant === "danger" && "bg-rose-600 text-white hover:bg-rose-500",
          variant === "outline" &&
            "border border-slate-300 dark:border-slate-600 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800",
          size === "sm" && "px-2.5 py-1.5 text-xs",
          size === "md" && "px-3.5 py-2 text-sm",
          size === "lg" && "px-5 py-2.5 text-base",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
