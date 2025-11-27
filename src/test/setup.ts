import { vi } from "vitest"

// Mock IndexedDB wrapper
const store = new Map()

vi.mock("idb-keyval", () => ({
	set: vi.fn((key, value) => Promise.resolve(store.set(key, value))),
	get: vi.fn((key) => Promise.resolve(store.get(key))),
	update: vi.fn((key, updater) => {
		const oldVal = store.get(key)
		const newVal = updater(oldVal)
		store.set(key, newVal)
		return Promise.resolve()
	}),
	del: vi.fn((key) => Promise.resolve(store.delete(key))),
	clear: vi.fn(() => Promise.resolve(store.clear()))
}))

// Mock Fetch
global.fetch = vi.fn()

// Mock Crypto UUID
Object.defineProperty(global, "crypto", {
	value: {
		randomUUID: () => "test-uuid-" + Math.random().toString(36).substr(2, 9)
	}
})
