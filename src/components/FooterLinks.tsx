import { Home } from "react-feather";
import {
  SiRss,
  SiGithub,
  SiInstagram,
  SiDiscord,
} from "@icons-pack/react-simple-icons";

const linkClass = "text-amber-500 hover:text-amber-400 transition";

export default function FooterLinks() {
  return (
    <div className="flex flex-row justify-center gap-x-5">
      <a
        href="https://purduehackers.com"
        className={linkClass}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Purdue Hackers homepage"
      >
        <Home height={22} width={22} />
      </a>
      <a
        href="https://blog.purduehackers.com/rss.xml"
        className={linkClass}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="RSS feed"
      >
        <SiRss height={22} width={22} />
      </a>
      <a
        href="https://github.com/purduehackers"
        className={linkClass}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub"
      >
        <SiGithub height={22} width={22} />
      </a>
      <a
        href="https://instagram.com/purduehackers"
        className={linkClass}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Instagram"
      >
        <SiInstagram height={22} width={22} />
      </a>
      <a
        href="https://puhack.horse/discord"
        className={linkClass}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Discord"
      >
        <SiDiscord height={22} width={22} />
      </a>
    </div>
  );
}
