import { getSettings, type AppSettings } from '../../utils/settingsManager'

export type SettingsGetResponse = AppSettings

export default defineEventHandler((_event) => {
  return getSettings() as SettingsGetResponse
})
