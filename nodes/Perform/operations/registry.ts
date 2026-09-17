import type { IDataObject } from 'n8n-workflow';

export type OperationParams = Record<string, unknown>;

export type Output = IDataObject | IDataObject[];

export interface OperationDefinition {
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
	/** Builds the path under /v1/automation. Path parameters are URL-encoded here. */
	endpoint: (params: OperationParams) => string;
	/** Top-level parameters that must be non-empty before a request is spent. */
	required: string[];
	/** Extra local check; returns a message to fail with, or undefined when fine. */
	validate?: (params: OperationParams) => string | undefined;
	buildBody?: (params: OperationParams) => IDataObject;
	buildQuery?: (params: OperationParams) => IDataObject;
	/**
	 * List endpoints answer `{ items, offset, limit, hasMore }` and are walked
	 * with Return All / Limit. Their rows are emitted one per n8n item.
	 */
	paginated?: boolean;
	/** Shapes the unwrapped `data` into what the workflow sees. Defaults to `data` itself. */
	pickOutput?: (data: unknown) => Output;
}

/**
 * Drops only `undefined`. Empty strings, null and 0 are kept: 0 is a valid
 * price (a free plan) and the API is the authority on what an empty value
 * means for each field.
 */
export function compact(input: Record<string, unknown>): IDataObject {
	const output: IDataObject = {};
	for (const [key, value] of Object.entries(input)) {
		if (value !== undefined) output[key] = value as IDataObject[string];
	}
	return output;
}

export function findMissingRequired(params: OperationParams, required: string[]): string[] {
	return required.filter((key) => {
		const value = params[key];
		return value === undefined || value === null || value === '';
	});
}

export function asRecord(value: unknown): IDataObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as IDataObject)
		: {};
}

function collection(params: OperationParams, name: string): IDataObject {
	return asRecord(params[name]);
}

/** Path segments are encoded so a phone number such as +972... survives the URL. */
function segment(value: unknown): string {
	return encodeURIComponent(String(value ?? '').trim());
}

/**
 * Tags arrive as a comma-separated string from the UI, or already as an array
 * when set through an expression. Returns undefined when the field is absent
 * so it is not sent at all.
 */
export function splitTags(value: unknown): string[] | undefined {
	if (value === undefined || value === null) return undefined;
	if (Array.isArray(value))
		return value.map((tag) => String(tag).trim()).filter((tag) => tag !== '');
	return String(value)
		.split(',')
		.map((tag) => tag.trim())
		.filter((tag) => tag !== '');
}

/** Coach IDs come from a multiOptions field (array) or an expression (array or comma-separated string). */
export function toIdList(value: unknown): string[] | undefined {
	if (value === undefined || value === null) return undefined;
	if (Array.isArray(value)) return value.map((id) => String(id).trim()).filter((id) => id !== '');
	return splitTags(value);
}

/** Applies the array conversions to the trainee profile fields shared by Create and Update. */
export function normaliseTraineeFields(fields: IDataObject): IDataObject {
	const { coachIds, tags, ...rest } = fields;
	return compact({
		...rest,
		coachIds: toIdList(coachIds),
		tags: splitTags(tags),
	});
}

function listItems(data: unknown): IDataObject[] {
	if (Array.isArray(data)) return data as IDataObject[];
	const items = asRecord(data).items;
	return Array.isArray(items) ? (items as IDataObject[]) : [];
}

/** RPC endpoints answer `[{ id, value }]`; the workflow gets `{ id, name }`. */
function rpcRows(data: unknown): IDataObject[] {
	return listItems(data).map((row) => ({ id: row.id, name: row.value ?? row.name ?? row.label }));
}

/**
 * Plan → Assign answers `data.subscription` as an array with the newly created
 * subscription first. The first entry is flattened into the output and the
 * whole list kept under `subscriptions`, matching the shape of Trainee → Get.
 */
export function subscriptionOutput(data: unknown): IDataObject {
	const raw = asRecord(data).subscription ?? asRecord(data).subscriptions;
	const list = Array.isArray(raw)
		? (raw as IDataObject[])
		: raw !== undefined
			? [asRecord(raw)]
			: [];
	return { ...(list[0] ?? {}), subscriptions: list };
}

const CONFIRM_DELETE_MESSAGE =
	'Enable "Confirm Deletion" to delete the trainee. Deletion is irreversible and removes every workout, measurement and form response of theirs.';

export const OPERATIONS: Record<string, OperationDefinition> = {
	// ---- Trainee ---------------------------------------------------------------
	'trainee:create': {
		method: 'POST',
		endpoint: () => '/trainees',
		required: ['firstName', 'lastName', 'phone'],
		buildBody: (p) =>
			compact({
				firstName: p.firstName,
				lastName: p.lastName,
				phone: p.phone,
				// Always explicit: an accidental invite reaches a real person.
				sendWhatsappInvite: p.sendWhatsappInvite === true,
				...normaliseTraineeFields(collection(p, 'additionalFields')),
			}),
		pickOutput: (data) => ({
			...asRecord(asRecord(data).trainee),
			created: asRecord(data).created === true,
		}),
	},

	'trainee:update': {
		method: 'PATCH',
		endpoint: (p) => `/trainees/${segment(p.traineeId)}`,
		required: ['traineeId'],
		buildBody: (p) => normaliseTraineeFields(collection(p, 'updateFields')),
		pickOutput: (data) => asRecord(asRecord(data).trainee),
	},

	'trainee:get': {
		method: 'GET',
		endpoint: (p) => `/trainees/${segment(p.traineeId)}`,
		required: ['traineeId'],
		pickOutput: (data) => ({
			...asRecord(asRecord(data).trainee),
			subscriptions: Array.isArray(asRecord(data).subscriptions)
				? asRecord(data).subscriptions
				: [],
		}),
	},

	'trainee:findByPhone': {
		method: 'GET',
		endpoint: (p) => `/trainees/by-phone/${segment(p.phone)}`,
		required: ['phone'],
		pickOutput: (data) => ({
			...asRecord(asRecord(data).trainee),
			found: asRecord(data).found === true,
		}),
	},

	'trainee:getMany': {
		method: 'GET',
		endpoint: () => '/trainees/search',
		required: [],
		paginated: true,
		buildQuery: (p) => compact({ ...collection(p, 'filters') }),
	},

	'trainee:delete': {
		method: 'DELETE',
		endpoint: (p) => `/trainees/${segment(p.traineeId)}`,
		required: ['traineeId'],
		validate: (p) => (p.confirm === true ? undefined : CONFIRM_DELETE_MESSAGE),
		buildBody: () => ({ confirm: true }),
		pickOutput: (data) => ({ deleted: asRecord(data).deleted === true }),
	},

	// ---- Plan ------------------------------------------------------------------
	'plan:assign': {
		method: 'POST',
		endpoint: (p) => `/trainees/${segment(p.traineeId)}/subscription`,
		required: ['traineeId', 'productId'],
		buildBody: (p) => compact({ productId: p.productId, ...collection(p, 'additionalFields') }),
		pickOutput: subscriptionOutput,
	},

	'plan:freeze': {
		method: 'POST',
		endpoint: (p) => `/trainees/${segment(p.traineeId)}/subscription/freeze`,
		required: ['traineeId'],
		buildBody: () => ({}),
		pickOutput: (data) => ({ subscriptions: asRecord(data).subscriptions ?? [] }),
	},

	'plan:reactivate': {
		method: 'POST',
		endpoint: (p) => `/trainees/${segment(p.traineeId)}/subscription/reactivate`,
		required: ['traineeId'],
		buildBody: () => ({}),
		pickOutput: (data) => ({ subscriptions: asRecord(data).subscriptions ?? [] }),
	},

	'plan:cancel': {
		method: 'POST',
		endpoint: (p) => `/trainees/${segment(p.traineeId)}/subscription/cancel`,
		required: ['traineeId', 'subscriptionId'],
		buildBody: (p) => ({ subscriptionId: p.subscriptionId as string }),
		pickOutput: (data) => ({ subscriptions: asRecord(data).subscriptions ?? [] }),
	},

	'plan:getMany': {
		method: 'GET',
		endpoint: () => '/products',
		required: [],
		paginated: true,
	},

	// ---- Program ---------------------------------------------------------------
	'program:assign': {
		method: 'POST',
		endpoint: (p) => `/trainees/${segment(p.traineeId)}/programs/assign`,
		required: ['traineeId', 'templateId'],
		buildBody: (p) => compact({ templateId: p.templateId, ...collection(p, 'additionalFields') }),
		pickOutput: (data) => asRecord(asRecord(data).program),
	},

	'program:getMany': {
		method: 'GET',
		endpoint: (p) => `/trainees/${segment(p.traineeId)}/programs`,
		required: ['traineeId'],
		paginated: true,
	},

	'programTemplate:getMany': {
		method: 'GET',
		endpoint: () => '/program-templates',
		required: [],
		paginated: true,
	},

	// ---- Form ------------------------------------------------------------------
	'form:send': {
		method: 'POST',
		endpoint: (p) => `/trainees/${segment(p.traineeId)}/forms/assign`,
		required: ['traineeId', 'formTemplateId'],
		buildBody: (p) =>
			compact({ formTemplateId: p.formTemplateId, ...collection(p, 'additionalFields') }),
		pickOutput: (data) => asRecord(asRecord(data).assignment),
	},

	'form:getMany': {
		method: 'GET',
		endpoint: () => '/forms',
		required: [],
		paginated: true,
	},

	'formResponse:getMany': {
		method: 'GET',
		endpoint: (p) => `/trainees/${segment(p.traineeId)}/form-responses`,
		required: ['traineeId'],
		paginated: true,
	},

	// ---- Task ------------------------------------------------------------------
	'task:create': {
		method: 'POST',
		endpoint: () => '/tasks',
		required: ['title'],
		buildBody: (p) => compact({ title: p.title, ...collection(p, 'additionalFields') }),
		pickOutput: (data) => asRecord(asRecord(data).task),
	},

	'task:update': {
		method: 'PATCH',
		endpoint: (p) => `/tasks/${segment(p.taskId)}`,
		required: ['taskId'],
		buildBody: (p) => compact({ ...collection(p, 'updateFields') }),
		pickOutput: (data) => asRecord(asRecord(data).task),
	},

	'task:getMany': {
		method: 'GET',
		endpoint: () => '/tasks',
		required: [],
		paginated: true,
		buildQuery: (p) => compact({ ...collection(p, 'filters') }),
	},

	// ---- Message ---------------------------------------------------------------
	'message:send': {
		method: 'POST',
		endpoint: (p) => `/trainees/${segment(p.traineeId)}/message`,
		required: ['traineeId', 'message'],
		buildBody: (p) => ({ message: p.message as string }),
		pickOutput: (data) => ({ sent: asRecord(data).sent }),
	},

	// ---- Weight ----------------------------------------------------------------
	'weight:log': {
		method: 'POST',
		endpoint: (p) => `/trainees/${segment(p.traineeId)}/weights`,
		required: ['traineeId', 'weightKg'],
		buildBody: (p) => compact({ weightKg: p.weightKg, ...collection(p, 'additionalFields') }),
		pickOutput: (data) => asRecord(asRecord(data).entry),
	},

	'weight:getMany': {
		method: 'GET',
		endpoint: (p) => `/trainees/${segment(p.traineeId)}/weights`,
		required: ['traineeId'],
		paginated: true,
	},

	// ---- Studio-level lists and validation -------------------------------------
	'coach:getMany': {
		method: 'GET',
		endpoint: () => '/rpc/coaches',
		required: [],
		pickOutput: rpcRows,
	},

	'tag:getMany': {
		method: 'GET',
		endpoint: () => '/rpc/tags',
		required: [],
		pickOutput: rpcRows,
	},

	'studio:validate': {
		method: 'GET',
		endpoint: () => '/validate',
		required: [],
		pickOutput: (data) => asRecord(data),
	},
};

export function getOperation(resource: string, operation: string): OperationDefinition {
	const key = `${resource}:${operation}`;
	const definition = OPERATIONS[key];
	if (definition === undefined) {
		throw new Error(`Unsupported Perform operation: ${key}`);
	}
	return definition;
}
