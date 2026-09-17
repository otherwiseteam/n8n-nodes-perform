import type { INodeProperties } from 'n8n-workflow';
import {
	collectionField,
	dynamicOption,
	notifyField,
	paginationFields,
	traineeIdField,
} from './shared';

const RESOURCE = 'program';

export const programDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'assign',
		displayOptions: { show: { resource: [RESOURCE] } },
		options: [
			{
				name: 'Assign',
				value: 'assign',
				action: 'Assign a program to a trainee',
				description: 'Assign a workout program to a trainee from an existing template',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many programs of a trainee',
				description: 'List the programs assigned to a trainee',
			},
		],
	},

	traineeIdField(RESOURCE, ['assign', 'getMany']),

	dynamicOption(
		'Program Template Name or ID',
		'templateId',
		'getProgramTemplates',
		'Template to build the program from.',
		{
			required: true,
			displayOptions: { show: { resource: [RESOURCE], operation: ['assign'] } },
		},
	),

	collectionField(
		'Additional Fields',
		'additionalFields',
		RESOURCE,
		['assign'],
		[
			notifyField,
			{
				displayName: 'Replace Existing',
				name: 'replaceExisting',
				type: 'boolean',
				default: false,
				description:
					'Whether to assign the program even when the trainee already has an active program from the same template. Off skips the duplicate; on creates a second program alongside it.',
			},
			{
				displayName: 'Start Date',
				name: 'startsOn',
				type: 'dateTime',
				default: '',
			},
		],
	),

	...paginationFields(RESOURCE, ['getMany']),
];

export const programTemplateDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'getMany',
		displayOptions: { show: { resource: ['programTemplate'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many program templates',
				description: 'List the program templates defined in the studio',
			},
		],
	},

	...paginationFields('programTemplate', ['getMany']),
];
