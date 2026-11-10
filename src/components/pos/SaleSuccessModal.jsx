
import { createPortal } from 'react-dom'

function formatPrice(price) {
  return Number(price || 0).toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
  })
}

function formatDate(date) {
  return new Date(date).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function SaleSuccessModal({ sale, onNewSale }) {
  const paymentLabel =
    sale.paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta'

  // Número de venta acompañado del identificador del dispositivo.
  // Compatibilidad con ventas antiguas que no tienen deviceId.
  const formattedSaleNumber = `#${String(sale.saleNumber).padStart(4, '0')}${
    sale.deviceId ? ` · ${sale.deviceId}` : ''
  }`

  // Subtotal antes de aplicar descuentos.
  // Compatibilidad con ventas antiguas que no tienen este campo.
  const calculatedSubtotal = sale.items.reduce(
    (sum, item) =>
      sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  )

  const subtotal =
    sale.subtotal !== undefined && sale.subtotal !== null
      ? Number(sale.subtotal)
      : calculatedSubtotal

  // Descuento total de la venta.
  // Si el campo no existe, se intenta recuperar desde los artículos.
  const calculatedDiscount = sale.items.reduce(
    (sum, item) => sum + Number(item.discountAmount || 0),
    0
  )

  const discountAmount =
    sale.discountAmount !== undefined && sale.discountAmount !== null
      ? Number(sale.discountAmount)
      : calculatedDiscount

  const hasDiscount = discountAmount > 0

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      {/* Estilos exclusivos de impresión */}
      {createPortal(
        <>
          <style>
            {`
              @media print {
                @page {
                  size: 80mm 200mm;
                  margin: 0;
                }

                html,
                body {
                  width: 80mm !important;
                  height: auto !important;
                  min-height: 0 !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  overflow: visible !important;
                }

                body > *:not(#lubinin-print-root) {
                  display: none !important;
                }

                #lubinin-print-root {
                  display: block !important;
                  position: static !important;
                  width: 80mm !important;
                  height: auto !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  overflow: visible !important;
                }

                #lubinin-ticket {
                  display: block !important;
                  position: static !important;
                  width: 72mm !important;
                  max-width: 72mm !important;
                  height: auto !important;
                  margin: 0 auto !important;
                  padding: 4mm !important;
                  color: #000 !important;
                  background: #fff !important;
                  font-family: monospace !important;
                  font-size: 12px !important;
                  line-height: 1.35 !important;
                  box-sizing: border-box !important;
                }

                #lubinin-ticket * {
                  color: #000 !important;
                  box-sizing: border-box !important;
                }
              }
            `}
          </style>

          <div
            id="lubinin-print-root"
            className="hidden"
          >
            <div
              id="lubinin-ticket"
              className="bg-white text-left text-black"
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
                  Venta: {formattedSaleNumber}
                </p>

                <p>
                  Fecha: {formatDate(sale.date)}
                </p>
              </div>

              <div className="my-3 border-t border-dashed border-black" />

              <p className="mb-2 font-bold">
                DETALLE
              </p>

              <div className="space-y-2">
                {sale.items.map((item, index) => (
                  <div key={`${item.id}-${index}`}>
                    <p className="font-bold">
                      {item.name}
                    </p>

                    <div className="flex justify-between gap-2">
                      <span>
                        {item.quantity} × {formatPrice(item.price)}
                      </span>

                      <span>
                        {formatPrice(item.price * item.quantity)}
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

              {sale.paymentMethod === 'cash' && sale.paymentDetails && (
                <>
                  <div className="mt-1 flex justify-between">
                    <span>Recibido</span>
                    <span>
                      {formatPrice(sale.paymentDetails.received)}
                    </span>
                  </div>

                  <div className="mt-1 flex justify-between">
                    <span>Cambio</span>
                    <span>
                      {formatPrice(sale.paymentDetails.change)}
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
          </div>
        </>,
        document.body
      )}

      {/* Ventana de confirmación de venta */}
      <div className="fixed inset-0 z-[150] flex items-center justify-center overflow-y-auto bg-black/60 p-4">
        <div className="relative w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-2xl">

          {/* Botón para cerrar la ventana */}
          <button
            type="button"
            onClick={onNewSale}
            aria-label="Cerrar ventana"
            className="no-print absolute right-4 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-4xl font-bold leading-none text-red-600 transition hover:bg-red-600 hover:text-white active:scale-95"
          >
            ×
          </button>

          {/* Confirmación */}
          <div className="no-print">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl text-green-700">
              ✓
            </div>

            <h2 className="text-2xl font-extrabold text-[#26332d]">
              ¡Venta realizada!
            </h2>

            <p className="mt-2 text-sm text-[#89877e]">
              La venta se guardó correctamente.
            </p>
          </div>

          {/* Resumen visible en pantalla */}
          <div className="no-print">
            <div className="mt-6 rounded-xl bg-[#f5f3ee] p-5">
              <p className="text-sm font-medium text-[#89877e]">
                Número de venta
              </p>

              <p className="mt-1 text-2xl font-extrabold text-[#26332d] break-words">
                {formattedSaleNumber}
              </p>

              <div className="my-4 border-t border-[#e8e4da]" />

              <p className="text-sm text-[#89877e]">
                Total cobrado
              </p>

              <p className="mt-2 text-4xl font-extrabold text-[#26332d]">
                {formatPrice(sale.total)}
              </p>

              {hasDiscount && (
                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-[#89877e]">
                    Descuento jubilado (5 %)
                  </span>
                  <span className="font-bold text-green-700">
                    -{formatPrice(discountAmount)}
                  </span>
                </div>
              )}

              <div className="mt-4 flex justify-between text-sm">
                <span className="text-[#89877e]">Método de pago</span>
                <span className="font-bold">{paymentLabel}</span>
              </div>

              {sale.paymentMethod === 'cash' && sale.paymentDetails && (
                <>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-[#89877e]">Recibido</span>
                    <span className="font-semibold">
                      {formatPrice(sale.paymentDetails.received)}
                    </span>
                  </div>

                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-[#89877e]">Cambio</span>
                    <span className="font-semibold">
                      {formatPrice(sale.paymentDetails.change)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="mt-5 text-left">
              <p className="mb-3 text-sm font-bold text-[#26332d]">
                Productos vendidos
              </p>

              <div className="max-h-36 space-y-2 overflow-y-auto">
                {sale.items.map((item, index) => (
                  <div
                    key={`${item.id}-${index}`}
                    className="flex justify-between gap-3 text-sm"
                  >
                    <span className="text-[#66685f]">
                      {item.quantity} × {item.name}
                    </span>

                    <span className="shrink-0 font-semibold">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Imprimir */}
            <button
              type="button"
              onClick={handlePrint}
              className="mt-7 w-full rounded-xl border-2 border-[#c18b45] py-4 font-bold text-[#a97735] transition hover:bg-[#faf5ec] active:scale-[0.99]"
            >
              🖨️ IMPRIMIR TICKET
            </button>

            {/* Nueva venta */}
            <button
              type="button"
              onClick={onNewSale}
              className="mt-3 w-full rounded-xl bg-[#c18b45] py-4 font-bold text-white transition hover:bg-[#a97735] active:scale-[0.99]"
            >
              NUEVA VENTA
            </button>
          </div>

        </div>
      </div>
    </>
  )
}

export default SaleSuccessModal
