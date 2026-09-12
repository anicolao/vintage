import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import { firebaseSettings } from './src/lib/firebase-config.mjs';

export default defineConfig(({ mode }) => ({
  plugins: [sveltekit(), {
    name: 'require-firebase-configuration',
    buildStart() { firebaseSettings({ ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }); }
  }]
}));
