import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'prompt',
			includeAssets: ['favicon.svg', 'icons/*.png'],
			kit: { adapterFallback: 'index.html', spa: true },
			manifest: {
				name: 'Ledgerly — personal finance',
				short_name: 'Ledgerly',
				description:
					'Calm, local-first personal finance. Multi-currency (LKR/USD/AUD), no bank linking.',
				theme_color: '#2a7f6f',
				background_color: '#faf9f7',
				display: 'standalone',
				start_url: '/',
				scope: '/',
				categories: ['finance', 'productivity'],
				icons: [
					{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
					{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
					{
						src: '/icons/icon-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable',
					},
				],
			},
			workbox: {
				// The SPA fallback document is the offline entry point for every route.
				navigateFallback: '/index.html',
				globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
				cleanupOutdatedCaches: true,
			},
			devOptions: { enabled: false },
		}),
	],
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
		// Component tests opt into jsdom with a `// @vitest-environment jsdom` pragma.
	},
});
