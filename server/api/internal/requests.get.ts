export type RequestsGetResponse = Array<{
  id: string
  type: 'openai' | 'claude' | 'openai-responses'
  payload: any
  timestamp: number
  draft?: {
    response: string
    toolCalls: any[]
    simulateStream: boolean
  }
}>

export default defineEventHandler((_event) => {
  return getPendingRequests() as RequestsGetResponse
})
