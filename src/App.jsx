
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

function normalizeProduct(product) {
  return {
    ...product,
    clientProductId:
      product.clientProductId || `lubinin-${product.id}`,
    active: product.active ?? true,
    pendingSync: product.pendingSync ?? false,
  }
}

function getSavedProducts() {
  try {
    const savedProducts = localStorage.getItem(
      PRODUCTS_STORAGE_KEY
    )

    if (!savedProducts) {
      return initialProducts.map(normalizeProduct)
    }

    const parsedProducts = JSON.parse(savedProducts)

    if (!Array.isArray(parsedProducts)) {
      return initialProducts.map(normalizeProduct)
    }

    return parsedProducts.map(normalizeProduct)
  } catch (error) {
    console.error(
      'Error al recuperar los productos:',
      error
    )

    return initialProducts.map(normalizeProduct)
  }
}

function hasProductChanges(previousProduct, product) {
  return (
    previousProduct.name !== product.name ||
    Number(previousProduct.price) !== Number(product.price) ||
    previousProduct.category !== product.category ||
    previousProduct.emoji !== product.emoji ||
    (previousProduct.active ?? true) !== product.active
  )
}

function App() {
  const [activePage, setActivePage] = useState('pos')
  const [products, setProducts] = useState(getSavedProducts)

  const isSyncingSales = useRef(false)
  const isSyncingProducts = useRef(false)
  const productsLoadPromise = useRef(null)

  // Guardar catálogo localmente
  useEffect(() => {
    try {
      localStorage.setItem(
        PRODUCTS_STORAGE_KEY,
        JSON.stringify(products)
      )
    } catch (error) {
      console.error(
        'Error al guardar los productos:',
        error
      )
    }
  }, [products])

  // Sincronizar productos pendientes con MongoDB
  const syncPendingProducts = async (productsToSync) => {
    if (!navigator.onLine || isSyncingProducts.current) {
      return
    }

    const pendingProducts = productsToSync.filter(
      (product) => product.pendingSync
    )

    if (pendingProducts.length === 0) {
      return
    }

    isSyncingProducts.current = true

    try {
      console.log(
        `Sincronizando ${pendingProducts.length} productos pendientes...`
      )

      const remoteProducts = await getRemoteProducts()

      for (const product of pendingProducts) {
        const remoteProduct = remoteProducts.find(
          (item) =>
            (item.clientProductId ||
              `lubinin-${item.id}`) === product.clientProductId
        )

        if (!remoteProduct) {
          await createRemoteProduct(product)
        } else {
          await updateRemoteProduct(product)

          if (
            (remoteProduct.active ?? true) !== product.active
          ) {
            await setRemoteProductActive(
              product.clientProductId,
              product.active
            )
          }
        }

        console.log(
          `Producto sincronizado: ${product.name}`
        )

        // Marcar como sincronizado solo si no cambió mientras
        // se estaba realizando la petición
        setProducts((currentProducts) =>
          currentProducts.map((currentProduct) => {
            if (
              currentProduct.clientProductId !==
              product.clientProductId
            ) {
              return currentProduct
            }

            if (hasProductChanges(product, currentProduct)) {
              return currentProduct
            }

            return {
              ...currentProduct,
              pendingSync: false,
            }
          })
        )
      }

      console.log('Sincronización de productos finalizada.')
    } catch (error) {
      console.error(
        'Error al sincronizar productos pendientes:',
        error
      )
    } finally {
      isSyncingProducts.current = false
    }
  }

  // Cargar productos desde MongoDB o migrar catálogo local
  useEffect(() => {
    const loadProducts = async () => {
      if (!navigator.onLine) {
        console.log(
          'Sin conexión. Se utilizará el catálogo local.'
        )
        return
      }

      try {
        console.log('Consultando productos en MongoDB...')

        const remoteProducts = await getRemoteProducts()

        console.log(
          `Respuesta de MongoDB: ${remoteProducts.length} productos encontrados.`
        )

        if (remoteProducts.length > 0) {
          const normalizedRemoteProducts =
            remoteProducts.map(normalizeProduct)

          const localProducts = getSavedProducts()

          // Conservar los cambios locales que todavía no
          // se hayan enviado a MongoDB
          const pendingLocalProducts = localProducts.filter(
            (product) => product.pendingSync
          )

          const mergedProducts = [
            ...normalizedRemoteProducts.filter(
              (remoteProduct) =>
                !pendingLocalProducts.some(
                  (localProduct) =>
                    localProduct.clientProductId ===
                    remoteProduct.clientProductId
                )
            ),
            ...pendingLocalProducts,
          ]

          setProducts(mergedProducts)

          console.log(
            `Productos cargados desde MongoDB: ${normalizedRemoteProducts.length}`
          )

          await syncPendingProducts(mergedProducts)

          return
        }

        // Si MongoDB está vacío, recuperar catálogo local
        const localProducts = getSavedProducts()

        console.log(
          `MongoDB vacío. Se migrarán ${localProducts.length} productos.`
        )

        for (const product of localProducts) {
          console.log(`Enviando producto: ${product.name}`)

          const savedProduct = await createRemoteProduct(product)

          console.log(
            `Producto guardado: ${savedProduct?.name || product.name}`
          )
        }

        setProducts(localProducts)

        console.log(
          `Migración finalizada: ${localProducts.length} productos.`
        )
      } catch (error) {
        console.error(
          'ERROR AL CARGAR O MIGRAR PRODUCTOS:',
          error
        )
      }
    }

    if (!productsLoadPromise.current) {
      productsLoadPromise.current = loadProducts()
    }
  }, [])

  // Guardar cambios del catálogo y sincronizarlos
  const handleProductsChange = (updatedProducts) => {
    const previousProducts = products

    const normalizedProducts = updatedProducts.map(
      (product) => {
        const normalizedProduct = normalizeProduct(product)

        const previousProduct = previousProducts.find(
          (item) => item.id === normalizedProduct.id
        )

        const hasChanges = previousProduct
          ? hasProductChanges(
              previousProduct,
              normalizedProduct
            )
          : true

        return {
          ...normalizedProduct,
          pendingSync:
            normalizedProduct.pendingSync || hasChanges,
        }
      }
    )

    setProducts(normalizedProducts)

    if (!navigator.onLine) {
      console.log(
        'Sin conexión. Cambios guardados localmente y pendientes de sincronización.'
      )
      return
    }

    syncPendingProducts(normalizedProducts)
  }

  // Sincronizar ventas y productos al iniciar y recuperar Internet
  useEffect(() => {
    let mounted = true

    const handleSync = async () => {
      if (!navigator.onLine || !mounted) {
        return
      }

      // Sincronizar ventas pendientes
      if (!isSyncingSales.current) {
        isSyncingSales.current = true

        try {
          const result = await syncPendingSales()

          if (mounted) {
            console.log(
              'Sincronización automática de ventas:',
              result
            )
          }
        } catch (error) {
          console.error(
            'Error al sincronizar ventas:',
            error
          )
        } finally {
          isSyncingSales.current = false
        }
      }

      // Sincronizar productos pendientes
      if (mounted) {
        const localProducts = getSavedProducts()
        await syncPendingProducts(localProducts)
      }
    }

    const handleOnline = () => {
      console.log(
        'Conexión recuperada. Iniciando sincronización...'
      )

      handleSync()
    }

 handleSync()

    window.addEventListener('online', handleOnline)

    // Reintento periódico mientras haya pendientes
    const retryInterval = setInterval(handleSync, 60000)

    return () => {
      mounted = false
      clearInterval(retryInterval)
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
