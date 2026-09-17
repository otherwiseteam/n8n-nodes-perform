/**
 * Reproduces exactly how n8n loads a community node, and prints the REAL error.
 *
 * n8n rewrites any TypeError raised while loading a node class into:
 *
 *   "Class could not be found. Please check if the class is named correctly."
 *
 * That message is almost always wrong - the class is usually found, and the
 * constructor threw. This script performs the identical load and shows the
 * actual error and stack.
 *
 * Run it ON THE MACHINE RUNNING n8n:
 *
 *   node diagnose-load.cjs
 *
 * Optionally point it at a specific package directory:
 *
 *   node diagnose-load.cjs /path/to/node_modules/n8n-nodes-perform
 */
const vm = require('vm');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PACKAGE = 'n8n-nodes-perform';

function findPackageDir() {
	if (process.argv[2]) return path.resolve(process.argv[2]);

	const candidates = [
		path.join(os.homedir(), '.n8n', 'nodes', 'node_modules', PACKAGE),
		path.join(process.cwd(), 'node_modules', PACKAGE),
		path.join(process.cwd(), PACKAGE),
	];
	return candidates.find((dir) => fs.existsSync(path.join(dir, 'package.json')));
}

const dir = findPackageDir();

console.log('environment');
console.log('  node        :', process.version);
console.log('  platform    :', process.platform, process.arch);

if (!dir) {
	console.log('');
	console.log('Could not find the package. Install it first:');
	console.log('  mkdir -p ~/.n8n/nodes && cd ~/.n8n/nodes && npm init -y && npm install ' + PACKAGE);
	console.log('Or pass the directory explicitly:  node diagnose-load.cjs <dir>');
	process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
console.log('  package dir :', dir);
console.log('  version     :', manifest.version);

// Which n8n-workflow will the node actually resolve at runtime?
let workflowVersion = 'NOT RESOLVABLE from the package directory';
try {
	const resolved = require.resolve('n8n-workflow/package.json', { paths: [dir] });
	workflowVersion = JSON.parse(fs.readFileSync(resolved, 'utf8')).version + '  (' + resolved + ')';
} catch {
	// leave the default message
}
console.log('  n8n-workflow:', workflowVersion);
console.log('');

const entries = [
	...(manifest.n8n?.nodes ?? []),
	...(manifest.n8n?.credentials ?? []),
];

if (entries.length === 0) {
	console.log('The package manifest lists no nodes or credentials - that alone would fail.');
	process.exit(1);
}

// n8n loads each class inside a VM context whose only global is `require`.
const context = vm.createContext({ require });
let failures = 0;

for (const entry of entries) {
	// n8n derives the class name from the filename, stripping the .node /
	// .credentials suffix: "Perform.node.js" -> "Perform".
	const [className] = path.parse(entry).name.split('.');
	let filePath = path.join(dir, entry);
	if (process.platform === 'win32') filePath = filePath.replace(/\\/g, '/');

	process.stdout.write(className.padEnd(16) + ' ');

	if (!fs.existsSync(filePath)) {
		failures += 1;
		console.log('FILE MISSING: ' + filePath);
		continue;
	}

	try {
		const script = new vm.Script("new (require('" + filePath + "')." + className + ')()');
		const instance = script.runInContext(context);
		const name = instance?.description?.displayName ?? instance?.displayName ?? '(loaded)';
		console.log('OK   ' + name);
	} catch (error) {
		failures += 1;
		console.log('FAILED');
		console.log('  error type : ' + error.constructor.name);
		console.log('  message    : ' + error.message);
		console.log('  n8n would report this as "Class could not be found": ' + (error instanceof TypeError));
		console.log('  stack:');
		console.log(
			String(error.stack || '')
				.split('\n')
				.slice(0, 12)
				.map((l) => '    ' + l)
				.join('\n'),
		);
	}
}

console.log('');
if (failures > 0) {
	console.log(failures + ' class(es) failed to load. The error above is the real cause.');
	process.exit(1);
}
console.log('All classes loaded. n8n should be able to load this package.');
