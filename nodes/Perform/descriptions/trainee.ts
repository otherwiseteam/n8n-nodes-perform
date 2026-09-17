import type { INodeProperties } from 'n8n-workflow';
import {
	DUPLICATE_PHONE_OPTIONS,
	TRAINEE_STATUS_OPTIONS,
	collectionField,
	dynamicOption,
	notifyField,
	paginationFields,
	planTermsFields,
	traineeIdField,
	traineeProfileFields,
} from './shared';

const RESOURCE = 'trainee';

const sendWhatsappInviteDescription =
	'Whether to send the trainee a WhatsApp message with a link to download the app. This is the only contact a trainee receives on creation, so keep it off for bulk imports.';

export const traineeDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'create',
		displayOptions: { show: { resource: [RESOURCE] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a trainee',
				description:
					'Create a trainee in the studio, optionally assigning a plan, coaches and forms in the same call',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a trainee',
				description: 'Delete a trainee and their entire history. Irreversible.',
			},
			{
				name: 'Find by Phone',
				value: 'findByPhone',
				action: 'Find a trainee by phone number',
				description:
					'Look a trainee up by phone number. No match returns found=false rather than an error, so it can be routed on.',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a trainee',
				description: 'Get a single trainee by ID, including their subscriptions',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many trainees',
				description: 'Search trainees by name, phone, status, coach or tag',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a trainee',
				description: 'Update an existing trainee. Fields that are not sent stay unchanged.',
			},
		],
	},

	// ---- Create --------------------------------------------------------------
	{
		displayName: 'First Name',
		name: 'firstName',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: [RESOURCE], operation: ['create'] } },
	},
	{
		displayName: 'Last Name',
		name: 'lastName',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: [RESOURCE], operation: ['create'] } },
	},
	{
		displayName: 'Phone',
		name: 'phone',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0501234567',
		description:
			'Any format works (0501234567, 972501234567, +972-50-123-4567). Perform normalises it server-side.',
		displayOptions: { show: { resource: [RESOURCE], operation: ['create', 'findByPhone'] } },
	},
	{
		displayName: 'Send WhatsApp Invite',
		name: 'sendWhatsappInvite',
		type: 'boolean',
		default: false,
		description: sendWhatsappInviteDescription,
		displayOptions: { show: { resource: [RESOURCE], operation: ['create'] } },
	},
	collectionField(
		'Additional Fields',
		'additionalFields',
		RESOURCE,
		['create'],
		[
			...traineeProfileFields,
			...planTermsFields,
			{
				displayName: 'External ID',
				name: 'externalId',
				type: 'string',
				default: '',
				description:
					'Stable ID from the system the trainee comes from (a sheet row, a CRM contact, a payment). Re-running the workflow with the same External ID returns the existing trainee instead of creating a duplicate.',
			},
			{
				displayName: 'On Duplicate Phone',
				name: 'onDuplicatePhone',
				type: 'options',
				options: DUPLICATE_PHONE_OPTIONS,
				default: 'error',
				description: 'What to do when a trainee with this phone number already exists',
			},
			dynamicOption(
				'Plan Name or ID',
				'productId',
				'getPlans',
				'Plan to assign on creation. Choosing one also opens an active subscription for the trainee.',
			),
		],
	),

	// ---- Get / Update / Delete -------------------------------------------------
	traineeIdField(RESOURCE, ['get', 'update', 'delete']),

	collectionField(
		'Update Fields',
		'updateFields',
		RESOURCE,
		['update'],
		[
			...traineeProfileFields,
			{
				displayName: 'First Name',
				name: 'firstName',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Last Name',
				name: 'lastName',
				type: 'string',
				default: '',
			},
			notifyField,
			{
				displayName: 'Phone',
				name: 'phone',
				type: 'string',
				default: '',
				description: 'Any format works. Perform normalises it server-side.',
			},
			{
				displayName: 'Send WhatsApp Invite',
				name: 'sendWhatsappInvite',
				type: 'boolean',
				default: false,
				description: sendWhatsappInviteDescription,
			},
		],
	),

	{
		displayName: 'Confirm Deletion',
		name: 'confirm',
		type: 'boolean',
		default: false,
		description:
			'Whether you really want this. Deleting a trainee also deletes every workout, measurement and form response of theirs, and nothing can be restored. The node refuses to send the request while this is off.',
		displayOptions: { show: { resource: [RESOURCE], operation: ['delete'] } },
	},

	// ---- Get Many --------------------------------------------------------------
	...paginationFields(RESOURCE, ['getMany']),
	collectionField(
		'Filters',
		'filters',
		RESOURCE,
		['getMany'],
		[
			dynamicOption('Coach Name or ID', 'coachId', 'getCoaches', 'Only trainees of this coach.'),
			{
				displayName: 'Created After',
				name: 'createdAfter',
				type: 'dateTime',
				default: '',
			},
			{
				displayName: 'Search Text',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Matches against name or phone number',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: TRAINEE_STATUS_OPTIONS,
				default: 'ACTIVE',
			},
			dynamicOption('Tag Name or ID', 'tag', 'getTags', 'Only trainees carrying this tag.'),
			{
				displayName: 'Updated After',
				name: 'updatedAfter',
				type: 'dateTime',
				default: '',
			},
		],
	),
];
