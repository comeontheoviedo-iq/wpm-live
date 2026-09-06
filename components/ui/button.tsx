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
            "bg-[var(--foreground)] text-[var(--surface)] shadow-xs hover:opacity-90",
          variant === "secondary" &&
            "bg-[var(--surface-muted)] text-[var(--foreground)] border border-[var(--border-strong)] shadow-xs hover:bg-[var(--surface)]",
          variant === "ghost" &&
            "bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
          variant === "danger" &&
            "bg-[var(--live)] text-white shadow-xs hover:brightness-110",
          variant === "outline" &&
            "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-none hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]",
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
