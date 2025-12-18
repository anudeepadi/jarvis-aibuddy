import { google } from 'googleapis'
import { prisma } from './prisma'

export async function getValidAccessToken(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: 'google',
    },
  })

  if (!account) {
    throw new Error('No Google account linked')
  }

  if (!account.access_token) {
    throw new Error('No access token available')
  }

  // Check if token is expired (with 5-minute buffer)
  const now = Math.floor(Date.now() / 1000)
  const isExpired = !account.expires_at || account.expires_at < now + 300

  if (!isExpired) {
    return account.access_token
  }

  // Token expired - refresh it
  if (!account.refresh_token) {
    throw new Error('No refresh token available - user must re-authenticate')
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )

  oauth2Client.setCredentials({
    refresh_token: account.refresh_token,
  })

  const { credentials } = await oauth2Client.refreshAccessToken()

  // Update tokens in database
  await prisma.account.update({
    where: {
      provider_providerAccountId: {
        provider: 'google',
        providerAccountId: account.providerAccountId,
      },
    },
    data: {
      access_token: credentials.access_token,
      expires_at: credentials.expiry_date
        ? Math.floor(credentials.expiry_date / 1000)
        : undefined,
      ...(credentials.refresh_token && {
        refresh_token: credentials.refresh_token,
      }),
    },
  })

  return credentials.access_token!
}

export function getCalendarClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({ access_token: accessToken })
  return google.calendar({ version: 'v3', auth: oauth2Client })
}

export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}
