import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { Perform } from '../nodes/Perform/Perform.node';
import { OPERATIONS } from '../nodes/Perform/operations/registry';

const node = new Perform();

function advertisedOperations(): string[] {
	const advertised: string[] = [];
	for (const prop of node.description.properties) {
		if (prop.name !== 'operation') continue;
		const forResources = (prop.displayOptions?.show?.resource as string[] | undefined) ?? [];
		for (const resource of forResources) {
			for (const option of prop.options ?? []) {
				advertised.push(`${resource}:${(option as INodePropertyOptions).value as string}`);
			}
		}
	}
	return advertised;
}

describe('Perform node description', () => {
	it('declares the credential', () => {
		expect(node.description.credentials).toEqual([{ name: 'performApi', required: true }]);
	});

	it('is usable as an AI agent tool', () => {
		expect(node.description.usableAsTool).toBe(true);
	});

	it('references distinct light and dark icons', () => {
		const icon = node.description.icon as { light: string; dark: string };
		expect(icon.light).toBe('file:perform.svg');
		expect(icon.dark).toBe('file:perform.dark.svg');
		expect(icon.light).not.toBe(icon.dark);
	});
});

describe('Perform method wiring', () => {
	it('registers every loadOptions method the descriptions reference', () => {
		const referenced = new Set<string>();
		const walk = (props: INodeProperties[]): void => {
			for (const prop of props) {
				const method = (prop.typeOptions as { loadOptionsMethod?: string } | undefined)
					?.loadOptionsMethod;
				if (typeof method === 'string') referenced.add(method);
				for (const option of prop.options ?? []) {
					if ('values' in option) walk(option.values as INodeProperties[]);
					if ('type' in option && 'name' in option && 'default' in option) {
						walk([option as INodeProperties]);
					}
				}
			}
		};
		walk(node.description.properties);

		const registered = Object.keys(node.methods?.loadOptions ?? {});
		expect(Array.from(referenced).sort()).toEqual([
			'getCoaches',
			'getForms',
			'getPlans',
			'getProgramTemplates',
			'getTags',
		]);
		for (const method of referenced) expect(registered).toContain(method);
	});
});

describe('Perform resource and operation coverage', () => {
	const resourceProp = node.description.properties.find((p) => p.name === 'resource');
	const resources = (resourceProp?.options ?? []).map((o) => (o as INodePropertyOptions).value);

	it('lists an operation property for every resource option', () => {
		expect(resources).toHaveLength(12);
		for (const value of resources) {
			const hasOperation = node.description.properties.some(
				(p) =>
					p.name === 'operation' &&
					(p.displayOptions?.show?.resource as string[] | undefined)?.includes(value as string),
			);
			expect(hasOperation).toBe(true);
		}
	});

	it('backs every advertised resource:operation pair with a registry entry', () => {
		const advertised = advertisedOperations();
		expect(advertised).toHaveLength(26);
		for (const key of advertised) expect(Object.keys(OPERATIONS)).toContain(key);
	});

	it('advertises every registry operation in the UI, leaving nothing unreachable', () => {
		const advertised = advertisedOperations();
		for (const key of Object.keys(OPERATIONS)) expect(advertised).toContain(key);
	});

	it('gives every paginated operation a Return All and Limit pair', () => {
		for (const [key, definition] of Object.entries(OPERATIONS)) {
			if (!definition.paginated) continue;
			const [resource, operation] = key.split(':');
			for (const name of ['returnAll', 'limit']) {
				const present = node.description.properties.some(
					(p) =>
						p.name === name &&
						(p.displayOptions?.show?.resource as string[]).includes(resource) &&
						(p.displayOptions?.show?.operation as string[]).includes(operation),
				);
				expect(present).toBe(true);
			}
		}
	});

	it('shows a Trainee ID field for every operation whose endpoint needs one', () => {
		for (const [key, definition] of Object.entries(OPERATIONS)) {
			if (!definition.required.includes('traineeId')) continue;
			const [resource, operation] = key.split(':');
			const present = node.description.properties.some(
				(p) =>
					p.name === 'traineeId' &&
					(p.displayOptions?.show?.resource as string[]).includes(resource) &&
					(p.displayOptions?.show?.operation as string[]).includes(operation),
			);
			expect(present).toBe(true);
		}
	});
});
