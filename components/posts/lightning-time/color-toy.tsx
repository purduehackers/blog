import rgbHex from 'rgb-hex'
import { useState } from 'react'

export enum LightningPart {
  Bolt,
  Zap,
  Spark
}

const ColorToy = ({
  part,
  defaultValues
}: {
  part: LightningPart
  defaultValues: number[]
}) => {
  const midpoints = ['0', '64', '128', '192', '240']

  const [staticValues, setStaticValues] = useState(defaultValues)
  const [valid, setValid] = useState([true, true])
  return (
    <div className="p-4 rounded-lg border-4 border-black flex flex-col gap-4 justify-center">
      <p className="text-2xl md:text-xl font-bold text-center">
        {LightningPart[part]} Colors
      </p>
      <div className="flex flex-row gap-x-4 justify-center">
        <input
          type="number"
          defaultValue={staticValues[0]}
          onChange={(e) => {
            const val = parseInt(e.target.value)
            if (val >= 0 && val <= 255) {
              setStaticValues([val, staticValues[1]])
              setValid([true, valid[1]])
            } else setValid([false, valid[1]])
          }}
          className={`border-2 border-black rounded w-1/4 md:w-1/3 text-center outline-none ${
            !valid[0] ? 'bg-red-100' : ''
          }`}
        ></input>
        <input
          type="number"
          defaultValue={staticValues[1]}
          onChange={(e) => {
            const val = parseInt(e.target.value)
            if (val >= 0 && val <= 255) {
              setStaticValues([staticValues[0], val])
              setValid([valid[0], true])
            } else setValid([valid[0], false])
          }}
          className={`border-2 border-black rounded w-1/4 md:w-1/3 text-center outline-none ${
            !valid[1] ? 'bg-red-100' : ''
          }`}
        ></input>
      </div>
      <div className="flex flex-row justify-center gap-2 md:gap-0 md:justify-between">
        {midpoints.map((midpoint) => (
          <div
            className="rounded-full w-8 h-8"
            key={midpoint}
            style={{
              backgroundColor:
                part === LightningPart.Bolt
                  ? `#${rgbHex(
                      parseInt(midpoint),
                      staticValues[0],
                      staticValues[1]
                    )}`
                  : part === LightningPart.Zap
                  ? `#${rgbHex(
                      staticValues[0],
                      parseInt(midpoint),
                      staticValues[1]
                    )}`
                  : `#${rgbHex(
                      staticValues[0],
                      staticValues[1],
                      parseInt(midpoint)
                    )}`
            }}
          ></div>
        ))}
      </div>
    </div>
  )
}

export default ColorToy
