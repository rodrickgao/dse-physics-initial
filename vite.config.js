import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { copyFileSync, cpSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

function copyStudyAssets() {
  return {
    name: "copy-study-assets",
    closeBundle() {
      const root = process.cwd();
      const output = resolve(root, "dist");
      mkdirSync(output, { recursive: true });
      [
        "site-data.js", "textbook-data.js", "knowledge-network-data.js",
        "paper2-knowledge-data.js", "statistics-data.js", "mistake-pdf.js", "og.png",
      ].forEach((file) => copyFileSync(resolve(root, file), resolve(output, file)));
      cpSync(resolve(root, "assets"), resolve(output, "assets"), { recursive: true });
      const catalog = JSON.parse(readFileSync(resolve(root, 'downloads/catalog.json'), 'utf8'));
      mkdirSync(resolve(output, 'downloads'), { recursive: true });
      copyFileSync(resolve(root, 'downloads/catalog.json'), resolve(output, 'downloads/catalog.json'));
      for (const file of catalog.files) {
        if (file.kind !== 'paper' || file.edition !== 'original') throw new Error('Worked papers must not be published');
        if (!/^downloads\/(?:originals\/(?:eng|chn)\/20\d{2}-paper-(?:1a|1b|2)|(?:eng|chn)\/knowledge)\.pdf$/.test(file.url)) throw new Error('Invalid download path');
        mkdirSync(dirname(resolve(output, file.url)), { recursive: true });
        copyFileSync(resolve(root, file.url), resolve(output, file.url));
      }
      cpSync(resolve(root, "vendor"), resolve(output, "vendor"), { recursive: true });
      cpSync(resolve(root, "text-papers"), resolve(output, "text-papers"), { recursive: true });
    },
  };
}

export default defineConfig({
  base: "./",
  server: { host: "127.0.0.1", fs: { deny: [".env", ".env.*", "**/.git/**", "**/.local/**", "**/server/**", "**/*.sqlite*", "**/*.pem", "**/*.key"] } },
  resolve: { alias: { "@dse/localized/jsx-runtime": resolve(process.cwd(), "src/lib/localized-jsx-runtime.js"), "@dse/localized/jsx-dev-runtime": resolve(process.cwd(), "src/lib/localized-jsx-runtime.js") } },
  plugins: [react({ jsxImportSource: "@dse/localized" }), tailwindcss(), copyStudyAssets()],
  build: {
    rollupOptions: { input: { main: resolve(process.cwd(), 'index.html'), admin: resolve(process.cwd(), 'admin.html') } },
    outDir: "dist",
    emptyOutDir: true,
  },
});
