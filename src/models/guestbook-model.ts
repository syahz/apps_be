export type GuestBookCreateRequest = {
  name: string
  origin: string
  purpose: string
  selfie_image: string
  signature_image: string
}

export type GuestBookUpdateRequest = {
  name?: string
  origin?: string
  purpose?: string
  selfie_image?: string
  signature_image?: string
}

export type GuestBookResponse = {
  id: string
  name: string
  origin: string
  purpose: string
  selfie_image: string
  signature_image: string
  created_at: Date
  updated_at: Date
}

export type GuestBookListResponse = {
  guestbooks: GuestBookResponse[]
  pagination: {
    totalData: number
    page: number
    limit: number
    totalPage: number
  }
}

export function toGuestBookResponse(entity: any): GuestBookResponse {
  return {
    id: entity.id,
    name: entity.name,
    origin: entity.origin,
    purpose: entity.purpose,
    selfie_image: entity.selfieImage,
    signature_image: entity.signatureImage,
    created_at: entity.createdAt,
    updated_at: entity.updatedAt
  }
}

export function toGuestBookListResponse(entities: any[], total: number, page: number, limit: number): GuestBookListResponse {
  return {
    guestbooks: entities.map(toGuestBookResponse),
    pagination: {
      totalData: total,
      page,
      limit,
      totalPage: Math.ceil(total / limit)
    }
  }
}
