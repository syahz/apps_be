import { Unit } from '@prisma/client'

// DTO untuk membuat unit baru
export interface CreateUnitRequest {
  code: string
  name: string
}

// DTO untuk mengupdate unit
export interface UpdateUnitRequest {
  code?: string
  name?: string
}

// Tipe data final yang akan dikirim sebagai response untuk satu unit
export type UnitResponse = {
  id: string
  code: string
  name: string
}

// Tipe data untuk response get all, termasuk paginasi
export type GetAllUnitsResponse = {
  units: UnitResponse[]
  pagination: {
    totalData: number
    page: number
    limit: number
    totalPage: number
  }
}

/**
 * Helper function (mapper) untuk mengubah satu objek Unit dari Prisma
 * menjadi format JSON response yang kita inginkan.
 */
export function toUnitResponse(unit: Unit): UnitResponse {
  return {
    id: unit.id,
    code: unit.code,
    name: unit.name
  }
}

/**
 * Helper function (mapper) untuk mengubah hasil query (banyak unit)
 * menjadi format response yang kita inginkan, lengkap dengan paginasi.
 */
export function toAllUnitsResponse(units: Unit[], total: number, page: number, limit: number): GetAllUnitsResponse {
  return {
    units: units.map((unit) => toUnitResponse(unit)),
    pagination: {
      totalData: total,
      page: page,
      limit: limit,
      totalPage: Math.ceil(total / limit)
    }
  }
}
