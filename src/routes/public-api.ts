import express from 'express'
import authRoutes from './details/auth'
import publicPublicationRoutes from './details/public-publication'
import publicCategoryRoutes from './details/public-category'
import publicGuestBookRoutes from './details/public-guestbook'

export const publicRouter = express.Router()

publicRouter.use('/api/auth', authRoutes)
publicRouter.use('/api/public/publications', publicPublicationRoutes)
publicRouter.use('/api/public/categories', publicCategoryRoutes)
publicRouter.use('/api/public/guestbook', publicGuestBookRoutes)
