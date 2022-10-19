import { LightningTime } from '@purduehackers/time'
import { useState } from 'react'

const randomTimeString = () => {
  const chars: string[] = []
  while (chars.length < 3) {
    const random = Math.floor(Math.random() * 16).toString(16)
    chars.push(random)
  }
  return chars.join('~')
}

const convertFromLightning = () => {
  const [time, setTime] = useState('12:00:00 PM')
  const [randomTime, setRandomTime] = useState(randomTimeString())
  const [colors, setColors] = useState(['#80a100', '#3200d6', '#f68500'])
  const [valid, setValid] = useState(true)
  return (
    <div
      className="p-1 rounded-lg mx-auto font-main w-full"
      style={{
        background: `linear-gradient(to right, ${colors[0]}, ${colors[1]}, ${colors[2]})`
      }}
    >
      <div className="rounded-lg p-4 flex flex-col justify-center bg-white h-full">
        <p className="text-2xl text-center font-bold">
          Convert from Lightning Time
        </p>
        <input
          type="text"
          defaultValue="8~0~0"
          placeholder={randomTime}
          className={`border-2 border-black rounded mt-4 w-7/12 mx-auto outline-none text-center ${
            !valid ? 'bg-red-100' : ''
          }`}
          onChange={(e) => {
            if (e.target.value.length > 7) return setValid(false)
            if (e.target.value.length === 0) {
              setRandomTime(randomTimeString())
            }
            try {
              const lt = new LightningTime()
              const converted = lt.convertFromLightning(e.target.value)
              setTime(converted.withSeconds)
              setColors(Object.values(lt.getColors(e.target.value)))
              setValid(true)
            } catch (e) {
              setValid(false)
            }
          }}
        ></input>
        <div className="text-center mt-2">
          <p className="text-xl font-bold font-mono">{time}</p>
        </div>
      </div>
    </div>
  )
}

export default convertFromLightning
