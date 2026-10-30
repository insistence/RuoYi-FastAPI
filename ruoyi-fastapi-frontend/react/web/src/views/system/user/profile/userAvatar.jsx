import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
import { useEffect, useRef, useState } from 'react'
import { Avatar, Button, Col, Modal, Row, Upload } from 'antd'
import Cropper from 'react-easy-crop'
import {
  UploadOutlined,
  PlusOutlined,
  MinusOutlined,
  UndoOutlined,
  RedoOutlined,
} from '@ant-design/icons'
import { uploadAvatar } from '@/api/system/user'
import useUserStore from '@/store/modules/user'
import { message } from '@/plugins/modal'

async function cropImage(source, area, rotation) {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.src = source
  await image.decode()
  const angle = (rotation * Math.PI) / 180
  const width = Math.abs(Math.cos(angle) * image.width) + Math.abs(Math.sin(angle) * image.height)
  const height = Math.abs(Math.sin(angle) * image.width) + Math.abs(Math.cos(angle) * image.height)
  const rotated = document.createElement('canvas')
  rotated.width = Math.round(width)
  rotated.height = Math.round(height)
  const context = rotated.getContext('2d')
  context.translate(width / 2, height / 2)
  context.rotate(angle)
  context.drawImage(image, -image.width / 2, -image.height / 2)
  const result = document.createElement('canvas')
  result.width = 200
  result.height = 200
  result
    .getContext('2d')
    .drawImage(rotated, area.x, area.y, area.width, area.height, 0, 0, 200, 200)
  return new Promise((resolve, reject) =>
    result.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(t('system:unableToCropTheImage')))),
      'image/png'
    )
  )
}
export default function UserAvatar() {
  useI18n()

  const avatar = useUserStore((state) => state.avatar),
    objectUrl = useRef(null)
  const [open, setOpen] = useState(false),
    [visible, setVisible] = useState(false),
    [source, setSource] = useState(avatar),
    [crop, setCrop] = useState({ x: 0, y: 0 }),
    [zoom, setZoom] = useState(1),
    [rotation, setRotation] = useState(0),
    [area, setArea] = useState(null),
    [saving, setSaving] = useState(false),
    [preview, setPreview] = useState('')
  useEffect(() => {
    if (!open || !area || !source) return
    let active = true,
      url
    cropImage(source, area, rotation)
      .then((blob) => {
        if (!active) return
        url = URL.createObjectURL(blob)
        setPreview(url)
      })
      .catch(() => {})
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [open, source, area, rotation])
  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    },
    []
  )
  function selectFile(file) {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      message.error(t('system:uploadAJpgPngWebpOrGifImage'))
      return Upload.LIST_IGNORE
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = URL.createObjectURL(file)
    setSource(objectUrl.current)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    return false
  }
  async function submit() {
    if (!area) return
    setSaving(true)
    try {
      const blob = await cropImage(source, area, rotation)
      const data = new FormData()
      data.append('avatarfile', blob, 'avatar.png')
      const response = await uploadAvatar(data)
      useUserStore.setState({
        avatar: /^https?:/.test(response.imgUrl)
          ? response.imgUrl
          : import.meta.env.VITE_APP_BASE_API + response.imgUrl,
      })
      message.success(t('common:updateSuccess'))
      setOpen(false)
    } catch (error) {
      message.error(error.message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <Button
        type="text"
        aria-label={t('system:changeAvatar')}
        title={t('system:clickToUploadAvatar')}
        className="user-avatar-button"
        onClick={() => {
          setSource(avatar)
          setCrop({ x: 0, y: 0 })
          setZoom(1)
          setRotation(0)
          setOpen(true)
        }}
      >
        <Avatar
          size={120}
          src={avatar}
        />
      </Button>
      <Modal
        className="avatar-crop-dialog"
        title={t('system:changeAvatar')}
        footer={null}
        open={open}
        afterOpenChange={setVisible}
        onCancel={() => setOpen(false)}
        onOk={submit}
        confirmLoading={saving}
        width="800px"
      >
        <Row>
          <Col
            xs={24}
            md={12}
          >
            <div className="avatar-crop-area">
              {visible && (
                <Cropper
                  image={source}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, pixels) => setArea(pixels)}
                />
              )}
            </div>
          </Col>
          <Col
            xs={24}
            md={12}
          >
            <div className="avatar-preview-area">
              <img
                src={preview || source}
                alt={t('system:avatarCropPreview')}
              />
            </div>
          </Col>
        </Row>
        <Row
          className="avatar-crop-actions"
          align="middle"
        >
          <Col
            lg={2}
            md={2}
          >
            <Upload
              beforeUpload={selectFile}
              showUploadList={false}
              accept="image/jpeg,image/png,image/webp,image/gif"
            >
              <Button>
                {t('layout:search.select')} <UploadOutlined />
              </Button>
            </Upload>
          </Col>
          <Col
            lg={{ span: 1, offset: 2 }}
            md={2}
          >
            <Button
              icon={<PlusOutlined />}
              aria-label={t('system:zoomIn')}
              onClick={() => setZoom((value) => Math.min(3, value + 0.1))}
            />
          </Col>
          <Col
            lg={{ span: 1, offset: 1 }}
            md={2}
          >
            <Button
              icon={<MinusOutlined />}
              aria-label={t('system:zoomOut')}
              onClick={() => setZoom((value) => Math.max(1, value - 0.1))}
            />
          </Col>
          <Col
            lg={{ span: 1, offset: 1 }}
            md={2}
          >
            <Button
              icon={<UndoOutlined />}
              aria-label={t('system:rotateLeft')}
              onClick={() => setRotation((value) => value - 90)}
            />
          </Col>
          <Col
            lg={{ span: 1, offset: 1 }}
            md={2}
          >
            <Button
              icon={<RedoOutlined />}
              aria-label={t('system:rotateRight')}
              onClick={() => setRotation((value) => value + 90)}
            />
          </Col>
          <Col
            lg={{ span: 2, offset: 6 }}
            md={2}
          >
            <Button
              type="primary"
              loading={saving}
              onClick={submit}
            >
              {t('system:submit')}
            </Button>
          </Col>
        </Row>
      </Modal>
    </>
  )
}
