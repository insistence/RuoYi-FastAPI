import { Navigate, useLocation } from 'react-router-dom'
export default function Redirect() {
  const { pathname, search, hash } = useLocation()
  const path = pathname.replace(/^\/redirect\/?/, '/')
  return (
    <Navigate
      replace
      to={`${path.startsWith('//') || path.startsWith('/redirect/') ? '/index' : path}${search}${hash}`}
    />
  )
}
