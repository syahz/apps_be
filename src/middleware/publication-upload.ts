import path from 'path'
import fs from 'fs/promises'
import { randomUUID } from 'crypto'
import sharp from 'sharp'
import multer from 'multer'
import { NextFunction, Request, Response } from 'express'

const MAX_FILE_SIZE = 3 * 1024 * 1024 // 3 MB
const storage = multer.memoryStorage()

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpe?g|png|webp)$/i.test(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Tipe file harus berupa gambar (jpg, jpeg, png, webp)'))
    }
  }
})

async function ensureDirectory(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

async function generateVariants(fileBuffer: Buffer) {
  const baseDir = path.join(process.cwd(), 'image', 'publication')
  await ensureDirectory(baseDir)

  const baseName = `pub-${Date.now()}-${randomUUID()}`
  const bannerFilename = `${baseName}.jpg`
  const ogFilename = `${baseName}-og.jpg`

  const bannerPath = path.join(baseDir, bannerFilename)
  const ogPath = path.join(baseDir, ogFilename)

  await sharp(fileBuffer).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(bannerPath)

  await sharp(fileBuffer).resize({ width: 1200, height: 630, fit: 'cover' }).jpeg({ quality: 85 }).toFile(ogPath)

  return {
    banner: path.join('image', 'publication', bannerFilename).replace(/\\/g, '/'),
    opengraph: path.join('image', 'publication', ogFilename).replace(/\\/g, '/')
  }
}

async function processPublicationImage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      return next()
    }

    const variants = await generateVariants(req.file.buffer)
    req.body.image = variants.banner
    req.body.image_og = variants.opengraph

    return next()
  } catch (error) {
    return next(error)
  }
}

export const publicationImageUpload = [upload.single('image'), processPublicationImage]
