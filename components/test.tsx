const Test = ({ name }: { name: string }) => (
  <>
    <br />
    <h1>
      This is a React component. This post's name is{' '}
      <span className="text-amber-500">{name}</span>.
    </h1>
  </>
)

export default Test
