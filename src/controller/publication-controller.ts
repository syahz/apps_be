import { NextFunction, Request, Response } from 'express'
import { CreatePublicationRequest, UpdatePublicationRequest, SupportedPublicationLanguage } from '../models/publication-model'
import { createPublication, deletePublication, getPublicationById, getPublications, updatePublication } from '../services/publication-services'

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function parseLanguage(lang?: string): SupportedPublicationLanguage {
  return lang === 'en' ? 'en' : 'id'
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

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request: CreatePublicationRequest = req.body as CreatePublicationRequest
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

    const request: UpdatePublicationRequest = req.body as UpdatePublicationRequest
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
