import {
	OPERATIONS,
	compact,
	findMissingRequired,
	getOperation,
	normaliseTraineeFields,
	splitTags,
	subscriptionOutput,
	toIdList,
} from '../nodes/Perform/operations/registry';

/**
 * Every endpoint, method, body and query below was taken from the Perform
 * Make.com app definition, which is the verified contract of the API. If one
 * of these expectations has to change, the API changed.
 */
describe('endpoints and methods', () => {
	const cases: Array<[string, string, string, Record<string, unknown>?]> = [
		['trainee:create', 'POST', '/trainees'],
		['trainee:update', 'PATCH', '/trainees/t1', { traineeId: 't1' }],
		['trainee:get', 'GET', '/trainees/t1', { traineeId: 't1' }],
		[
			'trainee:findByPhone',
			'GET',
			'/trainees/by-phone/%2B972501234567',
			{ phone: '+972501234567' },
		],
		['trainee:getMany', 'GET', '/trainees/search'],
		['trainee:delete', 'DELETE', '/trainees/t1', { traineeId: 't1' }],
		['plan:assign', 'POST', '/trainees/t1/subscription', { traineeId: 't1' }],
		['plan:freeze', 'POST', '/trainees/t1/subscription/freeze', { traineeId: 't1' }],
		['plan:reactivate', 'POST', '/trainees/t1/subscription/reactivate', { traineeId: 't1' }],
		['plan:cancel', 'POST', '/trainees/t1/subscription/cancel', { traineeId: 't1' }],
		['plan:getMany', 'GET', '/products'],
		['program:assign', 'POST', '/trainees/t1/programs/assign', { traineeId: 't1' }],
		['program:getMany', 'GET', '/trainees/t1/programs', { traineeId: 't1' }],
		['programTemplate:getMany', 'GET', '/program-templates'],
		['form:send', 'POST', '/trainees/t1/forms/assign', { traineeId: 't1' }],
		['form:getMany', 'GET', '/forms'],
		['formResponse:getMany', 'GET', '/trainees/t1/form-responses', { traineeId: 't1' }],
		['task:create', 'POST', '/tasks'],
		['task:update', 'PATCH', '/tasks/k1', { taskId: 'k1' }],
		['task:getMany', 'GET', '/tasks'],
		['message:send', 'POST', '/trainees/t1/message', { traineeId: 't1' }],
		['weight:log', 'POST', '/trainees/t1/weights', { traineeId: 't1' }],
		['weight:getMany', 'GET', '/trainees/t1/weights', { traineeId: 't1' }],
		['coach:getMany', 'GET', '/rpc/coaches'],
		['tag:getMany', 'GET', '/rpc/tags'],
		['studio:validate', 'GET', '/validate'],
	];

	it.each(cases)('%s is %s %s', (key, method, path, params = {}) => {
		const definition = OPERATIONS[key];
		expect(definition).toBeDefined();
		expect(definition.method).toBe(method);
		expect(definition.endpoint(params)).toBe(path);
	});

	it('covers exactly the operations the UI advertises', () => {
		expect(Object.keys(OPERATIONS)).toHaveLength(26);
	});

	it('URL-encodes path parameters', () => {
		expect(OPERATIONS['trainee:get'].endpoint({ traineeId: 'a/b c' })).toBe('/trainees/a%2Fb%20c');
	});

	it('marks every list endpoint as paginated and nothing else', () => {
		const paginated = Object.entries(OPERATIONS)
			.filter(([, d]) => d.paginated)
			.map(([k]) => k)
			.sort();
		expect(paginated).toEqual([
			'form:getMany',
			'formResponse:getMany',
			'plan:getMany',
			'program:getMany',
			'programTemplate:getMany',
			'task:getMany',
			'trainee:getMany',
			'weight:getMany',
		]);
	});

	it('rejects an unknown pairing loudly', () => {
		expect(() => getOperation('trainee', 'explode')).toThrow('Unsupported Perform operation');
	});
});

describe('helpers', () => {
	it('compact drops undefined only', () => {
		expect(compact({ a: undefined, b: '', c: null, d: 0, e: false })).toEqual({
			b: '',
			c: null,
			d: 0,
			e: false,
		});
	});

	it('findMissingRequired treats undefined, null and empty string as missing', () => {
		expect(
			findMissingRequired({ a: '', b: null, c: 0, d: 'x' }, ['a', 'b', 'c', 'd', 'e']),
		).toEqual(['a', 'b', 'e']);
	});

	it('splitTags accepts a comma-separated string or an array', () => {
		expect(splitTags(' vip, morning , ,')).toEqual(['vip', 'morning']);
		expect(splitTags(['a', ' b '])).toEqual(['a', 'b']);
		expect(splitTags(undefined)).toBeUndefined();
	});

	it('toIdList accepts the multiOptions array or an expression string', () => {
		expect(toIdList(['c1', 'c2'])).toEqual(['c1', 'c2']);
		expect(toIdList('c1,c2')).toEqual(['c1', 'c2']);
		expect(toIdList(undefined)).toBeUndefined();
	});

	it('normaliseTraineeFields converts the two list fields and leaves the rest alone', () => {
		expect(
			normaliseTraineeFields({ goal: 'cut', coachIds: ['c1'], tags: 'a,b', heightCm: 180 }),
		).toEqual({ goal: 'cut', coachIds: ['c1'], tags: ['a', 'b'], heightCm: 180 });
	});

	it('subscriptionOutput flattens the newest subscription and keeps the list', () => {
		const data = {
			subscription: [
				{ id: 's2', status: 'ACTIVE' },
				{ id: 's1', status: 'CANCELED' },
			],
		};
		expect(subscriptionOutput(data)).toEqual({
			id: 's2',
			status: 'ACTIVE',
			subscriptions: data.subscription,
		});
	});

	it('subscriptionOutput tolerates a single object', () => {
		expect(subscriptionOutput({ subscription: { id: 's1' } })).toEqual({
			id: 's1',
			subscriptions: [{ id: 's1' }],
		});
	});
});

describe('trainee bodies', () => {
	it('create sends the required fields, an explicit invite flag and the normalised extras', () => {
		const body = OPERATIONS['trainee:create'].buildBody?.({
			firstName: 'Dana',
			lastName: 'Cohen',
			phone: '0501234567',
			additionalFields: {
				externalId: 'row-7',
				onDuplicatePhone: 'return_existing',
				productId: 'p1',
				priceAgorot: 0,
				coachIds: ['c1', 'c2'],
				tags: 'vip, new',
				gender: 'FEMALE',
			},
		});
		expect(body).toEqual({
			firstName: 'Dana',
			lastName: 'Cohen',
			phone: '0501234567',
			sendWhatsappInvite: false,
			externalId: 'row-7',
			onDuplicatePhone: 'return_existing',
			productId: 'p1',
			priceAgorot: 0,
			coachIds: ['c1', 'c2'],
			tags: ['vip', 'new'],
			gender: 'FEMALE',
		});
	});

	it('create only sends the invite when it was switched on', () => {
		const body = OPERATIONS['trainee:create'].buildBody?.({
			firstName: 'a',
			lastName: 'b',
			phone: '1',
			sendWhatsappInvite: true,
		});
		expect(body?.sendWhatsappInvite).toBe(true);
	});

	it('create flattens the trainee and the created flag', () => {
		expect(
			OPERATIONS['trainee:create'].pickOutput?.({
				trainee: { id: 't1', name: 'Dana' },
				created: true,
			}),
		).toEqual({ id: 't1', name: 'Dana', created: true });
	});

	it('update sends only the chosen fields', () => {
		const body = OPERATIONS['trainee:update'].buildBody?.({
			traineeId: 't1',
			updateFields: { goal: 'bulk', notify: false, coachIds: ['c9'] },
		});
		expect(body).toEqual({ goal: 'bulk', notify: false, coachIds: ['c9'] });
	});

	it('get merges the subscriptions into the trainee', () => {
		expect(
			OPERATIONS['trainee:get'].pickOutput?.({
				trainee: { id: 't1' },
				subscriptions: [{ id: 's1' }],
			}),
		).toEqual({ id: 't1', subscriptions: [{ id: 's1' }] });
	});

	it('findByPhone reports found=false without a trainee instead of failing', () => {
		expect(OPERATIONS['trainee:findByPhone'].pickOutput?.({ found: false, trainee: null })).toEqual(
			{
				found: false,
			},
		);
		expect(
			OPERATIONS['trainee:findByPhone'].pickOutput?.({ found: true, trainee: { id: 't1' } }),
		).toEqual({ id: 't1', found: true });
	});

	it('getMany forwards the filters as query parameters', () => {
		expect(
			OPERATIONS['trainee:getMany'].buildQuery?.({
				filters: { q: 'dana', status: 'ACTIVE', coachId: 'c1' },
			}),
		).toEqual({ q: 'dana', status: 'ACTIVE', coachId: 'c1' });
		expect(OPERATIONS['trainee:getMany'].buildQuery?.({})).toEqual({});
	});

	it('delete refuses to run without the confirmation switch', () => {
		const definition = OPERATIONS['trainee:delete'];
		expect(definition.validate?.({ traineeId: 't1' })).toContain('Confirm Deletion');
		expect(definition.validate?.({ traineeId: 't1', confirm: false })).toContain(
			'Confirm Deletion',
		);
		expect(definition.validate?.({ traineeId: 't1', confirm: true })).toBeUndefined();
		expect(definition.buildBody?.({ traineeId: 't1', confirm: true })).toEqual({ confirm: true });
		expect(definition.pickOutput?.({ deleted: true })).toEqual({ deleted: true });
	});
});

describe('plan, program, form, task, message and weight bodies', () => {
	it('plan assign sends productId plus the terms', () => {
		expect(
			OPERATIONS['plan:assign'].buildBody?.({
				traineeId: 't1',
				productId: 'p1',
				additionalFields: { durationValue: 3, durationUnit: 'MONTHS', notify: false },
			}),
		).toEqual({ productId: 'p1', durationValue: 3, durationUnit: 'MONTHS', notify: false });
	});

	it('plan freeze and reactivate send an empty body', () => {
		expect(OPERATIONS['plan:freeze'].buildBody?.({ traineeId: 't1' })).toEqual({});
		expect(OPERATIONS['plan:reactivate'].buildBody?.({ traineeId: 't1' })).toEqual({});
	});

	it('plan cancel names the subscription', () => {
		expect(
			OPERATIONS['plan:cancel'].buildBody?.({ traineeId: 't1', subscriptionId: 's1' }),
		).toEqual({ subscriptionId: 's1' });
		expect(OPERATIONS['plan:cancel'].pickOutput?.({ subscriptions: [{ id: 's1' }] })).toEqual({
			subscriptions: [{ id: 's1' }],
		});
	});

	it('program assign sends the template and extras and returns the program', () => {
		expect(
			OPERATIONS['program:assign'].buildBody?.({
				traineeId: 't1',
				templateId: 'tpl',
				additionalFields: { replaceExisting: true, notify: false },
			}),
		).toEqual({ templateId: 'tpl', replaceExisting: true, notify: false });
		expect(OPERATIONS['program:assign'].pickOutput?.({ program: { id: 'pr1' } })).toEqual({
			id: 'pr1',
		});
	});

	it('form send returns the assignment', () => {
		expect(
			OPERATIONS['form:send'].buildBody?.({
				traineeId: 't1',
				formTemplateId: 'f1',
				additionalFields: { prompt: 'please' },
			}),
		).toEqual({ formTemplateId: 'f1', prompt: 'please' });
		expect(OPERATIONS['form:send'].pickOutput?.({ assignment: { id: 'as1' } })).toEqual({
			id: 'as1',
		});
	});

	it('task create and update return the task', () => {
		expect(
			OPERATIONS['task:create'].buildBody?.({
				title: 'Call',
				additionalFields: { clientId: 't1', priority: 3 },
			}),
		).toEqual({ title: 'Call', clientId: 't1', priority: 3 });
		expect(
			OPERATIONS['task:update'].buildBody?.({ taskId: 'k1', updateFields: { status: 'DONE' } }),
		).toEqual({ status: 'DONE' });
		expect(OPERATIONS['task:update'].pickOutput?.({ task: { id: 'k1' } })).toEqual({ id: 'k1' });
	});

	it('task getMany forwards filters', () => {
		expect(OPERATIONS['task:getMany'].buildQuery?.({ filters: { status: 'OPEN' } })).toEqual({
			status: 'OPEN',
		});
	});

	it('message send returns the sent count', () => {
		expect(OPERATIONS['message:send'].buildBody?.({ traineeId: 't1', message: 'hi' })).toEqual({
			message: 'hi',
		});
		expect(OPERATIONS['message:send'].pickOutput?.({ sent: 1 })).toEqual({ sent: 1 });
	});

	it('weight log returns the entry', () => {
		expect(
			OPERATIONS['weight:log'].buildBody?.({
				traineeId: 't1',
				weightKg: 81.5,
				additionalFields: { recordedAt: '2026-09-01T06:00:00.000Z' },
			}),
		).toEqual({ weightKg: 81.5, recordedAt: '2026-09-01T06:00:00.000Z' });
		expect(OPERATIONS['weight:log'].pickOutput?.({ entry: { id: 'w1' } })).toEqual({ id: 'w1' });
	});

	it('coach and tag lists turn the RPC rows into id/name pairs', () => {
		expect(
			OPERATIONS['coach:getMany'].pickOutput?.([
				{ id: 'c1', value: 'Bar' },
				{ id: 'c2', value: 'Noam' },
			]),
		).toEqual([
			{ id: 'c1', name: 'Bar' },
			{ id: 'c2', name: 'Noam' },
		]);
	});

	it('validate returns the studio record', () => {
		expect(OPERATIONS['studio:validate'].pickOutput?.({ studioName: 'Perform Gym' })).toEqual({
			studioName: 'Perform Gym',
		});
	});
});
