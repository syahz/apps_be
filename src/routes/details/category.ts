import express from 'express'
import { create, get, getAll, getById, update, remove } from '../../controller/category-controller'

const categoryRoutes = express.Router()

categoryRoutes.get('/', get)
categoryRoutes.get('/all', getAll)
categoryRoutes.post('/', create)
categoryRoutes.get('/:categoryId', getById)
categoryRoutes.put('/:categoryId', update)
categoryRoutes.delete('/:categoryId', remove)

export default categoryRoutes
