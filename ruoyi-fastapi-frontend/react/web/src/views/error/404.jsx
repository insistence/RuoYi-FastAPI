import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { Link } from 'react-router-dom'
import image from '@/assets/404_images/404.png'
import cloud from '@/assets/404_images/404_cloud.png'
import './style.css'
export default function NotFound() {
  useI18n()

  return (
    <main className="wscn-http404-container">
      <div className="wscn-http404">
        <div className="pic-404">
          <img
            className="pic-404__parent"
            src={image}
            alt="404"
          />
          {['left', 'mid', 'right'].map((side) => (
            <img
              key={side}
              className={`pic-404__child ${side}`}
              src={cloud}
              alt=""
            />
          ))}
        </div>
        <div className="bullshit">
          <div className="bullshit__oops">{t('auth:404Error')}</div>
          <div className="bullshit__headline">{t('layout:error.notFound')}</div>
          <div className="bullshit__info">{t('auth:thePageYouAreLookingForDoesNotExist')}</div>
          <Link
            className="bullshit__return-home"
            to="/index"
          >
            {t('layout:error.home')}
          </Link>
        </div>
      </div>
    </main>
  )
}
