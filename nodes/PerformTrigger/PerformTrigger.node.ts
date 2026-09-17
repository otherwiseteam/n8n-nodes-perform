import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	NodeConnectionType,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { loadOptions } from '../Perform/methods/loadOptions';
import { performApiRequest } from '../Perform/transport/request';

/** See Perform.node.ts for why this is resolved defensively. */
const MAIN_CONNECTION: NodeConnectionType = NodeConnectionTypes?.Main ?? 'main';

/** The one event Perform's webhook API publishes today. */
export const FORM_FILLED_EVENT = 'FORM_FILLED';

interface HookStaticData extends IDataObject {
	hookId?: string;
}

/** Pulls Perform's subscription id out of the create-hook response, whatever its nesting. */
export function extractHookId(data: unknown): string | undefined {
	if (typeof data !== 'object' || data === null) return undefined;
	const record = data as IDataObject;
	const hook = record.hook;
	const candidate =
		typeof hook === 'object' && hook !== null
			? (hook as IDataObject).id
			: (record.hookId ?? record.id);
	return typeof candidate === 'string' && candidate !== '' ? candidate : undefined;
}

export class PerformTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Perform Trigger',
		name: 'performTrigger',
		icon: { light: 'file:perform.svg', dark: 'file:perform.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"] === "FORM_FILLED" ? "Form Filled" : $parameter["event"]}}',
		description: 'Starts the workflow when a trainee fills a form in Perform',
		defaults: { name: 'Perform Trigger' },
		inputs: [],
		outputs: [MAIN_CONNECTION],
		credentials: [{ name: 'performApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Form Filled',
						value: FORM_FILLED_EVENT,
						description: 'A trainee submitted a form (intake, check-in or one-time)',
					},
				],
				default: FORM_FILLED_EVENT,
			},
			{
				displayName: 'Form Name or ID',
				name: 'formTemplateId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getForms' },
				default: '',
				description:
					'Only fire for this form. Leave empty to fire for every form a trainee fills. Only published, active forms are listed. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				displayOptions: { show: { event: [FORM_FILLED_EVENT] } },
			},
		],
	};

	methods = { loadOptions: { getForms: loadOptions.getForms } };

	webhookMethods = {
		default: {
			/**
			 * Perform exposes no endpoint to list subscriptions, so the id stored
			 * when the hook was created is the only evidence it exists. If the
			 * hook was removed on Perform's side, deactivate and reactivate the
			 * workflow to register a fresh one.
			 */
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node') as HookStaticData;
				return typeof staticData.hookId === 'string' && staticData.hookId !== '';
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node') as HookStaticData;
				const targetUrl = this.getNodeWebhookUrl('default');
				const event = this.getNodeParameter('event', FORM_FILLED_EVENT) as string;
				const formTemplateId = this.getNodeParameter('formTemplateId', '') as string;

				const body: IDataObject = { event, targetUrl };
				if (formTemplateId !== '') body.formTemplateId = formTemplateId;

				const data = await performApiRequest(this, 'POST', '/hooks', body);
				const hookId = extractHookId(data);
				if (hookId === undefined) {
					throw new NodeOperationError(
						this.getNode(),
						'Perform created the webhook but returned no hook ID, so it could not be tracked. Delete it in Perform before trying again.',
					);
				}

				staticData.hookId = hookId;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node') as HookStaticData;
				const hookId = staticData.hookId;
				if (typeof hookId !== 'string' || hookId === '') return true;

				try {
					await performApiRequest(this, 'DELETE', `/hooks/${encodeURIComponent(hookId)}`);
				} catch (error) {
					// Returning false tells n8n the remote side could not be cleaned
					// up; the stored id is kept so a later attempt can retry.
					this.logger.warn(
						`Perform Trigger: could not delete webhook ${hookId}: ${(error as Error).message}`,
					);
					return false;
				}

				delete staticData.hookId;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData() as IDataObject;
		return {
			workflowData: [this.helpers.returnJsonArray(body)],
		};
	}
}
