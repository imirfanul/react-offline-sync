export type HTTPMethod = "POST" | "PUT" | "PATCH" | "DELETE"

export interface RequestPayload {
	id: string
	url: string
	method: HTTPMethod
	body?: any
	headers?: Record<string, string>
	timestamp: number
	retryCount: number
}

export interface SyncConfig {
	/** * Async function to inject headers (e.g., specific auth tokens)
	 * immediately before the request is sent.
	 */
	prepareHeaders?: () => Promise<Record<string, string>>

	/** Callback when a request succeeds */
	onSuccess?: (response: any, payload: RequestPayload) => void

	/** Callback when a request fails permanently (e.g. 4xx error) */
	onError?: (error: any, payload: RequestPayload) => void

	/** Debug mode to log queue actions */
	debug?: boolean
}
