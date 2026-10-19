<script lang="ts">
	const modules = [
		{ name: 'engine', stage: 'Stage 2', status: 'contracts frozen, implementation in flight' },
		{ name: 'import', stage: 'Stage 2', status: 'contracts frozen, implementation in flight' },
		{ name: 'storage', stage: 'Stage 2', status: 'contracts frozen, implementation in flight' },
		{ name: 'ui (this page)', stage: 'Stage 3', status: 'scaffold placeholder' },
	];
</script>

<main class="mx-auto max-w-2xl px-4 py-16">
	<div class="rounded-card bg-surface p-8 shadow-sm ring-1 ring-line">
		<div class="flex items-center gap-3">
			<img src="/favicon.svg" alt="" class="h-9 w-9" />
			<h1 class="text-2xl font-semibold">Ledgerly</h1>
		</div>
		<p class="mt-3 text-ink-soft">
			Calm, local-first personal finance for simpler households. Multi-currency (LKR / USD / AUD),
			no bank linking — your data stays on your device.
		</p>
		<p class="mt-3 text-sm text-ink-soft">
			Stage 0 scaffold is live. The dashboard replaces this page in Stage 3.
		</p>
		<ul class="mt-6 space-y-2">
			{#each modules as m (m.name)}
				<li class="flex items-baseline justify-between gap-4 border-b border-line pb-2 text-sm">
					<span class="font-mono">{m.name}</span>
					<span class="text-ink-soft">{m.stage} — {m.status}</span>
				</li>
			{/each}
		</ul>
	</div>
</main>
