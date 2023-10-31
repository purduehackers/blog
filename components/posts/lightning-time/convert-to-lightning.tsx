'use client'

import { LightningTime } from '@purduehackers/time'
import { DateTime } from 'luxon'
import { useState } from 'react'

const ConvertToLightning = () => {
  const lt = new LightningTime()
  const [lightningString, setLightningString] = useState('8~0~0')
  const [colors, setColors] = useState(['#80a100', '#3200d6', '#f68500'])
  return (
    <div
      className="p-1 rounded-lg mx-auto font-main w-full"
      style={{
        background: `linear-gradient(to right, ${colors[0]}, ${colors[1]}, ${colors[2]})`
      }}
    >
      <div className="rounded-lg p-4 flex flex-col justify-center bg-white">
        <p className="text-2xl text-center font-bold">
          Convert to Lightning
          <br />
          Time
        </p>
        <input
          type="time"
          step={1}
          className="border-2 border-black rounded mt-4 w-7/12 mx-auto outline-none pl-1"
          defaultValue="12:00"
          onChange={(e) => {
            if (e.target.value) {
              const date = DateTime.fromISO(e.target.value).toJSDate()
              const { lightningString } = lt.convertToLightning(date)
              const newColors = Object.values(lt.getColors(lightningString))
              setColors(newColors)
              setLightningString(lightningString)
            }
          }}
        ></input>
        <div className="text-center mt-2">
          <p className="text-xl font-bold font-mono">⚡️{lightningString}⚡️</p>
        </div>
      </div>
    </div>
  )
}

export default ConvertToLightning
