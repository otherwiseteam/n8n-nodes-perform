import type { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { performApiRequest } from '../transport/request';

interface DropdownItem {
	id?: unknown;
	value?: unknown;
	name?: unknown;
	label?: unknown;
}

/**
 * Every RPC dropdown returns `[{ id, value }]` where id is the key and value is
 * the label. An empty array is a normal result (a studio with no tags yet),
 * never an error, so this never throws.
 */
export function mapDropdownItems(data: unknown): INodePropertyOptions[] {
	if (!Array.isArray(data)) return [];

	return (data as DropdownItem[])
		.filter((item) => item?.id !== undefined && item.id !== null && item.id !== '')
		.map((item) => ({
			name: String(item.value ?? item.label ?? item.name ?? item.id),
			value: String(item.id),
		}));
}

async function dropdown(ctx: ILoadOptionsFunctions, path: string): Promise<INodePropertyOptions[]> {
	return mapDropdownItems(await performApiRequest(ctx, 'GET', path));
}

/** Path of the RPC endpoint behind each dropdown, shared with the live scripts and tests. */
export const RPC_PATHS = {
	getCoaches: '/rpc/coaches',
	getForms: '/rpc/forms',
	getPlans: '/rpc/products',
	getProgramTemplates: '/rpc/program-templates',
	getTags: '/rpc/tags',
} as const;

export const loadOptions = {
	async getCoaches(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return dropdown(this, RPC_PATHS.getCoaches);
	},

	async getForms(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return dropdown(this, RPC_PATHS.getForms);
	},

	/** Plans are called "products" by the API; the UI says Plan throughout. */
	async getPlans(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return dropdown(this, RPC_PATHS.getPlans);
	},

	async getProgramTemplates(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return dropdown(this, RPC_PATHS.getProgramTemplates);
	},

	async getTags(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return dropdown(this, RPC_PATHS.getTags);
	},
};
