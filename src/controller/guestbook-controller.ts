import { Request, Response, NextFunction } from 'express'
import { GuestBookCreateRequest, GuestBookUpdateRequest } from '../models/guestbook-model'
import { createGuestBook, deleteGuestBook, getGuestBookById, getGuestBooks, updateGuestBook } from '../services/guestbook-services'

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request: GuestBookCreateRequest = {
      name: req.body.name,
      origin: req.body.origin,
      purpose: req.body.purpose,
      reason: req.body.reason,
      selfie_image: req.body.selfie_image,
      signature_image: req.body.signature_image
    }

    const response = await createGuestBook(request)
    res.status(201).json({ data: response })
  } catch (error) {
    next(error)
  }
}

export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const search = (req.query.search as string) || ''

    const response = await getGuestBooks(page, limit, search)
    res.status(200).json({ data: response })
  } catch (error) {
    next(error)
  }
}

export const details = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guestBookId = String(req.params.guestBookId)
    if (!uuidRegex.test(guestBookId)) {
      return res.status(400).json({ errors: 'Invalid UUID format for Guest Book Id' })
    }

    const response = await getGuestBookById(guestBookId)
    res.status(200).json({ data: response })
  } catch (error) {
    next(error)
  }
}

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guestBookId = String(req.params.guestBookId)
    if (!uuidRegex.test(guestBookId)) {
      return res.status(400).json({ errors: 'Invalid UUID format for Guest Book Id' })
    }

    const request: GuestBookUpdateRequest = {
      name: req.body.name,
      origin: req.body.origin,
      purpose: req.body.purpose,
      selfie_image: req.body.selfie_image,
      signature_image: req.body.signature_image
    }

    const response = await updateGuestBook(guestBookId, request)
    res.status(200).json({ data: response })
  } catch (error) {
    next(error)
  }
}

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guestBookId = String(req.params.guestBookId)
    if (!uuidRegex.test(guestBookId)) {
      return res.status(400).json({ errors: 'Invalid UUID format for Guest Book Id' })
    }

    const response = await deleteGuestBook(guestBookId)
    res.status(200).json({ data: response })
  } catch (error) {
    next(error)
  }
}
