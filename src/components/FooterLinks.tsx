import { Home } from "react-feather";
import {
  SiRss,
  SiGithub,
  SiInstagram,
  SiDiscord,
} from "@icons-pack/react-simple-icons";

export default function FooterLinks() {
  return (
    <div className="flex flex-row justify-center gap-x-5">
      <a
        href="https://purduehackers.com"
        className="hover:text-gray-600 transition text-black"
        target="_blank"
      >
        <Home height={27} width={27} />
      </a>
      <a
        href="https://blog.purduehackers.com/rss.xml"
        className="hover:text-gray-600 transition text-black"
        target="_blank"
      >
        <SiRss height={27} width={27} />
      </a>
      <a
        href="https://github.com/purduehackers"
        className="hover:text-gray-600 transition text-black"
        target="_blank"
      >
        <SiGithub height={27} width={27} />
      </a>
      <a
        href="https://instagram.com/purduehackers"
        className="hover:text-gray-600 transition text-black"
        target="_blank"
      >
        <SiInstagram height={27} width={27} />
      </a>
      <a
        href="https://puhack.horse/discord"
        className="hover:text-gray-600 transition text-black"
        target="_blank"
      >
        <SiDiscord height={27} width={27} />
      </a>
    </div>
  );
}
