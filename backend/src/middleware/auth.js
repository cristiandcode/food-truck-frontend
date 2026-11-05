
const crypto = require('crypto')

function createSessionToken(secret) {
  const payload = {
    exp: Date.now() + 8 * 60 * 60 * 1000,
  }

  const encodedPayload = Buffer
    .from(JSON.stringify(payload))
    .toString('base64url')

  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url')

  return `${encodedPayload}.${signature}`
}

function requireAuth(req, res, next) {
  const secret = process.env.SESSION_SECRET

  if (!secret) {
    return res.status(500).json({
      message: 'Configuración de seguridad incompleta.',
    })
  }

  const authorization = req.headers.authorization || ''
  const [scheme, token] = authorization.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      message: 'Acceso no autorizado. Introduce el PIN.',
    })
  }

  try {
    const [payload, signature] = token.split('.')

    if (!payload || !signature) {
      throw new Error('Token inválido')
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64url')

    const receivedBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expectedSignature)

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      throw new Error('Firma inválida')
    }

    const session = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    )

    if (!session.exp || Date.now() > session.exp) {
      throw new Error('Sesión caducada')
    }

    next()
  } catch {
    return res.status(401).json({
      message: 'La sesión ha caducado. Introduce nuevamente el PIN.',
    })
  }
}

module.exports = {
  createSessionToken,
  requireAuth,
}
