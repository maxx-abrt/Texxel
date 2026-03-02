import { Navbar } from "./_components/Navbar";

const LandingLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main style={{ paddingTop: "58px" }}>{children}</main>
    </div>
  );
};
export default LandingLayout;
