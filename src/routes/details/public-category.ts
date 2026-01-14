import express from 'express'
import { get, getAll } from '../../controller/category-controller'

const publicCategoryRoutes = express.Router()

publicCategoryRoutes.get('/', get)
publicCategoryRoutes.get('/all', getAll)

export default publicCategoryRoutes
