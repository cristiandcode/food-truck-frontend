
function ProductCard({ product, onAdd, isSelected }) {
  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      className={`group relative flex min-h-44 flex-col justify-between rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md ${
        isSelected
          ? 'border-green-500 bg-green-50 shadow-green-100'
          : 'border-[#e9e5dc] bg-white hover:border-[#d5ad70]'
      }`}
    >
      {/* Indicador de producto seleccionado */}
      {isSelected && (
        <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-base font-bold text-white shadow-sm">
          ✓
        </span>
      )}

      <div
        className={`flex h-20 w-full items-center justify-center rounded-xl text-5xl transition ${
          isSelected
            ? 'bg-green-100'
            : 'bg-[#f7f5ef] group-hover:bg-[#f1eadb]'
        }`}
      >
        {product.emoji}
      </div>

      <div className="mt-4 w-full">
        <p className="text-sm font-semibold leading-snug">
          {product.name}
        </p>

        <p className="mt-2 text-lg font-extrabold text-[#b17b35]">
          {product.price.toLocaleString('es-ES', {
            style: 'currency',
            currency: 'EUR',
          })}
        </p>
      </div>
    </button>
  )
}

export default ProductCard
