import { getSettings, type AppSettings } from '../utils/settingsManager'
import { getStats } from '../utils/statsManager'

export type PublicSettingsResponse = Pick<AppSettings,
  | 'siteTitle'
  | 'siteSubtitle'
  | 'siteLogo'
  | 'publicBaseUrl'
  | 'primaryColor'
  | 'language'
  | 'streamSpeed'
  | 'keepAliveInterval'
  | 'pendingRequestsLabel'
  | 'showPendingCountPublic'
  | 'showApiKeyPublic'
  | 'enableApiKeyAuth'
  | 'showTokensPublic'
  | 'tokensLabel'
  | 'toastTimeout'
> & {
  tokensInputToday: number
  tokensOutputToday: number
}

export default defineEventHandler((_event) => {
  const settings = getSettings()
  const stats = getStats()
  // Return only safe-to-share settings
  return {
    siteTitle: settings.siteTitle,
    siteSubtitle: settings.siteSubtitle,
    siteLogo: settings.siteLogo,
    publicBaseUrl: settings.publicBaseUrl,
    primaryColor: settings.primaryColor,
    language: settings.language,
    streamSpeed: settings.streamSpeed,
    keepAliveInterval: settings.keepAliveInterval,
    pendingRequestsLabel: settings.pendingRequestsLabel,
    showPendingCountPublic: settings.showPendingCountPublic,
    showApiKeyPublic: settings.showApiKeyPublic,
    enableApiKeyAuth: settings.enableApiKeyAuth,
    showTokensPublic: settings.showTokensPublic,
    tokensLabel: settings.tokensLabel,
    toastTimeout: settings.toastTimeout,
    tokensInputToday: stats.tokensInputToday,
    tokensOutputToday: stats.tokensOutputToday
    // Do NOT return the actual apiKey here
  } as PublicSettingsResponse
})
