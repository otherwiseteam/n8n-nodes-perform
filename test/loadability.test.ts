/**
 * Guards the load path itself.
 *
 * `inputs: [NodeConnectionTypes.Main]` throws during class construction on
 * older n8n installs where that export does not exist, and n8n reports it as
 * "Class could not be found. Please check if the class is named correctly."
 * These tests assert both nodes and the credential construct even when
 * n8n-workflow lacks the newer export.
 */
describe('nodes load under an older n8n-workflow', () => {
	beforeEach(() => {
		jest.resetModules();
	});

	afterEach(() => {
		jest.resetModules();
		jest.unmock('n8n-workflow');
	});

	it('constructs when NodeConnectionTypes is absent', () => {
		jest.doMock('n8n-workflow', () => {
			const actual = jest.requireActual('n8n-workflow');
			return { ...actual, NodeConnectionTypes: undefined };
		});

		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { Perform } = require('../nodes/Perform/Perform.node');
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { PerformTrigger } = require('../nodes/PerformTrigger/PerformTrigger.node');

		const node = new Perform();
		expect(node.description.inputs).toEqual(['main']);
		expect(node.description.outputs).toEqual(['main']);

		const trigger = new PerformTrigger();
		expect(trigger.description.inputs).toEqual([]);
		expect(trigger.description.outputs).toEqual(['main']);
	});

	it('constructs normally when NodeConnectionTypes is present', () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { Perform } = require('../nodes/Perform/Perform.node');
		const node = new Perform();
		expect(node.description.inputs).toEqual(['main']);
		expect(node.description.outputs).toEqual(['main']);
	});
});

describe('class names match what n8n derives from the filenames', () => {
	it('Perform.node.js exports a class named Perform', () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const mod = require('../nodes/Perform/Perform.node');
		expect(typeof mod.Perform).toBe('function');
		expect(() => new mod.Perform()).not.toThrow();
	});

	it('PerformTrigger.node.js exports a class named PerformTrigger', () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const mod = require('../nodes/PerformTrigger/PerformTrigger.node');
		expect(typeof mod.PerformTrigger).toBe('function');
		expect(() => new mod.PerformTrigger()).not.toThrow();
	});

	it('PerformApi.credentials.js exports a class named PerformApi', () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const mod = require('../credentials/PerformApi.credentials');
		expect(typeof mod.PerformApi).toBe('function');
		expect(() => new mod.PerformApi()).not.toThrow();
	});
});
