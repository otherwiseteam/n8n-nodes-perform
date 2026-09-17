import type { INodeProperties } from 'n8n-workflow';
import {
	collectionField,
	dynamicOption,
	notifyField,
	paginationFields,
	planTermsFields,
	startDateField,
	traineeIdField,
} from './shared';

const RESOURCE = 'plan';

export const planDescription: INodeProperties[] = [
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
				action: 'Assign or renew a plan for a trainee',
				description: 'Assign a new plan to a trainee, or renew an existing one',
			},
			{
				name: 'Cancel',
				value: 'cancel',
				action: 'Cancel a subscription of a trainee',
				description: 'Cancel one subscription and return the updated subscription list',
			},
			{
				name: 'Freeze',
				value: 'freeze',
				action: 'Freeze the active plan of a trainee',
				description: 'Freeze the active plan and return the updated subscription list',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many plans',
				description: 'List the plans (products) defined in the studio',
			},
			{
				name: 'Reactivate',
				value: 'reactivate',
				action: 'Reactivate a frozen plan of a trainee',
				description: 'Reactivate a frozen plan and return the updated subscription list',
			},
		],
	},

	traineeIdField(RESOURCE, ['assign', 'cancel', 'freeze', 'reactivate']),

	dynamicOption('Plan Name or ID', 'productId', 'getPlans', 'Plan to assign.', {
		required: true,
		displayOptions: { show: { resource: [RESOURCE], operation: ['assign'] } },
	}),

	collectionField(
		'Additional Fields',
		'additionalFields',
		RESOURCE,
		['assign'],
		[...planTermsFields, notifyField, startDateField],
	),

	{
		displayName: 'Subscription ID',
		name: 'subscriptionId',
		type: 'string',
		required: true,
		default: '',
		description:
			'ID of the subscription to cancel, taken from the subscriptions array of Trainee → Get or Plan → Assign',
		displayOptions: { show: { resource: [RESOURCE], operation: ['cancel'] } },
	},

	...paginationFields(RESOURCE, ['getMany']),
];
