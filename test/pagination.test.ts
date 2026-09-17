import {
	MAX_PAGE_SIZE,
	extractItems,
	fetchPages,
	hasMorePages,
	nextOffset,
	toLimit,
} from '../nodes/Perform/transport/pagination';

describe('page helpers', () => {
	it('extracts items from the list envelope and tolerates other shapes', () => {
		expect(extractItems({ items: [{ id: 1 }], offset: 0, limit: 50, hasMore: false })).toEqual([
			{ id: 1 },
		]);
		expect(extractItems([{ id: 2 }])).toEqual([{ id: 2 }]);
		expect(extractItems({ nope: true })).toEqual([]);
		expect(extractItems(null)).toEqual([]);
	});

	it('only continues on an explicit hasMore:true', () => {
		expect(hasMorePages({ hasMore: true })).toBe(true);
		expect(hasMorePages({ hasMore: 'yes' })).toBe(false);
		expect(hasMorePages([])).toBe(false);
	});

	it('advances the offset the way the API reports it, falling back to what was received', () => {
		expect(nextOffset({ offset: 100, limit: 50 }, 0, 50)).toBe(150);
		expect(nextOffset({}, 40, 10)).toBe(50);
	});

	it('normalises the limit parameter', () => {
		expect(toLimit(undefined)).toBe(50);
		expect(toLimit('7')).toBe(7);
		expect(toLimit(3.9)).toBe(3);
		expect(toLimit(0)).toBe(50);
		expect(toLimit(-2)).toBe(50);
	});
});

describe('fetchPages', () => {
	function context(pages: unknown[]) {
		const requests: Array<{ url: string; qs: Record<string, unknown> }> = [];
		let call = 0;
		const ctx = {
			getCredentials: async () => ({ apiKey: 'k', baseUrl: 'https://example.test' }),
			getNode: () => ({ name: 'Perform', type: 'perform' }),
			helpers: {
				httpRequestWithAuthentication: async (_cred: string, options: Record<string, unknown>) => {
					requests.push({ url: options.url as string, qs: options.qs as Record<string, unknown> });
					const page = pages[Math.min(call, pages.length - 1)];
					call += 1;
					return { success: true, data: page };
				},
			},
		};
		return { ctx: ctx as never, requests };
	}

	it('walks every page when returnAll is set', async () => {
		const { ctx, requests } = context([
			{ items: [{ id: 1 }, { id: 2 }], offset: 0, limit: 2, hasMore: true },
			{ items: [{ id: 3 }], offset: 2, limit: 2, hasMore: false },
		]);
		const rows = await fetchPages(ctx, '/forms', undefined, { returnAll: true });
		expect(rows.map((r) => r.id)).toEqual([1, 2, 3]);
		expect(requests).toHaveLength(2);
		expect(requests[0].qs).toEqual({ limit: MAX_PAGE_SIZE, offset: 0 });
		// The next offset follows what the API reported (offset + limit), not the page size we asked for.
		expect(requests[1].qs.offset).toBe(2);
	});

	it('requests only as many rows as the limit asks for', async () => {
		const { ctx, requests } = context([
			{ items: [{ id: 1 }, { id: 2 }, { id: 3 }], hasMore: true },
		]);
		const rows = await fetchPages(ctx, '/forms', undefined, { returnAll: false, limit: 2 });
		expect(rows).toHaveLength(2);
		expect(requests).toHaveLength(1);
		expect(requests[0].qs.limit).toBe(2);
	});

	it('pages until the limit is met when it exceeds the page size', async () => {
		const first = Array.from({ length: MAX_PAGE_SIZE }, (_, i) => ({ id: i }));
		const { ctx, requests } = context([
			{ items: first, offset: 0, limit: MAX_PAGE_SIZE, hasMore: true },
			{ items: [{ id: 'extra-1' }, { id: 'extra-2' }], offset: 200, limit: 200, hasMore: true },
		]);
		const rows = await fetchPages(ctx, '/forms', undefined, {
			returnAll: false,
			limit: MAX_PAGE_SIZE + 1,
		});
		expect(rows).toHaveLength(MAX_PAGE_SIZE + 1);
		expect(requests).toHaveLength(2);
	});

	it('keeps caller filters alongside the paging parameters', async () => {
		const { ctx, requests } = context([{ items: [], hasMore: false }]);
		await fetchPages(ctx, '/trainees/search', { status: 'ACTIVE' }, { returnAll: false, limit: 5 });
		expect(requests[0].qs).toEqual({ status: 'ACTIVE', limit: 5, offset: 0 });
	});

	it('stops on an empty page even if the API claims there is more', async () => {
		const { ctx, requests } = context([{ items: [], hasMore: true }]);
		const rows = await fetchPages(ctx, '/forms', undefined, { returnAll: true });
		expect(rows).toEqual([]);
		expect(requests).toHaveLength(1);
	});
});
