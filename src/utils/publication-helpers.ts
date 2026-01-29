import { prismaClient } from '../application/database'
import { ResponseError } from '../error/response-error'
import { PublicationSlugMap, SupportedPublicationLanguage } from '../models/publication-model'

type SlugRecord = { id: string; slug: string }

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

export async function ensureCategoriesExist(categoryIds: string[]): Promise<string[]> {
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

export async function isSlugTaken(slug: string, currentSlug?: string): Promise<boolean> {
  if (currentSlug && slug === currentSlug) {
    return false
  }

  const [idn, eng, chs] = await prismaClient.$transaction([
    prismaClient.publicationIdn.findUnique({ where: { slug } }),
    prismaClient.publicationEng.findUnique({ where: { slug } }),
    prismaClient.publicationChs.findUnique({ where: { slug } })
  ])

  return Boolean(idn || eng || chs)
}

export async function generateUniqueSlug(title: string, currentSlug?: string): Promise<string> {
  const baseSlug = slugify(title)
  let slug = baseSlug
  let counter = 1

  while (await isSlugTaken(slug, currentSlug)) {
    slug = `${baseSlug}-${counter}`
    counter += 1
  }

  return slug
}

export async function buildSlugMaps(
  publications: SlugRecord[],
  primaryLanguage: SupportedPublicationLanguage
): Promise<Record<string, PublicationSlugMap>> {
  const ids = publications.map((publication) => publication.id)
  if (ids.length === 0) {
    return {}
  }

  const [idnCounterparts, engCounterparts, chsCounterparts] = await prismaClient.$transaction([
    prismaClient.publicationIdn.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true } }),
    prismaClient.publicationEng.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true } }),
    prismaClient.publicationChs.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true } })
  ])

  const map: Record<string, PublicationSlugMap> = {}

  for (const publication of publications) {
    const entry: PublicationSlugMap = { id: null, en: null, zh: null }
    if (primaryLanguage === 'id') {
      entry.id = publication.slug
    }
    if (primaryLanguage === 'en') {
      entry.en = publication.slug
      entry.zh = publication.slug
    }
    if (primaryLanguage === 'zh') {
      entry.zh = publication.slug
      entry.en = publication.slug
    }
    map[publication.id] = entry
  }

  for (const idn of idnCounterparts) {
    const entry = map[idn.id] ?? { id: null, en: null, zh: null }
    entry.id = idn.slug
    map[idn.id] = entry
  }

  for (const eng of engCounterparts) {
    const entry = map[eng.id] ?? { id: null, en: null, zh: null }
    entry.en = eng.slug
    if (!entry.zh) {
      entry.zh = eng.slug
    }
    map[eng.id] = entry
  }

  for (const chs of chsCounterparts) {
    const entry = map[chs.id] ?? { id: null, en: null, zh: null }
    entry.zh = chs.slug
    map[chs.id] = entry
  }

  for (const key of Object.keys(map)) {
    if (!map[key].zh) {
      map[key].zh = map[key].en ?? map[key].id
    }
  }

  return map
}
