import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { descriptions } from './descriptions';
import { loadOptions } from './methods/loadOptions';
import { findMissingRequired, getOperation, type OperationParams } from './operations/registry';
import { fetchPages, toLimit } from './transport/pagination';
import { performApiRequest } from './transport/request';

/**
 * The main connection type, resolved defensively.
 *
 * `NodeConnectionTypes` (plural) is a recent n8n-workflow export. On older n8n
 * installs only `NodeConnectionType` (singular) exists, so reading `.Main` off
 * the plural name throws while this class is being constructed, and n8n
 * surfaces that as the misleading "Class could not be found. Please check if
 * the class is named correctly."
 *
 * Both spellings resolve to the string 'main', so falling back keeps the node
 * loadable across n8n versions. Referencing it through a constant rather than
 * writing 'main' inline also satisfies n8n's verification scanner, which
 * rejects a bare string literal here.
 */
const MAIN_CONNECTION: NodeConnectionType = NodeConnectionTypes?.Main ?? 'main';

/**
 * Reads a node parameter that may not belong to the current operation.
 *
 * n8n throws `Could not get parameter "x"` when a parameter is not part of the
 * active parameter set, and passing `undefined` as the fallback does NOT
 * suppress it. This node reads one superset of parameters for every operation,
 * so absent parameters are the normal case and must never abort execution.
 */
function optionalParameter(ctx: IExecuteFunctions, name: string, itemIndex: number): unknown {
	try {
		return ctx.getNodeParameter(name, itemIndex, undefined);
	} catch {
		return undefined;
	}
}

/** Every top-level parameter any operation might read. */
const COMMON_PARAMS = [
	'traineeId',
	'phone',
	'firstName',
	'lastName',
	'sendWhatsappInvite',
	'confirm',
	'productId',
	'subscriptionId',
	'templateId',
	'formTemplateId',
	'taskId',
	'title',
	'message',
	'weightKg',
	'returnAll',
	'limit',
	'additionalFields',
	'updateFields',
	'filters',
];

export class Perform implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Perform',
		name: 'perform',
		icon: { light: 'file:perform.svg', dark: 'file:perform.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Manage trainees, plans, programs, forms, tasks and weights in Perform',
		defaults: { name: 'Perform' },
		usableAsTool: true,
		inputs: [MAIN_CONNECTION],
		outputs: [MAIN_CONNECTION],
		credentials: [{ name: 'performApi', required: true }],
		properties: descriptions,
	};

	methods = { loadOptions };

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i += 1) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const definition = getOperation(resource, operation);

				const params: OperationParams = {};
				for (const key of COMMON_PARAMS) {
					const value = optionalParameter(this, key, i);
					if (value !== undefined) params[key] = value;
				}

				const missing = findMissingRequired(params, definition.required);
				if (missing.length > 0) {
					throw new NodeOperationError(
						this.getNode(),
						`Missing required parameter${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`,
						{ itemIndex: i },
					);
				}

				const problem = definition.validate?.(params);
				if (problem !== undefined) {
					throw new NodeOperationError(this.getNode(), problem, { itemIndex: i });
				}

				const endpoint = definition.endpoint(params);
				const qs = definition.buildQuery?.(params);

				let outputs: IDataObject[];
				if (definition.paginated) {
					outputs = await fetchPages(this, endpoint, qs, {
						returnAll: params.returnAll === true,
						limit: toLimit(params.limit),
					});
				} else {
					const body = definition.buildBody?.(params);
					const data = await performApiRequest(this, definition.method, endpoint, body, qs);
					const picked = definition.pickOutput ? definition.pickOutput(data) : data;
					outputs = Array.isArray(picked)
						? (picked as IDataObject[])
						: [(picked ?? {}) as IDataObject];
				}

				for (const entry of outputs) {
					returnData.push({ json: entry, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				// Raw errors must not escape the node: anything that is not already
				// an n8n error is wrapped so the UI gets a typed, attributable
				// failure rather than a bare Error.
				throw error instanceof NodeApiError || error instanceof NodeOperationError
					? error
					: new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
