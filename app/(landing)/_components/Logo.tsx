import { Poppins } from "next/font/google";
import { cn } from "@/lib/utils";

const font = Poppins({
  subsets: ["latin"],
  weight: ["700"],
});

export const Logo = () => {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-black shadow-sm">
        Tx
      </div>
      <p className={cn("text-base font-bold tracking-tight", font.className)}>Texxel</p>
    </div>
  );
};
