import fs from 'node:fs'
import path from 'node:path'

export interface Stats {
  tokensInputToday: number
  tokensOutputToday: number
  lastTokenDate: string
}

const defaultStats: Stats = {
  tokensInputToday: 0,
  tokensOutputToday: 0,
  lastTokenDate: new Date().toISOString().split('T')[0]
}

const statsPath = path.resolve(process.cwd(), '.data', 'stats.json')

export const getStats = (): Stats => {
  try {
    if (fs.existsSync(statsPath)) {
      const data = fs.readFileSync(statsPath, 'utf-8')
      const parsed = JSON.parse(data)
      const today = new Date().toISOString().split('T')[0]
      if (parsed.lastTokenDate !== today) {
        parsed.tokensInputToday = 0
        parsed.tokensOutputToday = 0
        parsed.lastTokenDate = today
      }
      return { ...defaultStats, ...parsed }
    }
  } catch (e) {
    console.error('[StatsManager] Failed to read stats', e)
  }
  return { ...defaultStats, lastTokenDate: new Date().toISOString().split('T')[0] }
}

export const incrementTokens = (inputAmount: number, outputAmount: number) => {
  const current = getStats()
  current.tokensInputToday += inputAmount
  current.tokensOutputToday += outputAmount
  try {
    const dir = path.dirname(statsPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(statsPath, JSON.stringify(current, null, 2))
  } catch (e) {
    console.error('[StatsManager] Failed to write stats', e)
  }
}
