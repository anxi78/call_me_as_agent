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

async function getPendingRequests() {
  const res = await fetch(`${BASE_URL}/api/internal/requests`)
  return await res.json()
}

async function runTests() {
  console.log('Running Disconnection Tests...')

  // 1. Non-streaming Disconnection
  console.log('Testing Non-streaming Disconnection (Claude)...')
  const controller1 = new AbortController()
  const resp1Promise = fetch(`${BASE_URL}/api/claude/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: false
    }),
    signal: controller1.signal
  }).catch(e => {
    if (e.name === 'AbortError') return 'aborted'
    throw e
  })

  // Wait for request to appear
  let requests = []
  for (let i = 0; i < 20; i++) {
    requests = await getPendingRequests()
    if (requests.length > 0) break
    await new Promise(r => setTimeout(r, 200))
  }
  if (requests.length === 0) throw new Error('No pending request found for non-streaming')
  const requestId1 = requests[0].id
  console.log('Request found:', requestId1)

  // Abort the client request
  console.log('Aborting client request...')
  controller1.abort()
  await resp1Promise

  // Check if it's still in the list
  await new Promise(r => setTimeout(r, 500))
  requests = await getPendingRequests()
  const found1 = requests.find((r: any) => r.id === requestId1)
  if (found1) {
    throw new Error('Request still in list after client disconnect (Non-streaming)')
  }
  console.log('✓ Request GONE after client disconnect (Non-streaming)')

  // 2. Streaming Disconnection
  console.log('\nTesting Streaming Disconnection...')
  const controller2 = new AbortController()
  const resp2Promise = fetch(`${BASE_URL}/api/openai/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true
    }),
    signal: controller2.signal
  }).catch(e => {
    if (e.name === 'AbortError') return 'aborted'
    throw e
  })

  // Wait for request to appear
  for (let i = 0; i < 20; i++) {
    requests = await getPendingRequests()
    if (requests.length > 0) break
    await new Promise(r => setTimeout(r, 200))
  }
  if (requests.length === 0) throw new Error('No pending request found for streaming')
  const requestId2 = requests[0].id
  console.log('Request found:', requestId2)

  // Abort the client request
  console.log('Aborting client streaming request...')
  controller2.abort()
  await resp2Promise

  // Check if it's still in the list
  await new Promise(r => setTimeout(r, 500))
  requests = await getPendingRequests()
  const found2 = requests.find((r: any) => r.id === requestId2)
  if (found2) {
    throw new Error('Request still in list after client disconnect (Streaming)')
  }
  console.log('✓ Request GONE after client disconnect (Streaming)')

  console.log('\nAll disconnection tests passed!')
}

const server = spawn('npm', ['run', 'dev'], { 
  stdio: 'inherit',
  env: { ...process.env, SKIP_AUTH: 'true' }
})
process.on('exit', () => server.kill())

try {
  await waitReady()
  await runTests()
  process.exit(0)
} catch (e) {
  console.error('Test failed:', e)
  process.exit(1)
}
