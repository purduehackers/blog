// FIXME: add props and remove ts-nocheck.
// @ts-nocheck

export default {
  h1: (props) => <h1 className="font-bold mt-4">{props.children}</h1>,
  h2: (props) => <h2 className="font-bold">{props.children}</h2>,
  h3: (props) => <h3 className="font-bold">{props.children}</h3>,
  a: (props) => (
    <a
      target="_blank"
      className="text-post hover:text-post-light transition"
      style={{
        textDecoration: "underline",
        textUnderlineOffset: "4px",
      }}
      {...props}
    ></a>
  ),
  img: (props) => (
    <img
      {...props}
      width={0}
      height={0}
      className="w-full md:w-[50vw] lg:w-[33vw] rounded-lg"
    />
  ),
  ul: (props) => (
    <ul className="list-disc list-outside ml-6 sm:ml-0">{props.children}</ul>
  ),
  ol: (props) => (
    <ol className="list-decimal list-inside ml-6">{props.children}</ol>
  ),
  li: (props) => <li className="mb-2">{props.children}</li>,
  hr: () => <hr className="border-2 border-post w-1/2 mx-auto my-4" />,
  blockquote: (props) => (
    <blockquote className="border-l-4 border-post blockquote">
      {/* <span className="italic pl-4">{props.children}</span> */}
      {props.children}
    </blockquote>
  ),
};
