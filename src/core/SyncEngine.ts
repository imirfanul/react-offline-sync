import { set, get, update } from "idb-keyval"
import { RequestPayload, SyncConfig } from "../types"

const QUEUE_KEY = "offline-mutation-queue"

export class SyncEngine {
	private isSyncing = false
	private listeners: Set<(isSyncing: boolean) => void> = new Set()
	private config: SyncConfig = {}

	constructor() {
		if (typeof window !== "undefined") {
			window.addEventListener("online", () => this.processQueue())
		}
	}

	/**
	 * Configure global settings (Auth injection, logging, etc)
	 */
	configure(config: SyncConfig) {
		this.config = config
	}

	/**
	 * Add a request to the IndexedDB queue
	 */
	async addRequest(
		req: Omit<RequestPayload, "id" | "timestamp" | "retryCount">
	) {
		const payload: RequestPayload = {
			...req,
			id: crypto.randomUUID(),
			timestamp: Date.now(),
			retryCount: 0
		}

		await update(QUEUE_KEY, (old: RequestPayload[] = []) => [
			...old,
			payload
		])
		this.log(`Request queued: ${payload.url}`)

		if (navigator.onLine) {
			this.processQueue()
		}
	}

	/**
	 * Main Sync Loop
	 */
	private async processQueue() {
		if (this.isSyncing || !navigator.onLine) return

		this.isSyncing = true
		this.notifyListeners()

		try {
			// Peek at the first item
			const queue: RequestPayload[] = (await get(QUEUE_KEY)) || []
			if (queue.length === 0) {
				this.isSyncing = false
				this.notifyListeners()
				return
			}

			const currentReq = queue[0]
			this.log(
				`Processing: ${currentReq.url} (Attempt ${
					currentReq.retryCount + 1
				})`
			)

			try {
				// 1. Prepare dynamic headers (e.g., refresh JWT)
				const dynamicHeaders = this.config.prepareHeaders
					? await this.config.prepareHeaders()
					: {}

				// 2. Execute Fetch
				const response = await fetch(currentReq.url, {
					method: currentReq.method,
					headers: {
						"Content-Type": "application/json",
						...currentReq.headers,
						...dynamicHeaders
					},
					body: JSON.stringify(currentReq.body)
				})

				// 3. Handle Errors based on Status Code
				if (!response.ok) {
					// Client Error (4xx): Do not retry. The request is bad.
					if (response.status >= 400 && response.status < 500) {
						throw new Error(
							`Client Error ${response.status}: ${response.statusText}`
						)
					}
					// Server Error (5xx): Throw to trigger catch block & retry logic
					throw new Error(`Server Error ${response.status}`)
				}

				// 4. Success
				const data = await response.json().catch(() => ({})) // Handle empty responses safely
				if (this.config.onSuccess)
					this.config.onSuccess(data, currentReq)

				// Remove from queue
				await update(QUEUE_KEY, (old: RequestPayload[]) => old.slice(1))

				// Recursive call to process next item immediately
				this.processQueue()
			} catch (error: any) {
				const isClientError = error.message.includes("Client Error")

				if (isClientError) {
					this.log("Dropping bad request (4xx).")
					if (this.config.onError)
						this.config.onError(error, currentReq)
					await update(QUEUE_KEY, (old: RequestPayload[]) =>
						old.slice(1)
					)
					this.processQueue() // Move next
				} else {
					// Server/Network Error -> Retry with Backoff
					this.handleRetry(currentReq)
				}
			}
		} catch (err) {
			this.isSyncing = false
		} finally {
			this.notifyListeners()
		}
	}

	/**
	 * Calculates exponential backoff and schedules next attempt
	 */
	private async handleRetry(req: RequestPayload) {
		this.log(`Sync failed. Scheduling retry...`)

		// Increment retry count in DB
		await update(QUEUE_KEY, (old: RequestPayload[]) => {
			if (!old.length) return []
			const head = old[0]
			// Sanity check: ensure we are updating the right item
			if (head.id !== req.id) return old
			return [
				{ ...head, retryCount: (head.retryCount || 0) + 1 },
				...old.slice(1)
			]
		})

		// Backoff Logic: 1s, 2s, 4s, 8s... capped at 30s
		const retryCount = req.retryCount + 1
		const delay = Math.min(1000 * 2 ** retryCount, 30000)

		this.isSyncing = false // Release lock so timeout can re-trigger
		this.notifyListeners()

		setTimeout(() => {
			if (navigator.onLine) this.processQueue()
		}, delay)
	}

	// --- Helpers ---

	subscribe(callback: (isSyncing: boolean) => void) {
		this.listeners.add(callback)
		// Initial call
		callback(this.isSyncing)
		return () => this.listeners.delete(callback)
	}

	private notifyListeners() {
		this.listeners.forEach((cb) => cb(this.isSyncing))
	}

	private log(msg: string) {
		if (this.config.debug) console.log(`[SyncEngine] ${msg}`)
	}
}

export const syncEngine = new SyncEngine()
