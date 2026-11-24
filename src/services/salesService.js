
import { authenticatedFetch } from './authService'

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000'

// Tiempo máximo de espera de una petición (ms)
const REQUEST_TIMEOUT_MS = 15000

// Petición con autenticación, timeout y lectura segura del JSON
async function requestJson(url, options = {}) {
  const controller = new AbortController()

  const timeoutId = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  )

  try {
    const response = await authenticatedFetch(url, {
      ...options,
      signal: controller.signal,
    })

    let data = null

    try {
      data = await response.json()
    } catch {
      data = null
    }

    return { response, data }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('El servidor tardó demasiado en responder.')
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

// Registrar una venta en MongoDB
export async function createSale(sale) {
  const { response, data } = await requestJson(
    `${API_URL}/api/sales`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sale),
    }
  )

  if (!response.ok) {
    const error = new Error(
      data?.message || 'No se pudo registrar la venta en el servidor.'
    )

    error.status = response.status
    throw error
  }

  if (!data) {
    const error = new Error(
      'Respuesta del servidor no válida al registrar la venta.'
    )

    error.status = response.status
    throw error
  }

  return data
}

// Cancelar una venta en MongoDB
export async function cancelRemoteSale(clientSaleId, cancelledAt) {
  const { response, data } = await requestJson(
    `${API_URL}/api/sales/${encodeURIComponent(clientSaleId)}/cancel`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cancelledAt }),
    }
  )

  if (!response.ok) {
    const error = new Error(
      data?.message || 'No se pudo cancelar la venta en el servidor.'
    )

    error.status = response.status
    throw error
  }

  if (!data) {
    const error = new Error(
      'Respuesta del servidor no válida al cancelar la venta.'
    )

    error.status = response.status
    throw error
  }

  return data
}

// Modificar el método de pago de una venta ya registrada en MongoDB.
export async function updateRemoteSalePayment(clientSaleId, paymentData) {
  const { response, data } = await requestJson(
    `${API_URL}/api/sales/${encodeURIComponent(clientSaleId)}/payment`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData),
    }
  )

  if (!response.ok) {
    const error = new Error(
      data?.message || 'No se pudo modificar el método de pago.'
    )

    error.status = response.status
    throw error
  }

  if (!data?.sale) {
    const error = new Error(
      'Respuesta del servidor no válida al modificar el método de pago.'
    )

    error.status = response.status
    throw error
  }

  return data
}

// Consultar todas las ventas de MongoDB
export async function getRemoteSales() {
  const { response, data } = await requestJson(
    `${API_URL}/api/sales`
  )

  if (!response.ok) {
    const error = new Error(
      data?.message || 'No se pudo consultar el historial de ventas.'
    )

    error.status = response.status
    throw error
  }

  if (!data) {
    throw new Error(
      'Respuesta del servidor no válida al consultar las ventas.'
    )
  }

  return data.sales || []
}

// Eliminar todas las ventas de MongoDB.
// Esta operación se invoca desde syncService, que coordina
// primero las sincronizaciones y el historial local.
export async function deleteAllRemoteSales() {
  const { response, data } = await requestJson(
    `${API_URL}/api/sales/all`,
    {
      method: 'DELETE',
    }
  )

  if (!response.ok) {
    const error = new Error(
      data?.message || 'No se pudo eliminar el historial de ventas.'
    )

    error.status = response.status
    throw error
  }

  if (!data || data.success !== true) {
    const error = new Error(
      'El servidor no confirmó la eliminación del historial.'
    )

    error.status = response.status
    throw error
  }

  return data
}
