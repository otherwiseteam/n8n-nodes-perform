import type { INodePropertyOptions } from 'n8n-workflow';
import {
	FORM_FILLED_EVENT,
	PerformTrigger,
	extractHookId,
} from '../nodes/PerformTrigger/PerformTrigger.node';

const trigger = new PerformTrigger();

interface HookHarnessOptions {
	params?: Record<string, unknown>;
	staticData?: Record<string, unknown>;
	response?: unknown;
	requestError?: Error;
}

function hookContext(options: HookHarnessOptions = {}) {
	const calls: Array<{ method: string; url: string; body?: unknown }> = [];
	const staticData = options.staticData ?? {};
	const warnings: string[] = [];
	const params = { event: FORM_FILLED_EVENT, formTemplateId: '', ...options.params };

	const ctx = {
		getWorkflowStaticData: () => staticData,
		getNodeWebhookUrl: () => 'https://n8n.example/webhook/abc',
		getNodeParameter: (name: string, fallback?: unknown) =>
			name in params ? params[name as keyof typeof params] : fallback,
		getNode: () => ({ name: 'Perform Trigger', type: 'performTrigger' }),
		getCredentials: async () => ({ apiKey: 'k', baseUrl: 'https://example.test' }),
		logger: { warn: (message: string) => warnings.push(message) },
		helpers: {
			httpRequestWithAuthentication: async (_cred: string, opts: Record<string, unknown>) => {
				calls.push({ method: opts.method as string, url: opts.url as string, body: opts.body });
				if (options.requestError) throw options.requestError;
				return options.response ?? { success: true, data: { hook: { id: 'h1' } } };
			},
		},
	};

	return { ctx: ctx as never, calls, staticData, warnings };
}

describe('Perform Trigger description', () => {
	it('is a webhook trigger with no inputs', () => {
		expect(trigger.description.group).toEqual(['trigger']);
		expect(trigger.description.inputs).toEqual([]);
		expect(trigger.description.webhooks?.[0]).toMatchObject({
			name: 'default',
			httpMethod: 'POST',
			responseMode: 'onReceived',
		});
		expect(trigger.description.credentials).toEqual([{ name: 'performApi', required: true }]);
	});

	it('offers the form-filled event and a form picker', () => {
		const event = trigger.description.properties.find((p) => p.name === 'event');
		expect((event?.options as INodePropertyOptions[]).map((o) => o.value)).toEqual([
			FORM_FILLED_EVENT,
		]);
		const form = trigger.description.properties.find((p) => p.name === 'formTemplateId');
		expect(form?.typeOptions).toEqual({ loadOptionsMethod: 'getForms' });
		expect(Object.keys(trigger.methods?.loadOptions ?? {})).toEqual(['getForms']);
	});
});

describe('extractHookId', () => {
	it('reads the nested hook id and the flatter fallbacks', () => {
		expect(extractHookId({ hook: { id: 'h1' } })).toBe('h1');
		expect(extractHookId({ hookId: 'h2' })).toBe('h2');
		expect(extractHookId({ id: 'h3' })).toBe('h3');
		expect(extractHookId({})).toBeUndefined();
		expect(extractHookId(null)).toBeUndefined();
	});
});

describe('webhook lifecycle', () => {
	const methods = trigger.webhookMethods.default;

	it('checkExists is true only when a hook id was stored', async () => {
		expect(await methods.checkExists.call(hookContext().ctx)).toBe(false);
		expect(await methods.checkExists.call(hookContext({ staticData: { hookId: 'h1' } }).ctx)).toBe(
			true,
		);
	});

	it('create registers the hook for every form and remembers its id', async () => {
		const { ctx, calls, staticData } = hookContext();
		expect(await methods.create.call(ctx)).toBe(true);
		expect(calls[0]).toEqual({
			method: 'POST',
			url: 'https://example.test/v1/automation/hooks',
			body: { event: 'FORM_FILLED', targetUrl: 'https://n8n.example/webhook/abc' },
		});
		expect(staticData.hookId).toBe('h1');
	});

	it('create scopes the hook to the chosen form', async () => {
		const { ctx, calls } = hookContext({ params: { formTemplateId: 'f1' } });
		await methods.create.call(ctx);
		expect(calls[0].body).toEqual({
			event: 'FORM_FILLED',
			targetUrl: 'https://n8n.example/webhook/abc',
			formTemplateId: 'f1',
		});
	});

	it('create fails loudly when Perform returns no hook id', async () => {
		const { ctx, staticData } = hookContext({ response: { success: true, data: {} } });
		await expect(methods.create.call(ctx)).rejects.toThrow('no hook ID');
		expect(staticData.hookId).toBeUndefined();
	});

	it('delete removes the hook and forgets its id', async () => {
		const { ctx, calls, staticData } = hookContext({
			staticData: { hookId: 'h1' },
			response: { success: true, data: {} },
		});
		expect(await methods.delete.call(ctx)).toBe(true);
		expect(calls[0]).toEqual({
			method: 'DELETE',
			url: 'https://example.test/v1/automation/hooks/h1',
			body: undefined,
		});
		expect(staticData.hookId).toBeUndefined();
	});

	it('delete is a no-op without a stored id', async () => {
		const { ctx, calls } = hookContext();
		expect(await methods.delete.call(ctx)).toBe(true);
		expect(calls).toHaveLength(0);
	});

	it('delete reports failure, logs it and keeps the id for a retry', async () => {
		const { ctx, staticData, warnings } = hookContext({
			staticData: { hookId: 'h1' },
			requestError: new Error('boom'),
		});
		expect(await methods.delete.call(ctx)).toBe(false);
		expect(staticData.hookId).toBe('h1');
		expect(warnings[0]).toContain('h1');
	});
});

describe('webhook()', () => {
	it('emits the payload as a single item', async () => {
		const payload = { event: 'form_filled', form: { id: 'f1' }, trainee: { id: 't1' } };
		const ctx = {
			getBodyData: () => payload,
			helpers: { returnJsonArray: (data: unknown) => [{ json: data }] },
		};
		const result = await trigger.webhook.call(ctx as never);
		expect(result.workflowData).toEqual([[{ json: payload }]]);
	});
});
