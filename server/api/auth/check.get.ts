export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const settings = getSettings()
  
  const otpEnabled = !!settings.enableOtpAuth
  // Password is required only if it's enabled in settings AND defined in ENV
  const passwordRequired = !!(settings.enablePasswordAuth && config.adminPassword)
  const authRequired = passwordRequired || otpEnabled

  if (!authRequired) {
    return { authenticated: true, authRequired: false, otpEnabled: false, passwordRequired: false }
  }

  const token = getCookie(event, 'auth_token')
  // We use adminPassword as the token if it exists, otherwise a fixed string
  const expectedToken = config.adminPassword || 'authenticated'
  
  if (token === expectedToken) {
    return { authenticated: true, authRequired: true, otpEnabled, passwordRequired }
  }

  return { authenticated: false, authRequired: true, otpEnabled, passwordRequired }
})
