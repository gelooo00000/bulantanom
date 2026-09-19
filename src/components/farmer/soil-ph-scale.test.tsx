import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SoilPhScale, readingVerdict } from "@/components/farmer/soil-ph-scale";
import type { SoilReadingHistory } from "@/lib/api/dashboard-api";

/**
 * The case that prompted this rewrite is the first test below: two readings
 * recorded on the same day, which the old time plot rendered as an axis
 * running from "Sep 14" to "Sep 14". A scale has no such failure mode, and
 * it answers the question the dots never did — whether the number is good.
 */

function reading(id: number, date: string, ph: number | null): SoilReadingHistory {
  return { id, date, ph, moisture: "moist", moisture_rank: 4 };
}

describe("readingVerdict", () => {
  it("names each band the way soil chemistry does", () => {
    expect(readingVerdict(4.9).label).toBe("Strongly acidic");
    expect(readingVerdict(5.8).label).toBe("Slightly acidic");
    expect(readingVerdict(6.5).label).toBe("Ideal for most crops");
    expect(readingVerdict(7.2).label).toBe("Slightly alkaline");
    expect(readingVerdict(8.9).label).toBe("Strongly alkaline");
  });

  it("puts the band edges on the right side", () => {
    expect(readingVerdict(6.0).label).toBe("Ideal for most crops");
    expect(readingVerdict(7.0).label).toBe("Ideal for most crops");
    expect(readingVerdict(5.99).label).toBe("Slightly acidic");
    expect(readingVerdict(7.01).label).toBe("Slightly alkaline");
  });

  it("explains what goes wrong, not just that something is wrong", () => {
    expect(readingVerdict(8.9).detail).toMatch(/iron, zinc and phosphorus lock up/);
    expect(readingVerdict(4.9).detail).toMatch(/aluminium/);
  });
});

describe("SoilPhScale", () => {
  it("handles two readings taken on the same day", () => {
    // The old time plot drew an axis from "Sep 14" to "Sep 14" here.
    render(
      <SoilPhScale
        ph={8.9}
        recordedOn="2026-09-14"
        history={[
          reading(1, "2026-09-14", 8.4),
          reading(2, "2026-09-14", 8.9),
        ]}
      />,
    );
    expect(screen.getByText(/· Strongly alkaline/)).toBeInTheDocument();
    expect(screen.getByText(/Up 0.5 from pH 8.4 on Sep 14/)).toBeInTheDocument();
  });

  it("says where the reading sits, in words as well as position", () => {
    render(<SoilPhScale ph={6.4} recordedOn="2026-09-10" history={[]} />);
    expect(screen.getByText("pH 6.4")).toBeInTheDocument();
    expect(screen.getByText(/· Ideal for most crops/)).toBeInTheDocument();
  });

  it("describes the whole scale for a screen reader", () => {
    render(<SoilPhScale ph={8.9} recordedOn="2026-09-14" history={[]} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Soil pH 8.9, strongly alkaline. Most vegetables prefer 6 to 7.",
    );
  });

  it("reports the direction of change against the previous reading", () => {
    render(
      <SoilPhScale
        ph={6.1}
        recordedOn="2026-09-10"
        history={[reading(1, "2026-06-02", 6.8), reading(2, "2026-09-10", 6.1)]}
      />,
    );
    expect(screen.getByText(/Down 0.7 from pH 6.8 on Jun 2/)).toBeInTheDocument();
  });

  it("says unchanged rather than showing a zero move", () => {
    render(
      <SoilPhScale
        ph={6.5}
        recordedOn="2026-09-10"
        history={[reading(1, "2026-06-02", 6.5), reading(2, "2026-09-10", 6.5)]}
      />,
    );
    expect(screen.getByText(/Unchanged from your reading on Jun 2/)).toBeInTheDocument();
  });

  it("omits the comparison when there is only one reading", () => {
    render(
      <SoilPhScale
        ph={6.5}
        recordedOn="2026-09-10"
        history={[reading(1, "2026-09-10", 6.5)]}
      />,
    );
    expect(screen.queryByText(/from pH/)).not.toBeInTheDocument();
  });

  it("marks the ideal band so the number does not have to be interpreted", () => {
    render(<SoilPhScale ph={6.4} recordedOn="2026-09-10" history={[]} />);
    expect(screen.getByText(/Green band is pH 6–7/)).toBeInTheDocument();
  });

  it("keeps an off-scale reading visible instead of clipping it away", () => {
    // A reading below the drawn minimum still has to render somewhere real.
    render(<SoilPhScale ph={3.1} recordedOn="2026-09-10" history={[]} />);
    expect(screen.getByText("pH 3.1")).toBeInTheDocument();
    expect(screen.getByText(/· Strongly acidic/)).toBeInTheDocument();
  });
});
