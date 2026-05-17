export default defineEventHandler(async (event) => {
  const settings = getSettings()
  if (settings.enableApiKeyAuth) {
    const authHeader = getHeader(event, 'authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (token !== settings.apiKey) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: Invalid API Key'
      })
    }
  }

  const body = await readBody(event)
  console.log('[OpenAI] Received request:', body)

  // Start keep-alive heartbeats while waiting for human response
  let keepAliveTimer: NodeJS.Timeout | null = null
  if (body.stream && settings.keepAliveInterval > 0) {
    setResponseHeaders(event, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Prevent Nginx buffering
    })
    
    keepAliveTimer = setInterval(() => {
      // Send a simple SSE comment to keep-alive
      if (!event.node.res.writableEnded) {
        event.node.res.write(': keep-alive\n\n')
      }
    }, settings.keepAliveInterval * 1000)
  }

  const result = await addRequest('openai', body)
  if (keepAliveTimer) clearInterval(keepAliveTimer)

  // Estimate tokens (rough heuristic)
  const estimateTokens = (obj: any) => Math.ceil(JSON.stringify(obj).length / 3)
  const promptTokens = estimateTokens(body.messages)
  const completionContent = (result.content || '') + (result.toolCalls ? JSON.stringify(result.toolCalls) : '')
  const completionTokens = Math.ceil(completionContent.length / 3)
  const totalTokens = promptTokens + completionTokens

  const now = Math.floor(Date.now() / 1000)
  const requestId = Math.random().toString(36).substring(2, 15)

  if (body.stream) {
    if (!getHeader(event, 'content-type')) {
      setResponseHeaders(event, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      })
    }
    
    // Flush headers to start the stream
    event.node.res.flushHeaders()

    const sendChunk = (chunk: any) => {
      event.node.res.write(`data: ${JSON.stringify(chunk)}\n\n`)
    }

    // 1. Send initial role chunk
    sendChunk({
      id: `chatcmpl-${requestId}`,
      object: 'chat.completion.chunk',
      created: now,
      model: body.model || 'gpt-4o',
      choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }]
    })

    // 2. Send content in chunks (character by character simulation)
    if (result.content) {
      const content = result.content
      const speed = result.simulateStream ? (settings.streamSpeed || 30) : 0

      if (speed === 0) {
        sendChunk({
          id: `chatcmpl-${requestId}`,
          object: 'chat.completion.chunk',
          created: now,
          model: body.model || 'gpt-4o',
          choices: [{ index: 0, delta: { content }, finish_reason: null }]
        })
      } else {
        for (let i = 0; i < content.length; i++) {
          sendChunk({
            id: `chatcmpl-${requestId}`,
            object: 'chat.completion.chunk',
            created: now,
            model: body.model || 'gpt-4o',
            choices: [{ index: 0, delta: { content: content[i] }, finish_reason: null }]
          })
          await new Promise(resolve => setTimeout(resolve, speed))
        }
      }
    }
    // 3. Send tool calls chunk
    if (result.toolCalls && result.toolCalls.length > 0) {
      const tool_calls = result.toolCalls.map((tc, i) => ({
        index: i,
        id: tc.id || `call_${Math.random().toString(36).substring(2, 9)}`,
        type: 'function',
        function: {
          name: tc.function?.name || (tc as any).name,
          arguments: typeof tc.function?.arguments === 'string'
            ? tc.function.arguments
            : JSON.stringify(tc.function?.arguments || (tc as any).input || {})
        }
      }))

      sendChunk({
        id: `chatcmpl-${requestId}`,
        object: 'chat.completion.chunk',
        created: now,
        model: body.model || 'gpt-4o',
        choices: [{ index: 0, delta: { tool_calls }, finish_reason: null }]
      })
    }

    // 4. Send final stop chunk with usage if requested
    const lastChunk: any = {
      id: `chatcmpl-${requestId}`,
      object: 'chat.completion.chunk',
      created: now,
      model: body.model || 'gpt-4o',
      choices: [{ index: 0, delta: {}, finish_reason: (result.toolCalls && result.toolCalls.length > 0) ? 'tool_calls' : 'stop' }]
    }
    
    if (body.stream_options?.include_usage) {
        lastChunk.usage = {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens
        }
    }

    sendChunk(lastChunk)

    event.node.res.write('data: [DONE]\n\n')
    event.node.res.end()
    return
  } else {
    // Non-streaming JSON response
    const response: any = {
      id: `chatcmpl-${requestId}`,
      object: 'chat.completion',
      created: now,
      model: body.model || 'gpt-4o',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: result.content || null
          },
          finish_reason: (result.toolCalls && result.toolCalls.length > 0) ? 'tool_calls' : 'stop'
        }
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens
      }
    }

    if (result.toolCalls && result.toolCalls.length > 0) {
      response.choices[0].message.tool_calls = result.toolCalls.map(tc => ({
        id: tc.id || `call_${Math.random().toString(36).substring(2, 9)}`,
        type: 'function',
        function: {
          name: tc.function?.name || (tc as any).name,
          arguments: typeof tc.function?.arguments === 'string'
            ? tc.function.arguments
            : JSON.stringify(tc.function?.arguments || (tc as any).input || {})
        }
      }))
    }

    return response
  }
})
