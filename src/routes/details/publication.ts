import express from 'express'
import { create, get, details, update, remove } from '../../controller/publication-controller'

const publicationRoutes = express.Router()

publicationRoutes.get('/', get)
publicationRoutes.post('/', create)
publicationRoutes.get('/:publicationId', details)
publicationRoutes.put('/:publicationId', update)
publicationRoutes.delete('/:publicationId', remove)

export default publicationRoutes
