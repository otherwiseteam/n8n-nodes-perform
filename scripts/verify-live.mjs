/**
 * Drives the node's REAL loadOptions and execute code against the live Perform
 * API through a minimal fake n8n context.
 *
 * This verifies what the node UI would actually render (every dropdown) and
 * that the read-only operations produce items, without needing an n8n
 * instance. Nothing is created, changed or sent to a trainee. Run with:
 *   npm run build && npm run verify:live
 *
 * Plain ESM rather than TypeScript so that n8n's verification scanner, which
 * lints every .ts and .js file in the attested source repo with console and
 * process access forbidden, does not treat dev tooling as shipped node code.
 */
import { loadOptions } from '../dist/nodes/Perform/methods/loadOptions.js';
import { Perform } from '../dist/nodes/Perform/Perform.node.js';

const BASE = process.env.PERFORM_BASE ?? 'https://perform-api.otherwise.co.il';
const KEY = process.env.PERFORM_API_KEY;

let requestCount = 0;

/** Performs the request the way n8n's authenticated helper would. */
async function httpRequestWithAuthentication(_credentialType, options) {
	requestCount += 1;
	const url = new URL(options.url);
	for (const [key, value] of Object.entries(options.qs ?? {})) {
		if (value !== undefined) url.searchParams.set(key, String(value));
	}

	const response = await fetch(url.toString(), {
		method: options.method ?? 'GET',
		headers: {
			Authorization: `Bearer ${KEY}`,
			...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
		},
		body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
	});

	const body = await response.json();
	if (!response.ok) {
		const error = new Error(body?.message ?? `HTTP ${response.status}`);
		error.response = { data: body };
		throw error;
	}
	return body;
}

/** Builds a fake context exposing only the surface the node touches. */
function context(params = {}) {
	return {
		getCredentials: async () => ({ apiKey: KEY, baseUrl: BASE }),
		getNode: () => ({ name: 'Perform', type: 'perform' }),
		getNodeParameter: (name, ...rest) => {
			if (name in params) return params[name];
			// Load-options context passes the fallback as the 2nd argument and
			// tolerates absent parameters.
			if (typeof rest[0] !== 'number') return rest[0];
			// Execute context: real n8n THROWS for a parameter outside the active
			// operation's set, and an undefined fallback does not suppress it.
			throw new Error(`Could not get parameter "${name}"`);
		},
		getInputData: () => [{ json: {} }],
		continueOnFail: () => false,
		helpers: { httpRequestWithAuthentication },
	};
}

function line(label, value) {
	console.log(`  ${label.padEnd(34)} ${value}`);
}

async function run(params) {
	const result = await new Perform().execute.call(context(params));
	return result[0].map((item) => item.json);
}

async function main() {
	if (!KEY) {
		console.error('PERFORM_API_KEY is not set. Copy .env.example to .env and fill it in.');
		process.exit(1);
	}

	const problems = [];

	console.log('\n== Credential / connection ==');
	const [studio] = await run({ resource: 'studio', operation: 'validate' });
	line('studioName', String(studio.studioName));
	if (!studio.studioName) problems.push('validate returned no studioName');

	console.log('\n== Dropdowns (what each picker will show) ==');
	const dropdowns = [
		['Plans', 'getPlans'],
		['Program templates', 'getProgramTemplates'],
		['Forms', 'getForms'],
		['Coaches', 'getCoaches'],
		['Tags', 'getTags'],
	];
	for (const [label, method] of dropdowns) {
		const items = await loadOptions[method].call(context());
		const shown = items.length > 0 ? items.map((i) => i.name).join(', ') : '(empty)';
		line(`${label} [${items.length}]`, shown);
		for (const item of items) {
			if (item.name === '' || item.value === '') {
				problems.push(`${label}: produced an option with a blank name or value`);
			}
		}
	}

	console.log('\n== Read-only operations ==');
	const lists = [
		['plan:getMany', { resource: 'plan', operation: 'getMany', returnAll: false, limit: 3 }],
		['programTemplate:getMany', { resource: 'programTemplate', operation: 'getMany', returnAll: false, limit: 3 }],
		['form:getMany', { resource: 'form', operation: 'getMany', returnAll: false, limit: 3 }],
		['task:getMany', { resource: 'task', operation: 'getMany', returnAll: false, limit: 3, filters: {} }],
		['trainee:getMany', { resource: 'trainee', operation: 'getMany', returnAll: false, limit: 3, filters: {} }],
		['coach:getMany', { resource: 'coach', operation: 'getMany' }],
		['tag:getMany', { resource: 'tag', operation: 'getMany' }],
	];
	let sampleTrainee;
	for (const [label, params] of lists) {
		const rows = await run(params);
		line(`${label} [${rows.length}]`, rows.length > 0 ? JSON.stringify(rows[0]).slice(0, 80) : '(empty)');
		if (label === 'trainee:getMany' && rows.length > 0) sampleTrainee = rows[0];
	}

	if (sampleTrainee) {
		console.log(`\n== Per-trainee reads (${sampleTrainee.name ?? sampleTrainee.id}) ==`);
		const traineeId = sampleTrainee.id;
		const [got] = await run({ resource: 'trainee', operation: 'get', traineeId });
		line('trainee:get', `${got.id} with ${Array.isArray(got.subscriptions) ? got.subscriptions.length : '?'} subscription(s)`);
		if (got.id !== traineeId) problems.push('trainee:get returned a different trainee');

		const [found] = await run({ resource: 'trainee', operation: 'findByPhone', phone: sampleTrainee.phone });
		line('trainee:findByPhone', `found=${found.found} id=${found.id}`);
		if (found.found !== true || found.id !== traineeId) problems.push('findByPhone did not resolve the sample trainee');

		for (const [resource] of [['program'], ['formResponse'], ['weight']]) {
			const rows = await run({ resource, operation: 'getMany', traineeId, returnAll: true });
			line(`${resource}:getMany [${rows.length}]`, rows.length > 0 ? JSON.stringify(rows[0]).slice(0, 80) : '(empty)');
		}
	} else {
		line('per-trainee reads', 'skipped, studio has no trainees');
	}

	const [missing] = await run({ resource: 'trainee', operation: 'findByPhone', phone: '0500000000' });
	line('findByPhone (unknown number)', `found=${missing.found}`);
	if (missing.found !== false) problems.push('an unknown phone number did not come back as found=false');

	console.log('\n== Client-side validation (no request spent) ==');
	const before = requestCount;
	try {
		await run({ resource: 'trainee', operation: 'delete', traineeId: 'x', confirm: false });
		problems.push('a delete without confirmation was not rejected locally');
	} catch (error) {
		line('error message', error.message);
		if (requestCount !== before) problems.push('validation failure still issued an HTTP request');
		else line('requests spent', '0 (correct)');
	}

	console.log(`\n${requestCount} live requests made, nothing written.`);
	if (problems.length > 0) {
		console.error(`\n${problems.length} problem(s):`);
		for (const problem of problems) console.error(`  - ${problem}`);
		process.exit(1);
	}
	console.log('All live UI-behaviour checks passed.\n');
}

await main();
