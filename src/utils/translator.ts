import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { GEMINI_API_KEY } from '../config'
import { ResponseError } from '../error/response-error'
import { logger } from './logger'

const GEMINI_MODEL_NAME = 'gemini-2.5-flash'

type TranslationResult = { title: string; content: string }

type TranslationConfig = {
  targetLanguage: 'English' | 'Simplified Chinese'
}

function parseGeminiJson(text: string) {
  try {
    return JSON.parse(text)
  } catch (e) {
    const cleanText = text
      .replace(/^```json\s*/, '')
      .replace(/^```\s*/, '')
      .replace(/\s*```$/, '')
      .trim()

    return JSON.parse(cleanText)
  }
}

async function translateWithGemini(title: string, content: string, config: TranslationConfig): Promise<TranslationResult> {
  if (!GEMINI_API_KEY) {
    logger.error('GEMINI_API_KEY is missing in environment variables')
    throw new ResponseError(500, 'Konfigurasi Server Error (API Key)')
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL_NAME,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING },
            content: { type: SchemaType.STRING }
          },
          required: ['title', 'content']
        }
      }
    })

    const prompt = `
      You are a professional translator and editor for a news portal.
      Translate the following Indonesian article to ${config.targetLanguage} with a professional, neutral newsroom tone.

      Rules:
      1. Preserve all HTML tags (<p>, <b>, etc.) and structure exactly. Translate only the visible text content inside tags.
      2. Do not add commentary.
      3. Return valid JSON exactly matching this structure:
      {
        "title": "Translated Title string",
        "content": "Translated HTML content string"
      }

      Input Data:
      Title: ${title}
      Content: ${content}
    `

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    if (!text) {
      throw new Error('Respons Gemini kosong')
    }

    const parsed = parseGeminiJson(text)

    if (!parsed.title || !parsed.content) {
      logger.warn('Gemini response format invalid:', parsed)
      throw new Error('Respons Gemini tidak memiliki field title/content')
    }

    return { title: parsed.title, content: parsed.content }
  } catch (error: any) {
    logger.error('Translate publication gagal (Gemini)', {
      message: error?.message,
      modelUsed: GEMINI_MODEL_NAME,
      keyConfigured: !!GEMINI_API_KEY,
      rawResponse: error?.response,
      targetLanguage: config.targetLanguage
    })

    const target = config.targetLanguage === 'Simplified Chinese' ? 'Bahasa China' : 'Bahasa Inggris'
    throw new ResponseError(502, `Gagal menerjemahkan publikasi ke ${target}: ${error?.message}`)
  }
}

export async function translateToEnglish(title: string, content: string): Promise<TranslationResult> {
  return translateWithGemini(title, content, { targetLanguage: 'English' })
}

export async function translateToChinese(title: string, content: string): Promise<TranslationResult> {
  return translateWithGemini(title, content, { targetLanguage: 'Simplified Chinese' })
}
