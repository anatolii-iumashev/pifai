/**
 * Remark plugin: strips `.md` and `.mdx` from relative links, adjusts path depth,
 * and adds target="_blank" to external links.
 *
 * Starlight resolves `/foo/bar.md` → route `/foo/bar/` (adds one directory level),
 * so a relative link `[link](./page.md)` from `bar.md` or `bar.mdx` would resolve to
 * `/foo/bar/page` instead of `/foo/page`. This plugin:
 *   1. Strips the `.md` and `.mdx` extension
 *   2. Prepends `../` for non-index.md pages (to undo the extra depth)
 *   3. Adds target="_blank" rel="noopener noreferrer" to external links
 *
 * Examples (from `woocommerce/getting-started.md` or `.mdx`):
 *   - `./products.md`    → `../products`
 *   - `./dir/index.md`   → `../dir/`
 *
 * Examples (from `woocommerce/index.md` — no depth adjustment needed):
 *   - `./products.md`    → `./products`
 *   - `./store-pages.md` → `./store-pages`
 *
 * External links:
 *   - `[Example](https://example.com)` → adds target="_blank" rel="noopener noreferrer"
 *
 * Rule for source .md and .mdx files:
 *   ALWAYS write links with the source file extension (`.md` or `.mdx`) — VS Code & GitHub need it.
 *   This plugin strips it at build time so the production site works.
 *
 * - Affects relative links ending in `.md` or `.mdx` → strips extension and adjusts depth
 * - Affects external (http/https) links → adds target="_blank"
 * - Leaves anchor-only links (#section) untouched
 * - Leaves other relative links untouched
 */

import { visit } from "unist-util-visit";

export function remarkStripMdLinks() {
  return (tree, file) => {
    // Starlight turns `foo.md` → `foo/index.html` (served at `/foo/`),
    // adding one level of directory depth. Relative links from such pages
    // must go up one extra level. `index.md` pages don't need adjustment.
    const filePath = file.path || (file.history && file.history[0]) || "";
    const isNotIndex = filePath
      ? !/\/index\.mdx?$/.test(filePath) && !/\\index\.mdx?$/.test(filePath)
      : false; // safe fallback: don't adjust depth if we can't determine file type

    visit(tree, "link", (node) => {
      const url = node.url;
      if (!url) return;

      // External links: open in new tab with security attributes
      if (/^https?:\/\//i.test(url)) {
        const data = node.data || (node.data = {});
        const props = data.hProperties || (data.hProperties = {});
        props.target = "_blank";
        props.rel = "noopener noreferrer";
        return;
      }

      // Skip anchor-only links
      if (url.startsWith("#")) return;
      // Skip non-.md links
      if (!/\.mdx?$/.test(url)) return;

      let newUrl;

      // Strip `index.md` entirely (keeping the trailing /)
      if (/\/index\.mdx?$/.test(url)) {
        newUrl = url.replace(/index\.mdx?$/, "");
      } else {
        // Strip the .md extension
        newUrl = url.replace(/\.mdx?$/, "");
      }

      // For non-index files: account for the extra directory depth
      // that Astro/Starlight introduces (foo.md → /foo/ route).
      // ./products.md → ../products,  ../x.md → ../../x, etc.
      if (isNotIndex && !newUrl.startsWith("/")) {
        // Strip leading ./ if present, then prepend ../
        newUrl = "../" + newUrl.replace(/^\.\//, "");
      }

      node.url = newUrl;
    });
  };
}
