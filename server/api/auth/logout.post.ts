import { destroySession } from '../../utils/sessionManager'

export type LogoutResponse = {
  success: boolean
}

export default defineEventHandler((event) => {
  const sessionId = getCookie(event, 'auth_session')
  destroySession(sessionId)
  
  deleteCookie(event, 'auth_session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  })
  
  return { success: true } as LogoutResponse
})
