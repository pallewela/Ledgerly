import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { collectTextItems, type PdfTextLike } from '../pdf';
import { extractTableFromText, type PositionedText } from '../statement';

/**
 * End-to-end PDF text extraction against a tiny generated statement
 * (fixtures/statement.pdf, Courier, three rows with a running balance).
 */
describe('PDF statement extraction', () => {
	it('reads a real text-layer PDF into ledger rows', async () => {
		const data = new Uint8Array(
			readFileSync(fileURLToPath(new URL('./fixtures/statement.pdf', import.meta.url))),
		);
		const task = getDocument({ data, useSystemFonts: false });
		const document = await task.promise;

		const items: PositionedText[] = [];
		for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
			const page = await document.getPage(pageNumber);
			const content = await page.getTextContent();
			items.push(...collectTextItems(content.items as unknown as PdfTextLike[], pageNumber));
		}
		await task.destroy();

		const table = extractTableFromText(items, { currency: 'LKR', defaultYear: 2026 });

		expect(
			table.rows.map((row) => `${row.Date}|${row.Description}|${row.Amount}|${row.Balance}`),
		).toEqual([
			'2026-10-18|KEELLS SUPER|-1234.56|45678.90',
			'2026-10-19|SALARY OCTOBER|250000.00|295678.90',
			'2026-10-20|DIALOG|-6000.00|289678.90',
		]);
		expect(table.meta.pages).toBe(1);
	});
});
