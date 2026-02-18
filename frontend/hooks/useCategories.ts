'use client'

import { useQuery } from '@tanstack/react-query'
import { getBackendUrl } from '@/lib/contracts/addresses'

/**
 * Category configuration from backend
 * Represents a betting category (e.g., crypto, predictions)
 */
export interface Category {
  id: string                    // 'crypto', 'predictions', etc.
  name: string                  // 'Cryptocurrency'
  emoji: string                 // '🪙'
  sources: string[]             // ['coingecko', 'polymarket']
  snapshotFrequency: string     // 'hourly', 'daily'
  rankingMethod: string         // 'market_cap', 'volume', etc.
  isActive: boolean
}

/**
 * Response from GET /api/categories
 */
interface CategoriesResponse {
  categories: Category[]
}

/**
 * Fetches all categories from backend
 */
async function fetchCategories(): Promise<Category[]> {
  const backendUrl = getBackendUrl()
  const response = await fetch(`${backendUrl}/api/categories`)

  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.statusText}`)
  }

  const data: CategoriesResponse = await response.json()
  return data.categories || []
}

interface UseCategoriesReturn {
  categories: Category[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Hook for fetching all available betting categories
 * Categories are cached for 5 minutes since they rarely change
 * @returns Categories array, loading state, and error state
 */
export function useCategories(): UseCategoriesReturn {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes (categories rarely change)
  })

  return {
    categories: data ?? [],
    isLoading,
    isError,
    error: error as Error | null,
    refetch
  }
}

/**
 * Hook for getting a specific category by ID
 * @param categoryId - The category ID to find
 * @returns The category if found, undefined otherwise
 */
export function useCategoryById(categoryId: string | undefined): Category | undefined {
  const { categories } = useCategories()
  if (!categoryId) return undefined
  return categories.find(c => c.id === categoryId)
}

/**
 * Format category for display with emoji
 * @param category - Category object
 * @returns Formatted string like "🪙 Crypto"
 */
export function formatCategoryDisplay(category: Category): string {
  return `${category.emoji} ${category.name}`
}
