
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

  const formattedSaleNumber = `#${String(sale.saleNumber).padStart(4, '0')}${
    sale.deviceId ? ` · ${sale.deviceId}` : ''
  }`

  const calculatedSubtotal = sale.items.reduce(
    (sum, item) =>
      sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  )

  const subtotal =
    sale.subtotal !== undefined && sale.subtotal !== null
      ? Number(sale.subtotal)
      : calculatedSubtotal

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
      {/* ESTILOS DE IMPRESIÓN */}
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

      {/* VENTANA DE CONFIRMACIÓN */}
      <div className="fixed inset-0 z-[150] flex items-center justify-center overflow-y-auto overscroll-contain bg-[#14251F]/75 p-3 backdrop-blur-sm sm:p-6">

        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sale-success-title"
          className="relative my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-[28px] border border-[#E9E1D2] bg-[#FFFEFA] shadow-[0_25px_80px_rgba(0,0,0,0.28)] sm:max-h-[calc(100dvh-3rem)]"
        >

          {/* FRANJA DECORATIVA */}
          <div className="h-2 w-full bg-gradient-to-r from-[#244C3D] via-[#C18B45] to-[#244C3D]" />

          {/* CIERRE SIEMPRE VISIBLE AL DESPLAZARSE */}
          <div className="sticky top-0 z-30 flex justify-end bg-[#FFFEFA]/95 px-4 pt-3 backdrop-blur-sm sm:px-6">
            <button
              type="button"
              onClick={onNewSale}
              aria-label="Cerrar ventana"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#F0D8D5] bg-[#FFF1EF] text-3xl font-semibold leading-none text-[#B94438] shadow-sm transition hover:bg-[#B94438] hover:text-white active:scale-90"
            >
              ×
            </button>
          </div>

          <div className="px-5 pb-6 pt-2 sm:px-7 sm:pb-8">

            {/* CONFIRMACIÓN */}
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-[76px] w-[76px] items-center justify-center rounded-full border-[6px] border-[#E4F0E7] bg-[#D8EADD] text-4xl font-bold text-[#286344] shadow-sm">
                ✓
              </div>

              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#A87938]">
                Operación completada
              </p>

              <h2
                id="sale-success-title"
                className="text-2xl font-extrabold tracking-tight text-[#233B30] sm:text-[28px]"
              >
                ¡Venta realizada!
              </h2>

              <p className="mt-2 text-sm text-[#88877E]">
                La venta se guardó correctamente.
              </p>
            </div>

            {/* NÚMERO DE VENTA */}
            <div className="mt-6 rounded-2xl border border-[#EAE3D6] bg-[#F7F4ED] p-4 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#918B7D]">
                Número de venta
              </p>

              <p className="mt-2 break-words text-lg font-extrabold text-[#344C3E] sm:text-xl">
                {formattedSaleNumber}
              </p>
            </div>

            {/* TOTAL COBRADO */}
            <div className="mt-4 overflow-hidden rounded-2xl bg-[#244638] shadow-lg shadow-[#244638]/15">
              <div className="px-5 py-5 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4E1D8]">
                  Total cobrado
                </p>

                <p className="mt-2 text-4xl font-black tracking-tight text-white sm:text-[42px]">
                  {formatPrice(sale.total)}
                </p>

                {hasDiscount && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#DDEBDD]">
                    <span>✓</span>
                    <span>
                      Descuento jubilado: -{formatPrice(discountAmount)}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 border-t border-white/15 bg-black/10">
                <div className="px-3 py-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#C3D2C7]">
                    Método de pago
                  </p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {paymentLabel}
                  </p>
                </div>

                {sale.paymentMethod === 'cash' && sale.paymentDetails ? (
                  <div className="border-l border-white/15 px-3 py-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#C3D2C7]">
                      Cambio
                    </p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {formatPrice(sale.paymentDetails.change)}
                    </p>
                  </div>
                ) : (
                  <div className="border-l border-white/15 px-3 py-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#C3D2C7]">
                      Estado
                    </p>
                    <p className="mt-1 text-sm font-bold text-white">
                      Completado
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* DETALLE DEL EFECTIVO */}
            {sale.paymentMethod === 'cash' && sale.paymentDetails && (
              <div className="mt-3 flex items-center justify-between rounded-xl border border-[#EAE3D6] bg-white px-4 py-3 text-sm">
                <span className="text-[#89877E]">
                  Importe recibido
                </span>
                <span className="font-bold text-[#344C3E]">
                  {formatPrice(sale.paymentDetails.received)}
                </span>
              </div>
            )}

            {/* PRODUCTOS VENDIDOS */}
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#304638]">
                  Productos vendidos
                </h3>

                <span className="rounded-full bg-[#F1EBDD] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#94733E]">
                  {sale.items.reduce(
                    (sum, item) => sum + Number(item.quantity || 0),
                    0
                  )} unidades
                </span>
              </div>

              <div className="space-y-2">
                {sale.items.map((item, index) => (
                  <div
                    key={`${item.id}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#EEE9DF] bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-bold text-[#344638]">
                        {item.name}
                      </p>

                      <p className="mt-1 text-xs text-[#969287]">
                        {item.quantity} × {formatPrice(item.price)}
                      </p>
                    </div>

                    <p className="shrink-0 text-sm font-extrabold text-[#344638]">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* BOTÓN IMPRIMIR */}
            <button
              type="button"
              onClick={handlePrint}
              className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-[#C18B45] bg-[#FFFDF8] px-4 py-4 text-sm font-extrabold tracking-wide text-[#A97735] transition hover:bg-[#F8F0E2] active:scale-[0.98]"
            >
              <span className="text-xl">🖨️</span>
              IMPRIMIR TICKET
            </button>

            {/* BOTÓN NUEVA VENTA */}
            <button
              type="button"
              onClick={onNewSale}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#244638] px-4 py-4 text-sm font-extrabold tracking-wide text-white shadow-lg shadow-[#244638]/15 transition hover:bg-[#315D49] active:scale-[0.98]"
            >
              <span>+</span>
              NUEVA VENTA
            </button>

            <p className="mt-5 text-center text-[10px] font-medium tracking-wide text-[#AAA496]">
              FOOD TRUCK LUBININ · GRACIAS POR TU COMPRA
            </p>

          </div>
        </div>
      </div>
    </>
  )
}

export default SaleSuccessModal
