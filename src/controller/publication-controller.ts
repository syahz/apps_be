import { NextFunction, Request, Response } from 'express'
import { CreatePublicationRequest, UpdatePublicationRequest, SupportedPublicationLanguage } from '../models/publication-model'
import {
  createPublication,
  deletePublication,
  getPublicationById,
  getPublications,
  updatePublication,
  getPublicationByIdForLandingPage
} from '../services/publication-services'

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function parseLanguage(lang?: string): SupportedPublicationLanguage {
  if (lang === 'en') return 'en'
  if (lang === 'zh') return 'zh'
  return 'id'
}

function parseCategoryIds(input: unknown): string[] | undefined {
  if (Array.isArray(input)) {
    return input.map(String)
  }

  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input)
      if (Array.isArray(parsed)) {
        return parsed.map(String)
      }
    } catch (error) {
      // fallback below
    }

    return input
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  }

  return undefined
}

function buildCreatePayload(req: Request): CreatePublicationRequest {
  const categoryIds = parseCategoryIds(req.body.category_ids) ?? []

  return {
    title: req.body.title,
    content: req.body.content,
    date: req.body.date,
    type: req.body.type,
    category_ids: categoryIds,
    image: req.body.image,
    image_og: req.body.image_og
  }
}

function buildUpdatePayload(req: Request): UpdatePublicationRequest {
  const categoryIds = parseCategoryIds(req.body.category_ids)

  return {
    title: req.body.title,
    content: req.body.content,
    date: req.body.date,
    type: req.body.type,
    category_ids: categoryIds,
    image: req.body.image,
    image_og: req.body.image_og
  }
}

export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const search = (req.query.search as string) || ''
    const language = parseLanguage(req.query.lang as string)

    const response = await getPublications(page, limit, search, language)
    res.status(200).json({ data: response })
  } catch (error) {
    next(error)
  }
}

export const details = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const publicationId = String(req.params.publicationId)
    if (!uuidRegex.test(publicationId)) {
      return res.status(400).json({ errors: 'Invalid UUID format for Publication Id' })
    }

    const language = parseLanguage(req.query.lang as string)
    const response = await getPublicationById(publicationId, language)
    res.status(200).json({ data: response })
  } catch (error) {
    next(error)
  }
}

export const detailLandingPage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slugPublication = String(req.params.slugPublication)
    const language = parseLanguage(req.query.lang as string)
    const response = await getPublicationByIdForLandingPage(slugPublication, language)
    res.status(200).json({ data: response })
  } catch (error) {
    next(error)
  }
}

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request = buildCreatePayload(req)

    if (!request.image || !request.image_og) {
      return res.status(400).json({ errors: 'Gambar publikasi wajib diunggah' })
    }

    const response = await createPublication(request)
    res.status(201).json({ data: response })
  } catch (error) {
    next(error)
  }
}

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const publicationId = String(req.params.publicationId)
    if (!uuidRegex.test(publicationId)) {
      return res.status(400).json({ errors: 'Invalid UUID format for Publication Id' })
    }

    const request = buildUpdatePayload(req)
    const response = await updatePublication(publicationId, request)
    res.status(200).json({ data: response })
  } catch (error) {
    next(error)
  }
}

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const publicationId = String(req.params.publicationId)
    if (!uuidRegex.test(publicationId)) {
      return res.status(400).json({ errors: 'Invalid UUID format for Publication Id' })
    }

    const response = await deletePublication(publicationId)
    res.status(200).json({ data: response })
  } catch (error) {
    next(error)
  }
}
