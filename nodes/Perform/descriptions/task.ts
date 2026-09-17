import type { INodeProperties } from 'n8n-workflow';
import { TASK_STATUS_OPTIONS, collectionField, dynamicOption, paginationFields } from './shared';

const RESOURCE = 'task';

const priorityField: INodeProperties = {
	displayName: 'Priority',
	name: 'priority',
	type: 'number',
	typeOptions: { minValue: 0, maxValue: 5 },
	default: 1,
	description: 'Priority from 0 (lowest) to 5 (highest)',
};

const traineeIdForTask: INodeProperties = {
	displayName: 'Trainee ID',
	name: 'clientId',
	type: 'string',
	default: '',
	description: 'ID of the trainee the task is about, as returned by the Trainee operations',
};

export const taskDescription: INodeProperties[] = [
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
				action: 'Create a task for a coach',
				description: 'Open a task in the coach task list',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many tasks',
				description: 'Search tasks by status, trainee or coach',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a task',
				description: 'Change the status, priority or snooze date of an existing task',
			},
		],
	},

	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: [RESOURCE], operation: ['create'] } },
	},

	collectionField(
		'Additional Fields',
		'additionalFields',
		RESOURCE,
		['create'],
		[
			dynamicOption('Coach Name or ID', 'coachId', 'getCoaches', 'Coach responsible for the task.'),
			{
				displayName: 'Detail',
				name: 'detail',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
			},
			{
				displayName: 'Due Date',
				name: 'dueAt',
				type: 'dateTime',
				default: '',
			},
			priorityField,
			traineeIdForTask,
		],
	),

	{
		displayName: 'Task ID',
		name: 'taskId',
		type: 'string',
		required: true,
		default: '',
		description: 'ID of the task, as returned by Task → Create or Get Many',
		displayOptions: { show: { resource: [RESOURCE], operation: ['update'] } },
	},

	collectionField(
		'Update Fields',
		'updateFields',
		RESOURCE,
		['update'],
		[
			priorityField,
			{
				displayName: 'Snooze Until',
				name: 'snoozeUntil',
				type: 'dateTime',
				default: '',
				description: 'Hide the task until this date',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: TASK_STATUS_OPTIONS,
				default: 'OPEN',
			},
		],
	),

	...paginationFields(RESOURCE, ['getMany']),
	collectionField(
		'Filters',
		'filters',
		RESOURCE,
		['getMany'],
		[
			dynamicOption('Coach Name or ID', 'coachId', 'getCoaches', 'Only tasks of this coach.'),
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: TASK_STATUS_OPTIONS,
				default: 'OPEN',
			},
			traineeIdForTask,
		],
	),
];
