import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import { remarkStripMdLinks } from "./src/remark-strip-md-links.mjs";

const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === "true";

const SITE_URL = process.env.CNAME
  ? `https://${process.env.CNAME}`
  : "https://anatolii-iumashev.github.io/pifai";

  // Use /pifai only for GitHub Pages CI builds; keep local dev/preview on root.
const BASE = process.env.CNAME ? "/" : (isGitHubPagesBuild ? "/pifai" : "/");

export default defineConfig({
  site: SITE_URL,
  base: BASE,

  markdown: {
    remarkPlugins: [remarkStripMdLinks],
  },

  integrations: [
    starlight({
      title: "Pifai",
      description: "Психология и философия + БЗ + ИИ",
      favicon: "/yin-yang.png",
      sidebar: [
        {
          label: "База и вводные",
          collapsed: false,
          items: [{ autogenerate: { directory: "basics" } }],
        },
        {
          label: "Проблематика и Use cases",
          collapsed: true,
          items: [{ autogenerate: { directory: "use-cases" } }],
        },
        {
          label: "Практики и техники",
          collapsed: true,
          items: [{ autogenerate: { directory: "practices" } }],
        },
        {
          label: "Цитаты великих людей",
          collapsed: true,
          items: [{ autogenerate: { directory: "quotes" } }],
        },
        {
          label: "Авторы и школы",
          collapsed: true,
          items: [
            {
              label: "Маршалл Розенберг (ННО)",
              collapsed: true,
              items: [{ autogenerate: { directory: "authors/rosenberg" } }],
            },
            {
              label: "Юнгианская психология",
              collapsed: true,
              items: [{ autogenerate: { directory: "authors/jung" } }],
            },
            {
              label: "Логотерапия Франкла",
              collapsed: true,
              items: [{ autogenerate: { directory: "authors/frankl" } }],
            },
            {
              label: "Интегральная теория Уилбера",
              collapsed: true,
              items: [{ autogenerate: { directory: "authors/wilber" } }],
            },
            {
              label: "Процессуальная психология Минделла",
              collapsed: true,
              items: [{ autogenerate: { directory: "authors/mindell" } }],
            },
            {
              label: "Методология Адизеса",
              collapsed: true,
              items: [{ autogenerate: { directory: "authors/adizes" } }],
            },
            {
              label: "Психологическое айкидо Литвака",
              collapsed: true,
              items: [{ autogenerate: { directory: "authors/litvak" } }],
            },
          ],
        },
        {
          label: "Классификация и типология",
          collapsed: true,
          items: [{ autogenerate: { directory: "typology" } }],
        },
        {
          label: "Дополнения",
          collapsed: true,
          items: [{ autogenerate: { directory: "addons" } }],
        },
        {
          label: "Глоссарий",
          collapsed: true,
          items: [{ autogenerate: { directory: "glossary" } }],
        },
      ],

      head: [
        {
          tag: "meta",
          attrs: { name: "pifai-build-id", content: process.env.RAG_BUILD_ID ?? "development" },
        },
      ],
      components: {
        SiteTitle: "./src/components/SiteTitle.astro",
        Sidebar: "starlight-theme-obsidian/overrides/Sidebar.astro",
        PageFrame: "./src/components/PageFrame.astro",
        PageSidebar: "./src/components/PageSidebar.astro",
        Pagination: "starlight-theme-obsidian/overrides/Pagination.astro",
        ThemeSelect: "starlight-theme-obsidian/overrides/ThemeSelect.astro",
      },
      customCss: [
        "starlight-theme-obsidian/styles/layers.css",
        "starlight-theme-obsidian/styles/theme.css",
        "starlight-theme-obsidian/styles/centered-reading.css",
        "starlight-theme-obsidian/styles/common.css",
      ],
      locales: {
        root: { label: "Русский", lang: "ru" },
      },
      editLink: {
        baseUrl: 'https://github.com/anatolii-iumashev/pifai/tree/main',
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/anatolii-iumashev/pifai",
        },
      ],

    }),
  ],
});
