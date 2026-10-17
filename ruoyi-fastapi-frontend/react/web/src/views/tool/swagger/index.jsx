import IFrame from '@/components/iFrame'
export default function Swagger() {
  return (
    <IFrame
      src={`${import.meta.env.VITE_APP_BASE_API}/proxy-docs`}
      title="系统接口文档"
    />
  )
}
