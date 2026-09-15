import { cn } from "@/lib/utils";

type LogoMarkProps = {
  className?: string;
  title?: string;
};

/** Waveform C — C-arc with 3 audio bars. Sharp at 14–28px. */
export function LogoMark({ className, title }: LogoMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={cn("shrink-0", className)}
    >
      {title ? <title>{title}</title> : null}
      {/* C-shaped arc (scaled from approved 32×32 mark) */}
      <path
        d="M18 4.875c-3.375-1.95-7.65-1.275-10.2 1.575C5.025 9.75 5.175 14.55 8.025 17.325c2.625 2.625 6.75 3.075 9.9 1.05"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      {/* Three vertical waveform bars in the opening */}
      <path
        d="M9.75 8.25v7.5M12.375 6.75v10.5M15 9.375v5.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
