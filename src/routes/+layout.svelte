<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import ConnectionStatus from '$lib/ui/ConnectionStatus.svelte';
	import PwaStatus from '$lib/ui/PwaStatus.svelte';

	let { children } = $props();

	const links = [
		{ href: '/', label: 'Home' },
		{ href: '/transactions', label: 'Transactions' },
		{ href: '/accounts', label: 'Accounts' },
		{ href: '/import', label: 'Import' },
		{ href: '/budgets', label: 'Budgets' },
		{ href: '/bills', label: 'Bills' },
		{ href: '/settings', label: 'Settings' },
	];

	function active(href: string): boolean {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}
</script>

<div class="min-h-screen">
	<a
		href="#main"
		class="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow"
		>Skip to content</a
	>
	<ConnectionStatus />
	<header class="border-b border-line bg-surface">
		<div class="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
			<a href="/" class="flex items-center gap-2 font-semibold">
				<img src="/favicon.svg" alt="" class="h-6 w-6" />
				Ledgerly
			</a>
			<nav class="flex flex-wrap gap-4 text-sm">
				{#each links as link (link.href)}
					<a
						href={link.href}
						class="pb-0.5 {active(link.href)
							? 'border-b-2 border-accent text-ink'
							: 'text-ink-soft hover:text-ink'}">{link.label}</a
					>
				{/each}
			</nav>
		</div>
	</header>
	<main id="main" tabindex="-1" class="mx-auto max-w-5xl px-4 py-8">
		{@render children()}
	</main>
	<footer class="mx-auto max-w-5xl px-4 pb-10 text-xs text-ink-soft">
		Your money, on your device. No bank linking, no accounts, no tracking.
	</footer>
	<PwaStatus />
</div>
