
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

import './index.css'

import Topbar from './components/layout/Topbar'
import POS from './pages/POS'
import Sales from './pages/Sales'
import Products from './pages/Products'
import Inventory from './pages/Inventory'

import { products as initialProducts } from './data/products'
import { syncPendingSales } from './services/syncService'

import {
  getRemoteProducts,
  createRemoteProduct,
  updateRemoteProduct,
  setRemoteProductActive,
  deleteRemoteProduct,
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
    seniorDiscountEligible:
      product.seniorDiscountEligible ?? false,
    deleted: product.deleted ?? false,
    deletedAt: product.deletedAt ?? null,
    pendingDelete: product.pendingDelete ?? false,
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

  // Estado de seguridad para las actualizaciones
  const [canApplyUpdate, setCanApplyUpdate] = useState(false)

  const isSyncingSales = useRef(false)
  const isSyncingProducts = useRef(false)
  const productsLoadPromise = useRef(null)

  const swRegistration = useRef(null)
  const isApplyingUpdate = useRef(false)

  // Registrar el Service Worker y detectar actualizaciones
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        swRegistration.current = registration
      }
    },
  })

  // Comprobar periódicamente si hay una nueva versión
  useEffect(() => {
    const updateCheck = window.setInterval(() => {
      if (swRegistration.current && navigator.onLine) {
        swRegistration.current.update().catch((error) => {
          console.error(
            'Error al comprobar actualizaciones:',
            error
          )
        })
      }
    }, 60 * 60 * 1000)

    return () => {
      window.clearInterval(updateCheck)
    }
  }, [])

  // Actualizar solamente cuando POS confirma que está libre
  useEffect(() => {
    if (
      !needRefresh ||
      !canApplyUpdate ||
      isApplyingUpdate.current
    ) {
      return
    }

    isApplyingUpdate.current = true

    console.log(
      'Nueva versión disponible. Actualizando aplicación...'
    )

    updateServiceWorker().catch((error) => {
      isApplyingUpdate.current = false

      console.error(
        'No se pudo aplicar la actualización:',
        error
      )
    })
  }, [
    needRefresh,
    canApplyUpdate,
    updateServiceWorker,
  ])

  // Recibir información de seguridad desde POS
  const handleUpdateSafetyChange = useCallback((isSafe) => {
    setCanApplyUpdate(isSafe)
  }, [])

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
      (product) => product.pendingSync || product.pendingDelete
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

      // Primero procesar las eliminaciones pendientes
      const productsToDelete = pendingProducts.filter(
        (product) => product.pendingDelete
      )

      for (const product of productsToDelete) {
        await deleteRemoteProduct(product.clientProductId)

        console.log(
          `Producto eliminado de MongoDB: ${product.name}`
        )

        // Conservar el registro local, pero marcarlo como sincronizado
        setProducts((currentProducts) =>
          currentProducts.map((currentProduct) => {
            if (
              currentProduct.clientProductId !==
              product.clientProductId
            ) {
              return currentProduct
            }

            return {
              ...currentProduct,
              deleted: true,
              active: false,
              pendingDelete: false,
              pendingSync: false,
            }
          })
        )
      }

      // Después procesar las altas y modificaciones pendientes
      const productsToUpdate = pendingProducts.filter(
        (product) => !product.pendingDelete && !product.deleted
      )

      for (const product of productsToUpdate) {
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

            if (
              currentProduct.deleted ||
              currentProduct.pendingDelete ||
              hasProductChanges(product, currentProduct)
            ) {
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

        const localProducts = getSavedProducts()

        // Conservar siempre los registros de productos eliminados
        const deletedLocalProducts = localProducts.filter(
          (product) => product.deleted
        )

        if (remoteProducts.length > 0) {
          const normalizedRemoteProducts =
            remoteProducts.map(normalizeProduct)

          // Conservar los cambios locales pendientes
          const pendingLocalProducts = localProducts.filter(
            (product) => product.pendingSync && !product.deleted
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
            ...deletedLocalProducts,
          ]

          setProducts(mergedProducts)

          console.log(
            `Productos cargados desde MongoDB: ${normalizedRemoteProducts.length}`
          )

          await syncPendingProducts(mergedProducts)

          return
        }

        // Si MongoDB está vacío, recuperar catálogo local
        // y migrar únicamente los productos no eliminados
        const productsToMigrate = localProducts.filter(
          (product) => !product.deleted
        )

        console.log(
          `MongoDB vacío. Se migrarán ${productsToMigrate.length} productos.`
        )

        for (const product of productsToMigrate) {
          console.log(`Enviando producto: ${product.name}`)

          const savedProduct = await createRemoteProduct(product)

          console.log(
            `Producto guardado: ${savedProduct?.name || product.name}`
          )

          setProducts((currentProducts) =>
            currentProducts.map((currentProduct) => {
              if (
                currentProduct.clientProductId !==
                product.clientProductId
              ) {
                return currentProduct
              }

              return {
                ...currentProduct,
                pendingSync: false,
              }
            })
          )
        }

        setProducts([
          ...productsToMigrate.map((product) => ({
            ...product,
            pendingSync: false,
          })),
          ...deletedLocalProducts,
        ])

        console.log(
          `Migración finalizada: ${productsToMigrate.length} productos.`
        )

        // Procesar también posibles eliminaciones pendientes
        await syncPendingProducts([
          ...productsToMigrate.map((product) => ({
            ...product,
            pendingSync: false,
          })),
          ...deletedLocalProducts,
        ])
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

  // Guardar cambios del catálogo y detectar productos eliminados
  const handleProductsChange = (updatedProducts) => {
    const previousProducts = products

    const normalizedUpdatedProducts = updatedProducts.map(
      (product) => {
        const normalizedProduct = normalizeProduct(product)

        const previousProduct = previousProducts.find(
          (item) =>
            item.clientProductId ===
            normalizedProduct.clientProductId
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

    // Identificar productos que estaban en el catálogo
    // y ya no aparecen en la lista recibida
    const updatedProductIds = new Set(
      normalizedUpdatedProducts.map(
        (product) => product.clientProductId
      )
    )

    const newlyDeletedProducts = previousProducts
      .filter(
        (product) =>
          !product.deleted &&
          !updatedProductIds.has(product.clientProductId)
      )
      .map((product) => ({
        ...product,
        active: false,
        deleted: true,
        deletedAt: new Date().toISOString(),
        pendingDelete: true,
        pendingSync: false,
      }))

    // Mantener los registros eliminados anteriores
    const existingDeletedProducts = previousProducts.filter(
      (product) => product.deleted
    )

    const mergedProducts = [
      ...normalizedUpdatedProducts,
      ...existingDeletedProducts,
      ...newlyDeletedProducts,
    ]

    setProducts(mergedProducts)

    if (!navigator.onLine) {
      console.log(
        'Sin conexión. Cambios guardados localmente y pendientes de sincronización.'
      )
      return
    }

    if (isAuthenticated) {
      syncPendingProducts(mergedProducts)
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

  // Productos visibles: los eliminados no aparecen en el TPV ni en el catálogo
  const visibleProducts = products.filter(
    (product) => !product.deleted
  )

  // Mantener identificadores únicos aunque se elimine el producto con ID más alto
  const nextProductId =
    products.reduce(
      (maximum, product) =>
        Math.max(maximum, Number(product.id) || 0),
      0
    ) + 1

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
        <POS
          products={visibleProducts}
          onUpdateSafetyChange={handleUpdateSafetyChange}
        />
      )}

      {activePage === 'sales' && (
        <Sales />
      )}

      {activePage === 'products' && (
        <Products
          products={visibleProducts}
          nextProductId={nextProductId}
          onProductsChange={handleProductsChange}
        />
      )}
        {activePage === 'inventory' && (
    <Inventory products={visibleProducts} />
  )}
    </div>
  )
}

export default App
