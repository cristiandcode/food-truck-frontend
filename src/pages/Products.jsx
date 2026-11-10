
import { useMemo, useState } from 'react'

import useCategories from '../hooks/useCategories'

function formatPrice(price) {
  return Number(price || 0).toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
  })
}

const emptyForm = {
  name: '',
  price: '',
  category: 'burgers',
  emoji: '🛍️',
  seniorDiscountEligible: false,
}

function Products({ products, onProductsChange }) {
  const {
    categories,
    addCategory,
    deleteCategory,
  } = useCategories()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')

  const [showCategoryCreator, setShowCategoryCreator] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryIcon, setNewCategoryIcon] = useState('📦')
  const [categoryError, setCategoryError] = useState('')
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)

  const [categoryActionError, setCategoryActionError] = useState('')
  const [deletingCategoryId, setDeletingCategoryId] = useState(null)
  const [categoryToDelete, setCategoryToDelete] = useState(null)

  const availableCategories = categories.filter(
    (category) => category.id !== 'all'
  )

  const activeCount = products.filter(
    (product) => product.active !== false
  ).length

  const inactiveCount = products.length - activeCount

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(search.trim().toLowerCase())

      const matchesCategory =
        categoryFilter === 'all' ||
        product.category === categoryFilter

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && product.active !== false) ||
        (statusFilter === 'inactive' && product.active === false)

      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [products, search, categoryFilter, statusFilter])

  const getCategoryName = (categoryId) => {
    return (
      availableCategories.find(
        (category) => category.id === categoryId
      )?.name || 'Sin categoría'
    )
  }

  const openNewProductForm = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setShowCategoryCreator(false)
    setCategoryError('')
    setNewCategoryName('')
    setNewCategoryIcon('📦')
    setShowForm(true)
  }

  const openEditForm = (product) => {
    setEditingId(product.id)

    setForm({
      name: product.name,
      price: String(product.price),
      category: product.category,
      emoji: product.emoji || '🛍️',
      seniorDiscountEligible:
        product.seniorDiscountEligible === true,
    })

    setFormError('')
    setShowCategoryCreator(false)
    setCategoryError('')
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setShowCategoryCreator(false)
    setCategoryError('')
  }

  const handleCreateCategory = async () => {
    if (isCreatingCategory) return

    setCategoryError('')

    if (!newCategoryName.trim()) {
      setCategoryError('Ingresá el nombre de la categoría.')
      return
    }

    setIsCreatingCategory(true)

    try {
      const newCategory = await addCategory(
        newCategoryName,
        newCategoryIcon
      )

      setForm((current) => ({
        ...current,
        category: newCategory.id,
      }))

      setNewCategoryName('')
      setNewCategoryIcon('📦')
      setShowCategoryCreator(false)
      setFormError('')
    } catch (error) {
      setCategoryError(
        error.message || 'No se pudo crear la categoría.'
      )
    } finally {
      setIsCreatingCategory(false)
    }
  }

  // Abre la ventana personalizada de confirmación.
  const handleDeleteCategory = (category) => {
    if (deletingCategoryId !== null) return

    setCategoryActionError('')
    setCategoryToDelete(category)
  }

  // Ejecuta la eliminación solamente después de confirmar.
  const confirmDeleteCategory = async () => {
    if (!categoryToDelete || deletingCategoryId !== null) return

    const category = categoryToDelete

    setCategoryActionError('')

    const assignedProducts = products.filter(
      (product) => product.category === category.id
    )

    setDeletingCategoryId(category.id)

    try {
      // Primero se eliminan la categoría y sus productos en el servidor.
      await deleteCategory(category.id)

      // Después actualizamos el catálogo local para que desaparezcan
      // inmediatamente de Gestión de productos y del TPV.
      const updatedProducts = products.filter(
        (product) => product.category !== category.id
      )

      onProductsChange(updatedProducts)

      if (categoryFilter === category.id) {
        setCategoryFilter('all')
      }

      // Si se estaba editando un producto de esa categoría,
      // cerramos el formulario porque ese producto ya no existe.
      const editingProductWasDeleted = assignedProducts.some(
        (product) => product.id === editingId
      )

      if (editingProductWasDeleted) {
        closeForm()
      } else if (form.category === category.id) {
        setForm((current) => ({
          ...current,
          category:
            availableCategories.find(
              (item) => item.id !== category.id
            )?.id || 'burgers',
        }))
      }

      setCategoryToDelete(null)
      setCategoryActionError('')
    } catch (error) {
      setCategoryActionError(
        error.message || 'No se pudo eliminar la categoría y sus productos.'
      )
      setCategoryToDelete(null)
    } finally {
      setDeletingCategoryId(null)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const name = form.name.trim()
    const price = Number(form.price)

    if (!name) {
      setFormError('Ingresá el nombre del producto.')
      return
    }

    if (!Number.isFinite(price) || price <= 0) {
      setFormError('Ingresá un precio válido mayor que cero.')
      return
    }

    if (
      !availableCategories.some(
        (category) => category.id === form.category
      )
    ) {
      setFormError('Seleccioná una categoría válida.')
      return
    }

    if (editingId !== null) {
      const updatedProducts = products.map((product) =>
        product.id === editingId
          ? {
              ...product,
              name,
              price: Number(price.toFixed(2)),
              category: form.category,
              emoji: form.emoji.trim() || '🛍️',
              seniorDiscountEligible:
                form.seniorDiscountEligible === true,
            }
          : product
      )

      onProductsChange(updatedProducts)
    } else {
      const nextId =
        products.reduce(
          (highest, product) =>
            Math.max(highest, Number(product.id) || 0),
          0
        ) + 1

      const newProduct = {
        id: nextId,
        name,
        price: Number(price.toFixed(2)),
        category: form.category,
        emoji: form.emoji.trim() || '🛍️',
        active: true,
        seniorDiscountEligible:
          form.seniorDiscountEligible === true,
      }

      onProductsChange([...products, newProduct])
    }

    closeForm()
  }

  const toggleProductStatus = (productId) => {
    const updatedProducts = products.map((product) =>
      product.id === productId
        ? { ...product, active: product.active === false }
        : product
    )

    onProductsChange(updatedProducts)
  }

  const productsToDeleteCount = categoryToDelete
    ? products.filter(
        (product) => product.category === categoryToDelete.id
      ).length
    : 0

  return (
    <main className="mx-auto max-w-7xl p-5 lg:p-8">
      {/* Encabezado */}
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">
            Gestión de productos
          </h2>

          <p className="mt-1 text-sm text-[#89877e]">
            Administrá el catálogo, los precios y las categorías de Lubinin.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewProductForm}
          className="rounded-xl bg-[#c18b45] px-5 py-3 font-bold text-white shadow-sm transition hover:bg-[#a97735]"
        >
          + Nuevo producto
        </button>
      </div>

      {/* Resumen */}
      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-[#26332d] p-5 text-white">
          <p className="text-sm text-white/70">
            Total de productos
          </p>

          <p className="mt-2 text-3xl font-extrabold">
            {products.length}
          </p>
        </div>

        <div className="rounded-2xl border border-[#e8e4da] bg-white p-5">
          <p className="text-sm text-[#89877e]">
            Productos activos
          </p>

          <p className="mt-2 text-3xl font-extrabold text-green-700">
            {activeCount}
          </p>
        </div>

        <div className="rounded-2xl border border-[#e8e4da] bg-white p-5">
          <p className="text-sm text-[#89877e]">
            Productos inactivos
          </p>

          <p className="mt-2 text-3xl font-extrabold text-[#89877e]">
            {inactiveCount}
          </p>
        </div>
      </div>

      {/* Gestión de categorías */}
      <div className="mb-6 rounded-2xl border border-[#e8e4da] bg-white p-5">
        <div className="mb-4">
          <h3 className="text-lg font-bold">
            Categorías
          </h3>

          <p className="mt-1 text-sm text-[#89877e]">
            Administrá las categorías que aparecen en el punto de venta.
          </p>
        </div>

        {categoryActionError && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
            {categoryActionError}
          </p>
        )}

        {availableCategories.length === 0 ? (
          <p className="text-sm text-[#89877e]">
            No hay categorías disponibles.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableCategories.map((category) => {
              const assignedCount = products.filter(
                (product) => product.category === category.id
              ).length

              return (
                <div
                  key={category.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#eeeae2] p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-2xl">
                      {category.icon || '📦'}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#26332d]">
                        {category.name}
                      </p>

                      <p className="text-xs text-[#89877e]">
                        {assignedCount} producto(s)
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(category)}
                    disabled={deletingCategoryId !== null}
                    title="Eliminar categoría y sus productos"
                    className="shrink-0 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingCategoryId === category.id
                      ? 'Eliminando...'
                      : 'Eliminar'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-[#e8e4da] bg-white p-5 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-semibold">
            Buscar producto
          </label>

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ej. Hamburguesa..."
            className="w-full rounded-xl border border-[#e8e4da] px-4 py-3 outline-none focus:border-[#c18b45]"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">
            Categoría
          </label>

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="w-full rounded-xl border border-[#e8e4da] bg-white px-4 py-3 outline-none focus:border-[#c18b45]"
          >
            <option value="all">Todas las categorías</option>

            {availableCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">
            Estado
          </label>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="w-full rounded-xl border border-[#e8e4da] bg-white px-4 py-3 outline-none focus:border-[#c18b45]"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
      </div>

      {/* Listado */}
      <div className="overflow-hidden rounded-2xl border border-[#e8e4da] bg-white">
        <div className="flex items-center justify-between border-b border-[#eeeae2] p-5">
          <div>
            <h3 className="text-lg font-bold">
              Catálogo de productos
            </h3>

            <p className="mt-1 text-sm text-[#89877e]">
              {filteredProducts.length} productos encontrados
            </p>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-4xl">📦</p>

            <p className="mt-4 font-semibold">
              No se encontraron productos
            </p>

            <p className="mt-1 text-sm text-[#89877e]">
              Probá cambiando los filtros o creando un producto nuevo.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#eeeae2]">
            {filteredProducts.map((product) => {
              const isActive = product.active !== false

              return (
                <div
                  key={product.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-5 transition hover:bg-[#fcfbf8]"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#f5f3ee] text-3xl">
                      {product.emoji || '🛍️'}
                    </div>

                    <div className="min-w-0">
                      <p
                        className={`font-bold ${
                          isActive ? 'text-[#26332d]' : 'text-[#99958b]'
                        }`}
                      >
                        {product.name}
                      </p>

                      <p className="mt-1 text-sm text-[#89877e]">
                        {getCategoryName(product.category)}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {isActive ? 'Activo' : 'Inactivo'}
                        </span>

                        {product.seniorDiscountEligible === true && (
                          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                            Admite descuento del 5 %
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <p className="text-lg font-extrabold text-[#26332d]">
                      {formatPrice(product.price)}
                    </p>

                    <button
                      type="button"
                      onClick={() => openEditForm(product)}
                      className="rounded-lg border border-[#e8e4da] px-3 py-2 text-sm font-semibold transition hover:bg-[#f5f3ee]"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleProductStatus(product.id)}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        isActive
                          ? 'bg-red-50 text-red-700 hover:bg-red-100'
                          : 'bg-green-50 text-green-700 hover:bg-green-100'
                      }`}
                    >
                      {isActive ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Formulario de producto */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-[#26332d]">
                  {editingId !== null ? 'Editar producto' : 'Nuevo producto'}
                </h3>

                <p className="mt-1 text-sm text-[#89877e]">
                  Completá los datos del producto.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-gray-500 hover:bg-gray-100"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Nombre del producto
                </label>

                <input
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="Ej. Hamburguesa especial"
                  maxLength={80}
                  required
                  className="w-full rounded-xl border border-[#e8e4da] px-4 py-3 outline-none focus:border-[#c18b45]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Precio (€)
                </label>

                <input
                  type="number"
                  value={form.price}
                  onChange={(event) =>
                    setForm({ ...form, price: event.target.value })
                  }
                  placeholder="Ej. 5.50"
                  min="0.01"
                  max="999999"
                  step="0.01"
                  required
                  className="w-full rounded-xl border border-[#e8e4da] px-4 py-3 outline-none focus:border-[#c18b45]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Categoría
                </label>

                <select
                  value={form.category}
                  onChange={(event) => {
                    if (event.target.value === '__new__') {
                      setShowCategoryCreator(true)
                      setCategoryError('')
                      return
                    }

                    setForm({
                      ...form,
                      category: event.target.value,
                    })

                    setShowCategoryCreator(false)
                  }}
                  className="w-full rounded-xl border border-[#e8e4da] bg-white px-4 py-3 outline-none focus:border-[#c18b45]"
                >
                  {availableCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}

                  <option value="__new__">
                    + Crear nueva categoría
                  </option>
                </select>
              </div>

              {showCategoryCreator && (
                <div className="space-y-3 rounded-xl border border-[#e8e4da] bg-[#fcfbf8] p-4">
                  <p className="text-sm font-bold text-[#26332d]">
                    Nueva categoría
                  </p>

                  <div>
                    <label className="mb-2 block text-sm font-semibold">
                      Nombre
                    </label>

                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(event) =>
                        setNewCategoryName(event.target.value)
                      }
                      placeholder="Ej. Churros"
                      maxLength={40}
                      className="w-full rounded-xl border border-[#e8e4da] bg-white px-4 py-3 outline-none focus:border-[#c18b45]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold">
                      Emoji
                    </label>

                    <input
                      type="text"
                      value={newCategoryIcon}
                      onChange={(event) =>
                        setNewCategoryIcon(event.target.value)
                      }
                      placeholder="Ej. 🥨"
                      maxLength={8}
                      className="w-full rounded-xl border border-[#e8e4da] bg-white px-4 py-3 outline-none focus:border-[#c18b45]"
                    />
                  </div>

                  {categoryError && (
                    <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
                      {categoryError}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCategoryCreator(false)
                        setCategoryError('')
                      }}
                      className="flex-1 rounded-xl border border-[#e8e4da] py-2.5 text-sm font-semibold text-[#66685f]"
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      disabled={isCreatingCategory}
                      className="flex-1 rounded-xl bg-[#26332d] py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {isCreatingCategory ? 'Creando...' : 'Crear categoría'}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Emoji del producto
                </label>

                <input
                  type="text"
                  value={form.emoji}
                  onChange={(event) =>
                    setForm({ ...form, emoji: event.target.value })
                  }
                  placeholder="Ej. 🍔"
                  maxLength={8}
                  className="w-full rounded-xl border border-[#e8e4da] px-4 py-3 outline-none focus:border-[#c18b45]"
                />

                <p className="mt-1 text-xs text-[#89877e]">
                  Podés utilizar un emoji para identificar el producto en el TPV.
                </p>
              </div>

              {/* Elegibilidad para descuento */}
              <div className="rounded-xl border border-[#e8e4da] bg-[#fcfbf8] p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={form.seniorDiscountEligible}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        seniorDiscountEligible: event.target.checked,
                      })
                    }
                    className="mt-1 h-4 w-4 accent-[#c18b45]"
                  />

                  <span>
                    <span className="block text-sm font-bold text-[#26332d]">
                      Admite descuento para jubilados y pensionados
                    </span>

                    <span className="mt-1 block text-xs leading-relaxed text-[#89877e]">
                      Si activás esta opción, el producto tendrá un descuento
                      del 5 % cuando se indique que el cliente es jubilado o pensionado.
                    </span>
                  </span>
                </label>
              </div>

              {formError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
                  {formError}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 rounded-xl border border-[#e8e4da] py-3 font-semibold text-[#66685f] transition hover:bg-[#f5f3ee]"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-[#c18b45] py-3 font-bold text-white transition hover:bg-[#a97735]"
                >
                  {editingId !== null ? 'Guardar cambios' : 'Crear producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmación personalizada para eliminar categoría */}
      {categoryToDelete && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              deletingCategoryId === null
            ) {
              setCategoryToDelete(null)
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-category-title"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="px-6 pb-5 pt-7 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl">
                🗑️
              </div>

              <h3
                id="delete-category-title"
                className="mt-4 text-xl font-extrabold text-[#26332d]"
              >
                Eliminar categoría
              </h3>

              <p className="mt-2 text-sm text-[#89877e]">
                ¿Estás seguro de que querés eliminar esta categoría?
              </p>

              <div className="mt-5 rounded-xl border border-[#eeeae2] bg-[#fcfbf8] p-4 text-left">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">
                    {categoryToDelete.icon || '📦'}
                  </span>

                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#89877e]">
                      Categoría seleccionada
                    </p>

                    <p className="mt-1 break-words font-bold text-[#26332d]">
                      {categoryToDelete.name}
                    </p>
                  </div>
                </div>

                <div className="mt-4 border-t border-[#e8e4da] pt-4">
                  <p className="text-sm font-semibold text-[#26332d]">
                    {productsToDeleteCount === 1
                      ? 'Se eliminará 1 producto.'
                      : `Se eliminarán ${productsToDeleteCount} productos.`}
                  </p>

                  <p className="mt-2 text-xs leading-relaxed text-[#89877e]">
                    Los productos de esta categoría también se eliminarán
                    permanentemente del catálogo. Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-xl bg-green-50 p-3 text-left">
                <span className="text-base">✓</span>

                <p className="text-xs leading-relaxed text-green-800">
                  Las ventas históricas y sus detalles se conservarán.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-[#eeeae2] bg-[#fcfbf8] p-5 sm:flex-row">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                disabled={deletingCategoryId !== null}
                className="flex-1 rounded-xl border border-[#e8e4da] bg-white px-4 py-3 font-semibold text-[#66685f] transition hover:bg-[#f5f3ee] disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmDeleteCategory}
                disabled={deletingCategoryId !== null}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingCategoryId === categoryToDelete.id
                  ? 'Eliminando...'
                  : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Products
