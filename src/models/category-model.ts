import { Category, CategoryTranslation } from '@prisma/client'

export interface CreateCategoryRequest {
  name: string
}

export interface UpdateCategoryRequest {
  name?: string
}

export type CategoryResponse = {
  id: string
  name: string
}

export type CategoryListResponse = {
  categories: CategoryResponse[]
  pagination: {
    totalData: number
    page: number
    limit: number
    totalPage: number
  }
}

function resolveCategoryName(translations: CategoryTranslation[]): string {
  const indonesian = translations.find((translation) => translation.languageCode === 'id')
  if (indonesian) return indonesian.name

  return translations[0]?.name ?? ''
}

export const toCategoryResponse = (category: Category & { translations: CategoryTranslation[] }): CategoryResponse => ({
  id: category.id,
  name: resolveCategoryName(category.translations)
})

export const toCategoryListResponse = (
  categories: Array<Category & { translations: CategoryTranslation[] }>,
  total: number,
  page: number,
  limit: number
): CategoryListResponse => ({
  categories: categories.map(toCategoryResponse),
  pagination: {
    totalData: total,
    page,
    limit,
    totalPage: Math.ceil(total / limit)
  }
})
