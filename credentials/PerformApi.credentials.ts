import type {
	Icon,
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class PerformApi implements ICredentialType {
	name = 'performApi';

	icon: Icon = { light: 'file:perform.svg', dark: 'file:perform.dark.svg' };

	displayName = 'Perform API';

	documentationUrl = 'https://github.com/otherwiseteam/n8n-nodes-perform#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Create it in Perform under Business settings → Integrations. The key starts with pf_live_ and is shown only once. One key belongs to exactly one studio.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://perform-api.otherwise.co.il',
			description: 'Change only when pointing the node at a staging or local Perform API',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/automation/validate',
		},
	};
}
