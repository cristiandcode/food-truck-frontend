
const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000'

const TOKEN_KEY = 'lubinin_auth_token'

// Obtener el token de sesión
export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY)
}

// Guardar el token después de ingresar con PIN
export function saveAuthToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

// Cerrar sesión
export function logout() {
  localStorage.removeItem(TOKEN_KEY)
}

// Ingresar mediante PIN
export async function loginWithPin(pin) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pin }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo validar el PIN.')
  }

  saveAuthToken(data.token)

  return data
}

// Realizar solicitudes autenticadas
export async function authenticatedFetch(url, options = {}) {
  const token = getAuthToken()

  if (!token) {
    throw new Error('Debes ingresar tu PIN para continuar.')
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
    window.dispatchEvent(new Event('lubinin:session-expired'))
  }

  return response
}
