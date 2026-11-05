import { createSale, cancelRemoteSale } from './salesService'

const STORAGE_KEY = 'lubinin_sales'

// Estado de una venta rechazada por el servidor (datos inválidos).
// No se reintenta automáticamente.
const REVIEW_STATUS = 'needs-review'

// Evitar que una misma venta se sincronice simultáneamente
const salesInProgress = new Set()

// Recuperar ventas guardadas localmente
function getLocalSales() {
  const savedSales = localStorage.getItem(STORAGE_KEY)

  if (!savedSales) return []

  const parsedSales = JSON.parse(savedSales)

  if (!Array.isArray(parsedSales)) {
    throw new Error('El historial local de ventas no es válido.')
  }

  return parsedSales
}

// Guardar las ventas actualizadas
function saveLocalSales(sales) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sales))
}

// Identificador de una venta (mismo criterio que antes)
function getSaleId(sale) {
  return sale?.id || sale?.clientSaleId
}

// Una venta está pendiente si no está sincronizada
// y tampoco está marcada para revisión
function isPendingSale(sale) {
  return (
    sale.syncStatus !== 'synced' &&
    sale.syncStatus !== REVIEW_STATUS
  )
}

// Una cancelación está pendiente si la venta ya existe en el servidor
// pero la cancelación todavía no se ha confirmado
function isCancellationPending(sale) {
  return (
    sale.status === 'cancelled' &&
    sale.cancelSynced === false &&
    sale.syncStatus === 'synced'
  )
}

// Errores que no se arreglan reintentando (datos rechazados)
function isPermanentError(error) {
  return error?.status === 400 || error?.status === 422
}

// Modificar una venta concreta leyendo siempre el estado más reciente
function updateLocalSale(saleId, updater) {
  const updatedSales = getLocalSales().map((localSale) =>
    getSaleId(localSale) === saleId
      ? { ...localSale, ...updater(localSale) }
      : localSale
  )

  saveLocalSales(updatedSales)
}

// Contar ventas pendientes de reintento automático
function getPendingSalesCount() {
  try {
    return getLocalSales().filter(isPendingSale).length
  } catch (error) {
    console.error('Error leyendo ventas pendientes:', error)
    return null
  }
}

// Contar ventas que requieren revisión
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

// Contar cancelaciones pendientes de enviar
function getPendingCancellationsCount() {
  try {
    return getLocalSales().filter(isCancellationPending).length
  } catch (error) {
    console.error('Error leyendo cancelaciones pendientes:', error)
    return null
  }
}

// Sincronizar una venta concreta
export async function syncSale(sale) {
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

  // Las ventas rechazadas no se reintentan automáticamente
  if (sale?.syncStatus === REVIEW_STATUS) {
    return {
      synced: false,
      reason: 'needs-review',
    }
  }

  // Evitar sincronizaciones simultáneas de la misma venta
  if (salesInProgress.has(saleId)) {
    return {
      synced: false,
      reason: 'in-progress',
    }
  }

  salesInProgress.add(saleId)

  try {
    const response = await createSale({
      ...sale,
      clientSaleId: saleId,
    })

    // Marcar como sincronizada leyendo el historial más reciente.
    // Si la venta se canceló localmente, se comprueba si el servidor
    // ya la tiene cancelada; si no, la cancelación queda pendiente.
    updateLocalSale(saleId, (localSale) => ({
      syncStatus: 'synced',
      lastSyncError: null,
      ...(localSale.status === 'cancelled'
        ? { cancelSynced: response?.sale?.status === 'cancelled' }
        : {}),
    }))

    return {
      synced: true,
      duplicated: response?.duplicated || false,
    }
  } catch (error) {
    console.error('Error sincronizando venta:', error)

    const permanent = isPermanentError(error)

    // Guardar el fallo para consultarlo tras cerrar el navegador.
    // Si el servidor rechazó los datos (400/422), la venta se marca
    // para revisión. En cualquier otro caso sigue pendiente.
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
  }
}

// Enviar al servidor la cancelación de una venta ya sincronizada
async function syncCancellation(saleId) {
  if (!navigator.onLine) {
    return { synced: false, reason: 'offline' }
  }

  const key = `cancel:${saleId}`

  if (salesInProgress.has(key)) {
    return { synced: false, reason: 'in-progress' }
  }

  salesInProgress.add(key)

  try {
    const sale = getLocalSales().find(
      (localSale) => getSaleId(localSale) === saleId
    )

    await cancelRemoteSale(saleId, sale?.cancelledAt)

    updateLocalSale(saleId, () => ({
      cancelSynced: true,
      lastCancelError: null,
    }))

    return { synced: true }
  } catch (error) {
    console.error('Error sincronizando cancelación:', error)

    try {
      if (error?.status === 404) {
        // El servidor no tiene la venta: se vuelve a enviar completa
        // (ya con estado cancelada) en el siguiente ciclo.
        updateLocalSale(saleId, () => ({
          syncStatus: 'pending',
          lastCancelError: error?.message || 'La venta no existe en el servidor.',
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
  }
}

// Cancelar una venta: se guarda primero en local y después se envía
export async function cancelSale(sale) {
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
      (localSale) => String(getSaleId(localSale)) === normalizedId
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
      // Venta que solo existe en el servidor (por ejemplo, hecha en otro
      // dispositivo): se guarda una copia local ya cancelada.
      const { _id, __v, createdAt, updatedAt, ...cleanSale } = sale

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

  // Intentar enviarla ahora. Si falla o no hay conexión,
  // queda pendiente y se reintenta automáticamente.
  try {
    const latest = getLocalSales().find(
      (localSale) => getSaleId(localSale) === realId
    )

    if (latest && latest.syncStatus === 'synced') {
      const result = await syncCancellation(realId)
      return { cancelled: true, synced: result.synced }
    }

    if (latest && isPendingSale(latest)) {
      // La venta aún no estaba en el servidor: se envía ya cancelada
      const result = await syncSale(latest)
      return { cancelled: true, synced: result.synced }
    }
  } catch (error) {
    console.error('Error enviando la cancelación:', error)
  }

  return { cancelled: true, synced: false }
}

// Reintentar manualmente una venta marcada para revisión
export async function retryReviewSale(saleId) {
  const normalizedId = String(saleId)

  let sale

  try {
    sale = getLocalSales().find(
      (localSale) => String(getSaleId(localSale)) === normalizedId
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

// Sincronizar todas las ventas pendientes
export async function syncPendingSales() {
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

    for (const sale of pendingSales) {
      const result = await syncSale(sale)

      if (result.synced) {
        syncedCount += 1
      }
    }

    // Enviar las cancelaciones pendientes (leyendo el estado más reciente)
    const salesToCancel = getLocalSales().filter(isCancellationPending)

    for (const sale of salesToCancel) {
      await syncCancellation(getSaleId(sale))
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