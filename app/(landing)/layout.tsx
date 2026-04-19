import { Navbar } from "./_components/Navbar";
import { AuthRedirect } from "./_components/AuthRedirect";
import { Noise } from "@/components/ui/noise";

const LandingLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative min-h-screen bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-[#f0f0ee] antialiased overflow-x-hidden">
      {/* Global film-grain — single static canvas pinned behind every section */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ mixBlendMode: "overlay", opacity: 0.5 }}
      >
        <Noise patternSize={256} patternAlpha={20} />
      </div>
      <AuthRedirect />
      <Navbar />
      <main style={{ paddingTop: "64px" }}>{children}</main>
    </div>
  );
};
export default LandingLayout;
