
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

import {
  getAuthToken,
  loginWithPin,
  logout,
} from './services/authService'

const PRODUCTS_STORAGE_KEY = 'lubinin_products'

// Normalizar productos para mantener una estructura consistente
function normalizeProduct(product) {
  return {
    ...product,
    clientProductId:
      product.clientProductId || `lubinin-${product.id}`,
    active: product.active ?? true,
    pendingSync: product.pendingSync ?? false,
  }
}

// Recuperar catálogo local
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

// Comprobar si un producto sufrió modificaciones
function hasProductChanges(previousProduct, product) {
  return (
    previousProduct.name !== product.name ||
    Number(previousProduct.price) !== Number(product.price) ||
    previousProduct.category !== product.category ||
    previousProduct.emoji !== product.emoji ||
    (previousProduct.active ?? true) !== product.active ||
    (previousProduct.seniorDiscountEligible ?? false) !==
      (product.seniorDiscountEligible ?? false)
  )
}

function App() {
  const [activePage, setActivePage] = useState('pos')
  const [products, setProducts] = useState(getSavedProducts)

  // Comprobar si existe un token guardado
const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Estado de la pantalla de acceso
  const [pin, setPin] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const isSyncingSales = useRef(false)
  const isSyncingProducts = useRef(false)
  const productsLoadPromise = useRef(null)

  // Detectar cuando el backend informa que la sesión caducó
  useEffect(() => {
    const handleSessionExpired = () => {
      logout()
      setIsAuthenticated(false)
      setPin('')
      setLoginError(
        'Tu sesión ha caducado. Introduce nuevamente el PIN.'
      )
    }

    window.addEventListener(
      'lubinin:session-expired',
      handleSessionExpired
    )

    return () => {
      window.removeEventListener(
        'lubinin:session-expired',
        handleSessionExpired
      )
    }
  }, [])

  // Ingresar mediante PIN
  const handleLogin = async (event) => {
    event.preventDefault()

    if (!/^\d{4}$/.test(pin)) {
      setLoginError('El PIN debe tener exactamente 4 dígitos.')
      return
    }

    setIsLoggingIn(true)
    setLoginError('')

    try {
      await loginWithPin(pin)

      setPin('')
      setLoginError('')
      setIsAuthenticated(true)

      console.log('Acceso autorizado.')
    } catch (error) {
      setLoginError(
        error.message || 'No se pudo validar el PIN.'
      )
    } finally {
      setIsLoggingIn(false)
    }
  }

  // Bloquear manualmente el TPV
  const handleLogout = () => {
    // Bloquear la aplicación sin eliminar el token del servidor.
    // Así se podrá sincronizar al recuperar Internet.
    setPin('')
    setLoginError('')
    setIsAuthenticated(false)
  }

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
    if (
      !isAuthenticated ||
      !navigator.onLine ||
      isSyncingProducts.current
    ) {
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

        // Marcar como sincronizado solo si no cambió
        // mientras se estaba realizando la petición
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
  // Esta operación solo se ejecuta después de ingresar con PIN
  useEffect(() => {
    if (!isAuthenticated) {
      productsLoadPromise.current = null
      return
    }

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

          // Conservar los cambios locales pendientes
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
  }, [isAuthenticated])

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

    if (isAuthenticated) {
      syncPendingProducts(normalizedProducts)
    }
  }

  // Sincronizar ventas y productos al iniciar
  // y al recuperar Internet, siempre con sesión autorizada
  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    let mounted = true

    const handleSync = async () => {
      if (
        !navigator.onLine ||
        !mounted ||
        !isAuthenticated
      ) {
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
      if (mounted && isAuthenticated) {
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
  }, [isAuthenticated])

  // Pantalla de acceso
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f5f3ee] text-[#26332d] flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🍔</div>

            <h1 className="text-3xl font-bold tracking-tight">
              LUBININ
            </h1>

            <p className="text-sm text-gray-500 mt-2">
              Sistema de gestión y punto de venta
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <label
              htmlFor="pin"
              className="block text-sm font-medium mb-2"
            >
              Introduce tu PIN de acceso
            </label>

            <input
              id="pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={4}
              value={pin}
              onChange={(event) => {
                setPin(
                  event.target.value
                    .replace(/\D/g, '')
                    .slice(0, 4)
                )
                setLoginError('')
              }}
              placeholder="••••"
              className="w-full text-center text-2xl tracking-[0.8em] border border-gray-300 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-[#26332d]"
              disabled={isLoggingIn}
              autoFocus
            />

            {loginError && (
              <p className="text-red-600 text-sm mt-3 text-center">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoggingIn || pin.length !== 4}
              className="w-full mt-6 bg-[#26332d] text-white font-semibold py-3 rounded-xl hover:bg-[#35483e] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoggingIn ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-6">
            Acceso privado · Food Truck Lubinin
          </p>
        </div>
      </div>
    )
  }

  // Aplicación principal
  return (
    <div className="min-h-screen bg-[#f5f3ee] text-[#26332d]">
      <div className="flex justify-end px-4 pt-3">
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm font-medium text-gray-600 hover:text-red-600 transition"
        >
          <span className="mr-1">🔒</span>
          Bloquear TPV
        </button>
      </div>

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
