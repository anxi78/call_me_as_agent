import { spawn } from 'node:child_process'
import http from 'node:http'

const BASE_URL = 'http://localhost:3000'

async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`${BASE_URL}/api/settings`)
      console.log('Server is ready')
      return
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  throw new Error('Server timed out')
}

async function runTests() {
  console.log('Running API Integration Tests...')

  // 1. OpenAI Responses (Non-streaming)
  console.log('Testing OpenAI Responses (Non-streaming)...')
  const resp1Promise = fetch(`${BASE_URL}/api/openai/v1/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      input: [{ role: 'user', content: 'Hello' }],
      stream: false
    })
  })

  await simulateHuman('OpenAI Non-streaming response')
  const resp1 = await (await resp1Promise).json()
  if (resp1.output_text !== 'OpenAI Non-streaming response' || !resp1.usage) {
    throw new Error('OpenAI Responses (Non-streaming) failed: ' + JSON.stringify(resp1))
  }
  console.log('✓ OpenAI Responses (Non-streaming) passed. Usage:', resp1.usage)

  // 2. OpenAI Responses (Streaming)
  console.log('Testing OpenAI Responses (Streaming)...')
  const resp2 = await fetch(`${BASE_URL}/api/openai/v1/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      input: [{ role: 'user', content: 'Hello' }],
      stream: true
    })
  })

  setTimeout(() => simulateHuman('Streaming hi!'), 500)
  const reader = resp2.body?.getReader()
  let usage: any = null
  let receivedDone = false
  if (reader) {
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6))
            if (data.type === 'response.done') {
              usage = data.response.usage
              receivedDone = true
            }
          } catch (e) {}
        }
      }
    }
  }
  if (!receivedDone || !usage) {
    throw new Error('OpenAI Responses (Streaming) failed')
  }
  console.log('✓ OpenAI Responses (Streaming) passed. Usage:', usage)

  // 3. OpenAI Chat Completions (Non-streaming)
  console.log('Testing OpenAI Chat Completions (Non-streaming)...')
  const respChat1Promise = fetch(`${BASE_URL}/api/openai/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: false
    })
  })

  await simulateHuman('Chat Non-streaming response')
  const respChat1 = await (await respChat1Promise).json()
  if (respChat1.choices[0].message.content !== 'Chat Non-streaming response' || !respChat1.usage) {
    throw new Error('OpenAI Chat Completions (Non-streaming) failed: ' + JSON.stringify(respChat1))
  }
  console.log('✓ OpenAI Chat Completions (Non-streaming) passed. Usage:', respChat1.usage)

  // 4. OpenAI Chat Completions (Streaming)
  console.log('Testing OpenAI Chat Completions (Streaming)...')
  const respChat2 = await fetch(`${BASE_URL}/api/openai/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true,
      stream_options: { include_usage: true }
    })
  })

  setTimeout(() => simulateHuman('Chat streaming hi!'), 500)
  const readerChat = respChat2.body?.getReader()
  let chatUsage: any = null
  let receivedChatDone = false
  if (readerChat) {
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await readerChat.read()
      if (done) break
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.substring(6).trim()
          if (dataStr === '[DONE]') {
            receivedChatDone = true
            continue
          }
          try {
            const data = JSON.parse(dataStr)
            if (data.usage) {
              chatUsage = data.usage
            }
          } catch (e) {}
        }
      }
    }
  }
  if (!receivedChatDone || !chatUsage) {
    throw new Error('OpenAI Chat Completions (Streaming) failed')
  }
  console.log('✓ OpenAI Chat Completions (Streaming) passed. Usage:', chatUsage)

  // 5. Claude (Non-streaming)
  console.log('Testing Claude (Non-streaming)...')
  const respClaude1Promise = fetch(`${BASE_URL}/api/claude/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-3-sonnet',
      messages: [{ role: 'user', content: 'Hello Claude' }],
      stream: false
    })
  })

  await simulateHuman('Claude Non-streaming response')
  const respClaude1 = await (await respClaude1Promise).json()
  if (respClaude1.content[0].text !== 'Claude Non-streaming response' || !respClaude1.usage) {
    throw new Error('Claude (Non-streaming) failed: ' + JSON.stringify(respClaude1))
  }
  console.log('✓ Claude (Non-streaming) passed. Usage:', respClaude1.usage)

  // 6. Claude (Streaming)
  console.log('Testing Claude (Streaming)...')
  const resp3 = await fetch(`${BASE_URL}/api/claude/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-3-sonnet',
      messages: [{ role: 'user', content: 'Hello Claude' }],
      stream: true
    })
  })

  setTimeout(() => simulateHuman('Claude here!'), 500)
  const reader3 = resp3.body?.getReader()
  let claudeUsage: any = null
  if (reader3) {
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader3.read()
      if (done) break
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6))
            if (data.type === 'message_delta' && data.usage) {
              claudeUsage = data.usage
            }
          } catch (e) {}
        }
      }
    }
  }
  if (!claudeUsage) {
    throw new Error('Claude (Streaming) failed')
  }
  console.log('✓ Claude (Streaming) passed. Usage:', claudeUsage)

  // 4. Verify Stats
  const settings = await (await fetch(`${BASE_URL}/api/settings`)).json()
  console.log('Current Stats - Input:', settings.tokensInputToday, 'Output:', settings.tokensOutputToday)
  if (settings.tokensInputToday <= 0 || settings.tokensOutputToday <= 0) {
    throw new Error('Stats not correctly updated')
  }
  console.log('✓ Stats verification passed.')

  console.log('\nAll tests passed successfully!')
}

async function simulateHuman(content: string) {
  let requests: any[] = []
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${BASE_URL}/api/internal/requests`)
    requests = await res.json()
    if (requests.length > 0) break
    await new Promise(r => setTimeout(r, 200))
  }
  if (requests.length === 0) throw new Error('No pending request found')
  const requestId = requests[0].id
  await fetch(`${BASE_URL}/api/internal/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: requestId, response: content })
  })
}

const server = spawn('npm', ['run', 'dev'], { stdio: 'inherit' })
process.on('exit', () => server.kill())

try {
  await waitReady()
  await runTests()
  process.exit(0)
} catch (e) {
  console.error('Test failed:', e)
  process.exit(1)
}
