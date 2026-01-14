import supertest from 'supertest'
import { web } from '../src/application/web'
import { logger } from '../src/utils/logger'
import { UserTest, UserWithRole } from './utils/test-utils'
import { prismaClient } from '../src/application/database'
import { FeedbackResponse } from '../src/models/feedback-model'
import { Unit } from '@prisma/client'

describe('Feedback API (/api/admin/feedback)', () => {
  let adminUser: UserWithRole
  let adminToken: string
  let userWithRole: UserWithRole
  let userToken: string
  let unitUBC: Unit
  let unitHO: Unit

  beforeAll(async () => {
    // --- Ambil Data Unit ---
    const ubc = await prismaClient.unit.findUnique({ where: { code: 'UBC' } })
    const ho = await prismaClient.unit.findUnique({ where: { code: 'HO' } })
    if (!ubc || !ho) throw new Error("Unit 'UBC' atau 'HO' tidak ditemukan. Jalankan seeder.")
    unitUBC = ubc
    unitHO = ho

    // --- SETUP PENGGUNA ---
    adminUser = await UserTest.createUserByRole({
      email: 'test.admin@example.com',
      name: 'Test Admin',
      roleName: 'Admin',
      unitCode: 'HO'
    })
    adminToken = UserTest.generateToken(adminUser)

    userWithRole = await UserTest.createUserByRole({
      email: 'test.user@example.com',
      name: 'Test User',
      roleName: 'Staff',
      unitCode: 'UBC'
    })
    userToken = UserTest.generateToken(userWithRole)
  })

  afterAll(async () => {
    await UserTest.delete()
  })

  afterEach(async () => {
    await prismaClient.feedback.deleteMany({
      where: { rating: { in: [1, 2, 3, 4, 5] } }
    })
  })

  describe('POST /api/admin/feedback', () => {
    it('should create a new feedback successfully', async () => {
      const response = await supertest(web).post('/api/admin/feedback').set('Authorization', `Bearer ${userToken}`).send({
        rating: 5,
        suggestion: 'Excellent service from UBC unit!',
        unitId: unitUBC.id
      })

      logger.debug(JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(201)
      expect(response.body.data.rating).toBe(5)
      expect(response.body.data.suggestion).toBe('Excellent service from UBC unit!')
      expect(response.body.data.unit.id).toBe(unitUBC.id)
      expect(response.body.data.unit.code).toBe('UBC')
      expect(response.body.data.unit.name).toBe(unitUBC.name)
      expect(response.body.data.createdAt).toBeDefined()
    })

    it('should create feedback with only rating (no suggestion)', async () => {
      const response = await supertest(web).post('/api/admin/feedback').set('Authorization', `Bearer ${userToken}`).send({
        rating: 3,
        unitId: unitHO.id
      })

      logger.debug(JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(201)
      expect(response.body.data.rating).toBe(3)
      expect(response.body.data.suggestion).toBe(null)
      expect(response.body.data.unit.code).toBe('HO')
    })

    it('should fail to create feedback with invalid rating', async () => {
      const response = await supertest(web).post('/api/admin/feedback').set('Authorization', `Bearer ${userToken}`).send({
        rating: 6, // Invalid rating
        suggestion: 'This should fail',
        unitId: unitUBC.id
      })

      logger.debug(JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(400)
    })

    it('should fail to create feedback with non-existent unit', async () => {
      const response = await supertest(web).post('/api/admin/feedback').set('Authorization', `Bearer ${userToken}`).send({
        rating: 4,
        suggestion: 'Good service',
        unitId: 'non-existent-unit-id'
      })

      logger.debug(JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(404)
      expect(response.body.errors).toBe('Unit tidak ditemukan')
    })

    it('should fail to create feedback without unitId', async () => {
      const response = await supertest(web).post('/api/admin/feedback').set('Authorization', `Bearer ${userToken}`).send({
        rating: 4,
        suggestion: 'Good service'
        // missing unitId
      })

      logger.debug(JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Unit ID is required')
    })
  })

  describe('GET /api/admin/feedback', () => {
    beforeEach(async () => {
      // Membuat beberapa feedback untuk testing
      await prismaClient.feedback.createMany({
        data: [
          { rating: 5, suggestion: 'Excellent service!', unitId: unitUBC.id, ipAddress: '192.168.1.1' },
          { rating: 4, suggestion: 'Good service', unitId: unitHO.id, ipAddress: '192.168.1.2' },
          { rating: 3, suggestion: 'Average service', unitId: unitUBC.id, ipAddress: '192.168.1.3' },
          { rating: 2, suggestion: 'Below average', unitId: unitHO.id, ipAddress: '192.168.1.4' },
          { rating: 1, suggestion: 'Poor service', unitId: unitUBC.id, ipAddress: '192.168.1.5' }
        ]
      })
    })

    it('should get all feedbacks with pagination', async () => {
      // Now feedback listing is restricted to the user's unit; use userToken (UBC)
      const response = await supertest(web).get('/api/admin/feedback?page=1&limit=3').set('Authorization', `Bearer ${userToken}`)

      logger.debug(JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.data.feedbacks).toHaveLength(3)
      // Only UBC feedbacks should be counted (3 entries)
      expect(response.body.data.pagination.totalData).toBe(3)
      expect(response.body.data.pagination.page).toBe(1)
      expect(response.body.data.pagination.limit).toBe(3)
      expect(response.body.data.pagination.totalPage).toBe(1)

      // Check if unit data is included
      response.body.data.feedbacks.forEach((feedback: FeedbackResponse) => {
        expect(feedback.unit).toBeDefined()
        expect(feedback.unit.id).toBeDefined()
        expect(feedback.unit.code).toBeDefined()
        expect(feedback.unit.name).toBeDefined()
      })
    })

    it('should search feedbacks by suggestion', async () => {
      const response = await supertest(web).get('/api/admin/feedback?search=Excellent').set('Authorization', `Bearer ${adminToken}`)

      logger.debug(JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.data.feedbacks).toHaveLength(1)
      expect(response.body.data.feedbacks[0].suggestion).toContain('Excellent')
    })

    it('should search feedbacks by unit name', async () => {
      const response = await supertest(web)
        .get('/api/admin/feedback?search=' + unitUBC.name)
        .set('Authorization', `Bearer ${adminToken}`)

      logger.debug(JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.data.feedbacks.length).toBeGreaterThan(0)
      response.body.data.feedbacks.forEach((feedback: FeedbackResponse) => {
        expect(feedback.unit.name).toBe(unitUBC.name)
      })
    })

    it('should search feedbacks by rating', async () => {
      const response = await supertest(web).get('/api/admin/feedback?search=5').set('Authorization', `Bearer ${adminToken}`)

      logger.debug(JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.data.feedbacks).toHaveLength(1)
      expect(response.body.data.feedbacks[0].rating).toBe(5)
    })
  })

  describe('GET /api/admin/feedback/dashboard', () => {
    beforeEach(async () => {
      // Membuat feedback untuk testing dashboard
      await prismaClient.feedback.createMany({
        data: [
          { rating: 5, suggestion: 'Excellent!', unitId: unitUBC.id, ipAddress: '192.168.1.1' },
          { rating: 5, suggestion: 'Great!', unitId: unitUBC.id, ipAddress: '192.168.1.1' },
          { rating: 4, suggestion: 'Good', unitId: unitUBC.id, ipAddress: '192.168.1.1' },
          { rating: 4, suggestion: 'Nice', unitId: unitHO.id, ipAddress: '192.168.1.2' },
          { rating: 3, suggestion: 'Average', unitId: unitHO.id, ipAddress: '192.168.1.3' },
          { rating: 2, suggestion: 'Below average', unitId: unitHO.id, ipAddress: '192.168.1.4' },
          { rating: 1, suggestion: 'Poor', unitId: unitUBC.id, ipAddress: '192.168.1.5' }
        ]
      })
    })

    it('should get dashboard data with summary and rating distribution', async () => {
      const response = await supertest(web).get('/api/admin/feedback/dashboard?page=1&limit=5').set('Authorization', `Bearer ${adminToken}`)

      logger.debug(JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)

      // Check feedbacks data
      expect(response.body.data.feedbacks).toHaveLength(5)
      expect(response.body.data.pagination).toBeDefined()

      // Check summary data
      expect(response.body.data.summary.totalFeedbacks).toBe(7)
      expect(response.body.data.summary.ratingDistribution).toBeDefined()
      expect(response.body.data.summary.ratingDistribution.rating5).toBe(2)
      expect(response.body.data.summary.ratingDistribution.rating4).toBe(2)
      expect(response.body.data.summary.ratingDistribution.rating3).toBe(1)
      expect(response.body.data.summary.ratingDistribution.rating2).toBe(1)
      expect(response.body.data.summary.ratingDistribution.rating1).toBe(1)
    })

    it('should filter dashboard by unitId', async () => {
      const response = await supertest(web).get(`/api/admin/feedback/dashboard?unitId=${unitUBC.id}`).set('Authorization', `Bearer ${adminToken}`)

      logger.debug(JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)

      // All feedbacks should be from UBC unit
      response.body.data.feedbacks.forEach((feedback: FeedbackResponse) => {
        expect(feedback.unit.id).toBe(unitUBC.id)
      })

      // Summary should only count UBC feedbacks
      expect(response.body.data.summary.totalFeedbacks).toBe(4) // 4 feedbacks from UBC
      expect(response.body.data.summary.ratingDistribution.rating5).toBe(2)
      expect(response.body.data.summary.ratingDistribution.rating4).toBe(1)
      expect(response.body.data.summary.ratingDistribution.rating1).toBe(1)
    })
  })

  describe('GET /api/admin/feedback/:feedbackId', () => {
    let feedback: FeedbackResponse

    beforeEach(async () => {
      const createResponse = await supertest(web).post('/api/admin/feedback').set('Authorization', `Bearer ${userToken}`).send({
        rating: 4,
        suggestion: 'Test feedback for details',
        unitId: unitUBC.id
      })
      feedback = createResponse.body.data
    })

    it('should get feedback details successfully', async () => {
      const response = await supertest(web).get(`/api/admin/feedback/${feedback.id}`).set('Authorization', `Bearer ${adminToken}`)

      logger.debug(JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.data.id).toBe(feedback.id)
      expect(response.body.data.rating).toBe(4)
      expect(response.body.data.suggestion).toBe('Test feedback for details')
      expect(response.body.data.unit.id).toBe(unitUBC.id)
      expect(response.body.data.unit.code).toBe('UBC')
      expect(response.body.data.unit.name).toBe(unitUBC.name)
    })

    it('should fail to get non-existent feedback', async () => {
      const response = await supertest(web).get('/api/admin/feedback/non-existent-id').set('Authorization', `Bearer ${adminToken}`)

      logger.debug(JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(404)
      expect(response.body.errors).toBe('Feedback tidak ditemukan')
    })
  })
})
