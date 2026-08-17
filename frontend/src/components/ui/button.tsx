import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "primary-sm" | "secondary-sm" | "icon-circular" | "ghost";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
          {
            "bg-primary text-on-primary text-[16px] font-medium leading-[24px] rounded-pill px-[12px] h-[48px]": variant === "primary",
            "bg-canvas text-ink text-[16px] font-medium leading-[24px] rounded-pill px-[12px] h-[48px] border border-hairline": variant === "secondary",
            "bg-primary text-on-primary text-[14px] font-medium leading-[20px] rounded-pill px-[8px] h-[32px]": variant === "primary-sm",
            "bg-canvas text-ink text-[14px] font-medium leading-[20px] rounded-pill px-[8px] h-[32px] border border-hairline": variant === "secondary-sm",
            "bg-canvas text-ink border border-hairline rounded-full w-[32px] h-[32px]": variant === "icon-circular",
            "text-body hover:text-ink text-[14px] font-medium leading-[20px] rounded-full px-[8px] h-[32px] hover:bg-canvas-soft": variant === "ghost",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
