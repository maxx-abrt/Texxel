import type { Middleware } from "@floating-ui/react";
import { flip, offset, shift, size, limitShift } from "@floating-ui/react";

/**
 * Shared FloatingUI options for BlockNote SuggestionMenuController instances.
 *
 * Improvements over BlockNote defaults:
 * - `flip` picks the side (top/bottom) with the most available space
 * - `shift` with `limitShift` keeps the menu near the cursor without clipping
 * - `size` constrains both max-height and max-width to available viewport space
 * - Tighter offset (8px) for a cleaner gap between cursor and menu
 */
export const suggestionMenuFloatingUIOptions = {
  useFloatingOptions: {
    placement: "bottom-start" as const,
    middleware: [
      offset(8),
      flip({ padding: 12 }),
      shift({
        padding: 12,
        limiter: limitShift({ offset: 8 }),
      }),
      size({
        padding: 12,
        apply({ elements, availableHeight, availableWidth }: {
          elements: { floating: HTMLElement };
          availableHeight: number;
          availableWidth: number;
        }) {
          elements.floating.style.maxHeight = `${Math.max(120, availableHeight)}px`;
          elements.floating.style.maxWidth = `${Math.min(360, Math.max(280, availableWidth))}px`;
        },
      }),
    ] as Middleware[],
  },
  elementProps: {
    onMouseDownCapture: (event: React.MouseEvent) => event.preventDefault(),
    style: {
      zIndex: 80,
    },
  },
};
