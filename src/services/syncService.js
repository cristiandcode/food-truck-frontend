
import {
  createSale,
  cancelRemoteSale,
  deleteAllRemoteSales,
} from './salesService'

const STORAGE_KEY = 'lubinin_sales'

// Estado de una venta rechazada por el servidor.
const REVIEW_STATUS = 'needs-review'

// Evitar que una misma venta se sincronice simultáneamente.
const salesInProgress = new Set()

// Coordinación para evitar sincronizaciones durante el borrado total.
let historyClearInProgress = false
let activeSyncOperations = 0

// Recuperar ventas guardadas localmente.
function getLocalSales() {
  const savedSales = localStorage.getItem(STORAGE_KEY)

  if (!savedSales) return []

  const parsedSales = JSON.parse(savedSales)

  if (!Array.isArray(parsedSales)) {
    throw new Error('El historial local de ventas no es válido.')
  }

  return parsedSales
}

// Guardar las ventas actualizadas.
function saveLocalSales(sales) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sales))
}

// Identificador de una venta.
function getSaleId(sale) {
  return sale?.id || sale?.clientSaleId
}

// Comparar identificadores aunque uno sea número y otro texto.
function sameSaleId(firstId, secondId) {
  return (
    firstId !== undefined &&
    firstId !== null &&
    secondId !== undefined &&
    secondId !== null &&
    String(firstId) === String(secondId)
  )
}

// Una venta está pendiente si no está sincronizada
// y tampoco está marcada para revisión.
function isPendingSale(sale) {
  return (
    sale.syncStatus !== 'synced' &&
    sale.syncStatus !== REVIEW_STATUS
  )
}

// Una cancelación está pendiente si la venta ya existe
// en el servidor, pero la cancelación no se ha confirmado.
function isCancellationPending(sale) {
  return (
    sale.status === 'cancelled' &&
    sale.cancelSynced === false &&
    sale.syncStatus === 'synced'
  )
}

// Errores que no se arreglan reintentando automáticamente.
function isPermanentError(error) {
  return error?.status === 400 || error?.status === 422
}

// Campos económicos y operativos que el servidor calcula
// o confirma y que deben incorporarse a la venta local.
function getServerSaleFields(serverSale) {
  if (!serverSale || typeof serverSale !== 'object') {
    return {}
  }

  const fields = [
    'saleNumber',
    'deviceId',
    'date',
    'items',
    'subtotal',
    'isSeniorCustomer',
    'discountRate',
    'discountAmount',
    'total',
    'paymentMethod',
    'paymentDetails',
    'status',
    'cancelledAt',
    'inventoryConsumption'
  ]

  const result = {}

  for (const field of fields) {
    if (
      serverSale[field] !== undefined &&
      (field !== 'deviceId' || serverSale[field])
    ) {
      result[field] = serverSale[field]
    }
  }

  return result
}

// Modificar una venta concreta leyendo siempre el estado más reciente.
function updateLocalSale(saleId, updater) {
  const currentSales = getLocalSales()

  const updatedSales = currentSales.map((localSale) =>
    sameSaleId(getSaleId(localSale), saleId)
      ? { ...localSale, ...updater(localSale) }
      : localSale
  )

  saveLocalSales(updatedSales)
}

// Contar ventas pendientes de reintento automático.
function getPendingSalesCount() {
  try {
    return getLocalSales().filter(isPendingSale).length
  } catch (error) {
    console.error('Error leyendo ventas pendientes:', error)
    return null
  }
}

// Contar ventas que requieren revisión.
function getReviewSalesCount() {
  try {
    return getLocalSales().filter(
      (sale) => sale.syncStatus === REVIEW_STATUS
    ).length
  } catch (error) {
    console.error('Error leyendo ventas en revisión:', error)
    return null
  }
}

// Contar cancelaciones pendientes de enviar.
function getPendingCancellationsCount() {
  try {
    return getLocalSales().filter(isCancellationPending).length
  } catch (error) {
    console.error('Error leyendo cancelaciones pendientes:', error)
    return null
  }
}

// Esperar a que terminen las sincronizaciones ya iniciadas.
function waitForActiveSyncOperations() {
  return new Promise((resolve) => {
    const check = () => {
      if (activeSyncOperations === 0) {
        resolve()
        return
      }

      setTimeout(check, 50)
    }

    check()
  })
}

// Eliminar todo el historial local y remoto.
// Si el servidor falla, se restaura el historial local anterior.
export async function clearAllSalesHistory() {
  if (!navigator.onLine) {
    return {
      cleared: false,
      reason: 'offline',
      error: new Error(
        'Necesitas conexión a Internet para eliminar todo el historial.'
      ),
    }
  }

  if (historyClearInProgress) {
    return {
      cleared: false,
      reason: 'in-progress',
    }
  }

  historyClearInProgress = true

  let previousSales = []

  try {
    // Capturar el historial local antes de modificarlo.
    previousSales = getLocalSales()

    // Esperar a que terminen las operaciones que ya estaban enviándose.
    await waitForActiveSyncOperations()

    // Vaciar primero el almacenamiento local para impedir que
    // las ventas antiguas vuelvan a sincronizarse durante el borrado.
    saveLocalSales([])

    // Eliminar el historial del servidor.
    const response = await deleteAllRemoteSales()

    return {
      cleared: true,
      deletedCount: response.deletedCount || 0,
    }
  } catch (error) {
    console.error('Error eliminando todo el historial:', error)

    // Si el servidor no confirma el borrado, recuperar las ventas
    // anteriores y conservar también cualquier venta nueva que
    // se haya guardado localmente durante la operación.
    try {
      const currentSales = getLocalSales()
      const restoredSales = new Map()

      for (const sale of previousSales) {
        const id = getSaleId(sale)

        if (id !== undefined && id !== null) {
          restoredSales.set(String(id), sale)
        }
      }

      for (const sale of currentSales) {
        const id = getSaleId(sale)

        if (id !== undefined && id !== null) {
          restoredSales.set(String(id), sale)
        }
      }

      saveLocalSales(Array.from(restoredSales.values()))
    } catch (restoreError) {
      console.error(
        'No se pudo restaurar el historial local:',
        restoreError
      )
    }

    return {
      cleared: false,
      reason: 'error',
      error,
    }
  } finally {
    historyClearInProgress = false
  }
}

// Sincronizar una venta concreta.
export async function syncSale(sale) {
  if (historyClearInProgress) {
    return {
      synced: false,
      reason: 'history-clearing',
    }
  }

  if (!navigator.onLine) {
    return {
      synced: false,
      reason: 'offline',
    }
  }

  const saleId = getSaleId(sale)

  if (!saleId) {
    return {
      synced: false,
      reason: 'missing-id',
    }
  }

  if (sale?.syncStatus === REVIEW_STATUS) {
    return {
      synced: false,
      reason: 'needs-review',
    }
  }

  if (salesInProgress.has(saleId)) {
    return {
      synced: false,
      reason: 'in-progress',
    }
  }

  salesInProgress.add(saleId)
  activeSyncOperations += 1

  try {
    const response = await createSale({
      ...sale,
      clientSaleId: saleId,
    })

    const serverSale = response?.sale
    const serverFields = getServerSaleFields(serverSale)

    updateLocalSale(saleId, (localSale) => {
      const wasCancelledLocally =
        localSale.status === 'cancelled'

      const serverConfirmsCancellation =
        serverSale?.status === 'cancelled'

      return {
        ...serverFields,

        ...(wasCancelledLocally
          ? {
              status: 'cancelled',
              cancelledAt:
                localSale.cancelledAt ||
                serverSale?.cancelledAt ||
                new Date().toISOString(),
              cancelSynced: serverConfirmsCancellation,
            }
          : {}),

        id: localSale.id || localSale.clientSaleId || saleId,

        syncStatus: 'synced',
        lastSyncError: null,
      }
    })

    return {
      synced: true,
      duplicated: response?.duplicated || false,
    }
  } catch (error) {
    console.error('Error sincronizando venta:', error)

    if (error?.status === 401) {
      return {
        synced: false,
        reason: 'unauthorized',
        error,
      }
    }

    const permanent = isPermanentError(error)

    try {
      updateLocalSale(saleId, (localSale) => ({
        syncAttempts: (localSale.syncAttempts || 0) + 1,
        lastSyncAttempt: new Date().toISOString(),
        lastSyncError: error?.message || 'Error desconocido',
        ...(permanent ? { syncStatus: REVIEW_STATUS } : {}),
      }))
    } catch (storageError) {
      console.error('No se pudo registrar el error:', storageError)
    }

    return {
      synced: false,
      reason: permanent ? 'rejected' : 'error',
      error,
    }
  } finally {
    salesInProgress.delete(saleId)
    activeSyncOperations -= 1
  }
}

// Enviar al servidor la cancelación de una venta ya sincronizada.
async function syncCancellation(saleId) {
  if (historyClearInProgress) {
    return {
      synced: false,
      reason: 'history-clearing',
    }
  }

  if (!navigator.onLine) {
    return { synced: false, reason: 'offline' }
  }

  const key = `cancel:${saleId}`

  if (salesInProgress.has(key)) {
    return { synced: false, reason: 'in-progress' }
  }

  salesInProgress.add(key)
  activeSyncOperations += 1

  try {
    const sale = getLocalSales().find(
      (localSale) => sameSaleId(getSaleId(localSale), saleId)
    )

    await cancelRemoteSale(saleId, sale?.cancelledAt)

    updateLocalSale(saleId, () => ({
      cancelSynced: true,
      lastCancelError: null,
    }))

    return { synced: true }
  } catch (error) {
    console.error('Error sincronizando cancelación:', error)

    if (error?.status === 401) {
      return {
        synced: false,
        reason: 'unauthorized',
        error,
      }
    }

    try {
      if (error?.status === 404) {
        updateLocalSale(saleId, () => ({
          syncStatus: 'pending',
          lastCancelError:
            error?.message || 'La venta no existe en el servidor.',
        }))
      } else {
        updateLocalSale(saleId, (localSale) => ({
          cancelAttempts: (localSale.cancelAttempts || 0) + 1,
          lastCancelError: error?.message || 'Error desconocido',
        }))
      }
    } catch (storageError) {
      console.error('No se pudo registrar el error:', storageError)
    }

    return { synced: false, reason: 'error', error }
  } finally {
    salesInProgress.delete(key)
    activeSyncOperations -= 1
  }
}

// Cancelar una venta: se guarda primero en local y después se envía.
export async function cancelSale(sale) {
  if (historyClearInProgress) {
    return {
      cancelled: false,
      reason: 'history-clearing',
    }
  }

  const saleId = getSaleId(sale)

  if (!saleId) {
    return { cancelled: false, reason: 'missing-id' }
  }

  const normalizedId = String(saleId)
  const cancelledAt = new Date().toISOString()

  let realId

  try {
    const localSales = getLocalSales()

    const found = localSales.find(
      (localSale) =>
        String(getSaleId(localSale)) === normalizedId
    )

    if (found) {
      if (found.status === 'cancelled') {
        return { cancelled: true, reason: 'already-cancelled' }
      }

      realId = getSaleId(found)

      updateLocalSale(realId, () => ({
        status: 'cancelled',
        cancelledAt,
        cancelSynced: false,
      }))
    } else {
      const {
        _id,
        __v,
        createdAt,
        updatedAt,
        ...cleanSale
      } = sale

      realId = normalizedId

      saveLocalSales([
        {
          ...cleanSale,
          id: normalizedId,
          syncStatus: 'synced',
          status: 'cancelled',
          cancelledAt,
          cancelSynced: false,
        },
        ...localSales,
      ])
    }
  } catch (error) {
    console.error('Error al cancelar la venta localmente:', error)
    return { cancelled: false, reason: 'storage-error' }
  }

  try {
    const latest = getLocalSales().find(
      (localSale) => sameSaleId(getSaleId(localSale), realId)
    )

    if (latest && latest.syncStatus === 'synced') {
      const result = await syncCancellation(realId)
      return { cancelled: true, synced: result.synced }
    }

    if (latest && isPendingSale(latest)) {
      const result = await syncSale(latest)
      return { cancelled: true, synced: result.synced }
    }
  } catch (error) {
    console.error('Error enviando la cancelación:', error)
  }

  return { cancelled: true, synced: false }
}

// Reintentar manualmente una venta marcada para revisión.
export async function retryReviewSale(saleId) {
  if (historyClearInProgress) {
    return {
      synced: false,
      reason: 'history-clearing',
    }
  }

  const normalizedId = String(saleId)

  let sale

  try {
    sale = getLocalSales().find(
      (localSale) =>
        String(getSaleId(localSale)) === normalizedId
    )
  } catch (error) {
    console.error('Error leyendo ventas locales:', error)
    return { synced: false, reason: 'storage-error' }
  }

  if (!sale) {
    return { synced: false, reason: 'not-found' }
  }

  const realId = getSaleId(sale)

  try {
    updateLocalSale(realId, () => ({
      syncStatus: 'pending',
      lastSyncError: null,
    }))
  } catch (error) {
    console.error('No se pudo preparar el reintento:', error)
    return { synced: false, reason: 'storage-error' }
  }

  return syncSale({ ...sale, syncStatus: 'pending' })
}

// Sincronizar todas las ventas pendientes.
export async function syncPendingSales() {
  if (historyClearInProgress) {
    return {
      synced: 0,
      pending: getPendingSalesCount(),
      review: getReviewSalesCount(),
      cancellations: getPendingCancellationsCount(),
      clearing: true,
    }
  }

  if (!navigator.onLine) {
    return {
      synced: 0,
      pending: getPendingSalesCount(),
      review: getReviewSalesCount(),
      cancellations: getPendingCancellationsCount(),
    }
  }

  try {
    const sales = getLocalSales()
    const pendingSales = sales.filter(isPendingSale)

    let syncedCount = 0
    let unauthorized = false

    for (const sale of pendingSales) {
      if (historyClearInProgress) break

      const result = await syncSale(sale)

      if (result.synced) {
        syncedCount += 1
      }

      if (result.reason === 'unauthorized') {
        unauthorized = true
        break
      }
    }

    if (!unauthorized && !historyClearInProgress) {
      const salesToCancel = getLocalSales().filter(
        isCancellationPending
      )

      for (const sale of salesToCancel) {
        if (historyClearInProgress) break

        const result = await syncCancellation(getSaleId(sale))

        if (result.reason === 'unauthorized') {
          break
        }
      }
    }

    return {
      synced: syncedCount,
      pending: getPendingSalesCount(),
      review: getReviewSalesCount(),
      cancellations: getPendingCancellationsCount(),
    }
  } catch (error) {
    console.error('Error sincronizando ventas pendientes:', error)

    return {
      synced: 0,
      pending: null,
      review: null,
      cancellations: null,
      error,
    }
  }
}
