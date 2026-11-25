
import { useEffect, useRef, useState } from 'react'

import {
  getRemoteInventory,
  initializeRemoteInventory,
  updateRemoteInventory,
} from '../services/inventoryService'

const INGREDIENTS_STORAGE_KEY = 'lubinin_inventory_ingredients'
const RECIPES_STORAGE_KEY = 'lubinin_inventory_recipes'
const SALES_STORAGE_KEY = 'lubinin_sales'
const PENDING_INVENTORY_KEY = 'lubinin_inventory_pending_sync'

function readStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : fallback
  } catch {
    return fallback
  }
}

function getTodayString() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getLocalDateStart(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0, 0, 0, 0
  )
}

function getLocalDateEnd(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23, 59, 59, 999
  )
}

function getPeriodRange(period, customStart, customEnd) {
  const today = new Date()
  const todayStart = getLocalDateStart(today)
  const todayEnd = getLocalDateEnd(today)

  if (period === 'all') {
    return {
      start: null,
      end: null,
      valid: true,
    }
  }

  if (period === 'day') {
    return {
      start: todayStart,
      end: todayEnd,
      valid: true,
    }
  }

  if (period === 'week') {
    const monday = new Date(todayStart)
    const dayOfWeek = monday.getDay()
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

    monday.setDate(monday.getDate() - daysSinceMonday)

    return {
      start: monday,
      end: todayEnd,
      valid: true,
    }
  }

  if (period === 'month') {
    return {
      start: new Date(
        today.getFullYear(),
        today.getMonth(),
        1,
        0, 0, 0, 0
      ),
      end: todayEnd,
      valid: true,
    }
  }

  if (period === 'custom') {
    if (!customStart || !customEnd || customStart > customEnd) {
      return {
        start: null,
        end: null,
        valid: false,
      }
    }

    const [startYear, startMonth, startDay] = customStart
      .split('-')
      .map(Number)

    const [endYear, endMonth, endDay] = customEnd
      .split('-')
      .map(Number)

    return {
      start: new Date(
        startYear,
        startMonth - 1,
        startDay,
        0, 0, 0, 0
      ),
      end: new Date(
        endYear,
        endMonth - 1,
        endDay,
        23, 59, 59, 999
      ),
      valid: true,
    }
  }

  return {
    start: todayStart,
    end: todayEnd,
    valid: true,
  }
}

function hasInventoryData(ingredients, recipes) {
  return (
    (Array.isArray(ingredients) && ingredients.length > 0) ||
    (
      recipes &&
      typeof recipes === 'object' &&
      Object.keys(recipes).length > 0
    )
  )
}

function Inventory({ products = [] }) {
  const [ingredients, setIngredients] = useState(() =>
    readStorage(INGREDIENTS_STORAGE_KEY, [])
  )

  const [recipes, setRecipes] = useState(() =>
    readStorage(RECIPES_STORAGE_KEY, {})
  )

  const [sales, setSales] = useState(() =>
    readStorage(SALES_STORAGE_KEY, [])
  )

  const [selectedPeriod, setSelectedPeriod] = useState('day')
  const [customStart, setCustomStart] = useState(getTodayString)
  const [customEnd, setCustomEnd] = useState(getTodayString)

  const [ingredientName, setIngredientName] = useState('')
  const [editingId, setEditingId] = useState(null)

  const [selectedProductId, setSelectedProductId] = useState('')
  const [draftIngredients, setDraftIngredients] = useState([])
  const [ingredientToAdd, setIngredientToAdd] = useState('')
  const [quantityToAdd, setQuantityToAdd] = useState('1')

  // Avisos visuales dentro de Almacén.
  const [notice, setNotice] = useState(null)

  // Ingrediente pendiente de confirmación para eliminar.
  const [ingredientToDelete, setIngredientToDelete] = useState(null)

  // Estado de sincronización del inventario.
  const [inventoryReady, setInventoryReady] = useState(false)
  const [syncStatus, setSyncStatus] = useState('loading')
  const [syncTrigger, setSyncTrigger] = useState(0)

  // Referencias para evitar sobrescribir datos durante la carga inicial.
  const revisionRef = useRef(0)
  const serverInitializedRef = useRef(false)
  const pendingRef = useRef(null)
  const skipNextSyncRef = useRef(false)
  const syncInProgressRef = useRef(false)
  const syncBlockedRef = useRef(false)

  // Cargar el inventario compartido al entrar en Almacén.
  useEffect(() => {
    let cancelled = false

    async function loadInventory() {
      const localIngredients = readStorage(
        INGREDIENTS_STORAGE_KEY,
        []
      )

      const localRecipes = readStorage(
        RECIPES_STORAGE_KEY,
        {}
      )

      const savedPending = readStorage(
        PENDING_INVENTORY_KEY,
        null
      )

      if (savedPending) {
        pendingRef.current = savedPending
      }

      try {
        const remote = await getRemoteInventory()

        if (cancelled) return

        revisionRef.current = Number(remote.revision) || 0
        serverInitializedRef.current = remote.initialized === true

        // El servidor ya tiene un inventario inicializado.
        if (remote.initialized === true) {
          // Si hay cambios locales pendientes, los conservamos.
          // No reemplazamos esos cambios con la versión remota.
          if (savedPending) {
            skipNextSyncRef.current = true

            setIngredients(
              Array.isArray(savedPending.ingredients)
                ? savedPending.ingredients
                : localIngredients
            )

            setRecipes(
              savedPending.recipes &&
              typeof savedPending.recipes === 'object'
                ? savedPending.recipes
                : localRecipes
            )

            setSyncStatus('pending')
            setInventoryReady(true)
            setSyncTrigger((current) => current + 1)

            return
          }

          // Sin cambios pendientes, MongoDB es la fuente principal.
          const remoteIngredients = Array.isArray(remote.ingredients)
            ? remote.ingredients
            : []

          const remoteRecipes =
            remote.recipes &&
            typeof remote.recipes === 'object'
              ? remote.recipes
              : {}

          skipNextSyncRef.current = true

          localStorage.setItem(
            INGREDIENTS_STORAGE_KEY,
            JSON.stringify(remoteIngredients)
          )

          localStorage.setItem(
            RECIPES_STORAGE_KEY,
            JSON.stringify(remoteRecipes)
          )

          setIngredients(remoteIngredients)
          setRecipes(remoteRecipes)
          setSyncStatus('synced')
          setInventoryReady(true)

          return
        }

        // MongoDB todavía no fue inicializado.
        // Si hay datos locales, intentamos migrarlos.
        if (
          savedPending ||
          hasInventoryData(localIngredients, localRecipes)
        ) {
          if (!savedPending) {
            pendingRef.current = {
              ingredients: localIngredients,
              recipes: localRecipes,
              baseRevision: 0,
            }

            localStorage.setItem(
              PENDING_INVENTORY_KEY,
              JSON.stringify(pendingRef.current)
            )
          }

          skipNextSyncRef.current = true

          setIngredients(
            savedPending?.ingredients || localIngredients
          )

          setRecipes(
            savedPending?.recipes || localRecipes
          )

          setSyncStatus('pending')
          setInventoryReady(true)
          setSyncTrigger((current) => current + 1)

          return
        }

        // Un dispositivo nuevo y vacío no inicializa el servidor.
        // Espera a que el dispositivo original aporte sus datos.
        skipNextSyncRef.current = true
        setSyncStatus('waiting')
        setInventoryReady(true)
      } catch (error) {
        if (cancelled) return

        console.error(
          'Error cargando inventario compartido:',
          error.message
        )

        // Si hay datos locales, se conservan para trabajar sin conexión.
        if (
          savedPending ||
          hasInventoryData(localIngredients, localRecipes)
        ) {
          if (!savedPending) {
            pendingRef.current = {
              ingredients: localIngredients,
              recipes: localRecipes,
              baseRevision: 0,
            }

            localStorage.setItem(
              PENDING_INVENTORY_KEY,
              JSON.stringify(pendingRef.current)
            )
          }

          skipNextSyncRef.current = true

          setIngredients(
            savedPending?.ingredients || localIngredients
          )

          setRecipes(
            savedPending?.recipes || localRecipes
          )
        } else {
          skipNextSyncRef.current = true
        }

        setSyncStatus('offline')
        setInventoryReady(true)
      }
    }

    loadInventory()

    return () => {
      cancelled = true
    }
  }, [])

  // Guardar una copia local y preparar los cambios para sincronizar.
  useEffect(() => {
    if (!inventoryReady) return

    localStorage.setItem(
      INGREDIENTS_STORAGE_KEY,
      JSON.stringify(ingredients)
    )

    localStorage.setItem(
      RECIPES_STORAGE_KEY,
      JSON.stringify(recipes)
    )

    // La carga inicial no debe generar una modificación nueva.
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false
      return
    }

    const existingPending = pendingRef.current

    const pending = {
      ingredients,
      recipes,
      baseRevision: existingPending
        ? existingPending.baseRevision
        : revisionRef.current,
    }

    pendingRef.current = pending

    localStorage.setItem(
      PENDING_INVENTORY_KEY,
      JSON.stringify(pending)
    )

    setSyncStatus('pending')
    setSyncTrigger((current) => current + 1)
  }, [ingredients, recipes, inventoryReady])

  // Sincronizar cambios pendientes con MongoDB.
  useEffect(() => {
    if (!inventoryReady || syncTrigger === 0) return
    if (!pendingRef.current) return
    if (syncBlockedRef.current) return

    let cancelled = false

    const timeout = window.setTimeout(async () => {
      if (syncInProgressRef.current) return

      const pending = pendingRef.current

      if (!pending) return

      syncInProgressRef.current = true

      try {
        let remote

        if (!serverInitializedRef.current) {
          // Primera migración: solo se intenta una vez si hay datos.
          if (!hasInventoryData(
            pending.ingredients,
            pending.recipes
          )) {
            setSyncStatus('waiting')
            return
          }

          remote = await initializeRemoteInventory(
            pending.ingredients,
            pending.recipes
          )

          serverInitializedRef.current = true
        } else {
          remote = await updateRemoteInventory(
            pending.ingredients,
            pending.recipes,
            pending.baseRevision
          )
        }

        if (cancelled) return

        revisionRef.current = Number(remote.revision) || 0

        const currentPending = pendingRef.current

        const sameSnapshot =
          currentPending &&
          JSON.stringify(currentPending.ingredients) ===
            JSON.stringify(pending.ingredients) &&
          JSON.stringify(currentPending.recipes) ===
            JSON.stringify(pending.recipes)

        if (sameSnapshot) {
          pendingRef.current = null

          localStorage.removeItem(PENDING_INVENTORY_KEY)

          setSyncStatus('synced')
        } else if (currentPending) {
          // Hubo cambios mientras se enviaba la petición.
          // Conservamos los cambios nuevos y usamos la nueva revisión.
          const updatedPending = {
            ...currentPending,
            baseRevision: revisionRef.current,
          }

          pendingRef.current = updatedPending

          localStorage.setItem(
            PENDING_INVENTORY_KEY,
            JSON.stringify(updatedPending)
          )

          setSyncStatus('pending')
          setSyncTrigger((current) => current + 1)
        }
      } catch (error) {
        if (cancelled) return

        console.error(
          'Error sincronizando inventario:',
          error.message
        )

        if (error.status === 409 || error.conflict) {
          // No reemplazamos los datos locales ni los del servidor.
          // El usuario debe revisar el conflicto antes de continuar.
          syncBlockedRef.current = true
          setSyncStatus('conflict')
        } else {
          setSyncStatus('offline')
        }
      } finally {
        syncInProgressRef.current = false
      }
    }, 500)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [inventoryReady, syncTrigger])

  // Reintentar cuando vuelve la conexión.
  useEffect(() => {
    function handleOnline() {
      if (!pendingRef.current) return

      syncBlockedRef.current = false
      setSyncStatus('pending')
      setSyncTrigger((current) => current + 1)
    }

    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  // Reintentar manualmente los cambios pendientes.
  function retryInventorySync() {
    if (!pendingRef.current) return

    syncBlockedRef.current = false
    setSyncStatus('pending')
    setSyncTrigger((current) => current + 1)
  }

  // Ocultar automáticamente los avisos.
  useEffect(() => {
    if (!notice) return

    const timeout = window.setTimeout(() => {
      setNotice(null)
    }, 3500)

    return () => window.clearTimeout(timeout)
  }, [notice])

  // Actualizar las ventas al entrar nuevamente en Almacén.
  function refreshSales() {
    const savedSales = readStorage(SALES_STORAGE_KEY, [])
    setSales(Array.isArray(savedSales) ? savedSales : [])
  }

  useEffect(() => {
    refreshSales()

    const handleFocus = () => refreshSales()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSales()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    )

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      )
    }
  }, [])

  const activeProducts = products.filter(
    (product) => product.active !== false
  )

  const selectedProduct = activeProducts.find(
    (product) => String(product.id) === selectedProductId
  )

  // Calcular el período seleccionado.
  const dateRange = getPeriodRange(
    selectedPeriod,
    customStart,
    customEnd
  )

  // Excluir ventas canceladas y aplicar el filtro de fechas.
  const filteredSales = dateRange.valid
    ? sales.filter((sale) => {
        if (
          !sale ||
          sale.status === 'cancelled' ||
          sale.cancelledAt
        ) {
          return false
        }

        const saleDate = new Date(sale.date)

        if (Number.isNaN(saleDate.getTime())) {
          return false
        }

        if (
          dateRange.start &&
          saleDate < dateRange.start
        ) {
          return false
        }

        if (
          dateRange.end &&
          saleDate > dateRange.end
        ) {
          return false
        }

        return true
      })
    : []

  // Calcular las unidades de productos vendidos.
  const productSalesMap = new Map()

  filteredSales.forEach((sale) => {
    if (!Array.isArray(sale.items)) return

    sale.items.forEach((item) => {
      const quantity = Number(item.quantity)

      if (!Number.isFinite(quantity) || quantity <= 0) {
        return
      }

      const productKey = String(
        item.clientProductId || item.id || item.name
      )

      const existing = productSalesMap.get(productKey)

      if (existing) {
        existing.quantity += quantity
      } else {
        productSalesMap.set(productKey, {
          key: productKey,
          name: item.name || 'Producto sin nombre',
          emoji: item.emoji || '🛍️',
          quantity,
        })
      }
    })
  })

  const productSales = Array.from(
    productSalesMap.values()
  ).sort((a, b) => b.quantity - a.quantity)

  const totalProductsSold = productSales.reduce(
    (sum, item) => sum + item.quantity,
    0
  )

  // Calcular el consumo de ingredientes registrado en cada venta.
  const ingredientConsumptionMap = new Map()

  filteredSales.forEach((sale) => {
    if (!Array.isArray(sale.inventoryConsumption)) {
      return
    }

    sale.inventoryConsumption.forEach((item) => {
      const quantity = Number(item.quantity)

      if (!Number.isFinite(quantity) || quantity <= 0) {
        return
      }

      const ingredientKey = String(
        item.ingredientId || item.name
      )

      const existing = ingredientConsumptionMap.get(
        ingredientKey
      )

      if (existing) {
        existing.quantity += quantity
      } else {
        ingredientConsumptionMap.set(ingredientKey, {
          key: ingredientKey,
          name: item.name || 'Ingrediente sin nombre',
          unit: item.unit || 'unidad',
          quantity,
        })
      }
    })
  })

  const ingredientConsumption = Array.from(
    ingredientConsumptionMap.values()
  ).sort((a, b) => b.quantity - a.quantity)

  // Detectar ventas antiguas que no tienen fotografía de receta.
  const salesWithoutConsumptionData = filteredSales.filter(
    (sale) => !Array.isArray(sale.inventoryConsumption)
  ).length

  function handleIngredientSubmit(event) {
    event.preventDefault()

    const name = ingredientName.trim()
    if (!name) return

    if (editingId !== null) {
      setIngredients((current) =>
        current.map((item) =>
          item.id === editingId ? { ...item, name } : item
        )
      )

      setNotice({
        type: 'success',
        message: 'Ingrediente actualizado correctamente.',
      })
    } else {
      setIngredients((current) => [
        ...current,
        {
          id: `ingredient-${Date.now()}`,
          name,
          unit: 'unidad',
        },
      ])

      setNotice({
        type: 'success',
        message: 'Ingrediente agregado correctamente.',
      })
    }

    setIngredientName('')
    setEditingId(null)
  }

  function handleEditIngredient(ingredient) {
    setIngredientName(ingredient.name)
    setEditingId(ingredient.id)
  }

  function handleDeleteIngredient(id) {
    const ingredient = ingredients.find(
      (item) => item.id === id
    )

    if (!ingredient) return

    setIngredientToDelete(ingredient)
  }

  function confirmDeleteIngredient() {
    if (!ingredientToDelete) return

    const id = ingredientToDelete.id

    setIngredients((current) =>
      current.filter((item) => item.id !== id)
    )

    setRecipes((current) => {
      const updated = {}

      Object.entries(current).forEach(([productId, recipe]) => {
        updated[productId] = recipe.filter(
          (item) => item.ingredientId !== id
        )
      })

      return updated
    })

    setDraftIngredients((current) =>
      current.filter((item) => item.ingredientId !== id)
    )

    if (editingId === id) {
      setIngredientName('')
      setEditingId(null)
    }

    setIngredientToDelete(null)

    setNotice({
      type: 'success',
      message: 'Ingrediente eliminado correctamente.',
    })
  }

  function handleSelectProduct(productId) {
    setSelectedProductId(productId)
    setDraftIngredients(recipes[productId] || [])
    setIngredientToAdd('')
    setQuantityToAdd('1')
  }

  function handleAddRecipeIngredient() {
    if (!ingredientToAdd) return

    const quantity = Number(quantityToAdd)

    if (!Number.isInteger(quantity) || quantity < 1) {
      setNotice({
        type: 'error',
        message: 'La cantidad debe ser un número entero mayor que cero.',
      })
      return
    }

    setDraftIngredients((current) => {
      const existing = current.find(
        (item) => item.ingredientId === ingredientToAdd
      )

      if (existing) {
        return current.map((item) =>
          item.ingredientId === ingredientToAdd
            ? { ...item, quantity }
            : item
        )
      }

      return [
        ...current,
        {
          ingredientId: ingredientToAdd,
          quantity,
        },
      ]
    })

    setIngredientToAdd('')
    setQuantityToAdd('1')

    setNotice({
      type: 'success',
      message: 'Ingrediente añadido a la receta. Recordá guardar los cambios.',
    })
  }

  function handleRemoveRecipeIngredient(id) {
    setDraftIngredients((current) =>
      current.filter((item) => item.ingredientId !== id)
    )
  }

  function handleSaveRecipe() {
    if (!selectedProductId) return

    setRecipes((current) => {
      const updated = { ...current }

      if (draftIngredients.length === 0) {
        delete updated[selectedProductId]
      } else {
        updated[selectedProductId] = draftIngredients
      }

      return updated
    })

    setNotice({
      type: 'success',
      message: 'Receta guardada correctamente.',
    })
  }

  function cancelIngredientEdit() {
    setIngredientName('')
    setEditingId(null)
  }

  function getRecipeStatus(product) {
    const recipe = recipes[String(product.id)]
    return recipe && recipe.length > 0
      ? 'Con receta'
      : 'Solo contar unidades'
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#26332d]">
          Almacén
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Controlá las unidades vendidas y los ingredientes consumidos en Lubinin.
        </p>
      </div>

      {/* ESTADO DE SINCRONIZACIÓN */}
      <div className="mb-6 rounded-xl border border-[#e8e4da] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#26332d]">
              Sincronización del almacén
            </p>

            <p className="mt-1 text-sm text-gray-500">
              {syncStatus === 'loading' &&
                'Conectando con el inventario compartido...'}

              {syncStatus === 'waiting' &&
                'Esperando los datos del dispositivo que contiene el inventario original.'}

              {syncStatus === 'synced' &&
                'Ingredientes y recetas sincronizados con MongoDB.'}

              {syncStatus === 'pending' &&
                'Hay cambios guardados localmente pendientes de sincronización.'}

              {syncStatus === 'offline' &&
                'Sin conexión con el servidor. Podés seguir trabajando; los cambios quedan guardados en este dispositivo.'}

              {syncStatus === 'conflict' &&
                'Otro dispositivo modificó el inventario. Tus cambios locales se conservaron, pero la sincronización está pausada para evitar sobrescribir datos.'}
            </p>
          </div>

          {(syncStatus === 'offline' ||
            syncStatus === 'pending' ||
            syncStatus === 'conflict') && (
            <button
              type="button"
              onClick={retryInventorySync}
              className="rounded-xl border border-[#ddd8cc] px-4 py-2 text-sm font-semibold text-[#53675a] hover:bg-[#f8f7f3]"
            >
              ↻ Reintentar
            </button>
          )}
        </div>
      </div>

      {/* AVISO VISUAL */}
      {notice && (
        <div
          role="status"
          className={`mb-6 flex items-start justify-between gap-4 rounded-xl border p-4 shadow-sm ${
            notice.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-green-200 bg-green-50 text-green-800'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-lg">
              {notice.type === 'error' ? '⚠️' : '✓'}
            </span>

            <p className="pt-0.5 text-sm font-medium">
              {notice.message}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Cerrar aviso"
            className="shrink-0 rounded-lg px-2 text-lg leading-none opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      {/* RESUMEN DE CONSUMO Y VENTAS */}
      <section className="mb-6 rounded-2xl border border-[#e8e4da] bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#26332d]">
              📊 Resumen de consumo
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Consultá las unidades vendidas y los ingredientes utilizados.
            </p>
          </div>

          <button
            type="button"
            onClick={refreshSales}
            className="rounded-xl border border-[#ddd8cc] px-4 py-2 text-sm font-semibold text-[#53675a] hover:bg-[#f8f7f3]"
          >
            ↻ Actualizar
          </button>
        </div>

        {/* FILTROS */}
        <div className="mb-5">
          <p className="mb-2 text-sm font-semibold text-[#26332d]">
            Período de consulta
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { id: 'day', label: 'Hoy' },
              { id: 'week', label: 'Semana' },
              { id: 'month', label: 'Mes' },
              { id: 'all', label: 'Todo' },
              { id: 'custom', label: 'Fechas' },
            ].map((period) => (
              <button
                key={period.id}
                type="button"
                onClick={() => setSelectedPeriod(period.id)}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  selectedPeriod === period.id
                    ? 'bg-[#26332d] text-white'
                    : 'border border-[#ddd8cc] bg-white text-[#53675a] hover:bg-[#f8f7f3]'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        {/* FECHAS PERSONALIZADAS */}
        {selectedPeriod === 'custom' && (
          <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl bg-[#f8f7f3] p-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="inventory-start-date"
                className="mb-2 block text-sm font-semibold text-[#26332d]"
              >
                Desde
              </label>

              <input
                id="inventory-start-date"
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(event) =>
                  setCustomStart(event.target.value)
                }
                className="w-full rounded-xl border border-[#ddd8cc] bg-white px-4 py-3 text-sm outline-none focus:border-[#26332d]"
              />
            </div>

            <div>
              <label
                htmlFor="inventory-end-date"
                className="mb-2 block text-sm font-semibold text-[#26332d]"
              >
                Hasta
              </label>

              <input
                id="inventory-end-date"
                type="date"
                value={customEnd}
                min={customStart || undefined}
                max={getTodayString()}
                onChange={(event) =>
                  setCustomEnd(event.target.value)
                }
                className="w-full rounded-xl border border-[#ddd8cc] bg-white px-4 py-3 text-sm outline-none focus:border-[#26332d]"
              />
            </div>
          </div>
        )}

        {!dateRange.valid && (
          <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            Seleccioná un rango de fechas válido. La fecha inicial no puede ser posterior a la fecha final.
          </p>
        )}

        {/* TOTALES */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-[#f8f7f3] p-4">
            <p className="text-sm text-gray-500">
              Ventas registradas
            </p>
            <p className="mt-1 text-2xl font-bold text-[#26332d]">
              {filteredSales.length}
            </p>
          </div>

          <div className="rounded-xl bg-[#f8f7f3] p-4">
            <p className="text-sm text-gray-500">
              Unidades de productos vendidos
            </p>
            <p className="mt-1 text-2xl font-bold text-[#26332d]">
              {totalProductsSold}
            </p>
          </div>
        </div>

        {/* INGREDIENTES CONSUMIDOS */}
        <div className="mb-6">
          <h4 className="mb-3 font-bold text-[#26332d]">
            🥬 Ingredientes consumidos
          </h4>

          {ingredientConsumption.length === 0 ? (
            <p className="rounded-xl bg-[#f8f7f3] p-4 text-sm text-gray-500">
              No hay consumo de ingredientes registrado en este período.
            </p>
          ) : (
            <div className="space-y-2">
              {ingredientConsumption.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#f8f7f3] px-4 py-3"
                >
                  <span className="font-medium text-[#26332d]">
                    {item.name}
                  </span>

                  <span className="shrink-0 font-bold text-[#26332d]">
                    {item.quantity} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PRODUCTOS VENDIDOS */}
        <div>
          <h4 className="mb-3 font-bold text-[#26332d]">
            🛒 Productos vendidos
          </h4>

          {productSales.length === 0 ? (
            <p className="rounded-xl bg-[#f8f7f3] p-4 text-sm text-gray-500">
              No hay productos vendidos en este período.
            </p>
          ) : (
            <div className="space-y-2">
              {productSales.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#f8f7f3] px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-xl">
                      {item.emoji}
                    </span>

                    <span className="truncate font-medium text-[#26332d]">
                      {item.name}
                    </span>
                  </div>

                  <span className="shrink-0 font-bold text-[#26332d]">
                    {item.quantity} uds.
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {salesWithoutConsumptionData > 0 && (
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Hay {salesWithoutConsumptionData}{' '}
            {salesWithoutConsumptionData === 1
              ? 'venta anterior'
              : 'ventas anteriores'}{' '}
            sin registro de consumo de ingredientes. Sus productos vendidos sí están incluidos, pero no se puede reconstruir su consumo de recetas.
          </p>
        )}

        <p className="mt-4 text-xs text-gray-400">
          Las ventas canceladas no se incluyen en estos resultados.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* PRODUCTOS DEL TPV */}
        <section className="rounded-2xl border border-[#e8e4da] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#26332d]">
                📦 Productos de venta
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Se obtienen automáticamente del TPV.
              </p>
            </div>

            <span className="rounded-full bg-[#f5f3ee] px-3 py-1 text-sm font-bold text-[#26332d]">
              {activeProducts.length}
            </span>
          </div>

          {activeProducts.length === 0 ? (
            <p className="rounded-xl bg-[#f8f7f3] p-4 text-sm text-gray-500">
              Todavía no hay productos activos en el TPV.
            </p>
          ) : (
            <div className="space-y-2">
              {activeProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#f8f7f3] px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-xl">
                      {product.emoji || '🛍️'}
                    </span>

                    <span className="truncate font-medium text-[#26332d]">
                      {product.name}
                    </span>
                  </div>

                  <span className="shrink-0 text-xs font-semibold text-gray-500">
                    {getRecipeStatus(product)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* INGREDIENTES */}
        <section className="rounded-2xl border border-[#e8e4da] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#26332d]">
                🥬 Ingredientes
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Creá los ingredientes que utilizarán las recetas.
              </p>
            </div>

            <span className="rounded-full bg-[#f5f3ee] px-3 py-1 text-sm font-bold text-[#26332d]">
              {ingredients.length}
            </span>
          </div>

          <form onSubmit={handleIngredientSubmit} className="mb-5">
            <label className="mb-2 block text-sm font-semibold text-[#26332d]">
              Nombre del ingrediente
            </label>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={ingredientName}
                onChange={(event) =>
                  setIngredientName(event.target.value)
                }
                placeholder="Ej. Carne de hamburguesa"
                className="min-w-0 flex-1 rounded-xl border border-[#ddd8cc] px-4 py-3 text-sm outline-none focus:border-[#26332d]"
              />

              <button
                type="submit"
                disabled={!ingredientName.trim()}
                className="rounded-xl bg-[#26332d] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#35483e] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {editingId !== null ? 'Guardar' : 'Agregar'}
              </button>
            </div>

            {editingId !== null && (
              <button
                type="button"
                onClick={cancelIngredientEdit}
                className="mt-2 text-sm font-medium text-gray-500 hover:text-gray-800"
              >
                Cancelar edición
              </button>
            )}
          </form>

          {ingredients.length === 0 ? (
            <p className="rounded-xl bg-[#f8f7f3] p-4 text-sm text-gray-500">
              Todavía no agregaste ingredientes.
            </p>
          ) : (
            <div className="space-y-2">
              {ingredients.map((ingredient) => (
                <div
                  key={ingredient.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#f8f7f3] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[#26332d]">
                      {ingredient.name}
                    </p>

                    <p className="text-xs text-gray-500">
                      Unidad: {ingredient.unit}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditIngredient(ingredient)}
                      className="rounded-lg px-3 py-2 text-sm font-semibold text-[#53675a] hover:bg-[#eaece7]"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteIngredient(ingredient.id)}
                      className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* RECETAS */}
      <section className="mt-6 rounded-2xl border border-[#e8e4da] bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-[#26332d]">
            🍔 Recetas
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            Elegí un producto del TPV y configurá qué ingredientes utiliza.
          </p>
        </div>

        {activeProducts.length === 0 ? (
          <p className="rounded-xl bg-[#f8f7f3] p-4 text-sm text-gray-500">
            Necesitás tener productos activos en el TPV.
          </p>
        ) : (
          <div className="max-w-xl">
            <label className="mb-2 block text-sm font-semibold text-[#26332d]">
              Producto del TPV
            </label>

            <select
              value={selectedProductId}
              onChange={(event) =>
                handleSelectProduct(event.target.value)
              }
              className="w-full rounded-xl border border-[#ddd8cc] bg-white px-4 py-3 text-sm outline-none focus:border-[#26332d]"
            >
              <option value="">Seleccioná un producto</option>

              {activeProducts.map((product) => (
                <option key={product.id} value={String(product.id)}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedProduct && (
          <div className="mt-6 border-t border-[#eeeae1] pt-6">
            <h4 className="mb-1 font-bold text-[#26332d]">
              Receta de {selectedProduct.name}
            </h4>

            <p className="mb-5 text-sm text-gray-500">
              Indicá cuántas unidades de cada ingrediente utiliza una unidad de este producto.
            </p>

            {ingredients.length === 0 ? (
              <p className="rounded-xl bg-[#f8f7f3] p-4 text-sm text-gray-500">
                Primero tenés que agregar ingredientes en la sección anterior.
              </p>
            ) : (
              <>
                <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_auto]">
                  <select
                    value={ingredientToAdd}
                    onChange={(event) =>
                      setIngredientToAdd(event.target.value)
                    }
                    className="min-w-0 rounded-xl border border-[#ddd8cc] bg-white px-4 py-3 text-sm outline-none focus:border-[#26332d]"
                  >
                    <option value="">Seleccioná un ingrediente</option>

                    {ingredients.map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.id}>
                        {ingredient.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantityToAdd}
                    onChange={(event) =>
                      setQuantityToAdd(event.target.value)
                    }
                    className="rounded-xl border border-[#ddd8cc] px-4 py-3 text-sm outline-none focus:border-[#26332d]"
                    placeholder="Cantidad"
                  />

                  <button
                    type="button"
                    onClick={handleAddRecipeIngredient}
                    disabled={
                      !ingredientToAdd ||
                      !Number.isInteger(Number(quantityToAdd)) ||
                      Number(quantityToAdd) < 1
                    }
                    className="rounded-xl bg-[#53675a] px-5 py-3 text-sm font-bold text-white hover:bg-[#405347] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    + Agregar
                  </button>
                </div>

                {draftIngredients.length === 0 ? (
                  <p className="rounded-xl bg-[#f8f7f3] p-4 text-sm text-gray-500">
                    Este producto todavía no tiene ingredientes asignados. Si lo dejás así, se contará solamente como unidad vendida.
                  </p>
                ) : (
                  <div className="mb-5 space-y-2">
                    {draftIngredients.map((item) => {
                      const ingredient = ingredients.find(
                        (entry) => entry.id === item.ingredientId
                      )

                      if (!ingredient) return null

                      return (
                        <div
                          key={item.ingredientId}
                          className="flex items-center justify-between gap-3 rounded-xl bg-[#f8f7f3] px-4 py-3"
                        >
                          <div>
                            <p className="font-medium text-[#26332d]">
                              {ingredient.name}
                            </p>

                            <p className="text-xs text-gray-500">
                              {item.quantity} {ingredient.unit} por producto
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveRecipeIngredient(item.ingredientId)
                            }
                            className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                          >
                            Quitar
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveRecipe}
                className="rounded-xl bg-[#26332d] px-6 py-3 text-sm font-bold text-white hover:bg-[#35483e]"
              >
                Guardar receta
              </button>

              {recipes[selectedProductId] && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftIngredients([])
                  }}
                  className="rounded-xl border border-red-200 px-5 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Quitar todos los ingredientes
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* MODAL PERSONALIZADO PARA ELIMINAR INGREDIENTES */}
      {ingredientToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIngredientToDelete(null)
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-ingredient-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-2xl">
              🗑️
            </div>

            <h3
              id="delete-ingredient-title"
              className="text-xl font-bold text-[#26332d]"
            >
              Eliminar ingrediente
            </h3>

            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              ¿Querés eliminar <strong className="text-[#26332d]">{ingredientToDelete.name}</strong>?
              También se quitará de todas las recetas donde esté utilizado.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIngredientToDelete(null)}
                className="rounded-xl border border-[#ddd8cc] px-5 py-3 text-sm font-semibold text-[#53675a] transition hover:bg-[#f8f7f3]"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmDeleteIngredient}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Inventory
