import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { Button, Row, Col } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import image from '@/assets/401_images/401.gif'
import './style.css'
export default function Forbidden() {
  useI18n()

  const navigate = useNavigate(),
    [query] = useSearchParams()
  return (
    <main className="errPage-container">
      <Button
        className="pan-back-btn"
        icon={<ArrowLeftOutlined />}
        onClick={() => (query.has('noGoBack') ? navigate('/') : navigate(-1))}
      >
        {t('layout:error.back')}
      </Button>
      <Row>
        <Col span={12}>
          <h1 className="text-jumbo">{t('auth:401Error')}</h1>
          <h2>{t('layout:error.forbidden')}</h2>
          <h6>{t('layout:error.forbiddenHint')}</h6>
          <ul className="list-unstyled">
            <li>
              <Link to="/">{t('auth:backToHome')}</Link>
            </li>
          </ul>
        </Col>
        <Col span={12}>
          <img
            src={image}
            width="313"
            height="428"
            alt={t('auth:forbidden.illustration')}
          />
        </Col>
      </Row>
    </main>
  )
}
