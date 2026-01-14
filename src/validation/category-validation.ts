import { z } from 'zod'

export class CategoryValidation {
  static readonly CREATE = z.object({
    name: z.string().min(1, 'Nama kategori wajib diisi').max(100, 'Nama kategori maksimal 100 karakter')
  })

  static readonly UPDATE = z.object({
    name: z.string().min(1, 'Nama kategori tidak boleh kosong').max(100, 'Nama kategori maksimal 100 karakter').optional()
  })
}
