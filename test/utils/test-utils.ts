import { prismaClient } from '../../src/application/database'
import bcrypt from 'bcrypt'
import { Role, User } from '@prisma/client'
import { signAccessToken } from '../../src/utils/jwt'

export type UserWithRole = User & { role: Role }

type CreateUserRequest = {
  email: string
  name: string
  roleName: string
  unitCode: string
}

export class UserTest {
  static async createUserByRole(request: CreateUserRequest): Promise<UserWithRole> {
    const role = await prismaClient.role.findUnique({ where: { name: request.roleName } })
    if (!role) throw new Error(`Role '${request.roleName}' tidak ditemukan. Jalankan seeder.`)

    const unit = await prismaClient.unit.findUnique({ where: { code: request.unitCode } })
    if (!unit) throw new Error(`Unit '${request.unitCode}' tidak ditemukan. Jalankan seeder.`)

    return prismaClient.user.create({
      data: {
        email: request.email,
        name: request.name,
        password: await bcrypt.hash('password123', 10),
        roleId: role.id,
        unitId: unit.id
      },
      include: { role: true }
    })
  }

  static async createAdmin(): Promise<UserWithRole> {
    return this.createUserByRole({
      email: 'test.admin@example.com',
      name: 'Test Admin',
      roleName: 'Admin',
      unitCode: 'HO'
    })
  }

  static generateToken(user: UserWithRole): string {
    return signAccessToken({ userId: user.id, role: user.role.name })
  }

  static async delete() {
    await prismaClient.user.deleteMany({ where: { email: { startsWith: 'test.' } } })
  }
}
