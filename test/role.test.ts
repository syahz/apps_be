import supertest from 'supertest'
import { web } from '../src/application/web'
import { logger } from '../src/utils/logger'
import { UserTest, UserWithRole } from './utils/test-utils'
import { prismaClient } from '../src/application/database'

describe('Role API (/api/admin/roles)', () => {
  let adminUser: UserWithRole
  let adminToken: string

  beforeAll(async () => {
    adminUser = await UserTest.createAdmin()
    adminToken = UserTest.generateToken(adminUser)
  })

  afterAll(async () => {
    await UserTest.delete()
  })

  // Bersihkan data role yang dibuat khusus untuk tes setelah setiap tes selesai
  afterEach(async () => {
    await prismaClient.role.deleteMany({
      where: {
        name: { startsWith: 'TEST-' }
      }
    })
  })

  describe('POST /api/admin/roles', () => {
    it('should create a new role successfully', async () => {
      const response = await supertest(web).post('/api/admin/roles').set('Authorization', `Bearer ${adminToken}`).send({ name: 'TEST-RoleBaru' })

      logger.debug('POST /api/admin/roles (success): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(201)
      expect(response.body.data.name).toBe('TEST-RoleBaru')
    })

    it('should fail with 409 if role name already exists', async () => {
      await prismaClient.role.create({ data: { name: 'TEST-DUP' } })

      const response = await supertest(web).post('/api/admin/roles').set('Authorization', `Bearer ${adminToken}`).send({ name: 'TEST-DUP' })

      logger.debug('POST /api/admin/roles (duplicate): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(409)
      expect(response.body.errors).toBe('Nama role sudah ada')
    })

    it('should fail with 401 if not authenticated', async () => {
      const response = await supertest(web).post('/api/admin/roles').send({ name: 'TEST-NoAuth' })

      logger.debug('POST /api/admin/roles (unauthenticated): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/admin/roles', () => {
    beforeEach(async () => {
      await prismaClient.role.createMany({ data: [{ name: 'TEST-Role A' }, { name: 'TEST-Role B' }, { name: 'TEST-Role C' }] })
    })

    it('should get a paginated list of roles', async () => {
      const response = await supertest(web).get('/api/admin/roles?page=1&limit=2&search=TEST-Role').set('Authorization', `Bearer ${adminToken}`)

      logger.debug('GET /api/admin/roles (paginated): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.data.roles).toHaveLength(2)
      expect(response.body.data.pagination.total_data).toBe(3)
    })

    it('should filter roles by search query', async () => {
      const response = await supertest(web).get('/api/admin/roles?search=Role B').set('Authorization', `Bearer ${adminToken}`)

      logger.debug('GET /api/admin/roles (search): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.data.roles).toHaveLength(1)
      expect(response.body.data.roles[0].name).toBe('TEST-Role B')
    })
  })

  describe('GET /api/admin/roles/all', () => {
    it('should get all roles without pagination', async () => {
      const totalRoles = await prismaClient.role.count()
      await prismaClient.role.createMany({ data: [{ name: 'TEST-X' }, { name: 'TEST-Y' }] })

      const response = await supertest(web).get('/api/admin/roles/all').set('Authorization', `Bearer ${adminToken}`)

      logger.debug('GET /api/admin/roles/all: %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.data.length).toBe(totalRoles + 2)
    })
  })

  describe('GET /api/admin/roles/:roleId', () => {
    it('should get a role by its ID', async () => {
      const newRole = await prismaClient.role.create({ data: { name: 'TEST-Detail' } })

      const response = await supertest(web).get(`/api/admin/roles/${newRole.id}`).set('Authorization', `Bearer ${adminToken}`)

      logger.debug('GET /api/admin/roles/:roleId (success): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.data.name).toBe('TEST-Detail')
    })

    it('should fail with 404 if role ID is not found', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await supertest(web).get(`/api/admin/roles/${nonExistentId}`).set('Authorization', `Bearer ${adminToken}`)

      logger.debug('GET /api/admin/roles/:roleId (not found): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(404)
    })
  })

  describe('PUT /api/admin/roles/:roleId', () => {
    it('should update a role successfully', async () => {
      const roleToUpdate = await prismaClient.role.create({ data: { name: 'TEST-Old' } })

      const response = await supertest(web)
        .put(`/api/admin/roles/${roleToUpdate.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'TEST-Updated' })

      logger.debug('PUT /api/admin/roles/:roleId (success): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.data.name).toBe('TEST-Updated')
    })

    it('should fail with 409 if new name already exists', async () => {
      await prismaClient.role.create({ data: { name: 'TEST-Exist' } })
      const roleToUpdate = await prismaClient.role.create({ data: { name: 'TEST-ToUpdate' } })

      const response = await supertest(web)
        .put(`/api/admin/roles/${roleToUpdate.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'TEST-Exist' })

      logger.debug('PUT /api/admin/roles/:roleId (duplicate name): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(409)
    })
  })

  describe('DELETE /api/admin/roles/:roleId', () => {
    it('should delete a role successfully if not in use', async () => {
      const roleToDelete = await prismaClient.role.create({ data: { name: 'TEST-Delete' } })

      const response = await supertest(web).delete(`/api/admin/roles/${roleToDelete.id}`).set('Authorization', `Bearer ${adminToken}`)

      logger.debug('DELETE /api/admin/roles/:roleId (success): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.data.message).toBe('Role berhasil dihapus')

      const findRole = await prismaClient.role.findUnique({ where: { id: roleToDelete.id } })
      expect(findRole).toBeNull()
    })

    it('should fail with 400 if role is still in use by a user', async () => {
      const adminRole = await prismaClient.role.findUnique({ where: { name: 'Admin' } })

      const response = await supertest(web).delete(`/api/admin/roles/${adminRole!.id}`).set('Authorization', `Bearer ${adminToken}`)

      logger.debug('DELETE /api/admin/roles/:roleId (in use): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(400)
      expect(response.body.errors).toContain('Role tidak dapat dihapus')
    })
  })
})
