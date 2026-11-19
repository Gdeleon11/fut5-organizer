import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/__tests__/**/*.test.{js,jsx}"],
    exclude: ["node_modules", "dist", "e2e"],
  },
});
