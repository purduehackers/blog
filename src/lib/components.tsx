// FIXME: add props and remove ts-nocheck.
// @ts-nocheck

export default {
  h1: (props) => (
    <h1 className="font-pixel uppercase text-3xl sm:text-4xl mt-8 mb-2">
      {props.children}
    </h1>
  ),
  h2: (props) => (
    <h2 className="font-pixel uppercase text-2xl sm:text-3xl mt-6 mb-2">
      {props.children}
    </h2>
  ),
  h3: (props) => (
    <h3 className="font-pixel uppercase text-xl sm:text-2xl mt-4 mb-2">
      {props.children}
    </h3>
  ),
  a: (props) => (
    <a
      target="_blank"
      className="text-amber-500 hover:text-amber-400 underline decoration-2 underline-offset-4 transition"
      {...props}
    ></a>
  ),
  img: (props) => (
    <a
      href={props.src}
      data-fancybox="post"
      data-caption={props.alt || undefined}
      className="block cursor-zoom-in"
    >
      <img
        {...props}
        width={0}
        height={0}
        className={
          props.className ||
          "w-full md:w-[50vw] lg:w-[33vw] xl:w-[22vw] rounded-sm border border-black/10"
        }
      />
    </a>
  ),
  WideImage: (props) => (
    <a
      href={props.src}
      data-fancybox="post"
      data-caption={props.alt || undefined}
      className="block cursor-zoom-in"
    >
      <img
        {...props}
        className="w-full h-auto rounded-sm mx-auto border border-black/10"
      />
    </a>
  ),
  ul: (props) => (
    <ul className="list-disc list-outside ml-6 sm:ml-0 marker:text-amber-500">
      {props.children}
    </ul>
  ),
  ol: (props) => (
    <ol className="list-decimal list-inside ml-6">{props.children}</ol>
  ),
  li: (props) => <li className="mb-2">{props.children}</li>,
  hr: () => (
    <hr className="border-0 border-t-2 border-purple-700 dark:border-yellow w-1/2 mx-auto my-6" />
  ),
  blockquote: (props) => (
    <blockquote className="border-l-4 border-purple-700 dark:border-yellow pl-4 blockquote">
      {props.children}
    </blockquote>
  ),
};
