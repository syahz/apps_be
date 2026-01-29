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

async function assertNameUnique(name: string, excludeCategoryId?: string) {
  const existing = await prismaClient.categoryTranslation.findFirst({
    where: {
      languageCode: 'id',
      name,
      ...(excludeCategoryId ? { categoryId: { not: excludeCategoryId } } : {})
    }
  })

  if (existing) {
    throw new ResponseError(409, 'Nama kategori sudah digunakan')
  }
}

export const createCategory = async (request: CreateCategoryRequest): Promise<CategoryResponse> => {
  const createRequest = Validation.validate(CategoryValidation.CREATE, request)
  createRequest.name = normalizeName(createRequest.name)

  await assertNameUnique(createRequest.name)

  const category = await prismaClient.category.create({
    data: {
      translations: {
        create: [
          { languageCode: 'id', name: createRequest.name },
          { languageCode: 'en', name: createRequest.name },
          { languageCode: 'zh', name: createRequest.name }
        ]
      }
    },
    include: { translations: true }
  })

  return toCategoryResponse(category)
}

export const getCategories = async (page: number, limit: number, search: string): Promise<CategoryListResponse> => {
  const skip = (page - 1) * limit
  const where = search
    ? {
        languageCode: 'id',
        name: {
          contains: search
        }
      }
    : { languageCode: 'id' }

  const [total, translations] = await prismaClient.$transaction([
    prismaClient.categoryTranslation.count({ where }),
    prismaClient.categoryTranslation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: { category: { include: { translations: true } } }
    })
  ])

  const categories = translations.map((translation) => ({ ...translation.category, translations: translation.category.translations }))
  return toCategoryListResponse(categories, total, page, limit)
}

export const getAllCategories = async (): Promise<CategoryResponse[]> => {
  const translations = await prismaClient.categoryTranslation.findMany({
    where: { languageCode: 'id' },
    orderBy: { name: 'asc' },
    include: { category: { include: { translations: true } } }
  })

  return translations.map((translation) => toCategoryResponse({ ...translation.category, translations: translation.category.translations }))
}

export const getCategoryById = async (categoryId: string): Promise<CategoryResponse> => {
  const category = await prismaClient.category.findUnique({ where: { id: categoryId }, include: { translations: true } })
  if (!category) {
    throw new ResponseError(404, 'Kategori tidak ditemukan')
  }
  return toCategoryResponse(category)
}

export const updateCategory = async (categoryId: string, request: UpdateCategoryRequest): Promise<CategoryResponse> => {
  const updateRequest = Validation.validate(CategoryValidation.UPDATE, request)

  const category = await prismaClient.category.findUnique({ where: { id: categoryId }, include: { translations: true } })
  if (!category) {
    throw new ResponseError(404, 'Kategori tidak ditemukan')
  }

  if (updateRequest.name) {
    updateRequest.name = normalizeName(updateRequest.name)
    await assertNameUnique(updateRequest.name, categoryId)

    await prismaClient.$transaction([
      prismaClient.categoryTranslation.upsert({
        where: { categoryId_languageCode: { categoryId, languageCode: 'id' } },
        update: { name: updateRequest.name },
        create: { categoryId, languageCode: 'id', name: updateRequest.name }
      }),
      prismaClient.categoryTranslation.upsert({
        where: { categoryId_languageCode: { categoryId, languageCode: 'en' } },
        update: { name: updateRequest.name },
        create: { categoryId, languageCode: 'en', name: updateRequest.name }
      }),
      prismaClient.categoryTranslation.upsert({
        where: { categoryId_languageCode: { categoryId, languageCode: 'zh' } },
        update: { name: updateRequest.name },
        create: { categoryId, languageCode: 'zh', name: updateRequest.name }
      })
    ])
  }

  const updatedCategory = await prismaClient.category.findUnique({ where: { id: categoryId }, include: { translations: true } })
  if (!updatedCategory) {
    throw new ResponseError(500, 'Gagal memuat kategori setelah pembaruan')
  }

  return toCategoryResponse(updatedCategory)
}

export const deleteCategory = async (categoryId: string): Promise<{ message: string }> => {
  const category = await prismaClient.category.findUnique({ where: { id: categoryId } })
  if (!category) {
    throw new ResponseError(404, 'Kategori tidak ditemukan')
  }

  const usage = await prismaClient.publicationCategory.count({ where: { categoryId } })
  if (usage > 0) {
    throw new ResponseError(400, 'Kategori tidak dapat dihapus karena masih terhubung dengan artikel')
  }

  await prismaClient.category.delete({ where: { id: categoryId } })
  return { message: 'Kategori berhasil dihapus' }
}
