
const express = require('express')
const crypto = require('crypto')

const {
  createSessionToken,
} = require('../middleware/auth')

const router = express.Router()

const failedAttempts = new Map()

const MAX_ATTEMPTS = 5
const BLOCK_TIME = 15 * 60 * 1000

router.post('/login', (req, res) => {
  const configuredPin = process.env.APP_PIN
  const sessionSecret = process.env.SESSION_SECRET

  if (
    !configuredPin ||
    !/^\d{4}$/.test(configuredPin) ||
    !sessionSecret
  ) {
    return res.status(500).json({
      message: 'El acceso todavía no está configurado.',
    })
  }

  const ip = req.ip
  const now = Date.now()
  const attempts = failedAttempts.get(ip)

  if (attempts && attempts.blockedUntil > now) {
    return res.status(429).json({
      message: 'Demasiados intentos. Inténtalo más tarde.',
    })
  }

  const receivedPin = String(req.body?.pin || '')

  const receivedBuffer = Buffer.from(receivedPin)
  const configuredBuffer = Buffer.from(configuredPin)

  const validPin =
    /^\d{4}$/.test(receivedPin) &&
    receivedBuffer.length === configuredBuffer.length &&
    crypto.timingSafeEqual(receivedBuffer, configuredBuffer)

  if (!validPin) {
    const currentAttempts = attempts
      ? attempts.count + 1
      : 1

    failedAttempts.set(ip, {
      count: currentAttempts,
      blockedUntil:
        currentAttempts >= MAX_ATTEMPTS
          ? now + BLOCK_TIME
          : 0,
    })

    return res.status(401).json({
      message: 'PIN incorrecto.',
      remainingAttempts: Math.max(
        0,
        MAX_ATTEMPTS - currentAttempts
      ),
    })
  }

  failedAttempts.delete(ip)

  const token = createSessionToken(sessionSecret)

  return res.json({
    message: 'Acceso autorizado.',
    token,
    expiresIn: 8 * 60 * 60,
  })
})

module.exports = router
