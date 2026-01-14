import { Request, Response, NextFunction } from 'express'
import { CreateCategoryRequest, UpdateCategoryRequest } from '../models/category-model'
import { createCategory, getCategories, getAllCategories, getCategoryById, updateCategory, deleteCategory } from '../services/category-services'

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request: CreateCategoryRequest = req.body as CreateCategoryRequest
    const response = await createCategory(request)
    res.status(201).json({ data: response })
  } catch (error) {
    next(error)
  }
}

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categoryId = String(req.params.categoryId)
    if (!uuidRegex.test(categoryId)) {
      return res.status(400).json({ errors: 'Invalid UUID format for Category Id' })
    }
    const request: UpdateCategoryRequest = req.body as UpdateCategoryRequest
    const response = await updateCategory(categoryId, request)
    res.status(200).json({ data: response })
  } catch (error) {
    next(error)
  }
}

export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const search = (req.query.search as string) || ''
    const response = await getCategories(page, limit, search)
    res.status(200).json({ data: response })
  } catch (error) {
    next(error)
  }
}

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await getAllCategories()
    res.status(200).json({ data: response })
  } catch (error) {
    next(error)
  }
}

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categoryId = String(req.params.categoryId)
    if (!uuidRegex.test(categoryId)) {
      return res.status(400).json({ errors: 'Invalid UUID format for Category Id' })
    }
    const response = await getCategoryById(categoryId)
    res.status(200).json({ data: response })
  } catch (error) {
    next(error)
  }
}

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categoryId = String(req.params.categoryId)
    if (!uuidRegex.test(categoryId)) {
      return res.status(400).json({ errors: 'Invalid UUID format for Category Id' })
    }
    const response = await deleteCategory(categoryId)
    res.status(200).json({ data: response })
  } catch (error) {
    next(error)
  }
}
