
import { useEffect, useRef, useState } from 'react'

import './index.css'

import Topbar from './components/layout/Topbar'
import POS from './pages/POS'
import Sales from './pages/Sales'
import Products from './pages/Products'

import { products as initialProducts } from './data/products'
import { syncPendingSales } from './services/syncService'

import {
  getRemoteProducts,
  createRemoteProduct,
  updateRemoteProduct,
  setRemoteProductActive,
} from './services/productsService'

const PRODUCTS_STORAGE_KEY = 'lubinin_products'

function getSavedProducts() {
  try {
    const savedProducts = localStorage.getItem(PRODUCTS_STORAGE_KEY)

    if (!savedProducts) {
      return initialProducts.map((product) => ({
        ...product,
        clientProductId: `lubinin-${product.id}`,
        active: product.active ?? true,
      }))
    }

    const parsedProducts = JSON.parse(savedProducts)

    if (!Array.isArray(parsedProducts)) {
      return initialProducts.map((product) => ({
        ...product,
        clientProductId: `lubinin-${product.id}`,
        active: product.active ?? true,
      }))
    }

    return parsedProducts.map((product) => ({
      ...product,
      clientProductId:
        product.clientProductId || `lubinin-${product.id}`,
      active: product.active ?? true,
    }))
  } catch (error) {
    console.error('Error al recuperar los productos:', error)

    return initialProducts.map((product) => ({
      ...product,
      clientProductId: `lubinin-${product.id}`,
      active: product.active ?? true,
    }))
  }
}

function App() {
  const [activePage, setActivePage] = useState('pos')
  const [products, setProducts] = useState(getSavedProducts)

  const isSyncing = useRef(false)
  const productsLoadPromise = useRef(null)

  // Guardar catálogo localmente
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

  // Cargar productos desde MongoDB o migrar catálogo local
  useEffect(() => {
    let mounted = true

    const loadProducts = async () => {
      if (!navigator.onLine) {
        console.log('Sin conexión. Se utilizará el catálogo local.')
        return
      }

      try {
        console.log('Consultando productos en MongoDB...')

        const remoteProducts = await getRemoteProducts()

        if (!mounted) return

        // MongoDB ya tiene productos
        if (remoteProducts.length > 0) {
          const normalizedProducts = remoteProducts.map((product) => ({
            ...product,
            clientProductId:
              product.clientProductId || `lubinin-${product.id}`,
            active: product.active ?? true,
          }))

          setProducts(normalizedProducts)

          console.log(
            `Productos cargados desde MongoDB: ${normalizedProducts.length}`
          )

          return
        }

        // MongoDB está vacío: recuperar catálogo local
        const localProducts = getSavedProducts()

        console.log(
          `MongoDB vacío. Se migrarán ${localProducts.length} productos.`
        )

        // Crear productos uno por uno
        for (const product of localProducts) {
          if (!mounted) return

          console.log(`Enviando producto: ${product.name}`)

          const savedProduct = await createRemoteProduct({
            ...product,
            clientProductId:
              product.clientProductId || `lubinin-${product.id}`,
          })

          console.log(
            `Producto guardado correctamente: ${savedProduct?.name || product.name}`
          )
        }

        if (!mounted) return

        setProducts(localProducts)

        console.log(
          `Migración finalizada: ${localProducts.length} productos.`
        )
      } catch (error) {
        console.error('ERROR AL MIGRAR PRODUCTOS:', error)
      }
    }

    // Evitar ejecuciones simultáneas de la migración
    if (!productsLoadPromise.current) {
      productsLoadPromise.current = loadProducts()
    }

    productsLoadPromise.current

    return () => {
      mounted = false
    }
  }, [])

  // Sincronizar cambios del catálogo con MongoDB
  const handleProductsChange = async (updatedProducts) => {
    const previousProducts = products

    const normalizedProducts = updatedProducts.map((product) => ({
      ...product,
      clientProductId:
        product.clientProductId || `lubinin-${product.id}`,
      active: product.active ?? true,
    }))

    // Actualizar interfaz y respaldo local
    setProducts(normalizedProducts)

    if (!navigator.onLine) {
      console.log('Sin conexión. Cambios guardados localmente.')
      return
    }

    try {
      for (const product of normalizedProducts) {
        const previousProduct = previousProducts.find(
          (item) => item.id === product.id
        )

        // Producto nuevo
        if (!previousProduct) {
          await createRemoteProduct(product)
          continue
        }

        const previousClientId =
          previousProduct.clientProductId ||
          `lubinin-${previousProduct.id}`

        // Detectar cambios en los datos
        const hasDataChanges =
          previousProduct.name !== product.name ||
          Number(previousProduct.price) !== Number(product.price) ||
          previousProduct.category !== product.category ||
          previousProduct.emoji !== product.emoji

        if (hasDataChanges) {
          await updateRemoteProduct(product)
        }

        // Detectar cambios de estado
        if (
          (previousProduct.active ?? true) !== product.active
        ) {
          await setRemoteProductActive(
            product.clientProductId || previousClientId,
            product.active
          )
        }
      }

      console.log('Catálogo sincronizado con MongoDB.')
    } catch (error) {
      console.error(
        'Error al sincronizar cambios de productos:',
        error
      )
    }
  }

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
        console.error(
          'Error en la sincronización automática:',
          error
        )
      } finally {
        isSyncing.current = false
      }
    }

    const handleOnline = () => {
      console.log('Conexión recuperada. Iniciando sincronización...')
      handleSync()
    }

    handleSync()

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
          onProductsChange={handleProductsChange}
        />
      )}
    </div>
  )
}

export default App
