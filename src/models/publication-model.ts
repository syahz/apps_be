import { PublicationIdn, PublicationEng, PublicationChs, CategoryArticle, PublicationType } from '@prisma/client'

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

type PublicationWithCategories = (PublicationIdn | PublicationEng | PublicationChs) & { categories?: CategoryArticle[] }

function mapPublicationType(type: PublicationType): PublicationKindResponse {
  return type === 'NEWS' ? 'news' : 'article'
}

export function toPublicationResponse(
  publication: PublicationWithCategories,
  language: SupportedPublicationLanguage,
  slugMap?: PublicationSlugMap
): PublicationResponse {
  const categories = publication.categories ?? []
  const resolvedSlugMap: PublicationSlugMap = {
    id: slugMap?.id ?? (language === 'id' ? publication.slug : null),
    en: slugMap?.en ?? (language === 'en' ? publication.slug : null),
    zh: slugMap?.zh ?? (language === 'zh' ? publication.slug : null)
  }
  return {
    id: publication.id,
    slug: publication.slug,
    title: publication.title,
    content: publication.content,
    type: mapPublicationType(publication.type),
    date: publication.date,
    image: (publication as any).bannerImage ?? null,
    image_og: (publication as any).ogImage ?? null,
    created_at: publication.createdAt,
    updated_at: publication.updatedAt,
    language,
    categories: categories.map((category) => ({ id: category.id, name: category.name })),
    slug_map: resolvedSlugMap
  }
}

export function toPublicationListResponse(
  publications: PublicationWithCategories[],
  total: number,
  page: number,
  limit: number,
  language: SupportedPublicationLanguage,
  slugMaps?: Record<string, PublicationSlugMap>
): PublicationListResponse {
  return {
    publications: publications.map((publication) => toPublicationResponse(publication, language, slugMaps?.[publication.id])),
    pagination: {
      totalData: total,
      page,
      limit,
      totalPage: Math.ceil(total / limit)
    }
  }
}
