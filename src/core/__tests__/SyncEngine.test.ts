import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { SyncEngine } from "../SyncEngine" // Adjust import path as needed
import * as idb from "idb-keyval"

describe("SyncEngine Core", () => {
	let engine: SyncEngine
	const QUEUE_KEY = "offline-mutation-queue"

	// Helper to mock online status
	const mockOnlineStatus = (isOnline: boolean) => {
		Object.defineProperty(navigator, "onLine", {
			configurable: true,
			value: isOnline
		})
	}

	beforeEach(() => {
		vi.clearAllMocks()
		;(idb as any).clear() // Clear our mocked in-memory DB
		mockOnlineStatus(true) // Default to online
		engine = new SyncEngine()
	})

	it("should add a request to IndexedDB and process it immediately if online", async () => {
		// Setup Mock Fetch Success
		;(global.fetch as any).mockResolvedValue({
			ok: true,
			json: async () => ({ success: true })
		})

		const payload = {
			url: "/api/todos",
			method: "POST" as const,
			body: { title: "Buy Milk" }
		}

		await engine.addRequest(payload)

		// 1. Verify it hit the DB
		const queue = await idb.get(QUEUE_KEY)
		expect(queue).toHaveLength(1)
		expect(queue[0]).toMatchObject({
			url: "/api/todos",
			body: { title: "Buy Milk" }
		})

		// 2. Verify fetch was called (flush promises)
		await new Promise(process.nextTick)

		expect(global.fetch).toHaveBeenCalledWith(
			"/api/todos",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ title: "Buy Milk" })
			})
		)

		// 3. Verify queue is empty after success
		const finalQueue = await idb.get(QUEUE_KEY)
		expect(finalQueue).toHaveLength(0)
	})

	it("should queue request but NOT fetch if offline", async () => {
		mockOnlineStatus(false)

		await engine.addRequest({
			url: "/api/offline",
			method: "POST",
			body: {}
		})

		// Verify DB has it
		const queue = await idb.get(QUEUE_KEY)
		expect(queue).toHaveLength(1)

		// Verify fetch was NEVER called
		expect(global.fetch).not.toHaveBeenCalled()
	})

	it('should process queue when "online" event fires', async () => {
		mockOnlineStatus(false)

		// Add 2 requests while offline
		await engine.addRequest({ url: "/api/1", method: "POST" })
		await engine.addRequest({ url: "/api/2", method: "POST" })

		expect(global.fetch).not.toHaveBeenCalled()

		// Go Online
		mockOnlineStatus(true)
		;(global.fetch as any).mockResolvedValue({ ok: true })

		// Simulate window event
		window.dispatchEvent(new Event("online"))

		// Wait for async processing
		await new Promise((r) => setTimeout(r, 100))

		// Should have processed both
		expect(global.fetch).toHaveBeenCalledTimes(2)

		// Check queue is empty
		const queue = await idb.get(QUEUE_KEY)
		expect(queue).toHaveLength(0)
	})

	it("should keep item in queue if fetch fails (Server Error)", async () => {
		// Mock Fetch Failure (500 Error)
		;(global.fetch as any).mockResolvedValue({
			ok: false,
			statusText: "Internal Server Error"
		})

		await engine.addRequest({ url: "/api/fail", method: "POST" })

		// Wait for processing
		await new Promise(process.nextTick)

		expect(global.fetch).toHaveBeenCalledTimes(1)

		// Item should STILL be in queue because it failed
		const queue = await idb.get(QUEUE_KEY)
		expect(queue).toHaveLength(1)
	})

	it("should notify subscribers of sync status", async () => {
		const listener = vi.fn()
		const unsubscribe = engine.subscribe(listener)

		;(global.fetch as any).mockImplementation(async () => {
			await new Promise((r) => setTimeout(r, 50)) // Add delay
			return { ok: true }
		})

		// Start request
		await engine.addRequest({ url: "/api/status", method: "POST" })

		// Expect listener to be called with true (syncing)
		expect(listener).toHaveBeenCalledWith(true)

		// Wait for finish
		await new Promise((r) => setTimeout(r, 100))

		// Expect listener to be called with false (idle)
		expect(listener).toHaveBeenCalledWith(false)

		unsubscribe()
	})
})
