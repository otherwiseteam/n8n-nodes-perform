import type { INodeProperties } from 'n8n-workflow';
import { collectionField, dynamicOption, paginationFields, traineeIdField } from './shared';

const RESOURCE = 'form';

export const formDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'send',
		displayOptions: { show: { resource: [RESOURCE] } },
		options: [
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many forms',
				description: 'List the forms defined in the studio',
			},
			{
				name: 'Send',
				value: 'send',
				action: 'Send a form to a trainee',
				description: 'Send a trainee a form to fill in the app',
			},
		],
	},

	traineeIdField(RESOURCE, ['send']),

	dynamicOption('Form Name or ID', 'formTemplateId', 'getForms', 'Form to send.', {
		required: true,
		displayOptions: { show: { resource: [RESOURCE], operation: ['send'] } },
	}),

	collectionField(
		'Additional Fields',
		'additionalFields',
		RESOURCE,
		['send'],
		[
			{
				displayName: 'Due Date',
				name: 'dueAt',
				type: 'dateTime',
				default: '',
				description: 'When the trainee should have filled the form by',
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Free text shown to the trainee alongside the form (up to 500 characters)',
			},
		],
	),

	...paginationFields(RESOURCE, ['getMany']),
];

export const formResponseDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'getMany',
		displayOptions: { show: { resource: ['formResponse'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many form responses of a trainee',
				description: 'List the forms a trainee has filled',
			},
		],
	},

	traineeIdField('formResponse', ['getMany']),

	...paginationFields('formResponse', ['getMany']),
];
