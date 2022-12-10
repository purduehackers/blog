import FooterLinks from './footer-links'

const Footer = () => (
  <div className="bg-gray-200 text-center bottom-0 mt-auto w-full flex flex-col justify-center gap-y-4 py-12 px-4">
    <p className="text-lg">
      Made with 💛 and ⚡️ •{' '}
      <span className="underline underline-offset-4 decoration-2">
        <a
          href="https://github.com/purduehackers/blog"
          target="_blank"
          className="decoration-amber-400 dark:decoration-amber-500 hover:decoration-[3px]"
        >
          Open source
        </a>
      </span>{' '}
      •{' '}
      <span className="underline underline-offset-4 decoration-2">
        <a
          href="https://vercel.com?utm_source=purdue-hackers&utm_campaign=oss"
          target="_blank"
          className="decoration-amber-400 dark:decoration-amber-500 hover:decoration-[3px]"
        >
          Powered by ▲Vercel
        </a>
      </span>
    </p>
    <FooterLinks />
  </div>
)

export default Footer
