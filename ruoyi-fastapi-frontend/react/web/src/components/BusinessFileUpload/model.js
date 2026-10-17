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
  if (count >= limit) return `上传文件数量不能超过 ${limit} 个`
  const extension = file.name.split('.').pop().toLowerCase()
  if (fileType.length && !fileType.map((type) => type.toLowerCase()).includes(extension))
    return `文件格式不正确，请上传 ${fileType.join('/')} 格式文件`
  if (file.name.includes(',')) return '文件名称不能包含英文逗号'
  if (fileSize && file.size > fileSize * 1024 * 1024) return `上传文件大小不能超过 ${fileSize} MB`
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
  if (!source.fileId || !source.downloadUrl) throw new Error('上传响应缺少文件ID或下载地址')
  return {
    fileId: source.fileId,
    name: source.originalFilename || filename,
    url: source.downloadUrl,
  }
}
