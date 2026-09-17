import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	IWebhookFunctions,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

/** Every automation endpoint lives under this prefix on the Perform API host. */
export const API_PREFIX = '/v1/automation';

export const DEFAULT_BASE_URL = 'https://perform-api.otherwise.co.il';

export const CREDENTIAL_NAME = 'performApi';

/** The contexts this node issues requests from: execute, dropdowns and webhook lifecycle. */
export type PerformContext =
	IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IWebhookFunctions;

function asRecord(body: unknown): IDataObject | undefined {
	return typeof body === 'object' && body !== null && !Array.isArray(body)
		? (body as IDataObject)
		: undefined;
}

/**
 * Perform wraps every response in `{ success, message, data }`. A rejected
 * request can arrive as HTTP 200 with `success: false`, so the envelope is
 * checked in addition to the status code.
 */
export function isEnvelopeFailure(body: unknown): boolean {
	return asRecord(body)?.success === false;
}

export function unwrapEnvelope(body: unknown): unknown {
	const record = asRecord(body);
	if (record === undefined) return body;
	return 'data' in record ? record.data : record;
}

/**
 * Perform writes its error messages as full sentences meant to be read as-is
 * ("No trainee with id X exists in this studio. Use Search trainees ..."), so
 * the message is passed through verbatim, with the machine code appended when
 * one is present.
 */
export function describeApiError(body: unknown, fallback: string): string {
	const record = asRecord(body);
	if (record === undefined) return fallback;

	const message =
		typeof record.message === 'string' && record.message.trim() !== '' ? record.message : undefined;
	if (message === undefined) return fallback;

	return typeof record.code === 'string' && record.code !== ''
		? `${message} (${record.code})`
		: message;
}

/**
 * Digs the response body out of whatever error shape n8n's HTTP helper threw.
 * Depending on the n8n version the helper rethrows the raw axios error
 * (`response.data`), a NodeApiError wrapping it (`cause.response.data`) or the
 * legacy request-library shape (`response.body`).
 */
export function extractErrorBody(error: unknown): unknown {
	const candidates: unknown[] = [];
	const visit = (value: unknown): void => {
		const record = asRecord(value);
		if (record === undefined) return;
		const response = asRecord(record.response);
		if (response !== undefined) {
			candidates.push(response.body, response.data);
		}
		if (record.cause !== undefined && record.cause !== value) visit(record.cause);
	};
	visit(error);
	return candidates.find((candidate) => asRecord(candidate) !== undefined);
}

export function resolveBaseUrl(configured: unknown): string {
	const value =
		typeof configured === 'string' && configured.trim() !== ''
			? configured.trim()
			: DEFAULT_BASE_URL;
	return value.replace(/\/+$/, '');
}

export async function performApiRequest(
	ctx: PerformContext,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<unknown> {
	const credentials = await ctx.getCredentials(CREDENTIAL_NAME);
	const baseUrl = resolveBaseUrl(credentials.baseUrl);

	let response: unknown;
	try {
		response = await ctx.helpers.httpRequestWithAuthentication.call(ctx, CREDENTIAL_NAME, {
			method,
			url: `${baseUrl}${API_PREFIX}${path}`,
			body,
			qs,
			json: true,
		});
	} catch (error) {
		const description = describeApiError(extractErrorBody(error), (error as Error).message);
		throw new NodeApiError(ctx.getNode(), error as never, { message: description });
	}

	if (isEnvelopeFailure(response)) {
		const description = describeApiError(response, 'Perform rejected the request');
		throw new NodeApiError(ctx.getNode(), response as never, { message: description });
	}

	return unwrapEnvelope(response);
}
