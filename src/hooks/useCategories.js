
import { useCallback, useEffect, useRef, useState } from 'react'

import { categories as defaultCategories } from '../data/categories'

import {
  getRemoteCategories,
  createRemoteCategory,
} from '../services/categoriesService'

const STORAGE_KEY = 'lubinin_categories'

function getSavedCategories() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)

    if (!saved) {
      return defaultCategories.filter(
        (category) => category.id !== 'all'
      )
    }

    const parsed = JSON.parse(saved)

    if (!Array.isArray(parsed)) {
      return defaultCategories.filter(
        (category) => category.id !== 'all'
      )
    }

    return parsed
  } catch (error) {
    console.error('Error recuperando categorías:', error)

    return defaultCategories.filter(
      (category) => category.id !== 'all'
    )
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
      if (!category?.id) continue

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
    mergeCategories(
      defaultCategories.filter(
        (category) => category.id !== 'all'
      ),
      getSavedCategories()
    )
  )

  const syncing = useRef(false)

  const updateCategories = useCallback((nextCategories) => {
    const merged = mergeCategories(nextCategories)

    setCategories(merged)
    saveCategories(merged)
  }, [])

  const syncPendingCategories = useCallback(async () => {
    if (!navigator.onLine || syncing.current) return

    syncing.current = true

    try {
      const savedCategories = getSavedCategories()

      const pendingCategories = savedCategories.filter(
        (category) => category.pendingSync === true
      )

      for (const category of pendingCategories) {
        try {
          const remoteCategory = await createRemoteCategory(category)

          const current = getSavedCategories()

          const updated = current.map((item) =>
            item.id === category.id
              ? {
                  ...remoteCategory,
                  pendingSync: false,
                }
              : item
          )

          updateCategories(updated)
        } catch (error) {
          // Si ya existe en MongoDB, comprobar si podemos recuperarla.
          if (error.message?.includes('Ya existe')) {
            try {
              const remoteCategories = await getRemoteCategories()

              const existing = remoteCategories.find(
                (item) => item.id === category.id
              )

              if (existing) {
                const current = getSavedCategories()

                updateCategories(
                  current.map((item) =>
                    item.id === category.id
                      ? { ...existing, pendingSync: false }
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
  }, [updateCategories])

  useEffect(() => {
    let mounted = true

    const loadCategories = async () => {
      if (!navigator.onLine) return

      try {
        const remoteCategories = await getRemoteCategories()

        if (!mounted) return

        const localCategories = getSavedCategories()

        const pendingCategories = localCategories.filter(
          (category) => category.pendingSync === true
        )

        const merged = mergeCategories(
          remoteCategories,
          pendingCategories
        )

        updateCategories(merged)

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
  }, [syncPendingCategories, updateCategories])

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
          category.name.toLowerCase() === cleanName.toLowerCase()
      )

      if (alreadyExists) {
        throw new Error('Ya existe una categoría con ese nombre.')
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

      const updated = [...currentCategories, newCategory]

      updateCategories(updated)

      if (navigator.onLine) {
        try {
          const remoteCategory = await createRemoteCategory(newCategory)

          const latest = getSavedCategories()

          updateCategories(
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
          // Si falla la conexión, queda guardada localmente
          // y se sincronizará cuando vuelva Internet.
          if (error.message?.includes('Ya existe')) {
            const remoteCategories = await getRemoteCategories()

            const existing = remoteCategories.find(
              (category) => category.id === id
            )

            if (existing) {
              const latest = getSavedCategories()

              updateCategories(
                latest.map((category) =>
                  category.id === id
                    ? { ...existing, pendingSync: false }
                    : category
                )
              )

              return existing
            }

            throw error
          }

          console.warn(
            'Categoría guardada localmente. Pendiente de sincronización.'
          )
        }
      }

      return newCategory
    },
    [updateCategories]
  )

  return {
    categories: mergeCategories(
      defaultCategories.filter(
        (category) => category.id !== 'all'
      ),
      categories
    ),
    addCategory,
  }
}

export default useCategories
