/**
 * A slowly scrolling ribbon of crops BulanTanom tracks — a friendly signal
 * that the farm's own crops are in the catalog. Pure CSS (see
 * `.crop-marquee` in globals.css): it pauses on hover and stands still for
 * reduced-motion users. Decorative, so screen readers get one sentence.
 */
const CROPS = [
  ["🍍", "Pineapple"],
  ["🥭", "Mango"],
  ["🍌", "Banana"],
  ["🍆", "Eggplant"],
  ["🌽", "Corn"],
  ["🥬", "Pechay"],
  ["🍠", "Ube"],
  ["🍄", "Mushroom"],
  ["🥥", "Coconut"],
  ["🍫", "Cacao"],
  ["🍈", "Papaya"],
  ["🌿", "Lemongrass"],
  ["🥒", "Okra"],
  ["🍉", "Watermelon"],
] as const;

export function CropMarquee() {
  return (
    <section className="pt-16 md:pt-24">
      <p className="text-muted-foreground px-6 text-center text-sm">
        Tracks the crops grown around Bulan, and their varieties
      </p>
      <p className="sr-only">
        Includes pineapple, mango, banana, eggplant, corn, pechay, ube, mushroom, coconut,
        cacao, papaya, lemongrass, okra and watermelon.
      </p>
      <div
        aria-hidden="true"
        className="crop-marquee mt-5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]"
      >
        {/* Two identical rows, each ending in the same gap, so moving by
            exactly half the track loops without a seam. */}
        <div className="crop-marquee-track flex w-max">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex gap-3 pr-3">
              {CROPS.map(([emoji, name]) => (
                <span
                  key={name}
                  className="text-foreground flex items-center gap-2 rounded-full border px-4 py-2 text-sm whitespace-nowrap"
                  style={{
                    background: "var(--landing-surface)",
                    borderColor: "var(--landing-border)",
                  }}
                >
                  <span className="text-lg">{emoji}</span>
                  {name}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
