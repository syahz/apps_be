import express from 'express'
import { create } from '../../controller/guestbook-controller'
import { guestBookUpload } from '../../middleware/guestbook-upload'

const publicGuestBookRoutes = express.Router()

publicGuestBookRoutes.post('/', guestBookUpload, create)

export default publicGuestBookRoutes
