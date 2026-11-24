
import { useEffect, useState } from 'react'

const INGREDIENTS_STORAGE_KEY = 'lubinin_inventory_ingredients'
const RECIPES_STORAGE_KEY = 'lubinin_inventory_recipes'
const SALES_STORAGE_KEY = 'lubinin_sales'

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

  useEffect(() => {
    localStorage.setItem(
      INGREDIENTS_STORAGE_KEY,
      JSON.stringify(ingredients)
    )
  }, [ingredients])

  useEffect(() => {
    localStorage.setItem(
      RECIPES_STORAGE_KEY,
      JSON.stringify(recipes)
    )
  }, [recipes])

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
    } else {
      setIngredients((current) => [
        ...current,
        {
          id: `ingredient-${Date.now()}`,
          name,
          unit: 'unidad',
        },
      ])
    }

    setIngredientName('')
    setEditingId(null)
  }

  function handleEditIngredient(ingredient) {
    setIngredientName(ingredient.name)
    setEditingId(ingredient.id)
  }

  function handleDeleteIngredient(id) {
    const confirmed = window.confirm(
      '¿Querés eliminar este ingrediente? También se quitará de las recetas donde esté utilizado.'
    )

    if (!confirmed) return

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
      alert('La cantidad debe ser un número entero mayor que cero.')
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

    alert('Receta guardada correctamente.')
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
    </main>
  )
}

export default Inventory
