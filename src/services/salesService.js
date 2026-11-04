
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// Registrar una venta en MongoDB
export async function createSale(sale) {
  const response = await fetch(`${API_URL}/api/sales`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sale),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.message || 'No se pudo registrar la venta en el servidor.'
    )
  }

  return data
}

// Consultar todas las ventas de MongoDB
export async function getRemoteSales() {
  const response = await fetch(`${API_URL}/api/sales`)

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.message || 'No se pudo consultar el historial de ventas.'
    )
  }

  return data.sales || []
}
