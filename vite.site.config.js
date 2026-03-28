import { defineConfig } from "vite";

// Site build — builds the docs/demo page as a static site
export default defineConfig({
  base: "/heerich/",
  build: {
    outDir: "dist-site",
  },
});
