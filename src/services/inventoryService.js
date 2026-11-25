
import { authenticatedFetch } from './authService'

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000'

// Consultar el inventario compartido de MongoDB.
export async function getRemoteInventory() {
  const response = await authenticatedFetch(
    `${API_URL}/api/inventory`
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.message || 'No se pudo consultar el inventario.'
    )
  }

  return data.inventory
}

// Migrar por primera vez los ingredientes y recetas locales.
export async function initializeRemoteInventory(
  ingredients,
  recipes
) {
  const response = await authenticatedFetch(
    `${API_URL}/api/inventory/initialize`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ingredients,
        recipes,
      }),
    }
  )

  const data = await response.json()

  if (!response.ok) {
    const error = new Error(
      data.message || 'No se pudo inicializar el inventario.'
    )

    error.status = response.status
    error.inventory = data.inventory || null
    error.conflict = response.status === 409

    throw error
  }

  return data.inventory
}

// Actualizar el inventario compartido.
// Se envía la revisión para evitar sobrescribir cambios
// realizados previamente desde otro dispositivo.
export async function updateRemoteInventory(
  ingredients,
  recipes,
  revision
) {
  const response = await authenticatedFetch(
    `${API_URL}/api/inventory`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ingredients,
        recipes,
        revision,
      }),
    }
  )

  const data = await response.json()

  if (!response.ok) {
    const error = new Error(
      data.message || 'No se pudo actualizar el inventario.'
    )

    error.status = response.status
    error.inventory = data.inventory || null
    error.conflict = response.status === 409

    throw error
  }

  return data.inventory
}
