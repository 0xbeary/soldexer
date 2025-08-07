import pino from 'pino'

/**
 * Shared logger instance for schema management
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  messageKey: 'message',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    },
  },
})
