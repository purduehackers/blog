import Image from 'next/future/image'

export default {
  h1: (props) => <h1 className="font-bold mt-4">{props.children}</h1>,
  h2: (props) => <h2 className="font-bold">{props.children}</h2>,
  a: (props) => (
    <a
      target="_blank"
      className="text-amber-500 hover:text-amber-600 transition"
      style={{
        textDecoration: 'underline',
        textUnderlineOffset: '4px'
      }}
      {...props}
    ></a>
  ),
  img: (props) => (
    <Image
      {...props}
      width={0}
      height={0}
      sizes="(max-width: 768px) 100vw,
      (max-width: 1024px) 50vw,
      33vw"
      style={{
        width: 'auto',
        height: 'auto',
        borderRadius: '8px'
      }}
    />
  ),
  ul: (props) => (
    <ul className="list-disc list-outside ml-4 sm:ml-0">{props.children}</ul>
  )
}
