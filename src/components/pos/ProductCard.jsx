
function ProductCard({ product, onAdd }) {
  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      className="group flex min-h-44 flex-col justify-between rounded-2xl border border-[#e9e5dc] bg-white p-4 text-left shadow-sm transition hover:-translate-y-1 hover:border-[#d5ad70] hover:shadow-md"
    >
      <div className="flex h-20 w-full items-center justify-center rounded-xl bg-[#f7f5ef] text-5xl transition group-hover:bg-[#f1eadb]">
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
