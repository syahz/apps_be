import { Validation } from '../validation/Validation'
import { prismaClient } from '../application/database'
import { ResponseError } from '../error/response-error'
import {
  CreateCategoryRequest,
  UpdateCategoryRequest,
  CategoryResponse,
  CategoryListResponse,
  toCategoryResponse,
  toCategoryListResponse
} from '../models/category-model'
import { CategoryValidation } from '../validation/category-validation'

const normalizeName = (value: string) => value.trim()

export const createCategory = async (request: CreateCategoryRequest): Promise<CategoryResponse> => {
  const createRequest = Validation.validate(CategoryValidation.CREATE, request)
  createRequest.name = normalizeName(createRequest.name)

  const existingCategory = await prismaClient.categoryArticle.findFirst({
    where: { name: createRequest.name }
  })
  if (existingCategory) {
    throw new ResponseError(409, 'Nama kategori sudah digunakan')
  }

  const category = await prismaClient.categoryArticle.create({ data: { name: createRequest.name } })
  return toCategoryResponse(category)
}

export const getCategories = async (page: number, limit: number, search: string): Promise<CategoryListResponse> => {
  const skip = (page - 1) * limit
  const where = search
    ? {
        name: {
          contains: search
        }
      }
    : {}

  const [total, categories] = await prismaClient.$transaction([
    prismaClient.categoryArticle.count({ where }),
    prismaClient.categoryArticle.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } })
  ])

  return toCategoryListResponse(categories, total, page, limit)
}

export const getAllCategories = async (): Promise<CategoryResponse[]> => {
  const categories = await prismaClient.categoryArticle.findMany({ orderBy: { name: 'asc' } })
  return categories.map(toCategoryResponse)
}

export const getCategoryById = async (categoryId: string): Promise<CategoryResponse> => {
  const category = await prismaClient.categoryArticle.findUnique({ where: { id: categoryId } })
  if (!category) {
    throw new ResponseError(404, 'Kategori tidak ditemukan')
  }
  return toCategoryResponse(category)
}

export const updateCategory = async (categoryId: string, request: UpdateCategoryRequest): Promise<CategoryResponse> => {
  const updateRequest = Validation.validate(CategoryValidation.UPDATE, request)

  const category = await prismaClient.categoryArticle.findUnique({ where: { id: categoryId } })
  if (!category) {
    throw new ResponseError(404, 'Kategori tidak ditemukan')
  }

  if (updateRequest.name) {
    updateRequest.name = normalizeName(updateRequest.name)
    const existingCategory = await prismaClient.categoryArticle.findFirst({
      where: {
        AND: [{ id: { not: categoryId } }, { name: updateRequest.name }]
      }
    })
    if (existingCategory) {
      throw new ResponseError(409, 'Nama kategori sudah digunakan oleh kategori lain')
    }
  }

  const updatedCategory = await prismaClient.categoryArticle.update({
    where: { id: categoryId },
    data: updateRequest
  })

  return toCategoryResponse(updatedCategory)
}

export const deleteCategory = async (categoryId: string): Promise<{ message: string }> => {
  const category = await prismaClient.categoryArticle.findUnique({ where: { id: categoryId } })
  if (!category) {
    throw new ResponseError(404, 'Kategori tidak ditemukan')
  }

  const [usageIdn, usageEng] = await prismaClient.$transaction([
    prismaClient.publicationIdn.count({ where: { categories: { some: { id: categoryId } } } }),
    prismaClient.publicationEng.count({ where: { categories: { some: { id: categoryId } } } })
  ])

  if (usageIdn > 0 || usageEng > 0) {
    throw new ResponseError(400, 'Kategori tidak dapat dihapus karena masih terhubung dengan artikel')
  }

  await prismaClient.categoryArticle.delete({ where: { id: categoryId } })
  return { message: 'Kategori berhasil dihapus' }
}
