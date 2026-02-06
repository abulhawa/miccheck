type ButtonVariant = "primary" | "secondary";

interface ButtonStyleOptions {
  variant?: ButtonVariant;
  className?: string;
}

const baseButtonStyles =
  "inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50";

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 text-white shadow-sm hover:bg-blue-500 active:bg-blue-700",
  secondary: "border border-white/20 text-white/90 hover:bg-white/5"
};

export function buttonStyles({ variant = "primary", className = "" }: ButtonStyleOptions = {}) {
  return `${baseButtonStyles} ${variantStyles[variant]} ${className}`.trim();
}

