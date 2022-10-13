import Link from 'next/link'
import { ArrowLeft } from 'react-feather'

const BackButton = () => (
  <div className="p-4">
    <Link href="/">
      <a className="flex flex-row justify-left hover:text-gray-600 transition">
        <ArrowLeft />
        All Posts
      </a>
    </Link>
  </div>
)

export default BackButton
