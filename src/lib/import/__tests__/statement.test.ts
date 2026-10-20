import { describe, expect, it } from 'vitest';
import type { PositionedText } from '../statement';
import { extractTableFromText, mergeExtractedTables } from '../statement';

/**
 * Statement extraction is layout logic, so the tests build synthetic layouts
 * exactly as PDF.js / OCR would report them (text + x/y/width/height + page).
 */

function item(text: string, x: number, y: number, page = 1): PositionedText {
	return { text, x, y, width: text.length * 6, height: 10, page };
}

function row(
	y: number,
	date: string,
	description: string,
	amount: string,
	balance?: string,
	page = 1,
): PositionedText[] {
	const cells = [
		item(date, 40, y, page),
		item(description, 120, y, page),
		item(amount, 400, y, page),
	];
	if (balance !== undefined) cells.push(item(balance, 520, y, page));
	return cells;
}

const header = [
	...['Date', 'Description', 'Amount', 'Balance'].map((text, index) =>
		item(text, 40 + index * 120, 700),
	),
];

describe('statement table extraction', () => {
	it('extracts dated rows with amounts and running balances (LKR, DD/MM)', () => {
		const table = extractTableFromText(
			[
				...header,
				...row(670, '18/10/2026', 'KEELLS SUPER', '1,234.56', '45,678.90'),
				...row(640, '19/10/2026', 'CARGILLS', '500.00', '45,178.90'),
			],
			{ currency: 'LKR', defaultYear: 2026 },
		);

		expect(table.rows).toEqual([
			{
				Date: '2026-10-18',
				Description: 'KEELLS SUPER',
				Amount: '-1234.56',
				Balance: '45678.90',
			},
			{
				Date: '2026-10-19',
				Description: 'CARGILLS',
				Amount: '-500.00',
				Balance: '45178.90',
			},
		]);
		expect(table.meta.candidates).toBe(2);
	});

	it('reads CR/DR markers and currency-prefixed amounts', () => {
		const table = extractTableFromText(
			[
				...row(610, '01 Oct 2026', 'SALARY OCT', 'Rs 250,000.00 CR'),
				...row(580, '02 Oct 2026', 'DIALOG', 'Rs 6,000.00 DR'),
				...row(550, '03 Oct 2026', 'REFUND', '(500.00)'),
			],
			{ currency: 'LKR', defaultYear: 2026 },
		);

		expect(table.rows.map((r) => r.Amount)).toEqual(['250000.00', '-6000.00', '-500.00']);
		expect(table.rows.map((r) => r.Description)).toEqual(['SALARY OCT', 'DIALOG', 'REFUND']);
	});

	it('infers month-first dates when a day component proves it', () => {
		const table = extractTableFromText(
			[
				...row(610, '05/13/2026', 'MAY PURCHASE', '10.00'),
				...row(580, '10/02/2026', 'OCT PURCHASE', '20.00'),
			],
			{ currency: 'USD', defaultYear: 2026 },
		);
		expect(table.rows.map((r) => r.Date)).toEqual(['2026-05-13', '2026-10-02']);
	});

	it('infers day-first dates when a month component proves it', () => {
		const table = extractTableFromText([...row(610, '13/05/2026', 'PURCHASE', '10.00')], {
			currency: 'AUD',
			defaultYear: 2026,
		});
		expect(table.rows[0].Date).toBe('2026-05-13');
	});

	it('handles banking-app dates without a year', () => {
		const table = extractTableFromText(
			[...row(610, '18 Oct', 'KEELLS', '1,500.00'), ...row(580, 'Oct 18', 'CARGILLS', '2,000.00')],
			{ currency: 'LKR', defaultYear: 2026 },
		);
		expect(table.rows.map((r) => r.Date)).toEqual(['2026-10-18', '2026-10-18']);
	});

	it('keeps pages separate and ordered', () => {
		const table = extractTableFromText(
			[
				...row(700, '18/10/2026', 'PAGE ONE', '10.00', undefined, 1),
				...row(700, '19/10/2026', 'PAGE TWO', '20.00', undefined, 2),
			],
			{ currency: 'LKR', defaultYear: 2026 },
		);
		expect(table.rows.map((r) => r.Description)).toEqual(['PAGE ONE', 'PAGE TWO']);
		expect(table.meta.pages).toBe(2);
	});

	it('skips headers, notes and rows without a parseable amount', () => {
		const table = extractTableFromText(
			[
				...header,
				...row(670, '18/10/2026', 'KEELLS SUPER', '1,234.56'),
				item('Closing balance carried forward', 40, 640),
				item('Statement generated on 20 Oct 2026', 40, 610),
			],
			{ currency: 'LKR', defaultYear: 2026 },
		);
		expect(table.rows).toHaveLength(1);
		expect(table.meta.skipped).toBeGreaterThanOrEqual(3);
	});

	it('corrects signs from the running balance even when CR is misprinted', () => {
		const table = extractTableFromText(
			[
				...row(670, '01/10/2026', 'SALARY', '1,000.00 CR', '1,000.00'),
				...row(640, '02/10/2026', 'MYSTERY', '200.00 CR', '800.00'),
			],
			{ currency: 'LKR', defaultYear: 2026 },
		);
		expect(table.rows.map((r) => r.Amount)).toEqual(['1000.00', '-200.00']);
	});

	it('merges multiple extractions', () => {
		const first = extractTableFromText([...row(700, '18/10/2026', 'ONE', '10.00')], {
			currency: 'LKR',
			defaultYear: 2026,
		});
		const second = extractTableFromText([...row(700, '19/10/2026', 'TWO', '20.00')], {
			currency: 'LKR',
			defaultYear: 2026,
		});
		const merged = mergeExtractedTables([first, second]);
		expect(merged.rows.map((r) => r.Description)).toEqual(['ONE', 'TWO']);
		expect(merged.meta.candidates).toBe(2);
	});
});
