import { useMemo, useState } from 'react'

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

  const refreshSales = () => {
    setSales(getSavedSales())
  }

  // Filtrar ventas según el período seleccionado
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

  // Total facturado
  const totalAmount = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  )

  // Total de unidades vendidas
  const totalUnits = filteredSales.reduce(
    (sum, sale) =>
      sum +
      getSaleItems(sale).reduce(
        (itemSum, item) =>
          itemSum + Number(item.quantity || 0),
        0
      ),
    0
  )

  // Ticket medio
  const averageTicket =
    filteredSales.length > 0
      ? totalAmount / filteredSales.length
      : 0

  // Ventas por método de pago
  const cashSales = filteredSales.filter(
    (sale) => sale.paymentMethod === 'cash'
  )

  const cardSales = filteredSales.filter(
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

  // Agrupar productos vendidos
  const productSummary = useMemo(() => {
    const productsMap = {}

    filteredSales.forEach((sale) => {
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
  }, [filteredSales])

  // Exportar informe de productos a CSV
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

    // BOM para que Excel reconozca correctamente los caracteres
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

  // Texto descriptivo del período
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
    <main className="mx-auto max-w-7xl p-5 lg:p-8">

      {/* Encabezado */}
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">
            Historial de ventas
          </h2>

          <p className="mt-1 text-sm text-[#89877e]">
            Consultá las operaciones y los productos vendidos en Lubinin.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshSales}
          className="rounded-xl border border-[#e8e4da] bg-white px-4 py-3 text-sm font-semibold transition hover:bg-[#f5f3ee]"
        >
          ↻ Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-6 rounded-2xl border border-[#e8e4da] bg-white p-5">

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
      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

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
            {filteredSales.length}
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
      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2">

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
      <div className="mb-7 overflow-hidden rounded-2xl border border-[#e8e4da] bg-white">

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

            {/* Ranking */}
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

            {/* Tabla de productos */}
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
      <div className="overflow-hidden rounded-2xl border border-[#e8e4da] bg-white">

        <div className="border-b border-[#eeeae2] p-5">
          <h3 className="text-lg font-bold">
            Operaciones registradas
          </h3>

          <p className="mt-1 text-sm text-[#89877e]">
            {filteredSales.length} ventas encontradas
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

                return (
                  <button
                    key={sale.id}
                    type="button"
                    onClick={() => setSelectedSale(sale)}
                    className="flex w-full flex-wrap items-center justify-between gap-4 p-5 text-left transition hover:bg-[#fcfbf8]"
                  >

                    <div className="flex min-w-0 items-center gap-4">

                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f5f3ee] text-xl">
                        {sale.paymentMethod === 'cash' ? '💵' : '💳'}
                      </div>

                      <div className="min-w-0">

                        <p className="font-bold text-[#26332d]">
                          Venta #{String(sale.saleNumber).padStart(4, '0')}
                        </p>

                        <p className="mt-1 text-sm text-[#89877e]">
                          {formatDate(sale.date)} · {formatTime(sale.date)}
                        </p>

                        <p className="mt-1 text-xs text-[#a19b8e]">
                          {units} unidades · {sale.paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta'}
                        </p>

                      </div>

                    </div>

                    <div className="flex shrink-0 items-center gap-3">

                      <span className="text-lg font-extrabold text-[#26332d]">
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedSale(null)}
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
              </div>

              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-gray-500 hover:bg-gray-100"
              >
                ×
              </button>

            </div>

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

                <span className="text-xl font-extrabold text-[#26332d]">
                  {formatPrice(selectedSale.total)}
                </span>

              </div>

            </div>

            <button
              type="button"
              onClick={() => setSelectedSale(null)}
              className="mt-5 w-full rounded-xl bg-[#26332d] py-3 font-bold text-white transition hover:bg-[#3c4c42]"
            >
              Cerrar detalle
            </button>

          </div>

        </div>
      )}

    </main>
  )
}

export default Sales