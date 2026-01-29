import fs from 'fs/promises'
import path from 'path'
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
  PublicationCreateOrUpdateResponse,
  PublicationTranslationWithParent
} from '../models/publication-model'
import { logger } from '../utils/logger'
import { PublicationValidation } from '../validation/publication-validation'
import { translateToChinese, translateToEnglish } from '../utils/translator'
import { ensureCategoriesExist, generateUniqueSlug } from '../utils/publication-helpers'

const publicationRelations = {
  translations: true,
  categories: { include: { category: { include: { translations: true } } } }
}

function translationNotFoundMessage(language: SupportedPublicationLanguage): string {
  if (language === 'en') return 'Publikasi versi Bahasa Inggris belum tersedia'
  if (language === 'zh') return 'Publikasi versi Bahasa China belum tersedia'
  return 'Publikasi tidak ditemukan'
}

async function fetchPublicationWithRelations(publicationId: string) {
  return prismaClient.publication.findUnique({ where: { id: publicationId }, include: publicationRelations })
}

export const getPublications = async (
  page: number,
  limit: number,
  search: string,
  language: SupportedPublicationLanguage = 'id'
): Promise<PublicationListResponse> => {
  const skip = (page - 1) * limit
  const where = {
    languageCode: language,
    ...(search ? { title: { contains: search } } : {})
  }

  const [total, translations] = await prismaClient.$transaction([
    prismaClient.publicationTranslation.count({ where }),
    prismaClient.publicationTranslation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { publication: { date: 'desc' } },
      include: { publication: { include: publicationRelations } }
    })
  ])

  return toPublicationListResponse(translations as PublicationTranslationWithParent[], total, page, limit, language)
}

export const getPublicationById = async (
  publicationId: string,
  language: SupportedPublicationLanguage = 'id'
): Promise<PublicationResponse> => {
  const publication = await fetchPublicationWithRelations(publicationId)
  if (!publication) {
    throw new ResponseError(404, 'Publikasi tidak ditemukan')
  }

  const translation = publication.translations.find((item) => item.languageCode === language)
  if (!translation) {
    throw new ResponseError(404, translationNotFoundMessage(language))
  }

  const translationWithParent: PublicationTranslationWithParent = { ...translation, publication }
  return toPublicationResponse(translationWithParent, language)
}

export const getPublicationByIdForLandingPage = async (
  slugPublication: string,
  language: SupportedPublicationLanguage = 'id'
): Promise<PublicationResponse> => {
  const translation = (await prismaClient.publicationTranslation.findFirst({
    where: { languageCode: language, slug: slugPublication },
    include: { publication: { include: publicationRelations } }
  })) as PublicationTranslationWithParent | null

  if (translation) {
    return toPublicationResponse(translation, language)
  }

  const fallback = (await prismaClient.publicationTranslation.findFirst({
    where: { slug: slugPublication },
    include: { publication: { include: publicationRelations } }
  })) as PublicationTranslationWithParent | null

  if (!fallback) {
    throw new ResponseError(404, 'Publikasi tidak ditemukan')
  }

  const desired = fallback.publication.translations.find((item) => item.languageCode === language)
  if (!desired) {
    throw new ResponseError(404, translationNotFoundMessage(language))
  }

  const desiredWithParent: PublicationTranslationWithParent = { ...desired, publication: fallback.publication }
  return toPublicationResponse(desiredWithParent, language)
}

export const createPublication = async (request: CreatePublicationRequest): Promise<PublicationCreateOrUpdateResponse> => {
  const createRequest = Validation.validate(PublicationValidation.CREATE, request)
  const categoryIds = await ensureCategoriesExist(createRequest.category_ids)
  const type = createRequest.type as PublicationType
  const bannerImage = createRequest.image
  const ogImage = createRequest.image_og

  const slugId = await generateUniqueSlug(createRequest.title, 'id')
  const translationEn = await translateToEnglish(createRequest.title, createRequest.content)
  const translationZh = await translateToChinese(createRequest.title, createRequest.content)
  const slugEn = await generateUniqueSlug(translationEn.title, 'en', undefined, createRequest.title)
  const slugZh = await generateUniqueSlug(translationZh.title, 'zh', undefined, translationEn.title ?? createRequest.title)

  const createdPublication = await prismaClient.$transaction(async (tx) => {
    const publication = await tx.publication.create({
      data: {
        type,
        date: createRequest.date,
        bannerImage,
        ogImage,
        categories: {
          create: categoryIds.map((categoryId) => ({ category: { connect: { id: categoryId } } }))
        }
      }
    })

    await tx.publicationTranslation.createMany({
      data: [
        {
          publicationId: publication.id,
          languageCode: 'id',
          title: createRequest.title,
          content: createRequest.content,
          slug: slugId
        },
        {
          publicationId: publication.id,
          languageCode: 'en',
          title: translationEn.title,
          content: translationEn.content,
          slug: slugEn
        },
        {
          publicationId: publication.id,
          languageCode: 'zh',
          title: translationZh.title,
          content: translationZh.content,
          slug: slugZh
        }
      ]
    })

    return publication
  })

  const publication = await fetchPublicationWithRelations(createdPublication.id)
  if (!publication) {
    throw new ResponseError(500, 'Gagal memuat data publikasi setelah dibuat')
  }

  const translationId = publication.translations.find((item) => item.languageCode === 'id')
  const translationEnSaved = publication.translations.find((item) => item.languageCode === 'en')
  const translationZhSaved = publication.translations.find((item) => item.languageCode === 'zh')

  if (!translationId || !translationEnSaved || !translationZhSaved) {
    throw new ResponseError(500, 'Terjemahan publikasi tidak lengkap setelah proses pembuatan')
  }

  const idResponse = toPublicationResponse({ ...translationId, publication }, 'id')
  const enResponse = toPublicationResponse({ ...translationEnSaved, publication }, 'en')
  const zhResponse = toPublicationResponse({ ...translationZhSaved, publication }, 'zh')

  return { idn: idResponse, eng: enResponse, zh: zhResponse }
}

export const updatePublication = async (
  publicationId: string,
  request: UpdatePublicationRequest
): Promise<PublicationCreateOrUpdateResponse> => {
  const updateRequest = Validation.validate(PublicationValidation.UPDATE, request)

  const publication = await fetchPublicationWithRelations(publicationId)
  if (!publication) {
    throw new ResponseError(404, 'Publikasi tidak ditemukan')
  }

  const categoryIds = updateRequest.category_ids ? await ensureCategoriesExist(updateRequest.category_ids) : undefined
  const newType: PublicationType = updateRequest.type ?? publication.type
  const newDate = updateRequest.date ?? publication.date
  const newBannerImage = updateRequest.image ?? publication.bannerImage
  const newOgImage = updateRequest.image_og ?? publication.ogImage
  const hasNewUpload = Boolean(updateRequest.image && updateRequest.image_og)

  const translationId = publication.translations.find((item) => item.languageCode === 'id')
  const translationEn = publication.translations.find((item) => item.languageCode === 'en')
  const translationZh = publication.translations.find((item) => item.languageCode === 'zh')

  const newTitle = updateRequest.title ?? translationId?.title ?? ''
  const newContent = updateRequest.content ?? translationId?.content ?? ''

  const shouldRetranslate = Boolean(updateRequest.title || updateRequest.content)

  const translationEnPayload = shouldRetranslate
    ? await translateToEnglish(newTitle, newContent)
    : translationEn
      ? { title: translationEn.title, content: translationEn.content }
      : await translateToEnglish(newTitle, newContent)

  const translationZhPayload = shouldRetranslate
    ? await translateToChinese(newTitle, newContent)
    : translationZh
      ? { title: translationZh.title, content: translationZh.content }
      : await translateToChinese(newTitle, newContent)

  const slugId = await generateUniqueSlug(newTitle, 'id', translationId?.slug)
  const slugEn = await generateUniqueSlug(translationEnPayload.title, 'en', translationEn?.slug, newTitle)
  const slugZh = await generateUniqueSlug(translationZhPayload.title, 'zh', translationZh?.slug, translationEnPayload.title)

  await prismaClient.$transaction(async (tx) => {
    await tx.publication.update({
      where: { id: publicationId },
      data: {
        type: newType,
        date: newDate,
        bannerImage: newBannerImage,
        ogImage: newOgImage
      }
    })

    if (categoryIds) {
      await tx.publicationCategory.deleteMany({ where: { publicationId } })
      if (categoryIds.length > 0) {
        await tx.publicationCategory.createMany({
          data: categoryIds.map((categoryId) => ({ publicationId, categoryId }))
        })
      }
    }

    await tx.publicationTranslation.upsert({
      where: { publicationId_languageCode: { publicationId, languageCode: 'id' } },
      update: {
        title: newTitle,
        content: newContent,
        slug: slugId
      },
      create: {
        publicationId,
        languageCode: 'id',
        title: newTitle,
        content: newContent,
        slug: slugId
      }
    })

    await tx.publicationTranslation.upsert({
      where: { publicationId_languageCode: { publicationId, languageCode: 'en' } },
      update: {
        title: translationEnPayload.title,
        content: translationEnPayload.content,
        slug: slugEn
      },
      create: {
        publicationId,
        languageCode: 'en',
        title: translationEnPayload.title,
        content: translationEnPayload.content,
        slug: slugEn
      }
    })

    await tx.publicationTranslation.upsert({
      where: { publicationId_languageCode: { publicationId, languageCode: 'zh' } },
      update: {
        title: translationZhPayload.title,
        content: translationZhPayload.content,
        slug: slugZh
      },
      create: {
        publicationId,
        languageCode: 'zh',
        title: translationZhPayload.title,
        content: translationZhPayload.content,
        slug: slugZh
      }
    })
  })

  if (hasNewUpload) {
    await deleteImageFiles([publication.bannerImage, publication.ogImage])
  }

  const updatedPublication = await fetchPublicationWithRelations(publicationId)
  if (!updatedPublication) {
    throw new ResponseError(500, 'Gagal memuat data publikasi setelah pembaruan')
  }

  const translationIdUpdated = updatedPublication.translations.find((item) => item.languageCode === 'id')
  const translationEnUpdated = updatedPublication.translations.find((item) => item.languageCode === 'en')
  const translationZhUpdated = updatedPublication.translations.find((item) => item.languageCode === 'zh')

  if (!translationIdUpdated || !translationEnUpdated || !translationZhUpdated) {
    throw new ResponseError(500, 'Terjemahan publikasi tidak lengkap setelah pembaruan')
  }

  const idResponse = toPublicationResponse({ ...translationIdUpdated, publication: updatedPublication }, 'id')
  const enResponse = toPublicationResponse({ ...translationEnUpdated, publication: updatedPublication }, 'en')
  const zhResponse = toPublicationResponse({ ...translationZhUpdated, publication: updatedPublication }, 'zh')

  return { idn: idResponse, eng: enResponse, zh: zhResponse }
}

export const deletePublication = async (publicationId: string): Promise<{ message: string }> => {
  const publication = await prismaClient.publication.findUnique({ where: { id: publicationId } })
  if (!publication) {
    throw new ResponseError(404, 'Publikasi tidak ditemukan')
  }

  await prismaClient.publication.delete({ where: { id: publicationId } })

  await deleteImageFiles([publication.bannerImage, publication.ogImage])

  return { message: 'Publikasi berhasil dihapus' }
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
