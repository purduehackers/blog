import Link from 'next/link'
import { ArrowLeft } from 'react-feather'

const BackButton = () => (
  <Link href="/">
    <a className="flex flex-row justify-left hover:text-gray-600 transition py-4 group">
      <ArrowLeft className="group-hover:-translate-x-1 transition-transform mr-1" />
      All Posts
    </a>
  </Link>
)

export default BackButton
