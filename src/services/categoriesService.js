
import { authenticatedFetch } from './authService'

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000'

export async function getRemoteCategories() {
  const response = await authenticatedFetch(
    `${API_URL}/api/categories`
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.message || 'No se pudieron consultar las categorías.'
    )
  }

  return data.categories || []
}

export async function createRemoteCategory(category) {
  const response = await authenticatedFetch(
    `${API_URL}/api/categories`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: category.name,
        icon: category.icon,
      }),
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.message || 'No se pudo crear la categoría.'
    )
  }

  return data.category
}
