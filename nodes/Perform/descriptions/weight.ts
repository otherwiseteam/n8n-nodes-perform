import type { INodeProperties } from 'n8n-workflow';
import { collectionField, paginationFields, traineeIdField } from './shared';

const RESOURCE = 'weight';

export const weightDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'log',
		displayOptions: { show: { resource: [RESOURCE] } },
		options: [
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many weight entries of a trainee',
				description: 'List the weight history of a trainee',
			},
			{
				name: 'Log',
				value: 'log',
				action: 'Log a weight measurement for a trainee',
				description: 'Record a weight measurement for a trainee',
			},
		],
	},

	traineeIdField(RESOURCE, ['log', 'getMany']),

	{
		displayName: 'Weight (Kg)',
		name: 'weightKg',
		type: 'number',
		required: true,
		default: 0,
		typeOptions: { numberPrecision: 2 },
		displayOptions: { show: { resource: [RESOURCE], operation: ['log'] } },
	},

	collectionField(
		'Additional Fields',
		'additionalFields',
		RESOURCE,
		['log'],
		[
			{
				displayName: 'Recorded At',
				name: 'recordedAt',
				type: 'dateTime',
				default: '',
				description: 'When the measurement was taken. Defaults to now.',
			},
		],
	),

	...paginationFields(RESOURCE, ['getMany']),
];
