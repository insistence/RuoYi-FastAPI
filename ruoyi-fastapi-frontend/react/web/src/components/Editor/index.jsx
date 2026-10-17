import { useEffect, useRef } from 'react'
import Quill from 'quill'
import DOMPurify from 'dompurify'
import request from '@/utils/request'
import { message } from '@/plugins/modal'
import 'quill/dist/quill.snow.css'
import './style.css'

const toolbar = [
  ['bold', 'italic', 'underline', 'strike'],
  ['blockquote', 'code-block'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ indent: '-1' }, { indent: '+1' }],
  [{ size: ['small', false, 'large', 'huge'] }],
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  ['clean'],
  ['link', 'image', 'video'],
]
export default function Editor({
  value = '',
  onChange,
  readOnly = false,
  minHeight = 192,
  height,
  fileSize = 5,
}) {
  const host = useRef(null),
    editor = useRef(null),
    change = useRef(onChange)
  change.current = onChange
  useEffect(() => {
    const container = document.createElement('div')
    host.current.append(container)
    const quill = new Quill(container, {
      theme: 'snow',
      readOnly,
      placeholder: '请输入内容',
      modules: { toolbar },
    })
    editor.current = quill
    quill.root.style.minHeight = `${minHeight}px`
    if (height) quill.root.style.height = `${height}px`
    quill.root.setAttribute('aria-label', '内容')
    quill.setContents(quill.clipboard.convert({ html: DOMPurify.sanitize(value || '') }), 'silent')
    const changed = (_, __, source) => {
      if (source === 'user') change.current?.(quill.root.innerHTML)
    }
    quill.on('text-change', changed)
    async function insertImage(file) {
      if (!file || !/^image\/(jpeg|png|gif|webp)$/.test(file.type))
        return message.error('请上传 JPG、PNG、GIF 或 WebP 图片')
      if (file.size > fileSize * 1024 * 1024)
        return message.error(`上传文件大小不能超过 ${fileSize} MB`)
      const index = quill.getSelection()?.index ?? quill.getLength() - 1
      const close = message.loading('正在上传图片', 0)
      try {
        const data = new FormData()
        data.append('file', file)
        const result = await request({
          url: '/common/upload',
          method: 'post',
          data,
          headers: {
            'Content-Type': 'multipart/form-data',
            repeatSubmit: false,
          },
        })
        if (!editor.current) return
        quill.insertEmbed(
          index,
          'image',
          /^https?:/.test(result.fileName)
            ? result.fileName
            : import.meta.env.VITE_APP_BASE_API + result.fileName,
          'user'
        )
        quill.setSelection(index + 1)
      } catch {
      } finally {
        close()
      }
    }
    quill.getModule('toolbar').addHandler('image', () => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/jpeg,image/png,image/gif,image/webp'
      input.onchange = () => insertImage(input.files[0])
      input.click()
    })
    const paste = (event) => {
      const files = [...(event.clipboardData?.items || [])].filter((item) =>
        item.type.startsWith('image/')
      )
      if (files.length) {
        event.preventDefault()
        event.stopImmediatePropagation()
        files.forEach((item) => void insertImage(item.getAsFile()))
      }
    }
    quill.root.addEventListener('paste', paste, true)
    return () => {
      quill.off('text-change', changed)
      quill.root.removeEventListener('paste', paste, true)
      quill.disable()
      editor.current = null
      host.current?.replaceChildren()
    }
  }, [])
  useEffect(() => {
    const quill = editor.current
    if (quill && value !== quill.root.innerHTML)
      quill.setContents(
        quill.clipboard.convert({ html: DOMPurify.sanitize(value || '') }),
        'silent'
      )
  }, [value])
  useEffect(() => {
    editor.current?.enable(!readOnly)
  }, [readOnly])
  return (
    <div
      className="ruoyi-editor"
      ref={host}
    />
  )
}
