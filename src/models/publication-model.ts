import { Publication, PublicationTranslation, PublicationCategory, Category, CategoryTranslation, PublicationType } from '@prisma/client'

export type SupportedPublicationLanguage = 'id' | 'en' | 'zh'
export type PublicationKindResponse = 'news' | 'article'

export type CreatePublicationRequest = {
  title: string
  content: string
  date: Date
  type: PublicationType
  image: string
  image_og: string
  category_ids: string[]
}

export type UpdatePublicationRequest = {
  title?: string
  content?: string
  date?: Date
  type?: PublicationType
  image: string
  image_og: string
  category_ids?: string[]
}

export type PublicationCategoryResponse = {
  id: string
  name: string
}

export type PublicationSlugMap = {
  id: string | null
  en: string | null
  zh: string | null
}

export type PublicationResponse = {
  id: string
  slug: string
  title: string
  content: string
  type: PublicationKindResponse
  date: Date
  image: string | null
  image_og: string | null
  created_at: Date
  updated_at: Date
  language: SupportedPublicationLanguage
  categories: PublicationCategoryResponse[]
  slug_map: PublicationSlugMap
}

export type PublicationListResponse = {
  publications: PublicationResponse[]
  pagination: {
    totalData: number
    page: number
    limit: number
    totalPage: number
  }
}

export type PublicationCreateOrUpdateResponse = {
  idn: PublicationResponse
  eng: PublicationResponse
  zh: PublicationResponse
}

type PublicationCategoryWithTranslations = PublicationCategory & { category: Category & { translations: CategoryTranslation[] } }

type PublicationWithRelations = Publication & {
  translations: PublicationTranslation[]
  categories: PublicationCategoryWithTranslations[]
}

export type PublicationTranslationWithParent = PublicationTranslation & {
  publication: PublicationWithRelations
}

function mapPublicationType(type: PublicationType): PublicationKindResponse {
  return type === 'NEWS' ? 'news' : 'article'
}

function resolveCategoryName(translations: CategoryTranslation[], language: SupportedPublicationLanguage): string {
  const byLang = translations.find((translation) => translation.languageCode === language)
  if (byLang) return byLang.name

  const indonesian = translations.find((translation) => translation.languageCode === 'id')
  if (indonesian) return indonesian.name

  return translations[0]?.name ?? ''
}

function buildSlugMapFromTranslations(translations: PublicationTranslation[]): PublicationSlugMap {
  const slugMap: PublicationSlugMap = { id: null, en: null, zh: null }

  for (const translation of translations) {
    if (translation.languageCode === 'id') slugMap.id = translation.slug
    if (translation.languageCode === 'en') slugMap.en = translation.slug
    if (translation.languageCode === 'zh') slugMap.zh = translation.slug
  }

  if (!slugMap.zh) {
    slugMap.zh = slugMap.en ?? slugMap.id
  }

  return slugMap
}

export function toPublicationResponse(translation: PublicationTranslationWithParent, language: SupportedPublicationLanguage): PublicationResponse {
  const publication = translation.publication
  const slugMap = buildSlugMapFromTranslations(publication.translations)

  return {
    id: publication.id,
    slug: translation.slug,
    title: translation.title,
    content: translation.content,
    type: mapPublicationType(publication.type),
    date: publication.date,
    image: publication.bannerImage ?? null,
    image_og: publication.ogImage ?? null,
    created_at: publication.createdAt,
    updated_at: publication.updatedAt,
    language,
    categories: publication.categories.map((category) => ({
      id: category.categoryId,
      name: resolveCategoryName(category.category.translations, language)
    })),
    slug_map: slugMap
  }
}

export function toPublicationListResponse(
  translations: PublicationTranslationWithParent[],
  total: number,
  page: number,
  limit: number,
  language: SupportedPublicationLanguage
): PublicationListResponse {
  return {
    publications: translations.map((translation) => toPublicationResponse(translation, language)),
    pagination: {
      totalData: total,
      page,
      limit,
      totalPage: Math.ceil(total / limit)
    }
  }
}
