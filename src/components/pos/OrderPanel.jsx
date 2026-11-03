
function formatPrice(price) {
  return price.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
  })
}

function OrderPanel({
  cart,
  total,
  totalItems,
  onUpdateQuantity,
  onClear,
  onCheckout,
}) {
  return (
    <aside className="flex min-h-[500px] flex-col border-t border-[#e8e4da] bg-white lg:border-l lg:border-t-0">

      {/* Encabezado del pedido */}
      <div className="flex items-center justify-between border-b border-[#eeeae2] p-6">
        <div>
          <h2 className="text-xl font-bold">
            Pedido actual
          </h2>

          <p className="mt-1 text-sm text-[#99958b]">
            {totalItems} productos seleccionados
          </p>
        </div>

        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f3ee] text-lg">
          🛒
        </span>
      </div>

      {/* Productos del carrito */}
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {cart.length === 0 ? (
          <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#f5f3ee] text-4xl">
              🛍️
            </div>

            <p className="font-semibold text-[#555b54]">
              El pedido está vacío
            </p>

            <p className="mt-1 text-sm text-[#aaa69c]">
              Seleccioná un producto para comenzar.
            </p>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 border-b border-[#f0eee8] pb-4"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f5f3ee] text-2xl">
                  {item.emoji}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {item.name}
                  </p>

                  <p className="mt-1 text-sm text-[#a18a68]">
                    {formatPrice(item.price)}
                  </p>
                </div>
              </div>

              {/* Control de unidades */}
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(item.id, -1)}
                  aria-label={`Quitar una unidad de ${item.name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#e8e4da] text-lg font-bold transition hover:bg-[#f5f3ee] active:scale-95"
                >
                  −
                </button>

                <span className="w-6 text-center text-sm font-bold">
                  {item.quantity}
                </span>

                <button
                  type="button"
                  onClick={() => onUpdateQuantity(item.id, 1)}
                  aria-label={`Agregar una unidad de ${item.name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#26332d] text-lg font-bold text-white transition hover:bg-[#3c4c42] active:scale-95"
                >
                  +
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Resumen y cobro */}
      <div className="border-t border-[#eeeae2] bg-[#fcfbf8] p-6">
        <div className="mb-3 flex justify-between text-sm text-[#77786f]">
          <span>Unidades</span>
          <span>{totalItems}</span>
        </div>

        <div className="mb-5 flex items-center justify-between">
          <span className="text-base font-semibold">
            Total
          </span>

          <span className="text-3xl font-extrabold text-[#26332d]">
            {formatPrice(total)}
          </span>
        </div>

        <button
          type="button"
          onClick={onCheckout}
          disabled={cart.length === 0}
          className="w-full rounded-xl bg-[#c18b45] py-4 text-base font-bold text-white shadow-sm transition hover:bg-[#a97735] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#d8d3c9]"
        >
          COBRAR · {formatPrice(total)}
        </button>

        <button
          type="button"
          onClick={onClear}
          disabled={cart.length === 0}
          className="mt-3 w-full rounded-xl py-3 text-sm font-semibold text-[#a16c61] transition hover:bg-[#f8eeeb] active:scale-[0.99] disabled:cursor-not-allowed disabled:text-[#c9c5bd]"
        >
          Vaciar pedido
        </button>
      </div>
    </aside>
  )
}

export default OrderPanel
