export default defineEventHandler(async (event) => {
  const { id, response, toolCalls, simulateStream } = await readBody(event)
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID is required'
    })
  }

  try {
    await pushToRequest(id, { content: response || '', toolCalls, simulateStream })
    return { success: true }
  } catch (error: any) {
    throw createError({
      statusCode: 404,
      statusMessage: error.message
    })
  }
})
