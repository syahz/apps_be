import path from 'path'
import fs from 'fs/promises'
import { randomUUID } from 'crypto'
import multer from 'multer'
import sharp from 'sharp'
import { NextFunction, Request, Response } from 'express'

const MAX_FILE_SIZE = 3 * 1024 * 1024 // 3 MB per file
const storage = multer.memoryStorage()

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpe?g|png|webp)$/i.test(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('File harus berupa gambar (jpg, jpeg, png, webp)'))
    }
  }
})

async function ensureDirectory(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

async function saveImage(buffer: Buffer, suffix: string) {
  const baseDir = path.join(process.cwd(), 'image', 'guestbook')
  await ensureDirectory(baseDir)

  const baseName = `guest-${Date.now()}-${randomUUID()}-${suffix}`
  const filename = `${baseName}.jpg`
  const targetPath = path.join(baseDir, filename)

  await sharp(buffer).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(targetPath)

  return path.join('image', 'guestbook', filename).replace(/\\/g, '/')
}

async function processGuestBookImages(req: Request, res: Response, next: NextFunction) {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined
    if (!files) {
      return next()
    }

    const selfie = files['selfie_image']?.[0]
    const signature = files['signature_image']?.[0]

    if (selfie) {
      req.body.selfie_image = await saveImage(selfie.buffer, 'selfie')
    }

    if (signature) {
      req.body.signature_image = await saveImage(signature.buffer, 'signature')
    }

    return next()
  } catch (error) {
    return next(error)
  }
}

export const guestBookUpload = [
  upload.fields([
    { name: 'selfie_image', maxCount: 1 },
    { name: 'signature_image', maxCount: 1 }
  ]),
  processGuestBookImages
]
