import { Home } from 'react-feather'
import { Instagram, Discord, Github } from '@icons-pack/react-simple-icons'

const FooterLinks = () => (
  <div className="flex flex-row justify-center gap-x-5">
    <a
      href="https://purduehackers.com"
      className="hover:text-gray-600 transition"
      target="_blank"
    >
      <Home />
    </a>
    <a
      href="https://github.com/purduehackers"
      className="hover:text-gray-600 transition"
      target="_blank"
    >
      <Github />
    </a>
    <a
      href="https://instagram.com/purduehackers"
      className="hover:text-gray-600 transition"
      target="_blank"
    >
      <Instagram />
    </a>
    <a
      href="https://puhack.horse/discord"
      className="hover:text-gray-600 transition"
      target="_blank"
    >
      <Discord />
    </a>
  </div>
)

export default FooterLinks
