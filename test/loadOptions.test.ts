import { RPC_PATHS, loadOptions, mapDropdownItems } from '../nodes/Perform/methods/loadOptions';

describe('mapDropdownItems', () => {
	it('maps the {id, value} contract to n8n options', () => {
		expect(
			mapDropdownItems([
				{ id: 'c1', value: 'Bar' },
				{ id: 'c2', value: 'Noam' },
			]),
		).toEqual([
			{ name: 'Bar', value: 'c1' },
			{ name: 'Noam', value: 'c2' },
		]);
	});

	it('drops rows without an id and falls back to the id as the label', () => {
		expect(mapDropdownItems([{ id: '', value: 'x' }, { value: 'y' }, { id: 'z' }])).toEqual([
			{ name: 'z', value: 'z' },
		]);
	});

	it('treats an empty or non-array result as an empty dropdown, never an error', () => {
		expect(mapDropdownItems([])).toEqual([]);
		expect(mapDropdownItems(undefined)).toEqual([]);
		expect(mapDropdownItems({ items: [] })).toEqual([]);
	});
});

describe('loadOptions methods', () => {
	function context() {
		const urls: string[] = [];
		const ctx = {
			getCredentials: async () => ({ apiKey: 'k', baseUrl: 'https://example.test' }),
			getNode: () => ({ name: 'Perform', type: 'perform' }),
			helpers: {
				httpRequestWithAuthentication: async (_cred: string, options: Record<string, unknown>) => {
					urls.push(options.url as string);
					return { success: true, data: [{ id: 'x', value: 'X' }] };
				},
			},
		};
		return { ctx: ctx as never, urls };
	}

	it.each(Object.entries(RPC_PATHS))('%s calls %s', async (method, path) => {
		const { ctx, urls } = context();
		const fn = loadOptions[method as keyof typeof loadOptions];
		const options = await fn.call(ctx);
		expect(urls).toEqual([`https://example.test/v1/automation${path}`]);
		expect(options).toEqual([{ name: 'X', value: 'x' }]);
	});
});
