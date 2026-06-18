import apiClient from './client'

const SPLIT_PDF_CHUNK_THRESHOLD = 20 * 1024 * 1024
const SPLIT_PDF_CHUNK_SIZE = 4 * 1024 * 1024

function makeUploadId() {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID()
  }
  if (cryptoObj?.getRandomValues) {
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
      (
        Number(c) ^
        (cryptoObj.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))
      ).toString(16)
    )
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function isPayloadTooLarge(err) {
  return err?.response?.status === 413
}

async function uploadSplitPdfChunks(file, onProgress) {
  const uploadId = makeUploadId()
  const totalChunks = Math.ceil(file.size / SPLIT_PDF_CHUNK_SIZE)

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * SPLIT_PDF_CHUNK_SIZE
    const end = Math.min(start + SPLIT_PDF_CHUNK_SIZE, file.size)
    const formData = new FormData()
    formData.append('chunk_index', String(chunkIndex))
    formData.append('total_chunks', String(totalChunks))
    formData.append('total_size', String(file.size))
    formData.append('filename', file.name)
    formData.append('file', file.slice(start, end), file.name)

    await apiClient.post(`/lessons/split-pdf/uploads/${uploadId}/chunks`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) return
        const loaded = Math.min(start + event.loaded, file.size)
        onProgress(Math.min(99, Math.round((loaded * 99) / file.size)))
      },
    })
  }

  onProgress?.(100)
  return uploadId
}

async function splitPdfDirect(url, file, onProgress) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await apiClient.post(url, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded * 100) / event.total))
      }
    },
  })
  return response.data
}

async function splitPdfChunked(kind, id, file, onProgress) {
  const uploadId = await uploadSplitPdfChunks(file, onProgress)
  const target =
    kind === 'module'
      ? `/lessons/module/${id}/split-pdf/uploads/${uploadId}/complete`
      : `/lessons/course/${id}/split-pdf/uploads/${uploadId}/complete`
  const response = await apiClient.post(target)
  return response.data
}

async function splitPdfWithFallback(kind, id, file, onProgress) {
  if (file.size > SPLIT_PDF_CHUNK_THRESHOLD) {
    return splitPdfChunked(kind, id, file, onProgress)
  }

  const directUrl =
    kind === 'module' ? `/lessons/module/${id}/split-pdf` : `/lessons/course/${id}/split-pdf`

  try {
    return await splitPdfDirect(directUrl, file, onProgress)
  } catch (err) {
    if (!isPayloadTooLarge(err)) throw err
    onProgress?.(0)
    return splitPdfChunked(kind, id, file, onProgress)
  }
}

export const lessonsApi = {
  create: async (data) => {
    const response = await apiClient.post('/lessons', data)
    return response.data
  },
  update: async (id, data) => {
    const response = await apiClient.put(`/lessons/${id}`, data)
    return response.data
  },
  delete: async (id) => {
    const response = await apiClient.delete(`/lessons/${id}`)
    return response.data
  },
  uploadVideo: async (lessonId, file, onProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post(`/lessons/${lessonId}/upload-video`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded * 100) / event.total))
        }
      },
    })
    return response.data
  },
  uploadPdf: async (lessonId, file, onProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post(`/lessons/${lessonId}/upload-pdf`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded * 100) / event.total))
        }
      },
    })
    return response.data
  },
  // Upload one PDF and auto-split it into multiple lessons by its table of
  // contents (bookmarks). Appends the created lessons to the given module.
  // Returns { created_count, lessons: [...] }.
  splitPdf: async (moduleId, file, onProgress) => {
    return splitPdfWithFallback('module', moduleId, file, onProgress)
  },
  // Upload one PDF and auto-split it into MODULES (top-level TOC headings) +
  // LESSONS (their sub-headings). Appends the created modules to the course.
  // Returns { created_modules, created_lessons, modules: [...] }.
  splitPdfIntoModules: async (courseId, file, onProgress) => {
    return splitPdfWithFallback('course', courseId, file, onProgress)
  },

  // === Supplementary resources (downloads / external links) ===
  listResources: async (lessonId) => {
    const response = await apiClient.get(`/lessons/${lessonId}/resources`)
    return Array.isArray(response.data) ? response.data : []
  },
  addResource: async (lessonId, { title, url, resource_type, file_size }) => {
    const response = await apiClient.post(`/lessons/${lessonId}/resources`, {
      title,
      url,
      resource_type: resource_type || null,
      file_size: file_size ?? null,
    })
    return response.data
  },
  deleteResource: async (resourceId) => {
    const response = await apiClient.delete(`/lessons/resources/${resourceId}`)
    return response.data
  },

  // === Personal notes (per-user, per-lesson, upsert) ===
  getMyNote: async (lessonId) => {
    const response = await apiClient.get(`/lessons/${lessonId}/notes/me`)
    return response.data // { content, updated_at }
  },
  saveMyNote: async (lessonId, content) => {
    const response = await apiClient.put(`/lessons/${lessonId}/notes/me`, {
      content,
    })
    return response.data
  },
}
