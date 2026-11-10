import { useEffect, useMemo, useRef, useState } from 'react'

import { getRemoteSales, updateRemoteSalePayment } from '../services/salesService'
import { retryReviewSale, cancelSale } from '../services/syncService'

const STORAGE_KEY = 'lubinin_sales'

function getSavedSales() {
  try {
    const savedSales = localStorage.getItem(STORAGE_KEY)
    if (!savedSales) return []

    const parsedSales = JSON.parse(savedSales)
    return Array.isArray(parsedSales) ? parsedSales : []
  } catch (error) {
    console.error('Error al recuperar las ventas:', error)
    return []
  }
}

// Combinar ventas locales y remotas sin duplicar operaciones

function mergeSales(localSales, remoteSales) {
  const salesMap = new Map()

  // Primero incorporamos las ventas locales.
  // Así no perdemos operaciones que todavía no llegaron al servidor.
  localSales.forEach((sale) => {
    const saleId = sale.id || sale.clientSaleId

    if (!saleId) return

    const normalizedId = String(saleId)

    salesMap.set(normalizedId, {
      ...sale,
      id: normalizedId,
    })
  })

  // Después incorporamos las ventas confirmadas por MongoDB.
  remoteSales.forEach((remoteSale) => {
    const saleId = remoteSale.clientSaleId || remoteSale.id

    if (!saleId) return

    const normalizedId = String(saleId)
    const localSale = salesMap.get(normalizedId)

    // Si la venta no existía localmente, se incorpora directamente.
    if (!localSale) {
      salesMap.set(normalizedId, {
        ...remoteSale,
        id: normalizedId,
        syncStatus: 'synced',
      })

      return
    }

    const localWasCancelled =
      localSale.status === 'cancelled'

    const remoteIsCancelled =
      remoteSale.status === 'cancelled'

    // MongoDB es la fuente de los importes, descuentos,
    // productos y datos definitivos de la venta.
    const mergedSale = {
      ...localSale,
      ...remoteSale,

      // Conservamos el identificador local.
      id: normalizedId,

      // Si la venta existe en MongoDB, está sincronizada.
      syncStatus: 'synced',

      // Conservamos los datos de seguimiento local.
      syncAttempts: localSale.syncAttempts || 0,
      lastSyncAttempt: localSale.lastSyncAttempt || null,
      lastSyncError: null,
    }

    // Una cancelación local pendiente nunca debe desaparecer
    // porque MongoDB todavía devuelva la venta como activa.
    if (localWasCancelled) {
      mergedSale.status = 'cancelled'
      mergedSale.cancelledAt =
        localSale.cancelledAt || remoteSale.cancelledAt || null

      mergedSale.cancelSynced =
        remoteIsCancelled || localSale.cancelSynced === true
    } else if (remoteIsCancelled) {
      // Si MongoDB ya tiene la venta cancelada, respetamos ese estado.
      mergedSale.status = 'cancelled'
      mergedSale.cancelledAt = remoteSale.cancelledAt
      mergedSale.cancelSynced = true
    } else {
      mergedSale.status = remoteSale.status || 'completed'
    }

    salesMap.set(normalizedId, mergedSale)
  })

  return Array.from(salesMap.values())
}


function isCancelled(sale) {
  return sale?.status === 'cancelled'
}

function getSyncState(sale) {
  if (sale.syncStatus === 'synced') return 'synced'
  if (sale.syncStatus === 'needs-review') return 'review'
  return 'pending'
}

function SyncBadge({ sale }) {
  const state = getSyncState(sale)

  if (state === 'synced') return null

  if (state === 'review') {
    return (
      <span className="mt-2 inline-flex rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-800">
        ⚠ Requiere revisión
      </span>
    )
  }

  return (
    <span className="mt-2 inline-flex rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
      ⏳ Pendiente de sincronizar
    </span>
  )
}

function CancelBadge({ sale }) {
  if (!isCancelled(sale)) return null

  return (
    <span className="mt-2 inline-flex flex-wrap items-center gap-2">
      <span className="inline-flex rounded-md bg-gray-200 px-2 py-1 text-xs font-bold text-gray-700">
        🚫 Cancelada
      </span>

      {sale.cancelSynced === false && (
        <span className="inline-flex rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
          ⏳ Cancelación pendiente de sincronizar
        </span>
      )}
    </span>
  )
}

function formatPrice(price) {
  return Number(price || 0).toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
  })
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTicketDate(date) {
  return new Date(date).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getLocalDate(date) {
  const parsedDate = new Date(date)
  const year = parsedDate.getFullYear()
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
  const day = String(parsedDate.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getCurrentMonth() {
  const date = new Date()

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, '0')}`
}

function getSaleItems(sale) {
  return Array.isArray(sale.items) ? sale.items : []
}

// Calcula el subtotal original de una venta.
function getSaleSubtotal(sale) {
  if (sale.subtotal !== undefined && sale.subtotal !== null) {
    return Number(sale.subtotal)
  }

  return getSaleItems(sale).reduce(
    (sum, item) =>
      sum +
      Number(item.price || 0) * Number(item.quantity || 0),
    0
  )
}

// Recupera el descuento total, incluso si falta el campo principal.
function getSaleDiscount(sale) {
  if (sale.discountAmount !== undefined && sale.discountAmount !== null) {
    return Number(sale.discountAmount)
  }

  return getSaleItems(sale).reduce(
    (sum, item) => sum + Number(item.discountAmount || 0),
    0
  )
}

// Ticket imprimible de una venta del historial
function HistorySaleTicket({ sale }) {
  const items = getSaleItems(sale)
  const subtotal = getSaleSubtotal(sale)
  const discountAmount = getSaleDiscount(sale)
  const hasDiscount = discountAmount > 0

  const paymentLabel =
    sale.paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta'

  return (
    <div
      id="lubinin-history-ticket"
      className="hidden bg-white text-left text-black"
    >
      <div className="text-center">
        <h2 className="text-xl font-bold">
          FOOD TRUCK LUBININ
        </h2>

        <p className="mt-1 text-xs">
          Ticket de venta
        </p>

        <div className="my-3 border-t border-dashed border-black" />

        <p>
          Venta: #{String(sale.saleNumber).padStart(4, '0')}
        </p>

        <p>
          Fecha: {formatTicketDate(sale.date)}
        </p>

        {isCancelled(sale) && (
          <p className="mt-2 font-bold">
            VENTA CANCELADA
          </p>
        )}
      </div>

      <div className="my-3 border-t border-dashed border-black" />

      <p className="mb-2 font-bold">
        DETALLE
      </p>

      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={`${item.id}-${index}`}>
            <p className="font-bold">
              {item.name}
            </p>

            <div className="flex justify-between gap-2">
              <span>
                {item.quantity} × {formatPrice(item.price)}
              </span>

              <span>
                {formatPrice(
                  Number(item.price || 0) *
                  Number(item.quantity || 0)
                )}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="my-3 border-t border-dashed border-black" />

      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{formatPrice(subtotal)}</span>
      </div>

      {hasDiscount && (
        <div className="mt-2 flex justify-between gap-2">
          <span>Descuento jubilado (5 %)</span>
          <span>-{formatPrice(discountAmount)}</span>
        </div>
      )}

      <div className="mt-2 flex justify-between text-lg font-bold">
        <span>TOTAL</span>
        <span>{formatPrice(sale.total)}</span>
      </div>

      <div className="my-3 border-t border-dashed border-black" />

      <p>
        Método de pago: {paymentLabel}
      </p>

      {sale.paymentMethod === 'cash' && (
        <>
          <div className="mt-1 flex justify-between">
            <span>Recibido</span>
            <span>
              {formatPrice(sale.paymentDetails?.received)}
            </span>
          </div>

          <div className="mt-1 flex justify-between">
            <span>Cambio</span>
            <span>
              {formatPrice(sale.paymentDetails?.change)}
            </span>
          </div>
        </>
      )}

      <div className="my-3 border-t border-dashed border-black" />

      <p className="text-center font-bold">
        ¡Gracias por tu compra!
      </p>

      <p className="mt-1 text-center text-xs">
        Conservá este ticket como comprobante.
      </p>
    </div>
  )
}

function Sales() {
  const [sales, setSales] = useState(getSavedSales)

  const [filterMode, setFilterMode] = useState('day')

  const [selectedDate, setSelectedDate] = useState(
    getLocalDate(new Date())
  )

  const [selectedMonth, setSelectedMonth] = useState(
    getCurrentMonth()
  )

  const [startDate, setStartDate] = useState(
    getLocalDate(new Date())
  )

  const [endDate, setEndDate] = useState(
    getLocalDate(new Date())
  )

  const [selectedSale, setSelectedSale] = useState(null)

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isRetrying, setIsRetrying] = useState(false)

  const [confirmCancel, setConfirmCancel] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [showPaymentEditor, setShowPaymentEditor] = useState(false)
  const [newPaymentMethod, setNewPaymentMethod] = useState('card')
  const [cashReceivedInput, setCashReceivedInput] = useState('')
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [paymentSuccess, setPaymentSuccess] = useState('')

  const isRefreshingRef = useRef(false)

  const closeDetail = () => {
    setSelectedSale(null)
    setConfirmCancel(false)
    setCancelError('')
    setShowPaymentEditor(false)
    setPaymentError('')
    setPaymentSuccess('')
  }

  const handleOpenPaymentEditor = () => {
    if (!selectedSale || isCancelled(selectedSale)) return

    if (!isOnline) {
      setPaymentError('Necesitás conexión para modificar el pago de una venta registrada en el servidor.')
      return
    }

    if (getSyncState(selectedSale) !== 'synced') {
      setPaymentError('Primero necesitás sincronizar esta venta con el servidor.')
      return
    }

    setPaymentError('')
    setPaymentSuccess('')
    setNewPaymentMethod(selectedSale.paymentMethod === 'cash' ? 'card' : 'cash')
    setCashReceivedInput(String(selectedSale.paymentDetails?.received ?? selectedSale.total ?? ''))
    setShowPaymentEditor(true)
  }

  const handleSavePaymentMethod = async () => {
    if (!selectedSale || isUpdatingPayment || isCancelled(selectedSale)) return

    if (!isOnline || getSyncState(selectedSale) !== 'synced') {
      setPaymentError('La venta debe estar sincronizada y necesitás conexión para modificar el pago.')
      return
    }

    const paymentData = { paymentMethod: newPaymentMethod }

    if (newPaymentMethod === 'cash') {
      const received = Number(String(cashReceivedInput).replace(',', '.'))

      if (!Number.isFinite(received) || received < Number(selectedSale.total || 0)) {
        setPaymentError('El importe recibido debe ser igual o superior al total de la venta.')
        return
      }

      paymentData.received = Number(received.toFixed(2))
    }

    setIsUpdatingPayment(true)
    setPaymentError('')
    setPaymentSuccess('')

    try {
      const result = await updateRemoteSalePayment(
        selectedSale.clientSaleId || selectedSale.id,
        paymentData
      )

      const serverSale = result.sale
      const normalizedId = String(serverSale.clientSaleId || selectedSale.clientSaleId || selectedSale.id)
      const updatedSale = { ...selectedSale, ...serverSale, id: normalizedId, syncStatus: 'synced' }

      const savedSales = getSavedSales()
      let foundLocalSale = false

      const updatedLocalSales = savedSales.map((sale) => {
        const saleId = String(sale.id || sale.clientSaleId || '')
        if (saleId !== normalizedId) return sale

        foundLocalSale = true
        return { ...sale, ...updatedSale, id: normalizedId, syncStatus: 'synced' }
      })

      if (!foundLocalSale) updatedLocalSales.push(updatedSale)

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLocalSales))

      setSales((currentSales) => {
        const exists = currentSales.some((sale) => String(sale.id || sale.clientSaleId || '') === normalizedId)

        if (!exists) return [...currentSales, updatedSale]

        return currentSales.map((sale) =>
          String(sale.id || sale.clientSaleId || '') === normalizedId ? updatedSale : sale
        )
      })

      setSelectedSale(updatedSale)
      setShowPaymentEditor(false)
      setPaymentSuccess('Método de pago actualizado correctamente.')
    } catch (error) {
      console.error('Error modificando el método de pago:', error)
      setPaymentError(error.message || 'No se pudo modificar el método de pago. Intentá nuevamente.')
    } finally {
      setIsUpdatingPayment(false)
    }
  }

  // Imprimir el ticket de la venta seleccionada
  const handlePrintTicket = () => {
    if (!selectedSale) return
    window.print()
  }

  const refreshSales = async () => {
    const initialLocalSales = getSavedSales()
    setSales(initialLocalSales)

    if (!navigator.onLine) {
      setIsOnline(false)
      setIsRefreshing(false)
      return
    }

    if (isRefreshingRef.current) {
      return
    }

    isRefreshingRef.current = true
    setIsRefreshing(true)

    try {
      const remoteSales = await getRemoteSales()
      const latestLocalSales = getSavedSales()

      const combinedSales = mergeSales(
        latestLocalSales,
        remoteSales
      )

      setSales(combinedSales)
      setIsOnline(true)

      console.log('Historial actualizado correctamente.')
      console.log('Ventas locales:', latestLocalSales.length)
      console.log('Ventas remotas:', remoteSales.length)
      console.log('Ventas unificadas:', combinedSales.length)
    } catch (error) {
      const latestLocalSales = getSavedSales()
      setSales(latestLocalSales)

      if (!navigator.onLine) {
        setIsOnline(false)
        console.warn('Sin conexión. Se mantiene el historial local.')
      } else {
        console.error('Error consultando las ventas remotas:', error)
      }
    } finally {
      isRefreshingRef.current = false
      setIsRefreshing(false)
    }
  }

  const handleRetrySale = async (sale) => {
    if (isRetrying) return

    setIsRetrying(true)

    try {
      const result = await retryReviewSale(sale.id)
      console.log('Resultado del reintento manual:', result)
    } catch (error) {
      console.error('Error en el reintento manual:', error)
    } finally {
      setIsRetrying(false)
      closeDetail()
      refreshSales()
    }
  }

  const handleCancelSale = async () => {
    if (!selectedSale || isCancelling) return

    setIsCancelling(true)
    setCancelError('')

    let failed = false

    try {
      const result = await cancelSale(selectedSale)
      console.log('Resultado de la cancelación:', result)

      if (!result?.cancelled) {
        failed = true
      }
    } catch (error) {
      console.error('Error al cancelar la venta:', error)
      failed = true
    }

    setIsCancelling(false)

    if (failed) {
      setCancelError(
        'No se pudo cancelar la venta. Intentá nuevamente.'
      )
      return
    }

    closeDetail()
    refreshSales()
  }

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      console.log('Conexión recuperada. Actualizando historial...')
      refreshSales()
    }

    const handleOffline = () => {
      setIsOnline(false)
      setIsRefreshing(false)
      setSales(getSavedSales())
      console.log('Sin conexión. Se mantiene el historial local.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    refreshSales()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const { pendingCount, reviewCount } = useMemo(() => {
    let pending = 0
    let review = 0

    sales.forEach((sale) => {
      const state = getSyncState(sale)

      if (state === 'pending') pending += 1
      if (state === 'review') review += 1
    })

    return { pendingCount: pending, reviewCount: review }
  }, [sales])

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const saleDate = getLocalDate(sale.date)

      if (filterMode === 'day') {
        return saleDate === selectedDate
      }

      if (filterMode === 'month') {
        return saleDate.startsWith(selectedMonth)
      }

      if (filterMode === 'range') {
        if (!startDate || !endDate) return false
        return saleDate >= startDate && saleDate <= endDate
      }

      return true
    })
  }, [
    sales,
    filterMode,
    selectedDate,
    selectedMonth,
    startDate,
    endDate,
  ])

  const activeSales = useMemo(
    () => filteredSales.filter((sale) => !isCancelled(sale)),
    [filteredSales]
  )

  const cancelledCount = filteredSales.length - activeSales.length

  const totalAmount = activeSales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  )

  const totalUnits = activeSales.reduce(
    (sum, sale) =>
      sum +
      getSaleItems(sale).reduce(
        (itemSum, item) =>
          itemSum + Number(item.quantity || 0),
        0
      ),
    0
  )

  const averageTicket =
    activeSales.length > 0
      ? totalAmount / activeSales.length
      : 0

  const cashSales = activeSales.filter(
    (sale) => sale.paymentMethod === 'cash'
  )

  const cardSales = activeSales.filter(
    (sale) => sale.paymentMethod === 'card'
  )

  const cashTotal = cashSales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  )

  const cardTotal = cardSales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  )

  const productSummary = useMemo(() => {
    const productsMap = {}

    activeSales.forEach((sale) => {
      getSaleItems(sale).forEach((item) => {
        const productKey = String(
          item.id ?? item.name ?? 'producto-sin-identificar'
        )

        const quantity = Number(item.quantity || 0)
        const price = Number(item.price || 0)

        if (!productsMap[productKey]) {
          productsMap[productKey] = {
            id: productKey,
            name: item.name || 'Producto sin nombre',
            emoji: item.emoji || '📦',
            quantity: 0,
            revenue: 0,
          }
        }

        productsMap[productKey].quantity += quantity
        productsMap[productKey].revenue += price * quantity
      })
    })

    return Object.values(productsMap).sort(
      (a, b) => b.quantity - a.quantity
    )
  }, [activeSales])

  const exportProductsCSV = () => {
    if (productSummary.length === 0) {
      alert('No hay productos vendidos para exportar.')
      return
    }

    const rows = [
      ['Producto', 'Unidades vendidas', 'Importe generado'],
      ...productSummary.map((product) => [
        product.name,
        product.quantity,
        product.revenue.toFixed(2).replace('.', ','),
      ]),
      [],
      ['TOTAL', totalUnits, totalAmount.toFixed(2).replace('.', ',')],
    ]

    const csvContent = rows
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell ?? '')
            return `"${value.replace(/"/g, '""')}"`
          })
          .join(';')
      )
      .join('\r\n')

    const blob = new Blob(
      ['\uFEFF' + csvContent],
      { type: 'text/csv;charset=utf-8;' }
    )

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `lubinin-productos-${getLocalDate(new Date())}.csv`

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
  }

  const getPeriodLabel = () => {
    if (filterMode === 'day') {
      return selectedDate
        ? formatDate(`${selectedDate}T12:00:00`)
        : 'Fecha seleccionada'
    }

    if (filterMode === 'month') {
      if (!selectedMonth) return 'Mes seleccionado'

      const [year, month] = selectedMonth.split('-')

      return new Date(
        Number(year),
        Number(month) - 1,
        1
      ).toLocaleDateString('es-ES', {
        month: 'long',
        year: 'numeric',
      })
    }

    if (filterMode === 'range') {
      if (!startDate || !endDate) return 'Período personalizado'

      return `${formatDate(`${startDate}T12:00:00`)} - ${formatDate(`${endDate}T12:00:00`)}`
    }

    return 'Todas las fechas'
  }

  return (
    <>
      <style>
        {`
          @media print {
            @page {
              size: 80mm auto;
              margin: 4mm;
            }

            body * {
              visibility: hidden !important;
            }

            #lubinin-history-ticket,
            #lubinin-history-ticket * {
              visibility: visible !important;
            }

            #lubinin-history-ticket {
              display: block !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: none !important;
              margin: 0 !important;
              padding: 0 !important;
              color: #000 !important;
              background: #fff !important;
              font-family: monospace !important;
              font-size: 12px !important;
            }

            .no-print {
              display: none !important;
            }
          }
        `}
      </style>

      <main className="mx-auto max-w-7xl p-5 lg:p-8">
        {/* Encabezado */}
        <div className="no-print mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">
              Historial de ventas
            </h2>

            <p className="mt-1 text-sm text-[#89877e]">
              Consultá las operaciones y los productos vendidos en Lubinin.
            </p>

            <p className={`mt-2 text-xs font-semibold ${
              isOnline ? 'text-green-700' : 'text-amber-700'
            }`}>
              {isOnline
                ? '● Conectado · Historial sincronizado con el servidor'
                : '● Sin conexión · Mostrando ventas guardadas en este dispositivo'}
            </p>

            {pendingCount > 0 && (
              <p className="mt-1 text-xs font-semibold text-amber-700">
                ⏳ {pendingCount}{' '}
                {pendingCount === 1
                  ? 'venta pendiente de sincronizar'
                  : 'ventas pendientes de sincronizar'}
              </p>
            )}

            {reviewCount > 0 && (
              <p className="mt-1 text-xs font-semibold text-red-700">
                ⚠ {reviewCount}{' '}
                {reviewCount === 1
                  ? 'venta requiere revisión'
                  : 'ventas requieren revisión'}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={refreshSales}
            disabled={isRefreshing || !isOnline}
            className="rounded-xl border border-[#e8e4da] bg-white px-4 py-3 text-sm font-semibold transition hover:bg-[#f5f3ee] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {!isOnline
              ? 'Sin conexión'
              : isRefreshing
                ? 'Actualizando...'
                : '↻ Actualizar'}
          </button>
        </div>

        {/* Filtros */}
        <div className="no-print mb-6 rounded-2xl border border-[#e8e4da] bg-white p-5">
          <div className="mb-4">
            <h3 className="font-bold text-[#26332d]">
              Período de consulta
            </h3>

            <p className="mt-1 text-sm text-[#89877e]">
              Seleccioná qué período querés analizar.
            </p>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {[
              { id: 'day', label: 'Un día' },
              { id: 'month', label: 'Un mes' },
              { id: 'range', label: 'Período personalizado' },
              { id: 'all', label: 'Todas las fechas' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilterMode(option.id)}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  filterMode === option.id
                    ? 'bg-[#26332d] text-white'
                    : 'bg-[#f5f3ee] text-[#66685f] hover:bg-[#eeece5]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {filterMode === 'day' && (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Seleccionar fecha
                </label>

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-xl border border-[#e8e4da] px-4 py-3 outline-none focus:border-[#c18b45]"
                />
              </div>

              <button
                type="button"
                onClick={() => setSelectedDate(getLocalDate(new Date()))}
                className="rounded-xl bg-[#f5f3ee] px-4 py-3 text-sm font-semibold text-[#66685f] transition hover:bg-[#eeece5]"
              >
                Hoy
              </button>
            </div>
          )}

          {filterMode === 'month' && (
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Seleccionar mes
              </label>

              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-xl border border-[#e8e4da] px-4 py-3 outline-none focus:border-[#c18b45]"
              />
            </div>
          )}

          {filterMode === 'range' && (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Desde
                </label>

                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-xl border border-[#e8e4da] px-4 py-3 outline-none focus:border-[#c18b45]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Hasta
                </label>

                <input
                  type="date"
                  min={startDate || undefined}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-xl border border-[#e8e4da] px-4 py-3 outline-none focus:border-[#c18b45]"
                />
              </div>
            </div>
          )}

          <p className="mt-4 text-xs font-medium text-[#89877e]">
            Período actual: {getPeriodLabel()}
          </p>
        </div>

        {/* Resumen general */}
        <div className="no-print mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-[#26332d] p-5 text-white">
            <p className="text-sm text-white/70">
              Total vendido
            </p>

            <p className="mt-2 text-3xl font-extrabold">
              {formatPrice(totalAmount)}
            </p>
          </div>

          <div className="rounded-2xl border border-[#e8e4da] bg-white p-5">
            <p className="text-sm text-[#89877e]">
              Operaciones
            </p>

            <p className="mt-2 text-3xl font-extrabold text-[#26332d]">
              {activeSales.length}
            </p>
          </div>

          <div className="rounded-2xl border border-[#e8e4da] bg-white p-5">
            <p className="text-sm text-[#89877e]">
              Unidades vendidas
            </p>

            <p className="mt-2 text-3xl font-extrabold text-[#26332d]">
              {totalUnits}
            </p>
          </div>

          <div className="rounded-2xl border border-[#e8e4da] bg-white p-5">
            <p className="text-sm text-[#89877e]">
              Ticket medio
            </p>

            <p className="mt-2 text-3xl font-extrabold text-[#26332d]">
              {formatPrice(averageTicket)}
            </p>
          </div>
        </div>

        {/* Resumen por método de pago */}
        <div className="no-print mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#e8e4da] bg-white p-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💵</span>

              <div>
                <p className="text-sm text-[#89877e]">
                  Ventas en efectivo
                </p>

                <p className="text-xl font-bold text-[#26332d]">
                  {formatPrice(cashTotal)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e8e4da] bg-white p-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💳</span>

              <div>
                <p className="text-sm text-[#89877e]">
                  Ventas con tarjeta
                </p>

                <p className="text-xl font-bold text-[#26332d]">
                  {formatPrice(cardTotal)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Informe de productos vendidos */}
        <div className="no-print mb-7 overflow-hidden rounded-2xl border border-[#e8e4da] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeae2] p-5">
            <div>
              <h3 className="text-lg font-bold text-[#26332d]">
                Productos vendidos
              </h3>

              <p className="mt-1 text-sm text-[#89877e]">
                Cantidad e importe generado por cada producto.
              </p>
            </div>

            <button
              type="button"
              onClick={exportProductsCSV}
              disabled={productSummary.length === 0}
              className="rounded-xl bg-[#26332d] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#3c4c42] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↓ Exportar Excel / CSV
            </button>
          </div>

          {productSummary.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
              <span className="mb-3 text-4xl">📦</span>

              <p className="font-semibold text-[#26332d]">
                Todavía no hay productos vendidos
              </p>

              <p className="mt-2 text-sm text-[#89877e]">
                Cuando registres ventas, aparecerá aquí el resumen por producto.
              </p>
            </div>
          ) : (
            <>
              <div className="border-b border-[#eeeae2] bg-[#faf9f6] p-5">
                <p className="mb-3 text-sm font-bold text-[#26332d]">
                  🏆 Ranking de productos más vendidos
                </p>

                <div className="flex flex-wrap gap-3">
                  {productSummary.slice(0, 3).map((product, index) => (
                    <div
                      key={product.id}
                      className="flex min-w-[180px] flex-1 items-center gap-3 rounded-xl border border-[#e8e4da] bg-white p-3"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5f3ee] text-lg">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#26332d]">
                          {product.name}
                        </p>

                        <p className="text-xs text-[#89877e]">
                          {product.quantity} unidades
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="border-b border-[#eeeae2] bg-white text-left text-xs uppercase tracking-wide text-[#89877e]">
                      <th className="px-5 py-4 font-semibold">
                        Producto
                      </th>

                      <th className="px-5 py-4 text-center font-semibold">
                        Unidades
                      </th>

                      <th className="px-5 py-4 text-right font-semibold">
                        Importe generado
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#eeeae2]">
                    {productSummary.map((product, index) => (
                      <tr
                        key={product.id}
                        className="transition hover:bg-[#fcfbf8]"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">
                              {product.emoji}
                            </span>

                            <div>
                              <p className="font-semibold text-[#26332d]">
                                {product.name}
                              </p>

                              {index === 0 && (
                                <p className="mt-1 text-xs font-semibold text-[#b17a35]">
                                  Producto más vendido
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex rounded-lg bg-[#f5f3ee] px-3 py-1.5 text-sm font-bold text-[#26332d]">
                            {product.quantity}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right font-bold text-[#26332d]">
                          {formatPrice(product.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  <tfoot>
                    <tr className="border-t-2 border-[#e8e4da] bg-[#faf9f6]">
                      <td className="px-5 py-4 font-extrabold text-[#26332d]">
                        TOTAL
                      </td>

                      <td className="px-5 py-4 text-center font-extrabold text-[#26332d]">
                        {totalUnits}
                      </td>

                      <td className="px-5 py-4 text-right font-extrabold text-[#26332d]">
                        {formatPrice(totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Listado de ventas */}
        <div className="no-print overflow-hidden rounded-2xl border border-[#e8e4da] bg-white">
          <div className="border-b border-[#eeeae2] p-5">
            <h3 className="text-lg font-bold">
              Operaciones registradas
            </h3>

            <p className="mt-1 text-sm text-[#89877e]">
              {filteredSales.length} ventas encontradas
              {cancelledCount > 0 &&
                ` · ${cancelledCount} ${
                  cancelledCount === 1 ? 'cancelada' : 'canceladas'
                }`}
            </p>
          </div>

          {filteredSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
              <span className="mb-4 text-5xl">📋</span>

              <p className="font-semibold text-[#26332d]">
                No hay ventas para este período
              </p>

              <p className="mt-2 text-sm text-[#89877e]">
                Cuando registres nuevas operaciones aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#eeeae2]">
              {[...filteredSales]
                .sort(
                  (a, b) =>
                    new Date(b.date).getTime() -
                    new Date(a.date).getTime()
                )
                .map((sale) => {
                  const units = getSaleItems(sale).reduce(
                    (sum, item) =>
                      sum + Number(item.quantity || 0),
                    0
                  )

                  const cancelled = isCancelled(sale)

                  return (
                    <button
                      key={sale.id}
                      type="button"
                      onClick={() => setSelectedSale(sale)}
                      className="flex w-full flex-wrap items-center justify-between gap-4 p-5 text-left transition hover:bg-[#fcfbf8]"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f5f3ee] text-xl ${
                          cancelled ? 'opacity-50' : ''
                        }`}>
                          {sale.paymentMethod === 'cash' ? '💵' : '💳'}
                        </div>

                        <div className="min-w-0">
                          <p className={`font-bold text-[#26332d] ${
                            cancelled ? 'text-[#89877e] line-through' : ''
                          }`}>
                            Venta #{String(sale.saleNumber).padStart(4, '0')}
                          </p>

                          <p className="mt-1 text-sm text-[#89877e]">
                            {formatDate(sale.date)} · {formatTime(sale.date)}
                          </p>

                          <p className="mt-1 text-xs text-[#a19b8e]">
                            {units} unidades · {sale.paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta'}
                          </p>

                          <SyncBadge sale={sale} />

                          <div>
                            <CancelBadge sale={sale} />
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <span className={`text-lg font-extrabold ${
                          cancelled
                            ? 'text-[#a19b8e] line-through'
                            : 'text-[#26332d]'
                        }`}>
                          {formatPrice(sale.total)}
                        </span>

                        <span className="text-xl text-[#aaa69c]">
                          →
                        </span>
                      </div>
                    </button>
                  )
                })}
            </div>
          )}
        </div>

        {/* Detalle de venta */}
        {selectedSale && (
          <div
            className="no-print fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
            onClick={closeDetail}
          >
            <div
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-extrabold text-[#26332d]">
                    Venta #{String(selectedSale.saleNumber).padStart(4, '0')}
                  </h3>

                  <p className="mt-1 text-sm text-[#89877e]">
                    {formatDate(selectedSale.date)} · {formatTime(selectedSale.date)}
                  </p>

                  <SyncBadge sale={selectedSale} />

                  <div>
                    <CancelBadge sale={selectedSale} />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeDetail}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-gray-500 hover:bg-gray-100"
                >
                  ×
                </button>
              </div>

              {isCancelled(selectedSale) && (
                <div className="mb-5 rounded-xl bg-gray-100 p-4 text-sm text-gray-700">
                  <p className="font-bold">
                    Esta venta está cancelada.
                  </p>

                  <p className="mt-1">
                    No suma en los totales ni en los informes.
                  </p>

                  {selectedSale.cancelledAt && (
                    <p className="mt-2 text-xs">
                      Cancelada el {formatDate(selectedSale.cancelledAt)} a las {formatTime(selectedSale.cancelledAt)}
                    </p>
                  )}
                </div>
              )}

              {getSyncState(selectedSale) === 'review' && (
                <div className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                  <p className="font-bold">
                    El servidor rechazó esta venta.
                  </p>

                  <p className="mt-1">
                    Sigue guardada en este dispositivo y no se ha perdido.
                    Ya no se reintenta automáticamente.
                  </p>

                  {selectedSale.lastSyncError && (
                    <p className="mt-2 text-xs">
                      Motivo: {selectedSale.lastSyncError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRetrySale(selectedSale)}
                    disabled={isRetrying || !isOnline}
                    className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isRetrying ? 'Reintentando...' : 'Reintentar envío'}
                  </button>
                </div>
              )}

              <div className="mb-5 space-y-3">
                {getSaleItems(selectedSale).map((item, index) => (
                  <div
                    key={`${item.id}-${index}`}
                    className="flex justify-between gap-3 border-b border-[#eeeae2] pb-3"
                  >
                    <div>
                      <p className="font-semibold text-[#26332d]">
                        {item.name}
                      </p>

                      <p className="mt-1 text-sm text-[#89877e]">
                        {item.quantity} × {formatPrice(item.price)}
                      </p>
                    </div>

                    <p className="font-bold text-[#26332d]">
                      {formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-xl bg-[#f5f3ee] p-4">
                <div className="flex justify-between">
                  <span className="text-sm text-[#89877e]">
                    Subtotal
                  </span>

                  <span className="font-semibold">
                    {formatPrice(getSaleSubtotal(selectedSale))}
                  </span>
                </div>

                {getSaleDiscount(selectedSale) > 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-sm text-[#89877e]">
                      Descuento jubilado (5 %)
                    </span>

                    <span className="font-semibold text-green-700">
                      -{formatPrice(getSaleDiscount(selectedSale))}
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-sm text-[#89877e]">
                    Método de pago
                  </span>

                  <span className="font-semibold">
                    {selectedSale.paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta'}
                  </span>
                </div>

                {selectedSale.paymentMethod === 'cash' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-[#89877e]">
                        Importe recibido
                      </span>

                      <span className="font-semibold">
                        {formatPrice(selectedSale.paymentDetails?.received)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-sm text-[#89877e]">
                        Cambio
                      </span>

                      <span className="font-semibold">
                        {formatPrice(selectedSale.paymentDetails?.change)}
                      </span>
                    </div>
                  </>
                )}

                <div className="flex justify-between border-t border-[#e8e4da] pt-3">
                  <span className="font-bold">
                    Total
                  </span>

                  <span className={`text-xl font-extrabold text-[#26332d] ${
                    isCancelled(selectedSale) ? 'line-through opacity-60' : ''
                  }`}>
                    {formatPrice(selectedSale.total)}
                  </span>
                </div>
              </div>

              {/* Modificar método de pago de una venta ya registrada */}
              {!isCancelled(selectedSale) && (
                <div className="mt-5">
                  {paymentSuccess && (
                    <p className="mb-3 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800">
                      {paymentSuccess}
                    </p>
                  )}

                  {paymentError && (
                    <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
                      {paymentError}
                    </p>
                  )}

                  {!showPaymentEditor ? (
                    <button
                      type="button"
                      onClick={handleOpenPaymentEditor}
                      disabled={!isOnline || getSyncState(selectedSale) !== 'synced'}
                      className="w-full rounded-xl border border-[#e8e4da] bg-white py-3 font-bold text-[#26332d] transition hover:bg-[#f5f3ee] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cambiar método de pago
                    </button>
                  ) : (
                    <div className="rounded-xl border border-[#e8e4da] bg-white p-4">
                      <p className="font-bold text-[#26332d]">
                        Modificar método de pago
                      </p>

                      <label className="mt-3 block text-sm font-semibold text-[#66685f]">
                        Nuevo método de pago
                      </label>

                      <select
                        value={newPaymentMethod}
                        onChange={(event) => {
                          setNewPaymentMethod(event.target.value)
                          setPaymentError('')
                        }}
                        disabled={isUpdatingPayment}
                        className="mt-2 w-full rounded-xl border border-[#e8e4da] bg-white px-3 py-3 outline-none focus:border-[#c18b45]"
                      >
                        <option value="cash">💵 Efectivo</option>
                        <option value="card">💳 Tarjeta</option>
                      </select>

                      {newPaymentMethod === 'cash' && (
                        <div className="mt-3">
                          <label className="block text-sm font-semibold text-[#66685f]">
                            Importe recibido (€)
                          </label>

                          <input
                            type="number"
                            min={Number(selectedSale.total || 0)}
                            step="0.01"
                            inputMode="decimal"
                            value={cashReceivedInput}
                            onChange={(event) => setCashReceivedInput(event.target.value)}
                            disabled={isUpdatingPayment}
                            className="mt-2 w-full rounded-xl border border-[#e8e4da] px-3 py-3 outline-none focus:border-[#c18b45]"
                            placeholder="Ej. 10,00"
                          />

                          <p className="mt-2 text-xs text-[#89877e]">
                            Total de la venta: {formatPrice(selectedSale.total)}. El cambio se calculará automáticamente.
                          </p>
                        </div>
                      )}

                      {newPaymentMethod === 'card' && (
                        <p className="mt-3 text-xs text-[#89877e]">
                          Se eliminarán los datos de efectivo (importe recibido y cambio).
                        </p>
                      )}

                      {paymentError && (
                        <p className="mt-3 text-sm font-semibold text-red-700">
                          {paymentError}
                        </p>
                      )}

                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowPaymentEditor(false)
                            setPaymentError('')
                          }}
                          disabled={isUpdatingPayment}
                          className="flex-1 rounded-xl border border-[#e8e4da] px-3 py-3 text-sm font-bold text-[#66685f] disabled:opacity-50"
                        >
                          Volver
                        </button>

                        <button
                          type="button"
                          onClick={handleSavePaymentMethod}
                          disabled={isUpdatingPayment || newPaymentMethod === selectedSale.paymentMethod}
                          className="flex-1 rounded-xl bg-[#26332d] px-3 py-3 text-sm font-bold text-white transition hover:bg-[#3c4c42] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isUpdatingPayment ? 'Guardando...' : 'Guardar cambio'}
                        </button>
                      </div>
                    </div>
                  )}

                  {!isOnline && (
                    <p className="mt-2 text-xs text-[#89877e]">
                      Conectate a internet para modificar el método de pago.
                    </p>
                  )}

                  {isOnline && getSyncState(selectedSale) !== 'synced' && (
                    <p className="mt-2 text-xs text-[#89877e]">
                      Esta venta debe estar sincronizada antes de poder modificar su pago.
                    </p>
                  )}
                </div>
              )}

              {/* Imprimir ticket */}
              <button
                type="button"
                onClick={handlePrintTicket}
                className="mt-5 w-full rounded-xl border-2 border-[#c18b45] py-3 font-bold text-[#a97735] transition hover:bg-[#faf5ec]"
              >
                🖨️ IMPRIMIR TICKET
              </button>

              {/* Cancelar venta */}
              {!isCancelled(selectedSale) && (
                <div className="mt-5">
                  {!confirmCancel ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCancelError('')
                        setConfirmCancel(true)
                      }}
                      className="w-full rounded-xl border border-red-200 bg-white py-3 font-bold text-red-700 transition hover:bg-red-50"
                    >
                      Cancelar venta
                    </button>
                  ) : (
                    <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
                      <p className="font-bold">
                        ¿Seguro que querés cancelar esta venta?
                      </p>

                      <p className="mt-1">
                        Dejará de sumar en los totales. No se puede deshacer.
                      </p>

                      {cancelError && (
                        <p className="mt-2 font-semibold">
                          {cancelError}
                        </p>
                      )}

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmCancel(false)
                            setCancelError('')
                          }}
                          disabled={isCancelling}
                          className="flex-1 rounded-lg border border-red-200 bg-white px-4 py-2 font-bold text-red-800 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          No, volver
                        </button>

                        <button
                          type="button"
                          onClick={handleCancelSale}
                          disabled={isCancelling}
                          className="flex-1 rounded-lg bg-red-700 px-4 py-2 font-bold text-white transition hover:bg-red-800 disabled:opacity-50"
                        >
                          {isCancelling ? 'Cancelando...' : 'Sí, cancelar venta'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={closeDetail}
                className="mt-5 w-full rounded-xl bg-[#26332d] py-3 font-bold text-white transition hover:bg-[#3c4c42]"
              >
                Cerrar detalle
              </button>
            </div>
          </div>
        )}

        {/* Plantilla de impresión del historial */}
        {selectedSale && (
          <HistorySaleTicket sale={selectedSale} />
        )}
      </main>
    </>
  )
}

export default Sales