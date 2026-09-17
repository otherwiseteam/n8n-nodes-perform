import type { IDataObject } from 'n8n-workflow';
import { performApiRequest, type PerformContext } from './request';

/** Perform serves at most this many rows per page on every list endpoint. */
export const MAX_PAGE_SIZE = 200;

export const DEFAULT_LIMIT = 50;

export interface PageOptions {
	returnAll: boolean;
	/** Ignored when returnAll is true. */
	limit?: number;
}

interface PageEnvelope {
	items?: unknown;
	offset?: unknown;
	limit?: unknown;
	hasMore?: unknown;
}

function asPage(data: unknown): PageEnvelope {
	return typeof data === 'object' && data !== null && !Array.isArray(data)
		? (data as PageEnvelope)
		: {};
}

/**
 * List endpoints answer `{ items, offset, limit, hasMore }`. Anything else
 * (a bare array from the RPC endpoints, or an unexpected shape) is treated as
 * a single, final page so callers never loop forever.
 */
export function extractItems(data: unknown): IDataObject[] {
	if (Array.isArray(data)) return data as IDataObject[];
	const items = asPage(data).items;
	return Array.isArray(items) ? (items as IDataObject[]) : [];
}

export function hasMorePages(data: unknown): boolean {
	return asPage(data).hasMore === true;
}

export function nextOffset(data: unknown, previousOffset: number, received: number): number {
	const page = asPage(data);
	if (typeof page.offset === 'number' && typeof page.limit === 'number') {
		return page.offset + page.limit;
	}
	return previousOffset + received;
}

/** Normalises the n8n `limit` parameter: positive integer, defaulting to 50. */
export function toLimit(value: unknown): number {
	const parsed = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
	return Math.floor(parsed);
}

/**
 * Walks Perform's offset pagination until either enough rows were collected or
 * the API reports no further page. Requests are sized to the caller's limit so
 * a "give me 5" never downloads 200 rows.
 */
export async function fetchPages(
	ctx: PerformContext,
	path: string,
	qs: IDataObject | undefined,
	options: PageOptions,
): Promise<IDataObject[]> {
	const wanted = options.returnAll ? Number.POSITIVE_INFINITY : toLimit(options.limit);
	const pageSize = Math.min(MAX_PAGE_SIZE, wanted);

	const collected: IDataObject[] = [];
	let offset = 0;

	for (;;) {
		const data = await performApiRequest(ctx, 'GET', path, undefined, {
			...(qs ?? {}),
			limit: pageSize,
			offset,
		});
		const page = extractItems(data);
		collected.push(...page);

		if (collected.length >= wanted) break;
		if (!hasMorePages(data) || page.length === 0) break;

		offset = nextOffset(data, offset, page.length);
	}

	return Number.isFinite(wanted) ? collected.slice(0, wanted) : collected;
}
