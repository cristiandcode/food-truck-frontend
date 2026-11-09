
import ProductCard from './ProductCard'

function ProductGrid({ products, onAdd, cart }) {
  if (products.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No hay productos en esta categoría.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => {
        const isSelected = cart.some(
          (item) => item.id === product.id
        )

        return (
          <ProductCard
            key={product.id}
            product={product}
            onAdd={onAdd}
            isSelected={isSelected}
          />
        )
      })}
    </div>
  )
}

export default ProductGrid
