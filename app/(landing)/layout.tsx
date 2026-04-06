import { Navbar } from "./_components/Navbar";

const LandingLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
      <Navbar />
      <main style={{ paddingTop: "56px" }}>{children}</main>
    </div>
  );
};
export default LandingLayout;
