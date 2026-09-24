import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 75 is Next's default for every image. 90 is allowed for the full-screen
    // farm photographs only, where a second lossy pass at 75 on an already
    // compressed JPEG visibly softened them.
    qualities: [75, 90],
  },
};

export default nextConfig;
