import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "primary-sm" | "secondary-sm" | "icon-circular" | "ghost" | "danger" | "danger-sm";
  // Renders as the single child element (e.g. a react-router <Link>)
  // with this button's props/classes merged onto it, instead of
  // wrapping it in a literal <button> — DashboardTopbar.tsx's
  // `<Button asChild><Link>...</Link></Button>` needs this: without it,
  // asChild leaked through to the DOM as an unknown attribute AND the
  // <Link>'s <a> ended up nested inside a real <button>, which is
  // invalid HTML (interactive element inside interactive element).
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
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
            "bg-error text-white hover:bg-error/90 text-[16px] font-medium leading-[24px] rounded-pill px-[16px] h-[48px]": variant === "danger",
            "bg-error text-white hover:bg-error/90 text-[14px] font-medium leading-[20px] rounded-pill px-[12px] h-[32px]": variant === "danger-sm",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
