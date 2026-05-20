import { finishRequest, getPendingRequests } from '../utils/requestManager'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', async () => {
    console.log('[Shutdown] Server is closing, finishing all pending requests...')
    const requests = getPendingRequests()
    if (requests.length === 0) return

    const finishPromises = requests.map(async (req) => {
      try {
        // Send a final message to the client indicating the server is shutting down
        await finishRequest(req.id, { 
          content: '\n\n[Server Shutdown] The proxy server is closing. Please retry your request if needed.' 
        })
      } catch (e) {
        // Ignore errors during shutdown cleanup
      }
    })

    await Promise.allSettled(finishPromises)
    console.log(`[Shutdown] Finished ${requests.length} requests.`)
  })
})
