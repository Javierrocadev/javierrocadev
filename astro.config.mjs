// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

import sanity from "@sanity/astro";

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    sanity({
      projectId: "oq1tmoti",
      dataset: "production",
      useCdn: false,
    }),
  ],
});
