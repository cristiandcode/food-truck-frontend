
import { useEffect, useRef, useState } from 'react'

import './index.css'

import Topbar from './components/layout/Topbar'
import POS from './pages/POS'
import Sales from './pages/Sales'
import Products from './pages/Products'

import { products as initialProducts } from './data/products'
import { syncPendingSales } from './services/syncService'

const PRODUCTS_STORAGE_KEY = 'lubinin_products'

function getSavedProducts() {
  try {
    const savedProducts = localStorage.getItem(PRODUCTS_STORAGE_KEY)

    if (!savedProducts) {
      return initialProducts.map((product) => ({
        ...product,
        active: product.active ?? true,
      }))
    }

    const parsedProducts = JSON.parse(savedProducts)

    if (!Array.isArray(parsedProducts)) {
      return initialProducts.map((product) => ({
        ...product,
        active: product.active ?? true,
      }))
    }

    return parsedProducts.map((product) => ({
      ...product,
      active: product.active ?? true,
    }))
  } catch (error) {
    console.error('Error al recuperar los productos:', error)

    return initialProducts.map((product) => ({
      ...product,
      active: product.active ?? true,
    }))
  }
}

function App() {
  const [activePage, setActivePage] = useState('pos')
  const [products, setProducts] = useState(getSavedProducts)

  const isSyncing = useRef(false)

  // Guardar el catálogo cada vez que se modifica
  useEffect(() => {
    try {
      localStorage.setItem(
        PRODUCTS_STORAGE_KEY,
        JSON.stringify(products)
      )
    } catch (error) {
      console.error('Error al guardar los productos:', error)
    }
  }, [products])

  // Sincronizar ventas pendientes al iniciar y recuperar internet
  useEffect(() => {
    let mounted = true

    const handleSync = async () => {
      if (!navigator.onLine || isSyncing.current || !mounted) {
        return
      }

      isSyncing.current = true

      try {
        const result = await syncPendingSales()

        if (mounted) {
          console.log('Sincronización automática:', result)
        }
      } catch (error) {
        console.error('Error en la sincronización automática:', error)
      } finally {
        isSyncing.current = false
      }
    }

    const handleOnline = () => {
      console.log('Conexión recuperada. Iniciando sincronización...')
      handleSync()
    }

    // Intentar sincronizar al iniciar la aplicación
    handleSync()

    // Escuchar cuando vuelve la conexión
    window.addEventListener('online', handleOnline)

    return () => {
      mounted = false
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#f5f3ee] text-[#26332d]">

      <Topbar
        activePage={activePage}
        onNavigate={setActivePage}
      />

      {activePage === 'pos' && (
        <POS products={products} />
      )}

      {activePage === 'sales' && (
        <Sales />
      )}

      {activePage === 'products' && (
        <Products
          products={products}
          onProductsChange={setProducts}
        />
      )}

    </div>
  )
}

export default App
