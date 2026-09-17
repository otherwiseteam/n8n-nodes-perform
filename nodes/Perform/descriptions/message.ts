import type { INodeProperties } from 'n8n-workflow';
import { traineeIdField } from './shared';

const RESOURCE = 'message';

export const messageDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'send',
		displayOptions: { show: { resource: [RESOURCE] } },
		options: [
			{
				name: 'Send',
				value: 'send',
				action: 'Send a message to a trainee',
				description: 'Send a message that appears to the trainee inside the Perform app',
			},
		],
	},

	traineeIdField(RESOURCE, ['send']),

	{
		displayName: 'Message',
		name: 'message',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		description: 'Text of the message, up to 1000 characters',
		displayOptions: { show: { resource: [RESOURCE], operation: ['send'] } },
	},
];
