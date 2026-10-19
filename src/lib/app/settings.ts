import type { LedgerRepository } from '$lib/engine/repository';
import type { FxRateTable } from '$lib/engine/types';
import { todayIso } from '$lib/engine/util';

/** App-level settings keys (the repository keeps them as simple key-value). */
export const BASE_CURRENCY_KEY = 'baseCurrency';
export const FX_RATES_KEY = 'fxRates';

export const SUPPORTED_DISPLAY_CURRENCIES = ['LKR', 'USD', 'AUD', 'EUR', 'GBP', 'INR'] as const;

export async function getBaseCurrency(repo: LedgerRepository): Promise<string> {
	return (await repo.getSetting<string>(BASE_CURRENCY_KEY)) ?? 'LKR';
}

export async function setBaseCurrency(repo: LedgerRepository, code: string): Promise<void> {
	await repo.putSetting(BASE_CURRENCY_KEY, code);
}

/**
 * FX rates are explicit and dated (never guessed). Missing rates surface in
 * reports via missingRates; the Settings page is where the user enters them.
 */
export async function getFxTable(repo: LedgerRepository): Promise<FxRateTable> {
	const base = await getBaseCurrency(repo);
	const stored = await repo.getSetting<{ asOf: string; rates: Record<string, number> }>(
		FX_RATES_KEY,
	);
	return { base, asOf: stored?.asOf ?? todayIso(), rates: stored?.rates ?? {} };
}

export async function setFxRates(
	repo: LedgerRepository,
	rates: Record<string, number>,
): Promise<void> {
	const clean: Record<string, number> = {};
	for (const [code, rate] of Object.entries(rates)) {
		if (Number.isFinite(rate) && rate > 0) clean[code] = rate;
	}
	await repo.putSetting(FX_RATES_KEY, { asOf: todayIso(), rates: clean });
}
