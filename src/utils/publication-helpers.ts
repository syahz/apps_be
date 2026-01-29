import { prismaClient } from '../application/database'
import { ResponseError } from '../error/response-error'

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

  const categories = await prismaClient.category.findMany({ where: { id: { in: uniqueIds } } })
  if (categories.length !== uniqueIds.length) {
    throw new ResponseError(400, 'Beberapa kategori tidak valid atau belum terdaftar')
  }

  return uniqueIds
}

export async function isSlugTaken(slug: string, languageCode: string, currentSlug?: string): Promise<boolean> {
  if (currentSlug && slug === currentSlug) {
    return false
  }

  const existing = await prismaClient.publicationTranslation.findUnique({
    where: {
      languageCode_slug: {
        languageCode,
        slug
      }
    }
  })

  return Boolean(existing)
}

export async function generateUniqueSlug(title: string, languageCode: string, currentSlug?: string, fallbackTitle?: string): Promise<string> {
  let baseSlug = slugify(title)

  if ((baseSlug === 'publikasi' || !baseSlug) && fallbackTitle) {
    const fallbackSlug = slugify(fallbackTitle)
    baseSlug = fallbackSlug || baseSlug
  }

  let slug = baseSlug
  let counter = 1

  while (await isSlugTaken(slug, languageCode, currentSlug)) {
    slug = `${baseSlug}-${counter}`
    counter += 1
  }

  return slug
}
