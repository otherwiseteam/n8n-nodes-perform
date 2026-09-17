module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	testMatch: ['**/test/**/*.test.ts'],
	transform: {
		'^.+\.ts$': ['ts-jest', { tsconfig: { strict: true, esModuleInterop: true, target: 'es2019', module: 'commonjs' } }],
	},
};
