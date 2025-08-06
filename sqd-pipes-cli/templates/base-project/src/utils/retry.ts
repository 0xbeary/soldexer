import { logger } from './logger'

export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      logger.warn(`Attempt ${attempt} failed: ${lastError.message}`)
      
      if (attempt < maxAttempts) {
        logger.info(`Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        delay *= 2 // Exponential backoff
      }
    }
  }

  throw lastError!
}
