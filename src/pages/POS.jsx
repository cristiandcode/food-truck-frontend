
import { useEffect, useRef, useState } from 'react'

import CategoryTabs from '../components/pos/CategoryTabs'
import ProductGrid from '../components/pos/ProductGrid'
import OrderPanel from '../components/pos/OrderPanel'
import CheckoutModal from '../components/pos/CheckoutModal'
import SaleSuccessModal from '../components/pos/SaleSuccessModal'

import { categories } from '../data/categories'
import { useCart } from '../hooks/useCart'
import {
  syncSale,
  syncPendingSales,
} from '../services/syncService'

const STORAGE_KEY = 'lubinin_sales'

// Recuperar las ventas guardadas
function getSavedSales() {
  try {
    const savedSales = localStorage.getItem(STORAGE_KEY)

    if (!savedSales) return []

    const parsedSales = JSON.parse(savedSales)

    return Array.isArray(parsedSales) ? parsedSales : []
  } catch (error) {
    console.error('Error al recuperar las ventas:', error)
    return []
  }
}

function POS({ products }) {
  const [activeCategory, setActiveCategory] = useState('all')
  const [showCheckout, setShowCheckout] = useState(false)
  const [completedSale, setCompletedSale] = useState(null)
  const [storageError, setStorageError] = useState('')

  const isProcessing = useRef(false)

  const {
    cart,
    addToCart,
    updateQuantity,
    clearCart,
    totalItems,
    total,
  } = useCart()

  // Intentar sincronizar ventas pendientes al abrir el TPV
  useEffect(() => {
    const handleSyncPending = async () => {
      const result = await syncPendingSales()

      console.log(
        'Resultado de sincronización de ventas pendientes:',
        result
      )
    }

    // Sincronización inicial
    handleSyncPending()

    // Sincronizar cuando vuelve la conexión
    const handleOnline = () => {
      console.log('Conexión recuperada. Sincronizando ventas pendientes...')

      handleSyncPending()
    }

    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  // Mostrar solamente productos activos
  const activeProducts = products.filter(
    (product) => product.active !== false
  )

  // Filtrar productos por categoría
  const filteredProducts = activeProducts.filter(
    (product) =>
      activeCategory === 'all' ||
      product.category === activeCategory
  )

  // Abrir pantalla de cobro
  const handleCheckout = () => {
    if (cart.length === 0) return

    setStorageError('')
    setShowCheckout(true)
  }

  // Confirmar y guardar la venta
  const handleConfirmPayment = (paymentMethod, paymentDetails) => {
    if (isProcessing.current || cart.length === 0) return

    isProcessing.current = true
    setStorageError('')

    try {
      // Recuperar las ventas actuales del almacenamiento
      const currentSales = getSavedSales()

      // Calcular el siguiente número de venta
      const nextSaleNumber =
        currentSales.reduce(
          (highest, sale) =>
            Math.max(highest, Number(sale.saleNumber) || 0),
          0
        ) + 1

      // Calcular el total en céntimos
      const totalCents = cart.reduce(
        (sum, item) =>
          sum + Math.round(item.price * 100) * item.quantity,
        0
      )

      // Crear el registro de venta
      const sale = {
        id: `${Date.now()}-${nextSaleNumber}`,
        saleNumber: nextSaleNumber,
        syncStatus: 'pending',
        date: new Date().toISOString(),

        // Guardar una copia de los productos y sus precios
        items: cart.map((item) => ({
          ...item,
          price: Number(item.price.toFixed(2)),
        })),

        total: totalCents / 100,
        paymentMethod,

        paymentDetails: {
          received: Number(paymentDetails.received.toFixed(2)),
          change: Number(paymentDetails.change.toFixed(2)),
        },
      }

      // Añadir la nueva venta al historial
      const updatedSales = [sale, ...currentSales]

      // Guardar en localStorage
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updatedSales)
      )

      // Verificar que se haya guardado correctamente
      const verification = localStorage.getItem(STORAGE_KEY)

      if (!verification) {
        throw new Error('No se pudo verificar el almacenamiento.')
      }

      const verifiedSales = JSON.parse(verification)

      if (
        !Array.isArray(verifiedSales) ||
        !verifiedSales.some((savedSale) => savedSale.id === sale.id)
      ) {
        throw new Error('La venta no aparece en el almacenamiento.')
      }

      // Actualizar la aplicación después de guardar correctamente
      setCompletedSale(sale)

      clearCart()
      setShowCheckout(false)

      console.log('Venta guardada correctamente:', sale)
      console.log('Total de ventas guardadas:', updatedSales.length)
      console.log('LocalStorage:', localStorage.getItem(STORAGE_KEY))

      // Intentar sincronizar después de guardar la venta localmente
      // Si falla, la venta permanece pendiente en el navegador
      syncSale(sale).then((result) => {
        console.log('Resultado de sincronización:', result)
      }).catch((error) => {
        console.error('Error inesperado al sincronizar:', error)
      })

    } catch (error) {
      console.error('Error al guardar la venta:', error)

      setStorageError(
        'No se pudo guardar la venta. El pedido sigue intacto. Revisá el almacenamiento del navegador e intentá nuevamente.'
      )

    } finally {
      isProcessing.current = false
    }
  }

  // Volver al TPV después de una venta
  const handleNewSale = () => {
    setCompletedSale(null)
    setStorageError('')
  }

  return (
    <div className="min-h-[calc(100vh-80px)]">

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

      {/* Confirmación de venta */}
      {completedSale && (
        <SaleSuccessModal
          sale={completedSale}
          onNewSale={handleNewSale}
        />
      )}

      {/* Error al guardar */}
      {storageError && (
        <div className="fixed bottom-5 left-1/2 z-[200] w-[calc(100%-32px)] max-w-lg -translate-x-1/2 rounded-xl bg-red-100 p-4 text-center text-sm font-semibold text-red-800 shadow-lg">
          {storageError}
        </div>
      )}

    </div>
  )
}

export default POS
