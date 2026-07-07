import * as React from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  text: string;
  className?: string;
}

// Tooltip minimo con CSS (group-hover), sin JS ni dependencias nuevas.
// Usar junto a una etiqueta tecnica (SDK, score de ofuscacion, severidad)
// para explicar que significa, en vez de dejar que el usuario tenga que
// adivinarlo o preguntarle a alguien.
function Tooltip({ text, className }: TooltipProps) {
  return (
    <span className={cn("group relative inline-flex items-center", className)}>
      <HelpCircle
        size={14}
        className="cursor-help text-on-surface-variant hover:text-primary"
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded bg-surface-container-highest p-2 text-xs font-normal text-on-surface opacity-0 shadow-lg outline outline-1 outline-outline-variant transition-opacity duration-150 group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export { Tooltip };
