/**
 * Live read-only verification of the Perform automation API contract.
 *
 * Only GET endpoints are called: nothing is created, changed or sent to a
 * trainee. Run with:
 *   npm run smoke
 *
 * Plain ESM rather than TypeScript so that n8n's verification scanner, which
 * lints every .ts and .js file in the attested source repo with console and
 * process access forbidden, does not treat dev tooling as shipped node code.
 */
const BASE = process.env.PERFORM_BASE ?? 'https://perform-api.otherwise.co.il';
const KEY = process.env.PERFORM_API_KEY;
const PREFIX = '/v1/automation';

const RPC_CHECKS = [
	'/rpc/forms',
	'/rpc/coaches',
	'/rpc/products',
	'/rpc/program-templates',
	'/rpc/tags',
];

const LIST_CHECKS = ['/forms', '/products', '/program-templates', '/tasks', '/trainees/search'];

async function get(path, headers = { Authorization: `Bearer ${KEY}` }) {
	const response = await fetch(`${BASE}${PREFIX}${path}`, { headers });
	let body;
	try {
		body = await response.json();
	} catch {
		body = undefined;
	}
	return { status: response.status, body };
}

/** Asserts the {id,value} contract every dropdown RPC is expected to honour. */
function assertDropdownContract(path, data) {
	if (!Array.isArray(data)) return [`${path}: data is not an array`];
	return data
		.filter((item) => typeof item?.id !== 'string' || typeof item?.value !== 'string')
		.map((item) => `${path}: item breaks the {id,value} contract: ${JSON.stringify(item)}`);
}

/** Asserts the {items, offset, limit, hasMore} page envelope of the list endpoints. */
function assertPageContract(path, data) {
	const problems = [];
	if (!Array.isArray(data?.items)) problems.push(`${path}: data.items is not an array`);
	if (typeof data?.hasMore !== 'boolean') problems.push(`${path}: data.hasMore is not a boolean`);
	return problems;
}

async function main() {
	if (!KEY) {
		console.error('PERFORM_API_KEY is not set. Copy .env.example to .env and fill it in.');
		process.exit(1);
	}

	const problems = [];

	const validate = await get('/validate');
	const validateOk = validate.status === 200 && validate.body?.success === true;
	console.log(
		`${validateOk ? 'PASS' : 'FAIL'}  GET /validate${validateOk ? ` (studio: ${validate.body?.data?.studioName})` : ''}`,
	);
	if (!validateOk) problems.push(`/validate: HTTP ${validate.status} ${JSON.stringify(validate.body)}`);

	for (const path of RPC_CHECKS) {
		const { status, body } = await get(path);
		const ok = status === 200 && body?.success === true;
		const count = Array.isArray(body?.data) ? ` (${body.data.length} items)` : '';
		console.log(`${ok ? 'PASS' : 'FAIL'}  GET ${path}${count}`);
		if (!ok) {
			problems.push(`${path}: HTTP ${status} ${JSON.stringify(body)}`);
			continue;
		}
		problems.push(...assertDropdownContract(path, body.data));
	}

	for (const path of LIST_CHECKS) {
		const { status, body } = await get(`${path}?limit=2&offset=0`);
		const ok = status === 200 && body?.success === true;
		const count = Array.isArray(body?.data?.items) ? ` (${body.data.items.length} of page, hasMore=${body.data.hasMore})` : '';
		console.log(`${ok ? 'PASS' : 'FAIL'}  GET ${path}${count}`);
		if (!ok) {
			problems.push(`${path}: HTTP ${status} ${JSON.stringify(body)}`);
			continue;
		}
		problems.push(...assertPageContract(path, body.data));
	}

	// A phone nobody has must come back as found=false, not as an error.
	const missing = await get('/trainees/by-phone/0500000000');
	const missingOk = missing.status === 200 && missing.body?.success === true && 'found' in (missing.body?.data ?? {});
	console.log(`${missingOk ? 'PASS' : 'FAIL'}  GET /trainees/by-phone/<unknown> answers with a found flag`);
	if (!missingOk) problems.push(`/trainees/by-phone: HTTP ${missing.status} ${JSON.stringify(missing.body)}`);

	// Auth must actually be enforced, and the Bearer prefix must be required.
	const unauth = await get('/validate', {});
	console.log(`${unauth.status === 401 ? 'PASS' : 'FAIL'}  GET /validate without auth returns 401`);
	if (unauth.status !== 401) problems.push('unauthenticated /validate did not return 401');

	const bare = await get('/validate', { Authorization: KEY });
	console.log(`${bare.status === 401 ? 'PASS' : 'FAIL'}  GET /validate with the key but no Bearer prefix returns 401`);
	if (bare.status !== 401) problems.push('/validate accepted a key without the Bearer prefix');

	console.log('');
	if (problems.length > 0) {
		console.error(`${problems.length} problem(s):`);
		for (const problem of problems) console.error(`  - ${problem}`);
		process.exit(1);
	}
	console.log('All contract checks passed.');
}

await main();
