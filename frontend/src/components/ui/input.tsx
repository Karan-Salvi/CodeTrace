import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "sm" | "lg";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex w-full bg-canvas text-ink border border-hairline rounded-sm px-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
          {
            "h-[40px] text-[14px]": variant === "default",
            "h-[32px] text-[14px]": variant === "sm",
            "h-[48px] text-[16px]": variant === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
