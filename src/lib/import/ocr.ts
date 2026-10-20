/**
 * Screenshot OCR extraction (browser only). Tesseract runs entirely on-device;
 * only its WASM core and English language data are fetched from the default
 * CDN on first use (cached afterwards). No image ever leaves the device.
 */

import type { ExtractedTable, PositionedText } from './statement';
import { extractTableFromText, mergeExtractedTables } from './statement';

const TSV_TIMEOUT_MS = 5 * 60 * 1000;

export interface OcrExtractOptions {
	currency: string;
	onProgress?: (message: string) => void;
}

interface TsvWord {
	lineKey: string;
	wordNumber: number;
	text: string;
	left: number;
	top: number;
	width: number;
	height: number;
}

/**
 * Convert Tesseract TSV output into one PositionedText per recognised line.
 * Level-5 rows are words; grouping by (block, paragraph, line) gives rows that
 * keep the amount and description on the same text line.
 */
export function tsvToItems(tsv: string, page: number): PositionedText[] {
	const groups = new Map<string, TsvWord[]>();

	for (const row of tsv.split(/\r?\n/)) {
		const columns = row.split('\t');
		if (columns.length < 12) continue;
		if (columns[0] !== '5') continue;

		const text = columns.slice(11).join('\t').trim();
		if (!text) continue;

		const left = Number(columns[6]);
		const top = Number(columns[7]);
		const width = Number(columns[8]);
		const height = Number(columns[9]);
		if (![left, top, width, height].every(Number.isFinite)) continue;

		const key = `${columns[2]}:${columns[3]}:${columns[4]}`;
		const bucket = groups.get(key) ?? [];
		bucket.push({ lineKey: key, wordNumber: Number(columns[5]), text, left, top, width, height });
		groups.set(key, bucket);
	}

	const items: PositionedText[] = [];
	for (const words of groups.values()) {
		words.sort((a, b) => a.wordNumber - b.wordNumber || a.left - b.left);
		const left = Math.min(...words.map((word) => word.left));
		const right = Math.max(...words.map((word) => word.left + word.width));
		const top = Math.min(...words.map((word) => word.top));
		const bottom = Math.max(...words.map((word) => word.top + word.height));
		items.push({
			text: words.map((word) => word.text).join(' '),
			x: left,
			// OCR coordinates grow downward; the extractor expects PDF-style
			// upward coordinates so page order stays top-to-bottom.
			y: -bottom,
			width: right - left,
			height: bottom - top,
			page,
		});
	}

	return items;
}

export async function extractImageTable(
	files: File[],
	options: OcrExtractOptions,
): Promise<ExtractedTable> {
	const { createWorker } = await import('tesseract.js');

	const worker = await createWorker('eng', 1, {
		logger: (message) => {
			if (message.status === 'recognizing text') {
				options.onProgress?.(`Recognising text… ${Math.round(message.progress * 100)}%`);
			}
		},
	});

	try {
		const tables: ExtractedTable[] = [];
		for (let index = 0; index < files.length; index += 1) {
			const label =
				files.length > 1
					? `Reading screenshot ${index + 1} of ${files.length}…`
					: 'Reading screenshot…';
			options.onProgress?.(label);

			const result = await Promise.race([
				worker.recognize(files[index], {}, { tsv: true }),
				new Promise<never>((_, reject) =>
					setTimeout(
						() => reject(new Error('OCR timed out — try a smaller image.')),
						TSV_TIMEOUT_MS,
					),
				),
			]);

			const items = tsvToItems(result.data.tsv ?? '', index + 1);
			tables.push(extractTableFromText(items, { currency: options.currency }));
		}
		return mergeExtractedTables(tables);
	} finally {
		await worker.terminate();
	}
}
