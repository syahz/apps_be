import fs from 'fs/promises'
import path from 'path'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { PublicationType } from '@prisma/client'
import { Validation } from '../validation/Validation'
import { prismaClient } from '../application/database'
import { ResponseError } from '../error/response-error'
import {
  PublicationResponse,
  toPublicationResponse,
  PublicationListResponse,
  CreatePublicationRequest,
  UpdatePublicationRequest,
  toPublicationListResponse,
  SupportedPublicationLanguage,
  PublicationCreateOrUpdateResponse
} from '../models/publication-model'
import { logger } from '../utils/logger'
import { GEMINI_API_KEY } from '../config'
import { PublicationValidation } from '../validation/publication-validation'

const GEMINI_MODEL_NAME = 'gemini-2.5-flash'

export const getPublications = async (
  page: number,
  limit: number,
  search: string,
  language: SupportedPublicationLanguage = 'id'
): Promise<PublicationListResponse> => {
  const skip = (page - 1) * limit
  const where = search ? { title: { contains: search } } : {}

  if (language === 'en') {
    const [total, publications] = await prismaClient.$transaction([
      prismaClient.publicationEng.count({ where }),
      prismaClient.publicationEng.findMany({ where, skip, take: limit, orderBy: { date: 'desc' }, include: { categories: true } })
    ])

    return toPublicationListResponse(publications, total, page, limit, 'en')
  }

  const [total, publications] = await prismaClient.$transaction([
    prismaClient.publicationIdn.count({ where }),
    prismaClient.publicationIdn.findMany({ where, skip, take: limit, orderBy: { date: 'desc' }, include: { categories: true } })
  ])

  return toPublicationListResponse(publications, total, page, limit, 'id')
}

export const getPublicationById = async (publicationId: string, language: SupportedPublicationLanguage = 'id'): Promise<PublicationResponse> => {
  if (language === 'id') {
    const publication = await prismaClient.publicationIdn.findUnique({ where: { id: publicationId }, include: { categories: true } })
    if (!publication) {
      throw new ResponseError(404, 'Publikasi tidak ditemukan')
    }
    return toPublicationResponse(publication, 'id')
  }

  const englishById = await prismaClient.publicationEng.findUnique({ where: { id: publicationId }, include: { categories: true } })
  if (englishById) {
    return toPublicationResponse(englishById, 'en')
  }

  const basePublication = await prismaClient.publicationIdn.findUnique({ where: { id: publicationId }, include: { categories: true } })
  if (!basePublication) {
    throw new ResponseError(404, 'Publikasi tidak ditemukan')
  }

  const englishBySlug = await prismaClient.publicationEng.findUnique({ where: { slug: basePublication.slug }, include: { categories: true } })
  if (!englishBySlug) {
    throw new ResponseError(404, 'Publikasi versi Bahasa Inggris belum tersedia')
  }

  return toPublicationResponse(englishBySlug, 'en')
}

export const createPublication = async (request: CreatePublicationRequest): Promise<PublicationCreateOrUpdateResponse> => {
  const createRequest = Validation.validate(PublicationValidation.CREATE, request)
  const categoryIds = await ensureCategoriesExist(createRequest.category_ids)
  const type = createRequest.type as PublicationType
  const slugIdn = await generateUniqueSlug(createRequest.title)
  const bannerImage = createRequest.image
  const ogImage = createRequest.image_og

  const translation = await translateToEnglish(createRequest.title, createRequest.content)
  const slugEng = await generateUniqueSlug(translation.title)
  const categoryConnect = categoryIds.map((id) => ({ id }))

  const { publicationIdn, publicationEng } = await prismaClient.$transaction(async (tx) => {
    const createdIdn = await tx.publicationIdn.create({
      data: {
        slug: slugIdn,
        title: createRequest.title,
        content: createRequest.content,
        type,
        date: createRequest.date,
        bannerImage,
        ogImage,
        categories: { connect: categoryConnect }
      },
      include: { categories: true }
    })

    const createdEng = await tx.publicationEng.create({
      data: {
        id: createdIdn.id,
        slug: slugEng,
        title: translation.title,
        content: translation.content,
        type,
        date: createRequest.date,
        bannerImage,
        ogImage,
        categories: { connect: categoryConnect }
      },
      include: { categories: true }
    })

    return { publicationIdn: createdIdn, publicationEng: createdEng }
  })

  return {
    idn: toPublicationResponse(publicationIdn, 'id'),
    eng: toPublicationResponse(publicationEng, 'en')
  }
}

export const updatePublication = async (publicationId: string, request: UpdatePublicationRequest): Promise<PublicationCreateOrUpdateResponse> => {
  const updateRequest = Validation.validate(PublicationValidation.UPDATE, request)

  const existingIdn = await prismaClient.publicationIdn.findUnique({ where: { id: publicationId }, include: { categories: true } })
  if (!existingIdn) {
    throw new ResponseError(404, 'Publikasi tidak ditemukan')
  }

  const categoryIds = updateRequest.category_ids ? await ensureCategoriesExist(updateRequest.category_ids) : undefined
  const categorySet = categoryIds ? categoryIds.map((id) => ({ id })) : undefined
  const fallbackCategorySet = categorySet ?? existingIdn.categories.map((category) => ({ id: category.id }))

  const newSlugIdn = updateRequest.title ? await generateUniqueSlug(updateRequest.title, existingIdn.slug) : existingIdn.slug
  const newTitle = updateRequest.title ?? existingIdn.title
  const newContent = updateRequest.content ?? existingIdn.content
  const newDate = updateRequest.date ?? existingIdn.date
  const newType: PublicationType = updateRequest.type ?? existingIdn.type
  const newBannerImage = updateRequest.image ?? existingIdn.bannerImage
  const newOgImage = updateRequest.image_og ?? existingIdn.ogImage
  const hasNewUpload = Boolean(updateRequest.image && updateRequest.image_og)

  const shouldRetranslate = Boolean(updateRequest.title || updateRequest.content)
  const englishBefore =
    (await prismaClient.publicationEng.findUnique({ where: { id: publicationId }, include: { categories: true } })) ||
    (await prismaClient.publicationEng.findUnique({ where: { slug: existingIdn.slug }, include: { categories: true } }))

  const translation = shouldRetranslate
    ? await translateToEnglish(newTitle, newContent)
    : englishBefore
    ? { title: englishBefore.title, content: englishBefore.content }
    : await translateToEnglish(newTitle, newContent)

  const newSlugEng = shouldRetranslate
    ? await generateUniqueSlug(translation.title, englishBefore?.slug)
    : englishBefore
    ? englishBefore.slug
    : await generateUniqueSlug(translation.title)

  const { publicationIdn, publicationEng } = await prismaClient.$transaction(async (tx) => {
    const updatedIdn = await tx.publicationIdn.update({
      where: { id: publicationId },
      data: {
        slug: newSlugIdn,
        title: newTitle,
        content: newContent,
        type: newType,
        date: newDate,
        bannerImage: newBannerImage,
        ogImage: newOgImage,
        ...(categorySet && { categories: { set: categorySet } })
      },
      include: { categories: true }
    })

    const updatedEng = englishBefore
      ? await tx.publicationEng.update({
          where: { id: englishBefore.id },
          data: {
            slug: newSlugEng,
            title: translation.title,
            content: translation.content,
            type: newType,
            date: newDate,
            bannerImage: newBannerImage,
            ogImage: newOgImage,
            ...(categorySet && { categories: { set: categorySet } })
          },
          include: { categories: true }
        })
      : await tx.publicationEng.create({
          data: {
            id: publicationId,
            slug: newSlugEng,
            title: translation.title,
            content: translation.content,
            type: newType,
            date: newDate,
            bannerImage: newBannerImage,
            ogImage: newOgImage,
            categories: { connect: fallbackCategorySet }
          },
          include: { categories: true }
        })

    return { publicationIdn: updatedIdn, publicationEng: updatedEng }
  })

  if (hasNewUpload) {
    await deleteImageFiles([existingIdn.bannerImage, existingIdn.ogImage])
  }

  return {
    idn: toPublicationResponse(publicationIdn, 'id'),
    eng: toPublicationResponse(publicationEng, 'en')
  }
}

export const deletePublication = async (publicationId: string): Promise<{ message: string }> => {
  const publicationIdn = await prismaClient.publicationIdn.findUnique({ where: { id: publicationId } })
  if (!publicationIdn) {
    throw new ResponseError(404, 'Publikasi tidak ditemukan')
  }

  await prismaClient.$transaction([
    prismaClient.publicationEng.deleteMany({ where: { OR: [{ id: publicationId }, { slug: publicationIdn.slug }] } }),
    prismaClient.publicationIdn.delete({ where: { id: publicationId } })
  ])

  await deleteImageFiles([publicationIdn.bannerImage, publicationIdn.ogImage])

  return { message: 'Publikasi berhasil dihapus' }
}

function slugify(text: string): string {
  const normalized = text
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\u0300-\u036f]/g, '')
  const slug = normalized
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
  return slug || 'publikasi'
}

function normalizeCategoryIds(categoryIds: string[]): string[] {
  return Array.from(new Set(categoryIds))
}

async function ensureCategoriesExist(categoryIds: string[]): Promise<string[]> {
  const uniqueIds = normalizeCategoryIds(categoryIds)
  if (uniqueIds.length === 0) {
    throw new ResponseError(400, 'Minimal satu kategori harus dipilih')
  }

  const categories = await prismaClient.categoryArticle.findMany({ where: { id: { in: uniqueIds } } })
  if (categories.length !== uniqueIds.length) {
    throw new ResponseError(400, 'Beberapa kategori tidak valid atau belum terdaftar')
  }

  return uniqueIds
}

async function isSlugTaken(slug: string, currentSlug?: string): Promise<boolean> {
  if (currentSlug && slug === currentSlug) {
    return false
  }

  const [idn, eng] = await prismaClient.$transaction([
    prismaClient.publicationIdn.findUnique({ where: { slug } }),
    prismaClient.publicationEng.findUnique({ where: { slug } })
  ])

  return Boolean(idn || eng)
}

async function generateUniqueSlug(title: string, currentSlug?: string): Promise<string> {
  const baseSlug = slugify(title)
  let slug = baseSlug
  let counter = 1

  while (await isSlugTaken(slug, currentSlug)) {
    slug = `${baseSlug}-${counter}`
    counter += 1
  }

  return slug
}

function parseGeminiJson(text: string) {
  try {
    return JSON.parse(text)
  } catch (e) {
    const cleanText = text
      .replace(/^```json\s*/, '')
      .replace(/^```\s*/, '')
      .replace(/\s*```$/, '')
      .trim()

    return JSON.parse(cleanText)
  }
}

async function translateToEnglish(title: string, content: string): Promise<{ title: string; content: string }> {
  if (!GEMINI_API_KEY) {
    logger.error('GEMINI_API_KEY is missing in environment variables')
    throw new ResponseError(500, 'Konfigurasi Server Error (API Key)')
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL_NAME,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING },
            content: { type: SchemaType.STRING }
          },
          required: ['title', 'content']
        }
      }
    })

    const prompt = `
      You are a professional translator and editor for a news portal.
      Translate the following Indonesian article to English with a professional, neutral newsroom tone.

      Rules:
      1. Preserve all HTML tags (<p>, <b>, etc.) and structure exactly. Translate only the visible text content inside tags.
      2. Do not add commentary.
      3. Return valid JSON exactly matching this structure:
      {
        "title": "Translated Title string",
        "content": "Translated HTML content string"
      }

      Input Data:
      Title: ${title}
      Content: ${content}
    `

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    if (!text) {
      throw new Error('Respons Gemini kosong')
    }

    const parsed = parseGeminiJson(text)

    if (!parsed.title || !parsed.content) {
      logger.warn('Gemini response format invalid:', parsed)
      throw new Error('Respons Gemini tidak memiliki field title/content')
    }

    return { title: parsed.title, content: parsed.content }
  } catch (error: any) {
    logger.error('Translate publication gagal (Gemini)', {
      message: error?.message,
      modelUsed: GEMINI_MODEL_NAME,
      keyConfigured: !!GEMINI_API_KEY,
      rawResponse: error?.response
    })

    throw new ResponseError(502, `Gagal menerjemahkan publikasi: ${error?.message}`)
  }
}

async function deleteImageFiles(filePaths: Array<string | null | undefined>) {
  await Promise.all(
    filePaths.map(async (filePath) => {
      if (!filePath) return

      const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath)

      try {
        await fs.unlink(absolutePath)
      } catch (error: any) {
        if (error?.code !== 'ENOENT') {
          logger.warn('Gagal menghapus file gambar publikasi', { filePath, message: error?.message })
        }
      }
    })
  )
}
