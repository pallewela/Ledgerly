/**
 * PDF statement extraction (browser only). Uses PDF.js to read the embedded
 * text layer — no rendering, no network, no OCR. Scanned PDFs have no text
 * layer and yield zero rows; the UI tells the user to export an image instead.
 */

import type { ExtractedTable, PositionedText } from './statement';
import { extractTableFromText } from './statement';

export interface PdfExtractOptions {
	currency: string;
	onProgress?: (message: string) => void;
}

export interface PdfTextLike {
	str?: string;
	transform?: number[];
	width?: number;
	height?: number;
}

/** Map PDF.js text items to positioned text (exported for the fixture test). */
export function collectTextItems(items: PdfTextLike[], page: number): PositionedText[] {
	const out: PositionedText[] = [];
	for (const entry of items) {
		const text = entry.str ?? '';
		if (!text.trim()) continue;
		const transform = entry.transform ?? [1, 0, 0, 1, 0, 0];
		out.push({
			text,
			x: transform[4],
			y: transform[5],
			width: entry.width,
			height: entry.height,
			page,
		});
	}
	return out;
}

export async function extractPdfTable(
	file: File,
	options: PdfExtractOptions,
): Promise<ExtractedTable> {
	const pdfjs = await import('pdfjs-dist');
	const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
	pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

	const data = await file.arrayBuffer();
	const loadingTask = pdfjs.getDocument({ data });
	const document = await loadingTask.promise;

	try {
		const items: PositionedText[] = [];
		for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
			options.onProgress?.(`Reading page ${pageNumber} of ${document.numPages}…`);
			const page = await document.getPage(pageNumber);
			const content = await page.getTextContent();
			items.push(...collectTextItems(content.items as PdfTextLike[], pageNumber));
			page.cleanup();
		}

		return extractTableFromText(items, { currency: options.currency });
	} finally {
		await loadingTask.destroy();
	}
}
