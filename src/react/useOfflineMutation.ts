import { syncEngine } from "../core/SyncEngine"
import { HTTPMethod } from "../types"

interface MutationOptions {
	url: string
	method?: HTTPMethod // Defaults to POST
	onEnqueue?: () => void
}

export const useOfflineMutation = () => {
	const submit = async (body: any, options: MutationOptions) => {
		try {
			await syncEngine.addRequest({
				url: options.url,
				method: options.method || "POST",
				body
			})

			if (options.onEnqueue) options.onEnqueue()

			return { success: true }
		} catch (error) {
			console.error("Failed to queue offline request", error)
			return { success: false, error }
		}
	}

	return { submit }
}
