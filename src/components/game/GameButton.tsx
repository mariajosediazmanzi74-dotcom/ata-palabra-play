import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const gameButton = cva("btn-game", {
  variants: {
    tone: {
      pink: "tone-pink",
      lilac: "tone-lilac",
      sun: "tone-sun",
      sky: "tone-sky",
      mint: "tone-mint",
      tangerine: "tone-tangerine",
      plum: "tone-plum",
    },
    size: {
      sm: "h-10 px-4 text-xs [&_svg]:size-4",
      md: "min-h-12 px-4 py-2 text-[0.8rem] sm:text-sm [&_svg]:size-5",
      lg: "h-14 px-7 text-base md:text-lg [&_svg]:size-6",
      xl: "h-16 px-10 text-xl md:h-20 md:px-14 md:text-2xl [&_svg]:size-7",
      icon: "size-11 p-0 [&_svg]:size-5",
    },
  },
  defaultVariants: { tone: "pink", size: "md" },
});

export interface GameButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof gameButton> {
  icon?: ReactNode;
}

export const GameButton = forwardRef<HTMLButtonElement, GameButtonProps>(
  ({ tone, size, icon, className, children, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(gameButton({ tone, size }), className)} {...props}>
      {icon}
      {children}
    </button>
  ),
);
GameButton.displayName = "GameButton";
