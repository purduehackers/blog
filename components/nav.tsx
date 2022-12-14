import { useRouter } from 'next/router'
import BackButton from './back-button'

const Nav = () => {
  const { pathname } = useRouter()

  return (
    <nav className="w-full top-0 z-10">
      <div className="container px-4 sm:px-8 md:px-14 mx-auto flex">
        {pathname !== '/' && <BackButton />}
        <div className="grow" />
      </div>
    </nav>
  )
}

export default Nav
