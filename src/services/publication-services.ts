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
  PublicationCreateOrUpdateResponse
} from '../models/publication-model'
import { logger } from '../utils/logger'
import { PublicationValidation } from '../validation/publication-validation'
import { translateToChinese, translateToEnglish } from '../utils/translator'
import { buildSlugMaps, ensureCategoriesExist, generateUniqueSlug } from '../utils/publication-helpers'

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

    const slugMaps = await buildSlugMaps(publications, language)
    return toPublicationListResponse(publications, total, page, limit, language, slugMaps)
  }

  if (language === 'zh') {
    const [total, publications] = await prismaClient.$transaction([
      prismaClient.publicationChs.count({ where }),
      prismaClient.publicationChs.findMany({ where, skip, take: limit, orderBy: { date: 'desc' }, include: { categories: true } })
    ])

    const slugMaps = await buildSlugMaps(publications, language)
    return toPublicationListResponse(publications, total, page, limit, language, slugMaps)
  }

  const [total, publications] = await prismaClient.$transaction([
    prismaClient.publicationIdn.count({ where }),
    prismaClient.publicationIdn.findMany({ where, skip, take: limit, orderBy: { date: 'desc' }, include: { categories: true } })
  ])

  const slugMaps = await buildSlugMaps(publications, 'id')
  return toPublicationListResponse(publications, total, page, limit, 'id', slugMaps)
}

export const getPublicationById = async (publicationId: string, language: SupportedPublicationLanguage = 'id'): Promise<PublicationResponse> => {
  if (language === 'id') {
    const publication = await prismaClient.publicationIdn.findUnique({ where: { id: publicationId }, include: { categories: true } })
    if (!publication) {
      throw new ResponseError(404, 'Publikasi tidak ditemukan')
    }
    const english = await prismaClient.publicationEng.findUnique({ where: { id: publication.id }, select: { slug: true } })
    const chinese = await prismaClient.publicationChs.findUnique({ where: { id: publication.id }, select: { slug: true } })
    return toPublicationResponse(publication, 'id', {
      id: publication.slug,
      en: english?.slug ?? null,
      zh: chinese?.slug ?? english?.slug ?? publication.slug
    })
  }

  if (language === 'en') {
    const publication = await prismaClient.publicationEng.findUnique({ where: { id: publicationId }, include: { categories: true } })
    if (!publication) {
      throw new ResponseError(404, 'Publikasi tidak ditemukan')
    }
    const indonesian = await prismaClient.publicationIdn.findUnique({ where: { id: publication.id }, select: { slug: true } })
    const chinese = await prismaClient.publicationChs.findUnique({ where: { id: publication.id }, select: { slug: true } })
    return toPublicationResponse(publication, 'en', {
      id: indonesian?.slug ?? null,
      en: publication.slug,
      zh: chinese?.slug ?? publication.slug
    })
  }

  // language === 'zh'
  const chineseById = await prismaClient.publicationChs.findUnique({ where: { id: publicationId }, include: { categories: true } })
  if (chineseById) {
    const indonesian = await prismaClient.publicationIdn.findUnique({ where: { id: chineseById.id }, select: { slug: true } })
    const english = await prismaClient.publicationEng.findUnique({ where: { id: chineseById.id }, select: { slug: true } })
    return toPublicationResponse(chineseById, 'zh', {
      id: indonesian?.slug ?? null,
      en: english?.slug ?? null,
      zh: chineseById.slug
    })
  }

  const basePublication = await prismaClient.publicationIdn.findUnique({ where: { id: publicationId }, include: { categories: true } })
  if (!basePublication) {
    throw new ResponseError(404, 'Publikasi tidak ditemukan')
  }

  const chineseBySlug = await prismaClient.publicationChs.findUnique({ where: { slug: basePublication.slug }, include: { categories: true } })
  if (!chineseBySlug) {
    throw new ResponseError(404, 'Publikasi versi Bahasa China belum tersedia')
  }

  const english = await prismaClient.publicationEng.findUnique({ where: { id: chineseBySlug.id }, select: { slug: true } })
  return toPublicationResponse(chineseBySlug, 'zh', {
    id: basePublication.slug,
    en: english?.slug ?? null,
    zh: chineseBySlug.slug
  })
}

export const getPublicationByIdForLandingPage = async (
  slugPublication: string,
  language: SupportedPublicationLanguage = 'id'
): Promise<PublicationResponse> => {
  if (language === 'id') {
    const publication = await prismaClient.publicationIdn.findUnique({ where: { slug: slugPublication }, include: { categories: true } })
    if (!publication) {
      throw new ResponseError(404, 'Publikasi tidak ditemukan')
    }
    const english =
      (await prismaClient.publicationEng.findUnique({ where: { id: publication.id }, select: { slug: true } })) ||
      (await prismaClient.publicationEng.findUnique({ where: { slug: slugPublication }, select: { slug: true } }))
    const chinese =
      (await prismaClient.publicationChs.findUnique({ where: { id: publication.id }, select: { slug: true } })) ||
      (await prismaClient.publicationChs.findUnique({ where: { slug: slugPublication }, select: { slug: true } }))

    return toPublicationResponse(publication, 'id', {
      id: publication.slug,
      en: english?.slug ?? null,
      zh: chinese?.slug ?? english?.slug ?? publication.slug
    })
  }

  if (language === 'en') {
    const publication = await prismaClient.publicationEng.findUnique({ where: { slug: slugPublication }, include: { categories: true } })
    if (!publication) {
      throw new ResponseError(404, 'Publikasi versi Bahasa Inggris belum tersedia')
    }
    const indonesian =
      (await prismaClient.publicationIdn.findUnique({ where: { id: publication.id }, select: { slug: true } })) ||
      (await prismaClient.publicationIdn.findUnique({ where: { slug: slugPublication }, select: { slug: true } }))
    const chinese =
      (await prismaClient.publicationChs.findUnique({ where: { id: publication.id }, select: { slug: true } })) ||
      (await prismaClient.publicationChs.findUnique({ where: { slug: slugPublication }, select: { slug: true } }))

    return toPublicationResponse(publication, 'en', {
      id: indonesian?.slug ?? null,
      en: publication.slug,
      zh: chinese?.slug ?? publication.slug
    })
  }

  const publication = await prismaClient.publicationChs.findUnique({ where: { slug: slugPublication }, include: { categories: true } })
  if (!publication) {
    throw new ResponseError(404, 'Publikasi versi Bahasa China belum tersedia')
  }

  const indonesian =
    (await prismaClient.publicationIdn.findUnique({ where: { id: publication.id }, select: { slug: true } })) ||
    (await prismaClient.publicationIdn.findUnique({ where: { slug: slugPublication }, select: { slug: true } }))
  const english =
    (await prismaClient.publicationEng.findUnique({ where: { id: publication.id }, select: { slug: true } })) ||
    (await prismaClient.publicationEng.findUnique({ where: { slug: slugPublication }, select: { slug: true } }))

  return toPublicationResponse(publication, 'zh', {
    id: indonesian?.slug ?? null,
    en: english?.slug ?? null,
    zh: publication.slug
  })
}

export const createPublication = async (request: CreatePublicationRequest): Promise<PublicationCreateOrUpdateResponse> => {
  const createRequest = Validation.validate(PublicationValidation.CREATE, request)
  const categoryIds = await ensureCategoriesExist(createRequest.category_ids)
  const type = createRequest.type as PublicationType
  const slugIdn = await generateUniqueSlug(createRequest.title)
  const bannerImage = createRequest.image
  const ogImage = createRequest.image_og

  const translationEn = await translateToEnglish(createRequest.title, createRequest.content)
  const translationZh = await translateToChinese(createRequest.title, createRequest.content)
  const slugEng = await generateUniqueSlug(translationEn.title, undefined, createRequest.title)
  const slugZh = slugEng
  const categoryConnect = categoryIds.map((id) => ({ id }))

  const { publicationIdn, publicationEng, publicationChs } = await prismaClient.$transaction(async (tx) => {
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
        title: translationEn.title,
        content: translationEn.content,
        type,
        date: createRequest.date,
        bannerImage,
        ogImage,
        categories: { connect: categoryConnect }
      },
      include: { categories: true }
    })

    const createdChs = await tx.publicationChs.create({
      data: {
        id: createdIdn.id,
        slug: slugZh,
        title: translationZh.title,
        content: translationZh.content,
        type,
        date: createRequest.date,
        bannerImage,
        ogImage,
        categories: { connect: categoryConnect }
      },
      include: { categories: true }
    })

    return { publicationIdn: createdIdn, publicationEng: createdEng, publicationChs: createdChs }
  })

  return {
    idn: toPublicationResponse(publicationIdn, 'id', { id: publicationIdn.slug, en: publicationEng.slug, zh: publicationChs.slug }),
    eng: toPublicationResponse(publicationEng, 'en', { id: publicationIdn.slug, en: publicationEng.slug, zh: publicationChs.slug }),
    zh: toPublicationResponse(publicationChs, 'zh', { id: publicationIdn.slug, en: publicationEng.slug, zh: publicationChs.slug })
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
  const chineseBefore =
    (await prismaClient.publicationChs.findUnique({ where: { id: publicationId }, include: { categories: true } })) ||
    (await prismaClient.publicationChs.findUnique({ where: { slug: existingIdn.slug }, include: { categories: true } }))

  const translation = shouldRetranslate
    ? await translateToEnglish(newTitle, newContent)
    : englishBefore
      ? { title: englishBefore.title, content: englishBefore.content }
      : await translateToEnglish(newTitle, newContent)

  const translationZh = shouldRetranslate
    ? await translateToChinese(newTitle, newContent)
    : chineseBefore
      ? { title: chineseBefore.title, content: chineseBefore.content }
      : await translateToChinese(newTitle, newContent)

  const newSlugEng = shouldRetranslate
    ? await generateUniqueSlug(translation.title, englishBefore?.slug, newTitle)
    : englishBefore
      ? englishBefore.slug
      : await generateUniqueSlug(translation.title, undefined, newTitle)

  const newSlugZh = newSlugEng

  const { publicationIdn, publicationEng, publicationChs } = await prismaClient.$transaction(async (tx) => {
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

    const updatedChs = chineseBefore
      ? await tx.publicationChs.update({
          where: { id: chineseBefore.id },
          data: {
            slug: newSlugZh,
            title: translationZh.title,
            content: translationZh.content,
            type: newType,
            date: newDate,
            bannerImage: newBannerImage,
            ogImage: newOgImage,
            ...(categorySet && { categories: { set: categorySet } })
          },
          include: { categories: true }
        })
      : await tx.publicationChs.create({
          data: {
            id: publicationId,
            slug: newSlugZh,
            title: translationZh.title,
            content: translationZh.content,
            type: newType,
            date: newDate,
            bannerImage: newBannerImage,
            ogImage: newOgImage,
            categories: { connect: fallbackCategorySet }
          },
          include: { categories: true }
        })

    return { publicationIdn: updatedIdn, publicationEng: updatedEng, publicationChs: updatedChs }
  })

  if (hasNewUpload) {
    await deleteImageFiles([existingIdn.bannerImage, existingIdn.ogImage])
  }

  return {
    idn: toPublicationResponse(publicationIdn, 'id', { id: publicationIdn.slug, en: publicationEng.slug, zh: publicationChs.slug }),
    eng: toPublicationResponse(publicationEng, 'en', { id: publicationIdn.slug, en: publicationEng.slug, zh: publicationChs.slug }),
    zh: toPublicationResponse(publicationChs, 'zh', { id: publicationIdn.slug, en: publicationEng.slug, zh: publicationChs.slug })
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
