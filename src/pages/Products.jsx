
import { useMemo, useState } from 'react'

import { categories } from '../data/categories'

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
}

function Products({ products, onProductsChange }) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')

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
      availableCategories.find((category) => category.id === categoryId)
        ?.name || 'Sin categoría'
    )
  }

  const openNewProductForm = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setShowForm(true)
  }

  const openEditForm = (product) => {
    setEditingId(product.id)

    setForm({
      name: product.name,
      price: String(product.price),
      category: product.category,
      emoji: product.emoji || '🛍️',
    })

    setFormError('')
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
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

    if (!availableCategories.some((category) => category.id === form.category)) {
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
                {category.name}
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
                      <p className={`font-bold ${
                        isActive ? 'text-[#26332d]' : 'text-[#99958b]'
                      }`}>
                        {product.name}
                      </p>

                      <p className="mt-1 text-sm text-[#89877e]">
                        {getCategoryName(product.category)}
                      </p>

                      <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {isActive ? 'Activo' : 'Inactivo'}
                      </span>
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
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value })
                  }
                  className="w-full rounded-xl border border-[#e8e4da] bg-white px-4 py-3 outline-none focus:border-[#c18b45]"
                >
                  {availableCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

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

    </main>
  )
}

export default Products
