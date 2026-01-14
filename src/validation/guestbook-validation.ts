import { z } from 'zod'

const trimmedString = (field: string, max: number) =>
  z
    .string({ message: `${field} wajib diisi` })
    .trim()
    .min(1, `${field} wajib diisi`)
    .max(max, `${field} maksimal ${max} karakter`)

export class GuestBookValidation {
  static readonly CREATE = z.object({
    name: trimmedString('Nama', 100),
    origin: trimmedString('Asal/Instansi', 150),
    purpose: trimmedString('Tujuan', 200),
    selfie_image: z.string().min(1, 'Foto selfie wajib diunggah'),
    signature_image: z.string().min(1, 'Foto tanda tangan wajib diunggah')
  })

  static readonly UPDATE = z
    .object({
      name: trimmedString('Nama', 100).optional(),
      origin: trimmedString('Asal/Instansi', 150).optional(),
      purpose: trimmedString('Tujuan', 200).optional(),
      selfie_image: z.string().min(1, 'Foto selfie wajib diunggah').optional(),
      signature_image: z.string().min(1, 'Foto tanda tangan wajib diunggah').optional()
    })
    .refine((data) => data.name || data.origin || data.purpose || data.selfie_image || data.signature_image, {
      message: 'Minimal satu field harus diisi untuk update'
    })
}
