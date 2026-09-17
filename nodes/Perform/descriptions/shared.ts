import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	default: 'trainee',
	options: [
		{ name: 'Coach', value: 'coach' },
		{ name: 'Form', value: 'form' },
		{ name: 'Form Response', value: 'formResponse' },
		{ name: 'Message', value: 'message' },
		{ name: 'Plan', value: 'plan' },
		{ name: 'Program', value: 'program' },
		{ name: 'Program Template', value: 'programTemplate' },
		{ name: 'Studio', value: 'studio' },
		{ name: 'Tag', value: 'tag' },
		{ name: 'Task', value: 'task' },
		{ name: 'Trainee', value: 'trainee' },
		{ name: 'Weight', value: 'weight' },
	],
};

/** n8n's required wording for dropdowns that also accept an expression. */
export const EXPRESSION_HINT =
	'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.';

export const TRAINEE_STATUS_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Active', value: 'ACTIVE' },
	{ name: 'Archived', value: 'ARCHIVED' },
	{ name: 'Churn Risk', value: 'CHURN_RISK' },
	{ name: 'Churned', value: 'CHURNED' },
	{ name: 'Paused', value: 'PAUSED' },
];

export const TASK_STATUS_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Dismissed', value: 'DISMISSED' },
	{ name: 'Done', value: 'DONE' },
	{ name: 'Open', value: 'OPEN' },
	{ name: 'Snoozed', value: 'SNOOZED' },
];

export const GENDER_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Female', value: 'FEMALE' },
	{ name: 'Male', value: 'MALE' },
	{ name: 'Other', value: 'OTHER' },
];

export const DURATION_UNIT_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Days', value: 'DAYS' },
	{ name: 'Months', value: 'MONTHS' },
];

export const UPDATE_CADENCE_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Biweekly', value: 'BIWEEKLY' },
	{ name: 'Monthly', value: 'MONTHLY' },
	{ name: 'Weekly', value: 'WEEKLY' },
];

export const DUPLICATE_PHONE_OPTIONS: INodePropertyOptions[] = [
	{
		name: 'Error',
		value: 'error',
		description: 'Fail the item so the duplicate is noticed',
	},
	{
		name: 'Return Existing',
		value: 'return_existing',
		description: 'Return the trainee that already has this phone number without creating anything',
	},
	{
		name: 'Update Existing',
		value: 'update',
		description: 'Overwrite the existing trainee with the values sent here',
	},
];

function show(resource: string, operations: string[]): INodeProperties['displayOptions'] {
	return { show: { resource: [resource], operation: operations } };
}

/** Builds the Trainee ID field that most operations start with. */
export function traineeIdField(resource: string, operations: string[]): INodeProperties {
	return {
		displayName: 'Trainee ID',
		name: 'traineeId',
		type: 'string',
		required: true,
		default: '',
		description:
			'ID of the trainee, as returned by Trainee → Create, Get Many or Find by Phone. Not the phone number.',
		displayOptions: show(resource, operations),
	};
}

/** Builds the Return All / Limit pair every list operation needs. */
export function paginationFields(resource: string, operations: string[]): INodeProperties[] {
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions: show(resource, operations),
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			typeOptions: { minValue: 1 },
			default: 50,
			description: 'Max number of results to return',
			displayOptions: {
				show: { resource: [resource], operation: operations, returnAll: [false] },
			},
		},
	];
}

/** Builds a collection scoped to the given operations. */
export function collectionField(
	displayName: 'Additional Fields' | 'Update Fields' | 'Filters',
	name: 'additionalFields' | 'updateFields' | 'filters',
	resource: string,
	operations: string[],
	options: INodeProperties[],
): INodeProperties {
	return {
		displayName,
		name,
		type: 'collection',
		placeholder: displayName === 'Filters' ? 'Add Filter' : 'Add Field',
		default: {},
		options: sortByDisplayName(options),
		displayOptions: show(resource, operations),
	};
}

/** n8n's linter wants collection entries alphabetised; sorting here keeps the source lists readable. */
export function sortByDisplayName(fields: INodeProperties[]): INodeProperties[] {
	return [...fields].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** Builds a dropdown fed by one of the RPC endpoints. */
export function dynamicOption(
	displayName: string,
	name: string,
	loadOptionsMethod: string,
	description: string,
	extra: Partial<INodeProperties> = {},
): INodeProperties {
	return {
		displayName,
		name,
		type: 'options',
		typeOptions: { loadOptionsMethod },
		default: '',
		description: `${description} ${EXPRESSION_HINT}`,
		...extra,
	};
}

export const coachNamesOrIdsField: INodeProperties = {
	displayName: 'Coach Names or IDs',
	name: 'coachIds',
	type: 'multiOptions',
	typeOptions: { loadOptionsMethod: 'getCoaches' },
	default: [],
	description:
		'Coaches responsible for the trainee. The first one is the primary coach. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
};

export const notifyField: INodeProperties = {
	displayName: 'Notify Trainee',
	name: 'notify',
	type: 'boolean',
	default: true,
	description:
		'Whether to send the trainee an in-app notification about the change. Turn off when tidying data in the background.',
};

export const startDateField: INodeProperties = {
	displayName: 'Start Date',
	name: 'startedOn',
	type: 'dateTime',
	default: '',
};

/** Profile fields shared by Trainee → Create (Additional Fields) and Trainee → Update (Update Fields). */
export const traineeProfileFields: INodeProperties[] = [
	{
		displayName: 'Birth Date',
		name: 'birthDate',
		type: 'dateTime',
		default: '',
	},
	coachNamesOrIdsField,
	{
		displayName: 'Daily Steps Goal',
		name: 'stepsGoal',
		type: 'number',
		default: 0,
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		default: '',
	},
	{
		displayName: 'Gender',
		name: 'gender',
		type: 'options',
		options: GENDER_OPTIONS,
		default: 'FEMALE',
	},
	{
		displayName: 'Goal',
		name: 'goal',
		type: 'string',
		default: '',
		description: 'Free-text training goal shown on the trainee profile',
	},
	{
		displayName: 'Height (Cm)',
		name: 'heightCm',
		type: 'number',
		default: 0,
	},
	dynamicOption(
		'Onboarding Form Name or ID',
		'onboardingFormId',
		'getForms',
		'Intake form the trainee fills once.',
	),
	startDateField,
	{
		displayName: 'Tags',
		name: 'tags',
		type: 'string',
		default: '',
		placeholder: 'vip, morning-group',
		description: 'Comma-separated list of tags to set on the trainee',
	},
	{
		displayName: 'Update Cadence',
		name: 'updateCadence',
		type: 'options',
		options: UPDATE_CADENCE_OPTIONS,
		default: 'WEEKLY',
		description: 'How often the trainee is asked to fill the periodic update form',
	},
	dynamicOption(
		'Update Form Name or ID',
		'updateFormId',
		'getForms',
		'Check-in form the trainee fills periodically.',
	),
	{
		displayName: 'Water Goal (Ml)',
		name: 'waterGoalMl',
		type: 'number',
		default: 0,
	},
	{
		displayName: 'Weight (Kg)',
		name: 'weightKg',
		type: 'number',
		default: 0,
	},
];

/** Plan pricing and duration overrides, shared by Trainee → Create and Plan → Assign. */
export const planTermsFields: INodeProperties[] = [
	{
		displayName: 'Duration',
		name: 'durationValue',
		type: 'number',
		default: 1,
		description:
			'How long the plan runs for this trainee, in the Duration Unit. Required for plans that define no duration of their own (listed as "price per trainee" in the Plan dropdown); the API says exactly what is missing otherwise.',
	},
	{
		displayName: 'Duration Unit',
		name: 'durationUnit',
		type: 'options',
		options: DURATION_UNIT_OPTIONS,
		default: 'MONTHS',
		description: 'Defaults to the unit defined on the plan itself',
	},
	{
		displayName: 'Price (Agorot)',
		name: 'priceAgorot',
		type: 'number',
		default: 0,
		description:
			'Price in agorot, not shekels: 19000 = ₪190. Overrides the price defined on the plan. 0 is a valid price (free plan); leave the field out to record no price at all.',
	},
];
