const MAX_USER_ERROR_LENGTH = 300

export const getSafeErrorMessage = (error: unknown, fallback: string): string => {
  const rawMessage = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : ''

  if (rawMessage.length === 0) return fallback

  try {
    const parsed: unknown = JSON.parse(rawMessage)
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'message' in parsed &&
      typeof parsed.message === 'string' &&
      parsed.message.length > 0
    ) {
      return parsed.message.length <= MAX_USER_ERROR_LENGTH
        ? parsed.message
        : fallback
    }
  } catch {
    // Ordinary non-JSON errors are handled below.
  }

  return rawMessage.length <= MAX_USER_ERROR_LENGTH ? rawMessage : fallback
}
