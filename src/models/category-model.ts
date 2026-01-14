import { CategoryArticle } from '@prisma/client'

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

export const toCategoryResponse = (category: CategoryArticle): CategoryResponse => ({
  id: category.id,
  name: category.name
})

export const toCategoryListResponse = (categories: CategoryArticle[], total: number, page: number, limit: number): CategoryListResponse => ({
  categories: categories.map(toCategoryResponse),
  pagination: {
    totalData: total,
    page,
    limit,
    totalPage: Math.ceil(total / limit)
  }
})
