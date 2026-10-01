import { Hero } from "@/components/marketing/hero";

export default function Home() {
  return (
    // The landing-* theme class is applied to <html> by the theme provider,
    // so this only needs to paint the canvas behind the photograph.
    <div className="flex flex-1 flex-col" style={{ background: "var(--landing-bg)" }}>
      <Hero />
    </div>
  );
}
