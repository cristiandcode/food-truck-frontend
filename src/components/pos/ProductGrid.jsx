import ProductCard from './ProductCard'

function ProductGrid({ products, onAdd }) {
  if (products.length === 0) {
    return <p className="text-sm text-gray-500">No hay productos en esta categoría.</p>
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAdd={onAdd}
        />
      ))}
    </div>
  )
}

export default ProductGrid