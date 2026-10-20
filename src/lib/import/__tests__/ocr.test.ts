import { describe, expect, it } from 'vitest';
import { extractTableFromText } from '../statement';
import { tsvToItems } from '../ocr';

/**
 * OCR line reconstruction: Tesseract TSV level-5 rows are words; grouping by
 * (block, paragraph, line) must rebuild readable transaction lines.
 */

function tsvRow(
	line: number,
	word: number,
	left: number,
	top: number,
	text: string,
	width = 80,
): string {
	return [
		'5',
		'1',
		'1',
		'1',
		String(line),
		String(word),
		String(left),
		String(top),
		String(width),
		'20',
		'95',
		text,
	].join('\t');
}

describe('OCR TSV reconstruction', () => {
	it('groups words into lines and extracts a transaction row', () => {
		const tsv = [
			'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
			tsvRow(1, 1, 40, 300, '18/10/2026'),
			tsvRow(1, 2, 160, 300, 'KEELLS'),
			tsvRow(1, 3, 260, 300, 'SUPER'),
			tsvRow(1, 4, 620, 300, '1,234.56'),
			tsvRow(2, 1, 40, 360, '19/10/2026'),
			tsvRow(2, 2, 160, 360, 'CARGILLS'),
			tsvRow(2, 3, 620, 360, '2,000.00'),
		].join('\n');

		const items = tsvToItems(tsv, 1);
		expect(items).toHaveLength(2);
		expect(items[0].text).toBe('18/10/2026 KEELLS SUPER 1,234.56');
		expect(items[0].page).toBe(1);

		const table = extractTableFromText(items, { currency: 'LKR', defaultYear: 2026 });
		expect(table.rows.map((r) => `${r.Date}|${r.Description}|${r.Amount}`)).toEqual([
			'2026-10-18|KEELLS SUPER|-1234.56',
			'2026-10-19|CARGILLS|-2000.00',
		]);
	});

	it('ignores non-word TSV levels and blank text', () => {
		const tsv = [
			['1', '1', '0', '0', '0', '0', '0', '0', '1000', '1000', '-1', ''].join('\t'),
			tsvRow(1, 1, 40, 300, '18/10/2026'),
			tsvRow(1, 2, 620, 300, '1,000.00'),
		].join('\n');

		const items = tsvToItems(tsv, 1);
		expect(items).toHaveLength(1);
		expect(items[0].text).toBe('18/10/2026 1,000.00');
	});
});
