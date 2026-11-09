import { useCallback, useEffect, useRef, useState } from 'react'

import { categories as defaultCategories } from '../data/categories'

import {
  getRemoteCategories,
  createRemoteCategory,
  deleteRemoteCategory,
} from '../services/categoriesService'

const STORAGE_KEY = 'lubinin_categories'

const initialCategories = defaultCategories.filter(
  (category) => category.id !== 'all'
)

function getSavedCategories() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)

    if (!saved) return initialCategories

    const parsed = JSON.parse(saved)

    if (!Array.isArray(parsed)) return initialCategories

    return parsed
  } catch (error) {
    console.error('Error recuperando categorías:', error)
    return initialCategories
  }
}

function saveCategories(categoriesToSave) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(categoriesToSave)
    )
  } catch (error) {
    console.error('Error guardando categorías:', error)
  }
}

function mergeCategories(...lists) {
  const result = new Map()

  for (const list of lists) {
    for (const category of list) {
      if (!category?.id || category.deleted === true) continue

      const previous = result.get(category.id)

      result.set(category.id, {
        ...previous,
        ...category,
      })
    }
  }

  return Array.from(result.values()).sort(
    (a, b) => (a.order || 100) - (b.order || 100)
  )
}

function getVisibleCategories(savedCategories) {
  const deletedIds = new Set(
    savedCategories
      .filter((category) => category.deleted === true)
      .map((category) => category.id)
  )

  return mergeCategories(
    initialCategories,
    savedCategories
  ).filter((category) => !deletedIds.has(category.id))
}

function createCategoryId(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function useCategories() {
  const [categories, setCategories] = useState(() =>
    getVisibleCategories(getSavedCategories())
  )

  const syncing = useRef(false)

  const updateSavedCategories = useCallback((nextCategories) => {
    saveCategories(nextCategories)
    setCategories(getVisibleCategories(nextCategories))
  }, [])

  const syncPendingCategories = useCallback(async () => {
    if (!navigator.onLine || syncing.current) return

    syncing.current = true

    try {
      // Primero sincronizar las eliminaciones pendientes.
      let current = getSavedCategories()

      const pendingDeletes = current.filter(
        (category) =>
          category.deleted === true &&
          category.pendingDeleteSync === true
      )

      for (const category of pendingDeletes) {
        try {
          await deleteRemoteCategory(category.id)

          current = getSavedCategories()

          updateSavedCategories(
            current.map((item) =>
              item.id === category.id
                ? {
                    ...item,
                    pendingDeleteSync: false,
                  }
                : item
            )
          )
        } catch (error) {
          // Si ya no existe en el servidor, la eliminación está cumplida.
          if (error.status === 404) {
            current = getSavedCategories()

            updateSavedCategories(
              current.map((item) =>
                item.id === category.id
                  ? {
                      ...item,
                      pendingDeleteSync: false,
                    }
                  : item
              )
            )

            continue
          }

          console.error(
            `No se pudo eliminar la categoría ${category.name}:`,
            error
          )
        }
      }

      // Después sincronizar las categorías nuevas.
      current = getSavedCategories()

      const pendingCategories = current.filter(
        (category) =>
          category.pendingSync === true &&
          category.deleted !== true
      )

      for (const category of pendingCategories) {
        try {
          const remoteCategory = await createRemoteCategory(category)

          current = getSavedCategories()

          updateSavedCategories(
            current.map((item) =>
              item.id === category.id
                ? {
                    ...remoteCategory,
                    pendingSync: false,
                  }
                : item
            )
          )
        } catch (error) {
          if (error.status === 409) {
            try {
              const remoteCategories = await getRemoteCategories()

              const existing = remoteCategories.find(
                (item) => item.id === category.id
              )

              if (existing) {
                current = getSavedCategories()

                updateSavedCategories(
                  current.map((item) =>
                    item.id === category.id
                      ? {
                          ...existing,
                          pendingSync: false,
                        }
                      : item
                  )
                )

                continue
              }
            } catch (refreshError) {
              console.error(
                'No se pudo comprobar la categoría:',
                refreshError
              )
            }
          }

          console.error(
            `No se pudo sincronizar la categoría ${category.name}:`,
            error
          )
        }
      }
    } finally {
      syncing.current = false
    }
  }, [updateSavedCategories])

  useEffect(() => {
    let mounted = true

    const loadCategories = async () => {
      if (!navigator.onLine) return

      try {
        const remoteCategories = await getRemoteCategories()

        if (!mounted) return

        const localCategories = getSavedCategories()

        const pendingCategories = localCategories.filter(
          (category) =>
            category.pendingSync === true &&
            category.deleted !== true
        )

        const deletedCategories = localCategories.filter(
          (category) => category.deleted === true
        )

        const merged = mergeCategories(
          remoteCategories,
          pendingCategories
        )

        // Conservar las marcas de eliminación locales.
        const saved = [
          ...merged,
          ...deletedCategories,
        ]

        updateSavedCategories(saved)

        await syncPendingCategories()
      } catch (error) {
        console.error(
          'No se pudieron cargar las categorías remotas:',
          error
        )
      }
    }

    const handleOnline = () => {
      loadCategories()
      syncPendingCategories()
    }

    loadCategories()

    window.addEventListener('online', handleOnline)

    return () => {
      mounted = false
      window.removeEventListener('online', handleOnline)
    }
  }, [syncPendingCategories, updateSavedCategories])

  const addCategory = useCallback(
    async (name, icon) => {
      const cleanName = name.trim()
      const cleanIcon = icon.trim() || '📦'

      if (!cleanName) {
        throw new Error('Ingresá el nombre de la categoría.')
      }

      if (cleanName.length > 40) {
        throw new Error(
          'El nombre no puede superar los 40 caracteres.'
        )
      }

      const id = createCategoryId(cleanName)

      if (!id) {
        throw new Error('El nombre de la categoría no es válido.')
      }

      const currentCategories = getSavedCategories()

      const alreadyExists = currentCategories.some(
        (category) =>
          category.id === id ||
          (
            category.deleted !== true &&
            category.name.toLowerCase() === cleanName.toLowerCase()
          )
      )

      if (alreadyExists) {
        throw new Error('Ya existe una categoría con ese nombre o identificador.')
      }

      const newCategory = {
        id,
        name: cleanName,
        icon: cleanIcon,
        order:
          Math.max(
            0,
            ...currentCategories.map(
              (category) => Number(category.order) || 0
            )
          ) + 1,
        pendingSync: true,
      }

      updateSavedCategories([
        ...currentCategories,
        newCategory,
      ])

      if (navigator.onLine) {
        try {
          const remoteCategory = await createRemoteCategory(newCategory)

          const latest = getSavedCategories()

          updateSavedCategories(
            latest.map((category) =>
              category.id === id
                ? {
                    ...remoteCategory,
                    pendingSync: false,
                  }
                : category
            )
          )

          return remoteCategory
        } catch (error) {
          if (error.status === 409) {
            throw error
          }

          console.warn(
            'Categoría guardada localmente. Pendiente de sincronización.'
          )
        }
      }

      return newCategory
    },
    [updateSavedCategories]
  )

  const deleteCategory = useCallback(
    async (categoryId) => {
      if (!categoryId || categoryId === 'all') {
        throw new Error('No se puede eliminar esta categoría.')
      }

      const current = getSavedCategories()

      const category = current.find(
        (item) =>
          item.id === categoryId &&
          item.deleted !== true
      )

      if (!category) {
        throw new Error('La categoría ya no existe.')
      }

      const tombstone = {
        ...category,
        deleted: true,
        pendingDeleteSync: true,
        pendingSync: false,
      }

      const updated = [
        ...current.filter((item) => item.id !== categoryId),
        tombstone,
      ]

      // Ocultar inmediatamente y conservar la marca de eliminación.
      updateSavedCategories(updated)

      if (navigator.onLine) {
        try {
          await deleteRemoteCategory(categoryId)

          const latest = getSavedCategories()

          updateSavedCategories(
            latest.map((item) =>
              item.id === categoryId
                ? {
                    ...item,
                    pendingDeleteSync: false,
                  }
                : item
            )
          )
        } catch (error) {
          // Si el servidor confirma que ya no existe, no queda pendiente.
          if (error.status === 404) {
            const latest = getSavedCategories()

            updateSavedCategories(
              latest.map((item) =>
                item.id === categoryId
                  ? {
                      ...item,
                      pendingDeleteSync: false,
                    }
                  : item
              )
            )

            return category
          }

          // Si el servidor impide eliminarla por tener productos,
          // restaurar la categoría en el listado local.
          if (error.status === 409 || error.status === 400) {
            const latest = getSavedCategories()

            updateSavedCategories(
              latest.filter((item) => item.id !== categoryId)
            )

            throw error
          }

          console.warn(
            'Categoría eliminada localmente. Pendiente de sincronización.'
          )
        }
      }

      return category
    },
    [updateSavedCategories]
  )

  return {
    categories: getVisibleCategories(getSavedCategories()),
    addCategory,
    deleteCategory,
  }
}

export default useCategories