import { PublicationIdn, PublicationEng, CategoryArticle, PublicationType } from '@prisma/client'

export type SupportedPublicationLanguage = 'id' | 'en'
export type PublicationKindResponse = 'news' | 'article'

export type CreatePublicationRequest = {
  title: string
  content: string
  date: Date
  type: PublicationType
  category_ids: string[]
}

export type UpdatePublicationRequest = {
  title?: string
  content?: string
  date?: Date
  type?: PublicationType
  category_ids?: string[]
}

export type PublicationCategoryResponse = {
  id: string
  name: string
}

export type PublicationResponse = {
  id: string
  slug: string
  title: string
  content: string
  type: PublicationKindResponse
  date: Date
  created_at: Date
  updated_at: Date
  language: SupportedPublicationLanguage
  categories: PublicationCategoryResponse[]
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
}

type PublicationWithCategories = (PublicationIdn | PublicationEng) & { categories?: CategoryArticle[] }

function mapPublicationType(type: PublicationType): PublicationKindResponse {
  return type === 'NEWS' ? 'news' : 'article'
}

export function toPublicationResponse(publication: PublicationWithCategories, language: SupportedPublicationLanguage): PublicationResponse {
  const categories = publication.categories ?? []
  return {
    id: publication.id,
    slug: publication.slug,
    title: publication.title,
    content: publication.content,
    type: mapPublicationType(publication.type),
    date: publication.date,
    created_at: publication.createdAt,
    updated_at: publication.updatedAt,
    language,
    categories: categories.map((category) => ({ id: category.id, name: category.name }))
  }
}

export function toPublicationListResponse(
  publications: PublicationWithCategories[],
  total: number,
  page: number,
  limit: number,
  language: SupportedPublicationLanguage
): PublicationListResponse {
  return {
    publications: publications.map((publication) => toPublicationResponse(publication, language)),
    pagination: {
      totalData: total,
      page,
      limit,
      totalPage: Math.ceil(total / limit)
    }
  }
}
