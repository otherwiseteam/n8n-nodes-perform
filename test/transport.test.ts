import {
	API_PREFIX,
	describeApiError,
	extractErrorBody,
	isEnvelopeFailure,
	performApiRequest,
	resolveBaseUrl,
	unwrapEnvelope,
} from '../nodes/Perform/transport/request';

describe('unwrapEnvelope', () => {
	it('returns data when present', () => {
		expect(
			unwrapEnvelope({ success: true, message: 'ok', data: { trainee: { id: 'a' } } }),
		).toEqual({
			trainee: { id: 'a' },
		});
	});

	it('returns an empty array unchanged', () => {
		expect(unwrapEnvelope({ success: true, data: [] })).toEqual([]);
	});

	it('returns the whole body when there is no data key', () => {
		expect(unwrapEnvelope({ success: true, message: 'ok' })).toEqual({
			success: true,
			message: 'ok',
		});
	});

	it('passes through non-objects', () => {
		expect(unwrapEnvelope('plain')).toBe('plain');
	});
});

describe('isEnvelopeFailure', () => {
	it('detects success:false even on a 200 response', () => {
		expect(isEnvelopeFailure({ success: false, message: 'nope' })).toBe(true);
	});

	it('treats success:true as fine', () => {
		expect(isEnvelopeFailure({ success: true, data: [] })).toBe(false);
	});

	it('treats a missing success key as fine', () => {
		expect(isEnvelopeFailure({ data: [] })).toBe(false);
	});
});

describe('describeApiError', () => {
	it('passes the sentence Perform wrote through verbatim', () => {
		const message =
			'No trainee with id X exists in this studio. Use Search trainees to get a valid id.';
		expect(describeApiError({ success: false, message }, 'fallback')).toBe(message);
	});

	it('appends the machine code when there is one', () => {
		expect(describeApiError({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, 'fallback')).toBe(
			'Unauthorized (UNAUTHORIZED)',
		);
	});

	it('falls back when the body carries no message', () => {
		expect(describeApiError({}, 'fallback')).toBe('fallback');
		expect(describeApiError({ message: '   ' }, 'fallback')).toBe('fallback');
	});

	it('falls back for a non-object body', () => {
		expect(describeApiError(null, 'fallback')).toBe('fallback');
	});
});

describe('extractErrorBody', () => {
	it('reads the axios shape', () => {
		expect(extractErrorBody({ response: { data: { message: 'x' } } })).toEqual({ message: 'x' });
	});

	it('reads the legacy request-library shape', () => {
		expect(extractErrorBody({ response: { body: { message: 'y' } } })).toEqual({ message: 'y' });
	});

	it('reads through a wrapping error to its cause', () => {
		expect(extractErrorBody({ cause: { response: { data: { message: 'z' } } } })).toEqual({
			message: 'z',
		});
	});

	it('returns undefined when nothing looks like a body', () => {
		expect(extractErrorBody(new Error('boom'))).toBeUndefined();
		expect(extractErrorBody(undefined)).toBeUndefined();
	});
});

describe('resolveBaseUrl', () => {
	it('defaults to the hosted API', () => {
		expect(resolveBaseUrl(undefined)).toBe('https://perform-api.otherwise.co.il');
		expect(resolveBaseUrl('')).toBe('https://perform-api.otherwise.co.il');
	});

	it('strips trailing slashes so the prefix is not doubled', () => {
		expect(resolveBaseUrl('http://localhost:4000///')).toBe('http://localhost:4000');
	});
});

describe('performApiRequest', () => {
	function context(response: unknown, requestError?: Error) {
		const calls: Array<Record<string, unknown>> = [];
		const ctx = {
			getCredentials: async () => ({ apiKey: 'pf_live_x', baseUrl: 'https://example.test/' }),
			getNode: () => ({ name: 'Perform', type: 'perform' }),
			helpers: {
				httpRequestWithAuthentication: async (_cred: string, options: Record<string, unknown>) => {
					calls.push(options);
					if (requestError) throw requestError;
					return response;
				},
			},
		};
		return { ctx, calls };
	}

	it('prefixes the path and returns the unwrapped data', async () => {
		const { ctx, calls } = context({ success: true, data: { studioName: 'Studio' } });
		const data = await performApiRequest(ctx as never, 'GET', '/validate');
		expect(calls[0].url).toBe(`https://example.test${API_PREFIX}/validate`);
		expect(calls[0].json).toBe(true);
		expect(data).toEqual({ studioName: 'Studio' });
	});

	it('throws a readable error on success:false with HTTP 200', async () => {
		const { ctx } = context({ success: false, message: 'Phone already exists.' });
		await expect(performApiRequest(ctx as never, 'POST', '/trainees', {})).rejects.toThrow(
			'Phone already exists.',
		);
	});

	it('surfaces the message from a failed HTTP response', async () => {
		const failure = Object.assign(new Error('Request failed with status code 404'), {
			response: {
				data: { success: false, message: 'No trainee with id X exists in this studio.' },
			},
		});
		const { ctx } = context(undefined, failure);
		await expect(performApiRequest(ctx as never, 'GET', '/trainees/X')).rejects.toThrow(
			'No trainee with id X exists in this studio.',
		);
	});
});
