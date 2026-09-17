module.exports = {
	root: true,
	env: { browser: true, es6: true, node: true },
	parser: '@typescript-eslint/parser',
	parserOptions: { project: ['./tsconfig.json'], sourceType: 'module', extraFileExtensions: ['.json'] },
	ignorePatterns: ['.eslintrc.js', '**/*.js', '**/node_modules/**', '**/dist/**', 'test/**', 'scripts/**'],
	overrides: [
		{
			files: ['package.json'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/community'],
			parserOptions: { project: null, extraFileExtensions: ['.json'] },
			rules: { 'n8n-nodes-base/community-package-json-name-still-default': 'off' },
		},
		{
			files: ['./credentials/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/credentials'],
			rules: {
				// Both disabled by n8n's own verification scanner
				// (@n8n/scan-community-package), which is the authority here: the
				// miscased autofix rewrites a valid https URL into camelCase, and
				// the community-nodes credential-password-field rule supersedes the
				// password-missing check.
				'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
				'n8n-nodes-base/cred-class-field-type-options-password-missing': 'off',
			},
		},
		{
			files: ['./nodes/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/nodes'],
			rules: {
				// Disabled by n8n's verification scanner: inputs/outputs must use
				// the NodeConnectionTypes enum, which these rules reject in favour
				// of the string literal "main". The scanner's
				// @n8n/community-nodes/node-connection-type-literal rule requires
				// the enum, so these two must be off or the two gates conflict.
				'n8n-nodes-base/node-class-description-inputs-wrong-regular-node': 'off',
				'n8n-nodes-base/node-class-description-inputs-wrong-trigger-node': 'off',
				'n8n-nodes-base/node-class-description-outputs-wrong': 'off',
				'n8n-nodes-base/node-param-type-options-max-value-present': 'off',
			},
		},
	],
};
