import { Logo } from "./Logo";

export const Footer = () => {
  return (
    <footer className="border-t bg-background/50 px-6 py-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
        <Logo />
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} A2E Thread. All rights reserved.
        </p>
      </div>
    </footer>
  );
};
