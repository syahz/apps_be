import { z } from 'zod'
import { PublicationType } from '@prisma/client'

const PublicationTypeSchema = z
  .string({ message: 'Jenis publikasi wajib diisi' })
  .transform((value) => value.trim().toLowerCase())
  .refine((value) => value === 'news' || value === 'article', {
    message: 'Jenis publikasi hanya boleh news atau article'
  })
  .transform((value) => (value === 'news' ? 'NEWS' : 'ARTICLE') as PublicationType)

export class PublicationValidation {
  private static readonly CATEGORY_IDS = z
    .array(z.string().uuid('Format Id Kategori tidak valid (UUID)'))
    .min(1, 'Minimal satu kategori harus dipilih')
    .refine((ids) => new Set(ids).size === ids.length, { message: 'Kategori tidak boleh duplikat' })

  static readonly CREATE = z.object({
    title: z.string().min(1, 'Judul wajib diisi').max(255, 'Judul maksimal 255 karakter'),
    content: z.string().min(1, 'Konten wajib diisi'),
    type: PublicationTypeSchema,
    date: z.coerce.date({ message: 'Tanggal tidak valid atau wajib diisi' }),
    category_ids: PublicationValidation.CATEGORY_IDS,
    image: z.string().min(1, 'Gambar publikasi wajib diisi'),
    image_og: z.string().min(1, 'Gambar OpenGraph wajib diisi')
  })

  static readonly UPDATE = z
    .object({
      title: z.string().min(1, 'Judul tidak boleh kosong').max(255, 'Judul maksimal 255 karakter').optional(),
      content: z.string().min(1, 'Konten tidak boleh kosong').optional(),
      type: PublicationTypeSchema.optional(),
      date: z.coerce.date({ message: 'Tanggal tidak valid' }).optional(),
      category_ids: PublicationValidation.CATEGORY_IDS.optional(),
      image: z.string().min(1, 'Gambar publikasi wajib diisi').optional(),
      image_og: z.string().min(1, 'Gambar OpenGraph wajib diisi').optional()
    })
    .refine(
      (data) =>
        data.title || data.content || data.date || data.type || (data.category_ids && data.category_ids.length > 0) || data.image || data.image_og,
      {
        message: 'Minimal satu field harus diisi untuk update'
      }
    )
}
