
import { createSale } from './salesService'

const STORAGE_KEY = 'lubinin_sales'

// Recuperar ventas guardadas localmente
function getLocalSales() {
  try {
    const savedSales = localStorage.getItem(STORAGE_KEY)

    if (!savedSales) return []

    const parsedSales = JSON.parse(savedSales)

    return Array.isArray(parsedSales) ? parsedSales : []
  } catch (error) {
    console.error('Error recuperando ventas locales:', error)
    return []
  }
}

// Guardar las ventas actualizadas
function saveLocalSales(sales) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sales))
}

// Sincronizar una venta concreta
export async function syncSale(sale) {
  if (!navigator.onLine) {
    return {
      synced: false,
      reason: 'offline',
    }
  }

  try {
    const response = await createSale({
      ...sale,
      clientSaleId: sale.id || sale.clientSaleId,
    })

    const saleId = sale.id || sale.clientSaleId

    const currentSales = getLocalSales()

    const updatedSales = currentSales.map((localSale) => {
      const localId = localSale.id || localSale.clientSaleId

      if (localId === saleId) {
        return {
          ...localSale,
          syncStatus: 'synced',
        }
      }

      return localSale
    })

    saveLocalSales(updatedSales)

    return {
      synced: true,
      duplicated: response.duplicated || false,
    }
  } catch (error) {
    console.error('Error sincronizando venta:', error)

    return {
      synced: false,
      reason: 'error',
      error,
    }
  }
}

// Sincronizar todas las ventas pendientes
export async function syncPendingSales() {
  if (!navigator.onLine) {
    return {
      synced: 0,
      pending: getLocalSales().length,
    }
  }

  const sales = getLocalSales()

  const pendingSales = sales.filter(
    (sale) => sale.syncStatus !== 'synced'
  )

  let syncedCount = 0

  for (const sale of pendingSales) {
    const result = await syncSale(sale)

    if (result.synced) {
      syncedCount += 1
    }
  }

  const remainingSales = getLocalSales().filter(
    (sale) => sale.syncStatus !== 'synced'
  )

  return {
    synced: syncedCount,
    pending: remainingSales.length,
  }
}
