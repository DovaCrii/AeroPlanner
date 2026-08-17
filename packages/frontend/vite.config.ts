import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { execSync } from "child_process";
import { readFileSync } from "fs";

const commitSha = (() => {
  if (process.env.COMMIT_SHA) return process.env.COMMIT_SHA;
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
})();

const appVersion = (() => {
  try {
    const pkg = JSON.parse(
      readFileSync(path.resolve(__dirname, "../../package.json"), "utf-8"),
    );
    return pkg.version;
  } catch {
    return "dev";
  }
})();

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __COMMIT_SHA__: JSON.stringify(commitSha),
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // npm hoists @vis.gl/react-maplibre to the workspace root but keeps
      // maplibre-gl inside this package, so the library cannot resolve its own
      // peer dependency by walking up node_modules. Pinning the path here
      // makes every "maplibre-gl" import — ours and the library's — land on
      // the single installed copy.
      "maplibre-gl": path.resolve(__dirname, "./node_modules/maplibre-gl"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
