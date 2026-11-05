
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// Consultar productos de MongoDB
export async function getRemoteProducts() {
  const response = await fetch(`${API_URL}/api/products`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.message || 'No se pudieron consultar los productos.'
    )
  }

  return data.products || []
}

// Crear un producto en MongoDB
export async function createRemoteProduct(product) {
  const response = await fetch(`${API_URL}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...product,
      clientProductId:
        product.clientProductId || `lubinin-${product.id}`,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.message || 'No se pudo crear el producto.'
    )
  }

  return data.product
}

// Actualizar un producto en MongoDB
export async function updateRemoteProduct(product) {
  const clientProductId =
    product.clientProductId || `lubinin-${product.id}`

  const response = await fetch(
    `${API_URL}/api/products/${encodeURIComponent(clientProductId)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: product.name,
        price: product.price,
        category: product.category,
        emoji: product.emoji,
      }),
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.message || 'No se pudo actualizar el producto.'
    )
  }

  return data.product
}

// Activar o desactivar un producto
export async function setRemoteProductActive(
  clientProductId,
  active
) {
  const action = active ? 'activate' : 'deactivate'

  const response = await fetch(
    `${API_URL}/api/products/${encodeURIComponent(clientProductId)}/${action}`,
    {
      method: 'PATCH',
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.message || 'No se pudo cambiar el estado del producto.'
    )
  }

  return data.product
}
