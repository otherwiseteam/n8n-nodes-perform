import type { INodeProperties } from 'n8n-workflow';

export const studioDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'validate',
		displayOptions: { show: { resource: ['studio'] } },
		options: [
			{
				name: 'Validate',
				value: 'validate',
				action: 'Validate the API key',
				description: 'Confirm the API key works and return the name of the studio it belongs to',
			},
		],
	},
];

export const coachDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'getMany',
		displayOptions: { show: { resource: ['coach'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many coaches',
				description: 'List the coaches of the studio',
			},
		],
	},
];

export const tagDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'getMany',
		displayOptions: { show: { resource: ['tag'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many tags',
				description: 'List the tags in use in the studio',
			},
		],
	},
];
