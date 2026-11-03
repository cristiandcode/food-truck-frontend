
function formatPrice(price) {
  return price.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
  })
}

function SaleSuccessModal({ sale, onNewSale }) {
  const paymentLabel =
    sale.paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta'

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-2xl">

        {/* Icono de confirmación */}
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl text-green-700">
          ✓
        </div>

        <h2 className="text-2xl font-extrabold text-[#26332d]">
          ¡Venta realizada!
        </h2>

        <p className="mt-2 text-sm text-[#89877e]">
          La venta se guardó correctamente.
        </p>

        {/* Número de venta */}
        <div className="mt-6 rounded-xl bg-[#f5f3ee] p-5">
          <p className="text-sm font-medium text-[#89877e]">
            Número de venta
          </p>

          <p className="mt-1 text-2xl font-extrabold text-[#26332d]">
            #{String(sale.saleNumber).padStart(4, '0')}
          </p>

          <div className="my-4 border-t border-[#e8e4da]" />

          <p className="text-sm text-[#89877e]">
            Total cobrado
          </p>

          <p className="mt-2 text-4xl font-extrabold text-[#26332d]">
            {formatPrice(sale.total)}
          </p>

          <div className="mt-4 flex justify-between text-sm">
            <span className="text-[#89877e]">Método de pago</span>
            <span className="font-bold">{paymentLabel}</span>
          </div>

          {sale.paymentMethod === 'cash' && (
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

        {/* Productos vendidos */}
        <div className="mt-5 text-left">
          <p className="mb-3 text-sm font-bold text-[#26332d]">
            Productos vendidos
          </p>

          <div className="max-h-36 space-y-2 overflow-y-auto">
            {sale.items.map((item) => (
              <div
                key={item.id}
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

        {/* Nueva venta */}
        <button
          type="button"
          onClick={onNewSale}
          className="mt-7 w-full rounded-xl bg-[#c18b45] py-4 font-bold text-white transition hover:bg-[#a97735] active:scale-[0.99]"
        >
          NUEVA VENTA
        </button>

      </div>
    </div>
  )
}

export default SaleSuccessModal
