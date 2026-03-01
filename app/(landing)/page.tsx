import { Heading } from "./_components/Heading";
import { Features } from "./_components/Features";
import { Footer } from "./_components/Footer";

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-24 pb-20 text-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,hsl(var(--primary)/0.12),transparent)]" />
        <Heading />
      </section>

      {/* Features */}
      <section className="flex justify-center px-6 pb-24">
        <Features />
      </section>

      <Footer />
    </div>
  );
}
