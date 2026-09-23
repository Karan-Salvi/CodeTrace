import { BrandLogo } from "./BrandLogo";

// Small square logo mark used in the landing/login header + footer —
// shared so both pages stay visually identical instead of drifting.
export function BrandMark() {
  return (
    <span className="grid size-7 place-items-center rounded-sm border border-hairline bg-ink text-canvas">
      <BrandLogo className="size-4" />
    </span>
  );
}
