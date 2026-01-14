import path from 'path'
import express from 'express'
import cors from 'cors'
import { FRONTEND_URL } from '../config/index'
import { publicRouter } from '../routes/public-api'
import { privateRouter } from '../routes/private-api'
import cookieParser from 'cookie-parser'
import { errorMiddleware } from '../middleware/error-middleware'

export const web = express()

web.set('trust proxy', 1)

const corsOptions = {
  origin: FRONTEND_URL || 'https://hr.bmuconnect.id',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true
}
web.use(cors(corsOptions))
web.use(cookieParser())
web.use(express.json())
web.use('/image', express.static(path.join(process.cwd(), 'image')))
web.use(publicRouter)
web.use(privateRouter)
web.use(errorMiddleware)
