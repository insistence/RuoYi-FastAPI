import { Link } from 'react-router-dom'
import image from '@/assets/404_images/404.png'
import cloud from '@/assets/404_images/404_cloud.png'
import './style.css'
export default function NotFound() {
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
          <div className="bullshit__oops">404错误!</div>
          <div className="bullshit__headline">找不到网页！</div>
          <div className="bullshit__info">
            对不起，您正在寻找的页面不存在。尝试检查URL的错误，然后按浏览器上的刷新按钮或尝试在我们的应用程序中找到其他内容。
          </div>
          <Link
            className="bullshit__return-home"
            to="/index"
          >
            返回首页
          </Link>
        </div>
      </div>
    </main>
  )
}
