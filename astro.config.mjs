import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import { remarkStripMdLinks } from "./src/remark-strip-md-links.mjs";

const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === "true";

const SITE_URL = process.env.CNAME
  ? `https://${process.env.CNAME}`
  : "https://aa.github.io/pl-chat";

// Use /pl-chat only for GitHub Pages CI builds; keep local dev/preview on root.
const BASE = process.env.CNAME ? "/" : (isGitHubPagesBuild ? "/pl-chat" : "/");

export default defineConfig({
  site: SITE_URL,
  base: BASE,

  markdown: {
    remarkPlugins: [remarkStripMdLinks],
  },

  integrations: [
    starlight({
      title: "База знаний pl-chat",
      description: "Психологический чат-бот: ННО, юнгианство, логотерапия, MBTI, интегральный подход и практические техники.",
      sidebar: [
        {
          label: "MBTI — Типология",
          collapsed: true,
          items: [{ autogenerate: { directory: "mbti" } }],
        },
        {
          label: "Ненасильственное общение (ННО)",
          collapsed: false,
          items: [{ autogenerate: { directory: "nvc" } }],
        },
        {
          label: "Юнгианская психология",
          collapsed: true,
          items: [{ autogenerate: { directory: "jung" } }],
        },
        {
          label: "Логотерапия Франкла",
          collapsed: true,
          items: [{ autogenerate: { directory: "frankl" } }],
        },
        {
          label: "Интегральная теория Уилбера",
          collapsed: true,
          items: [{ autogenerate: { directory: "wilber" } }],
        },
        {
          label: "Процессуальная психология Минделла",
          collapsed: true,
          items: [{ autogenerate: { directory: "mindell" } }],
        },
        {
          label: "Методология Адизеса",
          collapsed: true,
          items: [{ autogenerate: { directory: "adizes" } }],
        },
        {
          label: "Психологическое айкидо Литвака",
          collapsed: true,
          items: [{ autogenerate: { directory: "litvak" } }],
        },
        {
          label: "Интеграция подходов",
          collapsed: true,
          items: [{ autogenerate: { directory: "integral" } }],
        },
        {
          label: "Техники и упражнения",
          collapsed: true,
          items: [{ autogenerate: { directory: "techniques" } }],
        },
        {
          label: "FAQ",
          collapsed: true,
          items: [{ autogenerate: { directory: "faq" } }],
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
        baseUrl: 'https://github.com/anatolii-iumashev/pl-chat/tree/main',
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/anatolii-iumashev/pl-chat",
        },
      ],

    }),
  ],
});
