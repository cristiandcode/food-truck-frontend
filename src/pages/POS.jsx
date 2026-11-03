
import { useState } from 'react'

import Topbar from '../components/layout/Topbar'
import CategoryTabs from '../components/pos/CategoryTabs'
import ProductGrid from '../components/pos/ProductGrid'
import OrderPanel from '../components/pos/OrderPanel'
import CheckoutModal from '../components/pos/CheckoutModal'

import { categories } from '../data/categories'
import { products } from '../data/products'
import { useCart } from '../hooks/useCart'

function POS() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [showCheckout, setShowCheckout] = useState(false)

  const {
    cart,
    addToCart,
    updateQuantity,
    clearCart,
    totalItems,
    total,
  } = useCart()

  const filteredProducts = products.filter(
    (product) =>
      activeCategory === 'all' ||
      product.category === activeCategory
  )

  // Abrir pantalla de cobro
  const handleCheckout = () => {
    if (cart.length === 0) return

    setShowCheckout(true)
  }

  // Confirmar pago
  const handleConfirmPayment = (paymentMethod, paymentDetails) => {
    const sale = {
      id: Date.now(),
      date: new Date().toISOString(),
      items: cart.map((item) => ({ ...item })),
      total,
      paymentMethod,
      paymentDetails,
    }

    console.log('Venta registrada:', sale)

    alert(
      `¡Venta realizada correctamente!\nTotal: ${total.toFixed(2)} €\nMétodo: ${
        paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta'
      }`
    )

    clearCart()
    setShowCheckout(false)
  }

  return (
    <div className="min-h-screen bg-[#f5f3ee] text-[#26332d]">
      <Topbar />

      <main className="grid min-h-[calc(100vh-80px)] grid-cols-1 lg:grid-cols-[1fr_390px]">
        <section className="p-5 lg:p-8">
          <div className="mb-7">
            <h2 className="text-2xl font-bold">
              Punto de venta
            </h2>

            <p className="mt-1 text-sm text-[#89877e]">
              Seleccioná los productos para agregar al pedido.
            </p>
          </div>

          <CategoryTabs
            categories={categories}
            activeCategory={activeCategory}
            onChange={setActiveCategory}
          />

          <ProductGrid
            products={filteredProducts}
            onAdd={addToCart}
          />
        </section>

        <OrderPanel
          cart={cart}
          total={total}
          totalItems={totalItems}
          onUpdateQuantity={updateQuantity}
          onClear={clearCart}
          onCheckout={handleCheckout}
        />
      </main>

      {/* Ventana de cobro */}
      {showCheckout && (
        <CheckoutModal
          total={total}
          onClose={() => setShowCheckout(false)}
          onConfirm={handleConfirmPayment}
        />
      )}
    </div>
  )
}

export default POS
