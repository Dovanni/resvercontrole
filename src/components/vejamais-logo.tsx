import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  size?: number;
  showWordmark?: boolean;
  showTagline?: boolean;
  wordmarkClassName?: string;
  taglineClassName?: string;
};

export function VejamaisMark({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role="img"
      aria-label="VEJAMAIS ERP"
    >
      <defs>
        <linearGradient id="vjm-mark-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22C55E" />
          <stop offset="100%" stopColor="#16A34A" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#vjm-mark-bg)" />
      <path d="M16 18 L32 46 L48 18 L41.5 18 L32 34.5 L22.5 18 Z" fill="#FFFFFF" />
      <circle cx="47" cy="20" r="3.2" fill="#FFFFFF" fillOpacity="0.9" />
    </svg>
  );
}

export function VejamaisLogo({
  className,
  size = 40,
  showWordmark = true,
  showTagline = false,
  wordmarkClassName,
  taglineClassName,
}: Props) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <VejamaisMark size={size} className="rounded-xl shadow-glow" />
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span className={cn("font-display text-2xl tracking-tight text-foreground", wordmarkClassName)}>
            VEJAMAIS ERP
          </span>
          {showTagline && (
            <span
              className={cn(
                "mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
                taglineClassName,
              )}
            >
              Gestão Comercial e Financeira
            </span>
          )}
        </div>
      )}
    </div>
  );
}
