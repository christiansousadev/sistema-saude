'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UsePaginationOptions<T> {
  /** Função que busca uma página de itens */
  fetcher: (skip: number, limit: number) => Promise<{ items: T[]; total: number }>
  /** Itens por página (padrão: 20) */
  pageSize?: number
}

interface UsePaginationResult<T> {
  items: T[]
  total: number
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: string | null
  loadMore: () => Promise<void>
  reload: () => void
  /** Atualiza um item existente pelo predicado */
  updateItem: (predicate: (item: T) => boolean, updater: (item: T) => T) => void
  /** Remove um item pelo predicado */
  removeItem: (predicate: (item: T) => boolean) => void
  /** Adiciona um item no início da lista */
  prependItem: (item: T) => void
}

/**
 * M-4: Hook de paginação com "Ver mais" para o histórico de registros.
 *
 * Gerencia o carregamento incremental de itens da API,
 * expondo loadMore(), updateItem(), removeItem() e prependItem()
 * para mutações locais sem refetch completo.
 */
export function usePagination<T>({
  fetcher,
  pageSize = 20,
}: UsePaginationOptions<T>): UsePaginationResult<T> {
  const [items, setItems] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const skipRef = useRef(0)
  const loadingRef = useRef(false)

  const load = useCallback(
    async (skip: number, append: boolean) => {
      if (loadingRef.current) return
      loadingRef.current = true
      if (!append) setIsLoading(true)
      else setIsLoadingMore(true)
      setError(null)

      try {
        const result = await fetcher(skip, pageSize)
        setTotal(result.total)
        setItems(prev => append ? [...prev, ...result.items] : result.items)
        skipRef.current = skip + result.items.length
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'erro ao carregar'
        setError(msg)
      } finally {
        if (!append) setIsLoading(false)
        else setIsLoadingMore(false)
        loadingRef.current = false
      }
    },
    [fetcher, pageSize],
  )

  // carregamento inicial — roda uma vez após a montagem, nunca durante a fase de render
  useEffect(() => {
    void load(0, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadMore = useCallback(async () => {
    await load(skipRef.current, true)
  }, [load])

  const reload = useCallback(() => {
    skipRef.current = 0
    void load(0, false)
  }, [load])

  const updateItem = useCallback(
    (predicate: (item: T) => boolean, updater: (item: T) => T) => {
      setItems(prev => prev.map(item => predicate(item) ? updater(item) : item))
    },
    [],
  )

  const removeItem = useCallback((predicate: (item: T) => boolean) => {
    setItems(prev => prev.filter(item => !predicate(item)))
    setTotal(prev => Math.max(0, prev - 1))
  }, [])

  const prependItem = useCallback((item: T) => {
    setItems(prev => [item, ...prev])
    setTotal(prev => prev + 1)
  }, [])

  const hasMore = items.length < total

  return {
    items,
    total,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    reload,
    updateItem,
    removeItem,
    prependItem,
  }
}
