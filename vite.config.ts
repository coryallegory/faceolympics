import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

function getBuildId(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify(getBuildId()),
  },
});
