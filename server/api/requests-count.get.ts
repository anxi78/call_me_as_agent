import { getPendingRequests } from '../utils/requestManager'

export default defineEventHandler(() => {
  return { count: getPendingRequests().length }
})
