import express from 'express'
import { get, details } from '../../controller/publication-controller'

const publicPublicationRoutes = express.Router()

publicPublicationRoutes.get('/', get)
publicPublicationRoutes.get('/:publicationId', details)

export default publicPublicationRoutes
