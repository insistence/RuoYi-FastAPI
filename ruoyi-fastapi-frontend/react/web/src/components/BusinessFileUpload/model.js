import { t } from '@/i18n'
export function normalizeFiles(value) {
  return (Array.isArray(value) ? value : [])
    .filter((file) => file && typeof file === 'object' && file.fileId)
    .map((file) => {
      const url = file.url || file.downloadUrl || file.fileName || ''
      let name = url.split('?')[0].split('/').pop()
      try {
        name = decodeURIComponent(name)
      } catch {}
      return { fileId: file.fileId, name: file.name || file.originalFilename || name, url }
    })
    .filter((file) => file.url)
}
export function validateFile(file, { count, limit, fileSize, fileType }) {
  if (count >= limit) return t('file:youCanUploadUpToValueFiles', { limit })
  const extension = file.name.split('.').pop().toLowerCase()
  if (fileType.length && !fileType.map((type) => type.toLowerCase()).includes(extension))
    return t('file:invalidFileFormatUploadAValueFile', { arg0: fileType.join('/') })
  if (file.name.includes(',')) return t('file:upload.nameComma')
  if (fileSize && file.size > fileSize * 1024 * 1024)
    return t('file:uploadedFilesCannotExceedValueMb', { fileSize })
  return ''
}
export function appendUploadData(body, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue
    for (const item of Array.isArray(value) ? value : [value]) body.append(key, item)
  }
}
export function uploadedFile(response, filename) {
  const source = response.data || response
  if (!source.fileId || !source.downloadUrl)
    throw new Error(t('file:theUploadResponseIsMissingAFileIdOr'))
  return {
    fileId: source.fileId,
    name: source.originalFilename || filename,
    url: source.downloadUrl,
  }
}
