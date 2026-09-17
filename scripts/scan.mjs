/**
 * Runs n8n's own community-node verification gate against this repo, locally,
 * before publishing.
 *
 * Why this exists: n8n's CLI (`npx @n8n/scan-community-package <name>`) only
 * works on an ALREADY-PUBLISHED package. It reads the npm provenance
 * attestation, downloads the attested GitHub source, and lints both that source
 * and the shipped tarball - useless as a pre-publish check. This calls the
 * scanner's analyzePackage() directly on local directories instead.
 *
 * The scanner is installed into an isolated prefix rather than as a
 * devDependency: hoisted alongside our own TypeScript it breaks, because its
 * nested ts-api-utils resolves the wrong typescript and dies with
 * "Cannot read properties of undefined (reading 'Intrinsic')".
 *
 * Run with:  npm run scan
 *
 * Two legs are checked, mirroring what n8n does:
 *   1. SOURCE - this working tree, standing in for the attested GitHub checkout
 *   2. DIST   - the built output, standing in for the published tarball
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const toolDir = resolve(root, '.scan-tool');
const scannerEntry = resolve(
	toolDir,
	'node_modules/@n8n/scan-community-package/scanner/scanner.mjs',
);

if (!existsSync(dist)) {
	console.error('dist/ is missing. Run `npm run build` first.');
	process.exit(1);
}

if (!existsSync(scannerEntry)) {
	console.log('Installing @n8n/scan-community-package into .scan-tool (first run only)...');
	const install = spawnSync(
		'npm',
		['install', '@n8n/scan-community-package', '--prefix', toolDir, '--ignore-scripts', '--no-save'],
		// shell: true is required on Windows - Node refuses to spawn npm.cmd
		// directly since the .bat/.cmd argument-injection fix.
		{ stdio: 'inherit', shell: true },
	);
	if (install.status !== 0) {
		console.error('Failed to install the scanner.');
		process.exit(1);
	}
}

const { analyzePackage } = await import(pathToFileURL(scannerEntry).href);

const legs = [
	['SOURCE (stands in for the attested GitHub checkout)', root],
	['DIST (stands in for the published tarball)', dist],
];

let failed = false;

for (const [label, dir] of legs) {
	const result = await analyzePackage(dir);
	console.log(`\n===== ${label} =====`);
	if (result.passed) {
		console.log('PASSED');
	} else {
		failed = true;
		console.log(`FAILED: ${result.message}`);
		if (result.details) console.log(result.details);
	}
}

console.log('');
if (failed) {
	console.error('n8n would REJECT this package for verification. Fix the errors above.');
	process.exit(1);
}
console.log('n8n would ACCEPT this package for verification.');
