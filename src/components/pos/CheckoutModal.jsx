
import { useState } from 'react'

function formatPrice(price) {
  return price.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
  })
}

function CheckoutModal({ total, onClose, onConfirm }) {
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [cashReceived, setCashReceived] = useState('')

  const received = Number(cashReceived.replace(',', '.'))
  const change = received - total

  const canConfirm =
    paymentMethod === 'card' ||
    (cashReceived !== '' &&
      Number.isFinite(received) &&
      change >= 0)

  const handleConfirm = () => {
    if (!canConfirm) return

    onConfirm(paymentMethod, {
      received: paymentMethod === 'cash' ? received : total,
      change: paymentMethod === 'cash' ? change : 0,
    })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">

      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">

        {/* Encabezado */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#26332d]">
              Finalizar venta
            </h2>

            <p className="mt-1 text-sm text-[#99958b]">
              Seleccioná el método de pago.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-gray-500 hover:bg-gray-100"
          >
            ×
          </button>
        </div>

        {/* Total */}
        <div className="mb-6 rounded-xl bg-[#f5f3ee] p-5 text-center">
          <p className="text-sm font-medium text-[#89877e]">
            Total a cobrar
          </p>

          <p className="mt-2 text-4xl font-extrabold text-[#26332d]">
            {formatPrice(total)}
          </p>
        </div>

        {/* Métodos de pago */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPaymentMethod('cash')}
            className={`rounded-xl border-2 p-5 transition ${
              paymentMethod === 'cash'
                ? 'border-[#c18b45] bg-[#faf5ec]'
                : 'border-[#e8e4da] hover:bg-gray-50'
            }`}
          >
            <span className="mb-2 block text-3xl">💵</span>
            <span className="font-bold">Efectivo</span>
          </button>

          <button
            type="button"
            onClick={() => setPaymentMethod('card')}
            className={`rounded-xl border-2 p-5 transition ${
              paymentMethod === 'card'
                ? 'border-[#c18b45] bg-[#faf5ec]'
                : 'border-[#e8e4da] hover:bg-gray-50'
            }`}
          >
            <span className="mb-2 block text-3xl">💳</span>
            <span className="font-bold">Tarjeta</span>
          </button>
        </div>

        {/* Efectivo */}
        {paymentMethod === 'cash' && (
          <div className="mb-6">
            <label className="mb-2 block text-sm font-semibold">
              Importe recibido (€)
            </label>

            <input
              type="text"
              inputMode="decimal"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              placeholder="Ej. 20,00"
              className="w-full rounded-xl border border-[#e8e4da] px-4 py-4 text-xl font-bold outline-none focus:border-[#c18b45]"
            />

            <div className="mt-3 flex justify-between rounded-xl bg-[#f5f3ee] p-4">
              <span className="font-semibold text-[#77786f]">
                Cambio
              </span>

              <span className={`text-xl font-extrabold ${
                cashReceived !== '' && change < 0
                  ? 'text-red-600'
                  : 'text-[#26332d]'
              }`}>
                {formatPrice(
                  cashReceived === '' ? 0 : Math.max(0, change)
                )}
              </span>
            </div>

            {cashReceived !== '' && change < 0 && (
              <p className="mt-2 text-sm text-red-600">
                El importe recibido es insuficiente.
              </p>
            )}
          </div>
        )}

        {/* Tarjeta */}
        {paymentMethod === 'card' && (
          <div className="mb-6 rounded-xl bg-[#f5f3ee] p-4 text-center">
            <p className="text-2xl">💳</p>

            <p className="mt-2 font-semibold text-[#26332d]">
              Cobro con tarjeta
            </p>

            <p className="mt-1 text-sm text-[#89877e]">
              Realizá el cobro en el terminal y confirmalo aquí cuando el pago haya sido aceptado.
            </p>
          </div>
        )}

        {/* Confirmación */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="w-full rounded-xl bg-[#c18b45] py-4 font-bold text-white transition hover:bg-[#a97735] disabled:cursor-not-allowed disabled:bg-[#d8d3c9]"
        >
          CONFIRMAR COBRO · {formatPrice(total)}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-xl py-3 text-sm font-semibold text-[#77786f] hover:bg-gray-100"
        >
          Cancelar
        </button>

      </div>
    </div>
  )
}

export default CheckoutModal
