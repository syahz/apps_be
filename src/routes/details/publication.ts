import express from 'express'
import { create, get, details, update, remove } from '../../controller/publication-controller'
import { publicationImageUpload } from '../../middleware/publication-upload'

const publicationRoutes = express.Router()

publicationRoutes.get('/', get)
publicationRoutes.post('/', publicationImageUpload, create)
publicationRoutes.get('/:publicationId', details)
publicationRoutes.put('/:publicationId', publicationImageUpload, update)
publicationRoutes.delete('/:publicationId', remove)

export default publicationRoutes
