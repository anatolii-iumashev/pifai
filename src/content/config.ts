import { docsLoader } from "@astrojs/starlight/content-loaders";
import { defineCollection } from "astro:content";

export const collections = {
  docs: defineCollection({ loader: docsLoader() }),
};
