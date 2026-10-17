import { cropImage } from '@/utils/cropImage'
import { imageInfo } from '@/utils/imageInfo'
import React, { useRef, useState } from 'react'
import Taro, { useReady } from '@tarojs/taro'
import { View, Image, Text, Canvas } from '@tarojs/components'
import Button from '@/components/ActionButton'
import { uploadAvatar } from '@/api/system/user'
import { useUserStore } from '@/store'
import { avatarUrl } from '@/store/modules/user'
import { usePageAuth } from '@/permission'
import { getToken } from '@/utils/auth'
import { initialCrop, moveCrop, resizeCrop, sourceCrop } from '@/utils/avatarCrop'
export default function Avatar() {
  const allowed = usePageAuth()
  const [image, setImage] = useState(null)
  const [crop, setCrop] = useState(null)
  const [view, setView] = useState({ width: 300, height: 300 })
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState('')
  const drag = useRef(null)
  const canvasId = 'avatar-canvas'
  async function load(src) {
    try {
      const info = await imageInfo(src)
      const windowWidth = Taro.getSystemInfoSync().windowWidth
      const ratio = Math.min((windowWidth - 32) / info.width, (windowWidth - 32) / info.height)
      const size = { width: info.width * ratio, height: info.height * ratio }
      setImage({ ...info, src: info.path || src })
      setView(size)
      setCrop(initialCrop(size.width, size.height))
      setError('')
    } catch (failure) {
      setError(failure.errMsg || failure.message || '图片加载失败，请重新选择头像')
    }
  }
  useReady(() => {
    if (getToken()) load(useUserStore.getState().avatar)
  })
  async function choose() {
    if (busy) return
    try {
      const result = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      })
      await load(result.tempFilePaths[0])
    } catch (failure) {
      if (!/cancel/i.test(failure.errMsg || '')) setError('选择图片失败')
    }
  }
  function start(event, mode) {
    event.stopPropagation()
    if (busy) return
    const touch = event.touches[0]
    drag.current = { mode, x: touch.pageX, y: touch.pageY, crop }
  }
  function move(event) {
    event.stopPropagation()
    event.preventDefault?.()
    const initial = drag.current
    if (!initial || busy) return
    const touch = event.touches[0]
    const transform = initial.mode === 'move' ? moveCrop : resizeCrop
    setCrop(
      transform(
        initial.crop,
        touch.pageX - initial.x,
        touch.pageY - initial.y,
        view.width,
        view.height,
        initial.mode
      )
    )
  }
  async function submit() {
    if (!image || !crop || lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const selected = sourceCrop(crop, view, image)
      const croppedPath = await cropImage(image.src, selected, canvasId)
      const response = await uploadAvatar({
        name: 'avatarfile',
        filePath: croppedPath,
      })
      useUserStore.getState().SET_AVATAR(avatarUrl(response.imgUrl))
      await Taro.showToast({ title: '修改成功', icon: 'success' })
      Taro.navigateBack()
    } catch (failure) {
      setError(failure.message || failure.errMsg || '头像上传失败')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  if (!allowed) return null
  const outputHeight = crop ? Math.max(1, Math.round((400 * crop.height) / crop.width)) : 400
  return (
    <View className="mobile-page bg-black text-white">
      <Text className="block text-sm text-center text-gray-300">
        拖动选框调整位置，拖动四边或右下角调整大小
      </Text>
      {image && crop && (
        <View
          className="crop-stage"
          style={{ width: `${view.width}px`, height: `${view.height}px` }}
        >
          <Image
            src={image.src}
            style={{ width: `${view.width}px`, height: `${view.height}px` }}
          />
          <View
            className="crop-frame"
            style={{
              left: `${crop.x}px`,
              top: `${crop.y}px`,
              width: `${crop.width}px`,
              height: `${crop.height}px`,
            }}
            onTouchStart={(event) => start(event, 'move')}
            onTouchMove={move}
            onTouchEnd={() => {
              drag.current = null
            }}
          >
            {['top', 'right', 'bottom', 'left', 'bottom-right'].map((edge) => (
              <View
                key={edge}
                className={`crop-handle crop-handle-${edge}`}
                onTouchStart={(event) => start(event, edge)}
                onTouchMove={move}
                onTouchEnd={() => {
                  drag.current = null
                }}
              />
            ))}
          </View>
        </View>
      )}
      {error && <Text className="mobile-error">{error}</Text>}
      <View className="avatar-actions">
        <Button
          className="mobile-button avatar-button"
          onClick={choose}
          disabled={busy}
        >
          选择头像
        </Button>
        <Button
          className="mobile-button avatar-button avatar-submit"
          onClick={submit}
          disabled={busy || !image}
          loading={busy}
        >
          提 交
        </Button>
      </View>
      <Canvas
        id={canvasId}
        canvasId={canvasId}
        style={{
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          width: '400px',
          height: `${outputHeight}px`,
        }}
      />
    </View>
  )
}
