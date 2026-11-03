
import { useState } from 'react'

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

function Sales() {
  const [sales, setSales] = useState(getSavedSales)
  const [selectedDate, setSelectedDate] = useState(
    getLocalDate(new Date())
  )
  const [selectedSale, setSelectedSale] = useState(null)

  const refreshSales = () => {
    setSales(getSavedSales())
  }

  const filteredSales = sales.filter((sale) => {
    if (!selectedDate) return true

    return getLocalDate(sale.date) === selectedDate
  })

  const totalAmount = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  )

  const totalUnits = filteredSales.reduce(
    (sum, sale) =>
      sum +
      sale.items.reduce(
        (itemSum, item) => itemSum + Number(item.quantity || 0),
        0
      ),
    0
  )

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

  return (
    <main className="mx-auto max-w-7xl p-5 lg:p-8">

      {/* Encabezado */}
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">
            Historial de ventas
          </h2>

          <p className="mt-1 text-sm text-[#89877e]">
            Consultá las operaciones realizadas en Lubinin.
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

      {/* Filtro de fecha */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-[#e8e4da] bg-white p-5">

        <div>
          <label className="mb-2 block text-sm font-semibold">
            Filtrar por fecha
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
          onClick={() => setSelectedDate('')}
          className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
            selectedDate === ''
              ? 'bg-[#26332d] text-white'
              : 'bg-[#f5f3ee] text-[#66685f] hover:bg-[#eeece5]'
          }`}
        >
          Todas las fechas
        </button>

        <button
          type="button"
          onClick={() => setSelectedDate(getLocalDate(new Date()))}
          className="rounded-xl bg-[#f5f3ee] px-4 py-3 text-sm font-semibold text-[#66685f] transition hover:bg-[#eeece5]"
        >
          Hoy
        </button>

      </div>

      {/* Resumen */}
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
            {formatPrice(
              filteredSales.length > 0
                ? totalAmount / filteredSales.length
                : 0
            )}
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
              No hay ventas para esta fecha
            </p>

            <p className="mt-2 text-sm text-[#89877e]">
              Cuando registres nuevas operaciones aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#eeeae2]">

            {filteredSales.map((sale) => {
              const units = sale.items.reduce(
                (sum, item) => sum + Number(item.quantity || 0),
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">

          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">

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
              {selectedSale.items.map((item) => (
                <div
                  key={item.id}
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
                    {formatPrice(item.price * item.quantity)}
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
