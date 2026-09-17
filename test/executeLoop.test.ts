import { Perform } from '../nodes/Perform/Perform.node';

/**
 * Drives the real execute() against a fake IExecuteFunctions. This covers the
 * loop itself: parameter collection, local validation, pagination, output
 * shaping, pairedItem tagging and continueOnFail.
 */
interface HarnessOptions {
	params: Record<string, unknown>;
	itemCount?: number;
	continueOnFail?: boolean;
	/** A single response, or one response per request in order. */
	responses?: unknown[];
	requestError?: Error;
}

function harness(options: HarnessOptions) {
	const calls: Array<{ method: string; url: string; body?: unknown; qs?: unknown }> = [];
	const itemCount = options.itemCount ?? 1;
	const responses = options.responses ?? [{ success: true, data: { ok: true } }];

	const ctx = {
		getInputData: () => new Array(itemCount).fill({ json: {} }),
		// Faithful to real n8n: it THROWS for a parameter that is not part of the
		// active operation's parameter set, and an `undefined` fallback does not
		// suppress that.
		getNodeParameter: (name: string, _i: number, ..._rest: unknown[]) => {
			if (name in options.params) return options.params[name];
			throw new Error(`Could not get parameter "${name}"`);
		},
		getNode: () => ({ name: 'Perform', type: 'perform' }),
		getCredentials: async () => ({ apiKey: 'pf_live_test', baseUrl: 'https://example.test' }),
		continueOnFail: () => options.continueOnFail === true,
		helpers: {
			httpRequestWithAuthentication: async (_cred: string, opts: Record<string, unknown>) => {
				calls.push({
					method: opts.method as string,
					url: opts.url as string,
					body: opts.body,
					qs: opts.qs,
				});
				if (options.requestError !== undefined) throw options.requestError;
				return responses[Math.min(calls.length - 1, responses.length - 1)];
			},
		},
	};

	const run = () => new Perform().execute.call(ctx as never);
	return { run, calls };
}

describe('execute: happy path', () => {
	it('creates a trainee and flattens the response', async () => {
		const { run, calls } = harness({
			params: {
				resource: 'trainee',
				operation: 'create',
				firstName: 'Dana',
				lastName: 'Cohen',
				phone: '0501234567',
				sendWhatsappInvite: false,
				additionalFields: { tags: 'vip' },
			},
			responses: [
				{ success: true, data: { trainee: { id: 't1', name: 'Dana Cohen' }, created: true } },
			],
		});

		const result = await run();

		expect(calls).toHaveLength(1);
		expect(calls[0].method).toBe('POST');
		expect(calls[0].url).toBe('https://example.test/v1/automation/trainees');
		expect(calls[0].body).toEqual({
			firstName: 'Dana',
			lastName: 'Cohen',
			phone: '0501234567',
			sendWhatsappInvite: false,
			tags: ['vip'],
		});
		expect(result[0][0].json).toEqual({ id: 't1', name: 'Dana Cohen', created: true });
		expect(result[0][0].pairedItem).toEqual({ item: 0 });
	});

	it('runs an operation that has no parameters at all', async () => {
		const { run, calls } = harness({
			params: { resource: 'studio', operation: 'validate' },
			responses: [{ success: true, data: { studioName: 'Studio' } }],
		});
		const result = await run();
		expect(calls[0].method).toBe('GET');
		expect(calls[0].body).toBeUndefined();
		expect(calls[0].url).toBe('https://example.test/v1/automation/validate');
		expect(result[0][0].json).toEqual({ studioName: 'Studio' });
	});

	it('processes every input item', async () => {
		const { run, calls } = harness({
			params: { resource: 'trainee', operation: 'get', traineeId: 't1' },
			itemCount: 3,
			responses: [{ success: true, data: { trainee: { id: 't1' }, subscriptions: [] } }],
		});
		const result = await run();
		expect(calls).toHaveLength(3);
		expect(result[0].map((r) => r.pairedItem)).toEqual([{ item: 0 }, { item: 1 }, { item: 2 }]);
	});

	it('emits one item per row for list operations and honours the limit', async () => {
		const { run, calls } = harness({
			params: {
				resource: 'trainee',
				operation: 'getMany',
				returnAll: false,
				limit: 2,
				filters: { status: 'ACTIVE' },
			},
			responses: [
				{
					success: true,
					data: {
						items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
						offset: 0,
						limit: 2,
						hasMore: true,
					},
				},
			],
		});
		const result = await run();
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe('https://example.test/v1/automation/trainees/search');
		expect(calls[0].qs).toEqual({ status: 'ACTIVE', limit: 2, offset: 0 });
		expect(result[0].map((r) => r.json)).toEqual([{ id: 'a' }, { id: 'b' }]);
		expect(result[0].every((r) => (r.pairedItem as { item: number }).item === 0)).toBe(true);
	});

	it('walks all pages when Return All is on', async () => {
		const { run, calls } = harness({
			params: { resource: 'form', operation: 'getMany', returnAll: true },
			responses: [
				{ success: true, data: { items: [{ id: 'f1' }], offset: 0, limit: 1, hasMore: true } },
				{ success: true, data: { items: [{ id: 'f2' }], offset: 1, limit: 1, hasMore: false } },
			],
		});
		const result = await run();
		expect(calls).toHaveLength(2);
		expect(result[0].map((r) => r.json)).toEqual([{ id: 'f1' }, { id: 'f2' }]);
	});

	it('reports found=false for an unknown phone number instead of failing', async () => {
		const { run, calls } = harness({
			params: { resource: 'trainee', operation: 'findByPhone', phone: '+972 50-123-4567' },
			responses: [{ success: true, data: { found: false, trainee: null } }],
		});
		const result = await run();
		expect(calls[0].url).toBe(
			'https://example.test/v1/automation/trainees/by-phone/%2B972%2050-123-4567',
		);
		expect(result[0][0].json).toEqual({ found: false });
	});

	it('spreads the coach list into one item per coach', async () => {
		const { run } = harness({
			params: { resource: 'coach', operation: 'getMany' },
			responses: [{ success: true, data: [{ id: 'c1', value: 'Bar' }] }],
		});
		const result = await run();
		expect(result[0].map((r) => r.json)).toEqual([{ id: 'c1', name: 'Bar' }]);
	});
});

describe('execute: parameters absent from the current operation', () => {
	it('sends a message even though the create-only parameters are not present', async () => {
		const { run, calls } = harness({
			params: { resource: 'message', operation: 'send', traineeId: 't1', message: 'hi' },
			responses: [{ success: true, data: { sent: 1 } }],
		});
		const result = await run();
		expect(calls[0].url).toContain('/trainees/t1/message');
		expect(calls[0].body).toEqual({ message: 'hi' });
		expect(result[0][0].json).toEqual({ sent: 1 });
	});

	it('still surfaces a genuinely missing required parameter', async () => {
		const { run } = harness({
			params: { resource: 'message', operation: 'send', traineeId: 't1' },
		});
		await expect(run()).rejects.toThrow('Missing required parameter: message');
	});
});

describe('execute: local validation', () => {
	it('names every missing field and spends no request', async () => {
		const { run, calls } = harness({
			params: { resource: 'trainee', operation: 'create', firstName: '' },
		});
		await expect(run()).rejects.toThrow('Missing required parameters: firstName, lastName, phone');
		expect(calls).toHaveLength(0);
	});

	it('refuses to delete a trainee without the confirmation switch', async () => {
		const { run, calls } = harness({
			params: { resource: 'trainee', operation: 'delete', traineeId: 't1', confirm: false },
		});
		await expect(run()).rejects.toThrow('Confirm Deletion');
		expect(calls).toHaveLength(0);
	});

	it('deletes once confirmed, sending the confirm flag in the body', async () => {
		const { run, calls } = harness({
			params: { resource: 'trainee', operation: 'delete', traineeId: 't1', confirm: true },
			responses: [{ success: true, data: { deleted: true } }],
		});
		const result = await run();
		expect(calls[0].method).toBe('DELETE');
		expect(calls[0].body).toEqual({ confirm: true });
		expect(result[0][0].json).toEqual({ deleted: true });
	});
});

describe('execute: error handling', () => {
	it('throws on a 200 response carrying success:false', async () => {
		const { run } = harness({
			params: { resource: 'trainee', operation: 'get', traineeId: 'nope' },
			responses: [{ success: false, message: 'No trainee with id nope exists in this studio.' }],
		});
		await expect(run()).rejects.toThrow('No trainee with id nope exists in this studio.');
	});

	it('collects the error per item when continueOnFail is set', async () => {
		const { run } = harness({
			params: { resource: 'message', operation: 'send', traineeId: '' },
			continueOnFail: true,
			itemCount: 2,
		});
		const result = await run();
		expect(result[0]).toHaveLength(2);
		expect(result[0][0].json.error).toContain('traineeId');
		expect(result[0][1].pairedItem).toEqual({ item: 1 });
	});

	it('keeps going past a failing request when continueOnFail is set', async () => {
		const { run } = harness({
			params: { resource: 'studio', operation: 'validate' },
			requestError: new Error('network down'),
			continueOnFail: true,
		});
		const result = await run();
		expect(result[0][0].json.error).toBe('network down');
	});
});
