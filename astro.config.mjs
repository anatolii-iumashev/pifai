import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import { remarkStripMdLinks } from "./src/remark-strip-md-links.mjs";

const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === "true";

const SITE_URL = process.env.CNAME
  ? `https://${process.env.CNAME}`
  : "https://anatolii-iumashev.github.io/pif";

  // Use /pif only for GitHub Pages CI builds; keep local dev/preview on root.
const BASE = process.env.CNAME ? "/" : (isGitHubPagesBuild ? "/pif" : "/");

export default defineConfig({
  site: SITE_URL,
  base: BASE,

  markdown: {
    remarkPlugins: [remarkStripMdLinks],
  },

  integrations: [
    starlight({
      title: "ПиФ — Бот + БЗ",
      description: "База знаний по психологии и философии. Чат-бот психотерапевт.",
      sidebar: [
        {
          label: "1. База и вводные",
          collapsed: false,
          items: [{ autogenerate: { directory: "basics" } }],
        },
        {
          label: "2. Проблематика и Use cases",
          collapsed: true,
          items: [{ autogenerate: { directory: "use-cases" } }],
        },
        {
          label: "3. Практики и техники",
          collapsed: true,
          items: [{ autogenerate: { directory: "practices" } }],
        },
        {
          label: "4. Цитаты великих людей",
          collapsed: true,
          items: [{ autogenerate: { directory: "quotes" } }],
        },
        {
          label: "5. Авторы и школы",
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
          label: "6. Классификация и типология",
          collapsed: true,
          items: [{ autogenerate: { directory: "typology" } }],
        },
        {
          label: "7. Дополнения",
          collapsed: true,
          items: [{ autogenerate: { directory: "addons" } }],
        },
      ],

      head: [
        {
          tag: "link",
          attrs: {
            rel: "icon",
            type: "image/png",
            href: "/favicon.png",
          },
        },
      ],
      components: {
        Sidebar: "starlight-theme-obsidian/overrides/Sidebar.astro",
        PageFrame: "starlight-theme-obsidian/overrides/PageFrame.astro",
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
        baseUrl: 'https://github.com/anatolii-iumashev/pif/tree/main',
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/anatolii-iumashev/pif",
        },
      ],

    }),
  ],
});
