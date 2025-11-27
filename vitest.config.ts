// vitest.config.ts
import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		environment: "jsdom", // Simulates browser environment (window, navigator)
		setupFiles: ["./src/test/setup.ts"],
		restoreMocks: true
	}
})
