import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.magnexis.maps",
  appName: "Magnexis Maps",
  webDir: "www",
  backgroundColor: "#07111F",
  ios: {
    contentInset: "never",
    preferredContentMode: "mobile",
    scrollEnabled: false,
  },
  plugins: {
    // Use native networking for API requests from the bundled local origin.
    CapacitorHttp: { enabled: true },
  },
};

export default config;
