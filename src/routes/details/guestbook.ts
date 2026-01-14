import express from 'express'
import { create, get, details, update, remove } from '../../controller/guestbook-controller'
import { guestBookUpload } from '../../middleware/guestbook-upload'

const guestBookRoutes = express.Router()

guestBookRoutes.get('/', get)
guestBookRoutes.post('/', guestBookUpload, create)
guestBookRoutes.get('/:guestBookId', details)
guestBookRoutes.put('/:guestBookId', guestBookUpload, update)
guestBookRoutes.delete('/:guestBookId', remove)

export default guestBookRoutes
