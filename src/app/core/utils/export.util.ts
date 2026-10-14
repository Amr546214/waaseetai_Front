/** Shared admin export plumbing: a real CSV file download and a print (save-as-PDF) helper. */

export interface CsvColumn<T> {
	header: string;
	/** Property key, or a function that derives the cell from the row. */
	value: keyof T | ((row: T) => unknown);
}

/** Guards against spreadsheet formula injection: a cell that starts with = + - @ (or tab/CR) is prefixed with a single quote. */
export function csvCell(raw: unknown): string {
	let text = raw === null || raw === undefined ? '' : raw instanceof Date ? raw.toISOString() : String(raw);
	if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Builds the CSV text (UTF-8 BOM first so Arabic opens correctly in Excel; CRLF line endings; headers in column order). */
export function buildCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
	const lines = [columns.map(c => csvCell(c.header)).join(',')];
	for (const row of rows) {
		lines.push(columns.map(c => csvCell(typeof c.value === 'function' ? c.value(row) : row[c.value])).join(','));
	}
	return '﻿' + lines.join('\r\n');
}

/** Downloads a real .csv file with the given rows. */
export function exportCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]): void {
	const blob = new Blob([buildCsv(columns, rows)], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

/** Opens the browser print dialog (the user can choose "Save as PDF"); optionally sets the document title for the printed header/file name. */
export function printPage(printTitle?: string): void {
	const previous = document.title;
	if (printTitle) document.title = printTitle;
	try {
		window.print();
	} finally {
		if (printTitle) document.title = previous;
	}
}
