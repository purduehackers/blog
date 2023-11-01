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
  const midpoints = [0, 64, 128, 192, 240] // 00, 40, 80, c0, f0

  const [staticValues, setStaticValues] = useState(defaultValues)
  const [valid, setValid] = useState([true, true])
  return (
    <div className="px-3 py-4 rounded-lg border-4 border-black flex flex-col gap-4 justify-center">
      <p className="text-2xl md:text-xl font-bold text-center">
        {LightningPart[part]} Colors
      </p>
      <div className="flex flex-row gap-x-2 justify-center font-mono">
        {part === LightningPart.Bolt && (
          <div className="px-2 rounded bg-gray-100 text-center border-2 border-red-800">
            R
          </div>
        )}
        <input
          type="number"
          defaultValue={staticValues[0]}
          placeholder={part === LightningPart.Bolt ? 'G' : 'R'}
          onChange={(e) => {
            const val = parseInt(e.target.value)
            if (val >= 0 && val <= 255) {
              setStaticValues([val, staticValues[1]])
              setValid([true, valid[1]])
            } else setValid([false, valid[1]])
          }}
          className={`border-2 border-black rounded w-1/5 md:w-1/3 text-center sm:text-left px-1 outline-none ${
            !valid[0] ? 'bg-red-100' : ''
          } ${
            part === LightningPart.Bolt ? 'border-green-800' : 'border-red-800'
          }`}
        ></input>
        {part === LightningPart.Zap && (
          <div className="px-2 rounded bg-gray-100 text-center border-2 border-green-800">
            G
          </div>
        )}
        <input
          type="number"
          defaultValue={staticValues[1]}
          placeholder={part === LightningPart.Spark ? 'G' : 'B'}
          onChange={(e) => {
            const val = parseInt(e.target.value)
            if (val >= 0 && val <= 255) {
              setStaticValues([staticValues[0], val])
              setValid([valid[0], true])
            } else setValid([valid[0], false])
          }}
          className={`border-2 border-black rounded w-1/5 md:w-1/3 text-center sm:text-left px-1 outline-none ${
            !valid[1] ? 'bg-red-100' : ''
          } ${
            part === LightningPart.Spark
              ? 'border-green-800'
              : 'border-blue-800'
          }`}
        ></input>
        {part === LightningPart.Spark && (
          <div className="px-2 rounded bg-gray-100 text-center border-2 border-blue-800">
            B
          </div>
        )}
      </div>
      <div className="flex flex-row justify-center gap-2 md:gap-0 md:justify-between">
        {midpoints.map((midpoint, i) => (
          <div key={midpoint} className="flex flex-col gap-2 justify-center">
            <div
              className="rounded-full w-8 h-8"
              style={{
                backgroundColor:
                  part === LightningPart.Bolt
                    ? `#${rgbHex(midpoint, staticValues[0], staticValues[1])}`
                    : part === LightningPart.Zap
                    ? `#${rgbHex(staticValues[0], midpoint, staticValues[1])}`
                    : `#${rgbHex(staticValues[0], staticValues[1], midpoint)}`
              }}
            ></div>
            <div
              className={`text-xs rounded bg-gray-100 text-center font-mono border-2 ${
                part === LightningPart.Bolt
                  ? 'border-red-800'
                  : part === LightningPart.Zap
                  ? 'border-green-800'
                  : 'border-blue-800'
              }`}
            >
              {(i === 4 ? 60 : 64) * i}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ColorToy
