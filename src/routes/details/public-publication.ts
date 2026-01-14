import express from 'express'
import { get, detailLandingPage } from '../../controller/publication-controller'

const publicPublicationRoutes = express.Router()

publicPublicationRoutes.get('/', get)
publicPublicationRoutes.get('/:slugPublication', detailLandingPage)

export default publicPublicationRoutes
