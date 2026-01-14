import fs from 'fs/promises'
import path from 'path'
import { prismaClient } from '../application/database'
import { ResponseError } from '../error/response-error'
import { Validation } from '../validation/Validation'
import { GuestBookValidation } from '../validation/guestbook-validation'
import {
  GuestBookCreateRequest,
  GuestBookUpdateRequest,
  GuestBookResponse,
  GuestBookListResponse,
  toGuestBookResponse,
  toGuestBookListResponse
} from '../models/guestbook-model'
import { logger } from '../utils/logger'

export const createGuestBook = async (request: GuestBookCreateRequest): Promise<GuestBookResponse> => {
  const data = Validation.validate(GuestBookValidation.CREATE, request)

  const created = await prismaClient.guestBook.create({
    data: {
      name: data.name,
      origin: data.origin,
      purpose: data.purpose,
      selfieImage: data.selfie_image,
      signatureImage: data.signature_image
    }
  })

  return toGuestBookResponse(created)
}

export const getGuestBooks = async (page: number, limit: number, search: string): Promise<GuestBookListResponse> => {
  const skip = (page - 1) * limit
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { origin: { contains: search, mode: 'insensitive' } },
          { purpose: { contains: search, mode: 'insensitive' } }
        ]
      }
    : {}

  const [total, rows] = await prismaClient.$transaction([
    prismaClient.guestBook.count({ where }),
    prismaClient.guestBook.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } })
  ])

  return toGuestBookListResponse(rows, total, page, limit)
}

export const getGuestBookById = async (id: string): Promise<GuestBookResponse> => {
  const entity = await prismaClient.guestBook.findUnique({ where: { id } })
  if (!entity) {
    throw new ResponseError(404, 'Guest book entry not found')
  }
  return toGuestBookResponse(entity)
}

export const updateGuestBook = async (id: string, request: GuestBookUpdateRequest): Promise<GuestBookResponse> => {
  const data = Validation.validate(GuestBookValidation.UPDATE, request)

  const existing = await prismaClient.guestBook.findUnique({ where: { id } })
  if (!existing) {
    throw new ResponseError(404, 'Guest book entry not found')
  }

  const updated = await prismaClient.guestBook.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      origin: data.origin ?? existing.origin,
      purpose: data.purpose ?? existing.purpose,
      selfieImage: data.selfie_image ?? existing.selfieImage,
      signatureImage: data.signature_image ?? existing.signatureImage
    }
  })

  if (data.selfie_image || data.signature_image) {
    await deleteImages([data.selfie_image ? existing.selfieImage : null, data.signature_image ? existing.signatureImage : null])
  }

  return toGuestBookResponse(updated)
}

export const deleteGuestBook = async (id: string): Promise<{ message: string }> => {
  const existing = await prismaClient.guestBook.findUnique({ where: { id } })
  if (!existing) {
    throw new ResponseError(404, 'Guest book entry not found')
  }

  await prismaClient.guestBook.delete({ where: { id } })
  await deleteImages([existing.selfieImage, existing.signatureImage])

  return { message: 'Guest book entry deleted' }
}

async function deleteImages(filePaths: Array<string | null | undefined>) {
  await Promise.all(
    filePaths.map(async (filePath) => {
      if (!filePath) return
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath)
      try {
        await fs.unlink(absolutePath)
      } catch (error: any) {
        if (error?.code !== 'ENOENT') {
          logger.warn('Failed to delete guest book image', { filePath, message: error?.message })
        }
      }
    })
  )
}
