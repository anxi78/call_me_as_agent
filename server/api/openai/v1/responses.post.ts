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
  console.log('[OpenAI Responses] Received request:', body)

  const requestId = Math.random().toString(36).substring(2, 15)
  const now = Math.floor(Date.now() / 1000)

  // Start keep-alive heartbeats while waiting
  let keepAliveTimer: NodeJS.Timeout | null = null
  if (body.stream && settings.keepAliveInterval > 0) {
    setResponseHeaders(event, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    })
    keepAliveTimer = setInterval(() => {
      if (!event.node.res.writableEnded) {
        event.node.res.write(': keep-alive\n\n')
      }
    }, settings.keepAliveInterval * 1000)
  }

  const result = await addRequest('openai-responses', body)
  if (keepAliveTimer) clearInterval(keepAliveTimer)

  // Estimate tokens
  const estimateTokens = (obj: any) => Math.ceil(JSON.stringify(obj).length / 3)
  const promptTokens = estimateTokens(body.input || body.instructions)
  const completionContent = (result.content || '') + (result.toolCalls ? JSON.stringify(result.toolCalls) : '')
  const completionTokens = Math.ceil(completionContent.length / 3)
  const totalTokens = promptTokens + completionTokens

  if (body.stream) {
    if (!getHeader(event, 'content-type')) {
      setResponseHeaders(event, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      })
    }

    event.node.res.flushHeaders()

    const sendEvent = (eventName: string, data: any) => {
      event.node.res.write(`event: ${eventName}\ndata: ${JSON.stringify({ type: eventName, ...data })}\n\n`)
    }

    // 1. Send response.created
    sendEvent('response.created', {
      response: {
        id: `resp_${requestId}`,
        object: 'response',
        created: now,
        model: body.model || 'gpt-4o',
        status: 'in_progress'
      }
    })

    const itemId = `item_${Math.random().toString(36).substring(2, 9)}`

    // 2. Add output item
    sendEvent('response.output_item.added', {
      response_id: `resp_${requestId}`,
      output_index: 0,
      item: {
        id: itemId,
        type: 'message',
        role: 'assistant',
        content: []
      }
    })

    // 3. Send content (simulation)
    if (result.content) {
      const content = result.content
      const speed = result.simulateStream ? (settings.streamSpeed || 30) : 0

      if (speed === 0) {
        sendEvent('response.output_text.delta', {
          response_id: `resp_${requestId}`,
          item_id: itemId,
          output_index: 0,
          content_index: 0,
          delta: content
        })
      } else {
        for (let i = 0; i < content.length; i++) {
          sendEvent('response.output_text.delta', {
            response_id: `resp_${requestId}`,
            item_id: itemId,
            output_index: 0,
            content_index: 0,
            delta: content[i]
          })
          await new Promise(resolve => setTimeout(resolve, speed))
        }
      }
      
      sendEvent('response.output_text.done', {
        response_id: `resp_${requestId}`,
        item_id: itemId,
        output_index: 0,
        content_index: 0,
        text: content
      })
    }

    // 4. Tool calls (if any)
    if (result.toolCalls && result.toolCalls.length > 0) {
       result.toolCalls.forEach((tc, idx) => {
          const tcItemId = tc.id || `item_tc_${idx}`
          sendEvent('response.output_item.added', {
            response_id: `resp_${requestId}`,
            output_index: result.content ? idx + 1 : idx,
            item: {
              id: tcItemId,
              type: 'function_call',
              name: tc.function?.name || (tc as any).name,
              arguments: ''
            }
          })
          sendEvent('response.function_call_arguments.delta', {
            response_id: `resp_${requestId}`,
            item_id: tcItemId,
            output_index: result.content ? idx + 1 : idx,
            delta: typeof tc.function?.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function?.arguments || (tc as any).input || {})
          })
          sendEvent('response.function_call_arguments.done', {
            response_id: `resp_${requestId}`,
            item_id: tcItemId,
            output_index: result.content ? idx + 1 : idx,
            arguments: typeof tc.function?.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function?.arguments || (tc as any).input || {})
          })
       })
    }

    // 5. Send response.done
    sendEvent('response.done', {
      response: {
        id: `resp_${requestId}`,
        object: 'response',
        status: 'completed',
        output: [
          {
            id: itemId,
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: result.content }]
          }
        ],
        usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: totalTokens }
      }
    })

    event.node.res.end()
    return
  } else {
    // Non-streaming JSON response
    const output: any[] = []
    if (result.content) {
      output.push({
        id: `item_msg_${requestId}`,
        type: 'message',
        role: 'assistant',
        content: result.content
      })
    }

    if (result.toolCalls && result.toolCalls.length > 0) {
      result.toolCalls.forEach((tc, idx) => {
        output.push({
          id: tc.id || `item_tc_${idx}`,
          type: 'function_call',
          name: tc.function?.name || (tc as any).name,
          arguments: typeof tc.function?.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function?.arguments || (tc as any).input || {})
        })
      })
    }

    return {
      id: `resp_${requestId}`,
      object: 'response',
      created: now,
      model: body.model || 'gpt-4o',
      status: 'completed',
      output,
      usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: totalTokens }
    }
  }
})
