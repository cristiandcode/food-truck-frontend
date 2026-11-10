
const API_URL = (
  import.meta.env.VITE_API_URL ||
  'https://lubinin-backend.onrender.com'
).replace(/\/$/, '')

const TOKEN_KEY = 'lubinin_auth_token'
const OFFLINE_PIN_KEY = 'lubinin_offline_pin_verifier'
const PBKDF2_ITERATIONS = 120000

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function saveAuthToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
}

// Convertir bytes a Base64
function bytesToBase64(bytes) {
  let binary = ''

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary)
}

function base64ToBytes(value) {
  const binary = atob(value)

  return Uint8Array.from(binary, (char) =>
    char.charCodeAt(0)
  )
}

// Generar hash seguro del PIN
async function hashPin(pin, salt, iterations) {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      'Este dispositivo no permite validar el PIN offline.'
    )
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  )

  return bytesToBase64(new Uint8Array(bits))
}

// Guardar el verificador después de validar online
async function saveOfflinePinVerifier(pin) {
  try {
    const salt = crypto.getRandomValues(
      new Uint8Array(16)
    )

    const hash = await hashPin(
      pin,
      salt,
      PBKDF2_ITERATIONS
    )

    localStorage.setItem(
      OFFLINE_PIN_KEY,
      JSON.stringify({
        salt: bytesToBase64(salt),
        hash,
        iterations: PBKDF2_ITERATIONS,
      })
    )
  } catch (error) {
    console.error(
      'No se pudo preparar el acceso offline:',
      error
    )
  }
}

// Validar PIN localmente
async function loginOffline(pin) {
  const saved = localStorage.getItem(OFFLINE_PIN_KEY)

  if (!saved) {
    throw new Error(
      'Todavía no se configuró el acceso offline. Conectate a Internet e ingresá una vez con tu PIN.'
    )
  }

  try {
    const verifier = JSON.parse(saved)

    const calculatedHash = await hashPin(
      pin,
      base64ToBytes(verifier.salt),
      verifier.iterations
    )

    if (calculatedHash !== verifier.hash) {
      throw new Error('PIN incorrecto.')
    }

    return {
      message: 'Acceso autorizado sin conexión.',
      offline: true,
    }
  } catch (error) {
    if (error.message === 'PIN incorrecto.') {
      throw error
    }

    throw new Error(
      'No se pudo comprobar el PIN offline.'
    )
  }
}

// Ingresar mediante PIN
export async function loginWithPin(pin) {
  if (!/^\d{4}$/.test(String(pin))) {
    throw new Error(
      'El PIN debe tener exactamente 4 dígitos.'
    )
  }

  // Sin conexión: validar localmente
  if (!navigator.onLine) {
    return loginOffline(pin)
  }

  let response

  try {
    response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin }),
    })
  } catch (error) {
    // Si falla la conexión, intentar validación local
    if (error instanceof TypeError) {
      return loginOffline(pin)
    }

    throw error
  }

  let data = {}

  try {
    data = await response.json()
  } catch {
    // Respuesta no JSON
  }

  if (!response.ok) {
    throw new Error(
      data.message || 'No se pudo validar el PIN.'
    )
  }

  if (!data.token) {
    throw new Error(
      'El servidor no devolvió un token de sesión.'
    )
  }

  saveAuthToken(data.token)

  // Registrar el PIN para futuros accesos offline
  await saveOfflinePinVerifier(pin)

  return data
}

// Solicitudes autenticadas
export async function authenticatedFetch(url, options = {}) {
  const token = getAuthToken()

  if (!token) {
    throw new Error(
      'Debes ingresar tu PIN para continuar.'
    )
  }

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    logout()

    window.dispatchEvent(
      new Event('lubinin:session-expired')
    )
  }

  return response
}
