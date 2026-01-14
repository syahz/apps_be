import express from 'express'
import { create, get, getAll, getById, update, remove } from '../../controller/role-controller'

const roleRoutes = express.Router()

roleRoutes.get('/', get)
roleRoutes.post('/', create)
roleRoutes.get('/all', getAll)
roleRoutes.put('/:roleId', update)
roleRoutes.get('/:roleId', getById)
roleRoutes.delete('/:roleId', remove)

export default roleRoutes
