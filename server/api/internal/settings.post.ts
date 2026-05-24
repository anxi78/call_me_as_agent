import { updateSettings, type AppSettings } from '../../utils/settingsManager'

export type SettingsUpdateResponse = AppSettings

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return updateSettings(body) as SettingsUpdateResponse
})
