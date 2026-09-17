import { PerformApi } from '../credentials/PerformApi.credentials';

const credential = new PerformApi();

describe('PerformApi credential', () => {
	it('is named the way the nodes reference it', () => {
		expect(credential.name).toBe('performApi');
		expect(credential.displayName).toBe('Perform API');
	});

	it('stores the key as a password field', () => {
		const apiKey = credential.properties.find((p) => p.name === 'apiKey');
		expect(apiKey?.typeOptions).toEqual({ password: true });
		expect(apiKey?.required).toBe(true);
	});

	it('sends the key as a Bearer token, which the API insists on', () => {
		const headers = (credential.authenticate.properties as { headers: Record<string, string> })
			.headers;
		expect(headers.Authorization).toBe('=Bearer {{$credentials.apiKey}}');
	});

	it('tests against the validate endpoint under the configured base URL', () => {
		expect(credential.test.request.baseURL).toBe('={{$credentials.baseUrl}}');
		expect(credential.test.request.url).toBe('/v1/automation/validate');
	});

	it('defaults the base URL to the hosted API', () => {
		const baseUrl = credential.properties.find((p) => p.name === 'baseUrl');
		expect(baseUrl?.default).toBe('https://perform-api.otherwise.co.il');
	});

	it('references distinct light and dark icons', () => {
		const icon = credential.icon as { light: string; dark: string };
		expect(icon.light).toBe('file:perform.svg');
		expect(icon.dark).toBe('file:perform.dark.svg');
	});
});
