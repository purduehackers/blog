'use client'

import { LightningTime } from '@purduehackers/time'
import { createContext, useEffect, useState } from 'react'

const { boltColor, zapColor, sparkColor } =
  new LightningTime().convertToLightning(new Date()).colors

export const LightningTimeContext = createContext({
  boltColor,
  zapColor,
  sparkColor,
  bolts: '0',
  zaps: '0',
  sparks: '0',
  charges: '0'
})

const LightningTimeProvider = ({ ...props }) => {
  const [boltColor, setBoltColor] = useState('#000000')
  const [zapColor, setZapColor] = useState('#000000')
  const [sparkColor, setSparkColor] = useState('#000000')
  const [bolts, setBolts] = useState('0')
  const [zaps, setZaps] = useState('0')
  const [sparks, setSparks] = useState('0')
  const [charges, setCharges] = useState('0')

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()

      const lt = new LightningTime()
      const convertedTime = lt.convertToLightning(now).lightningString
      const colors = Object.values(lt.getColors(convertedTime))
      const { bolts, zaps, sparks, charges } = lt.getParts(convertedTime)

      document.documentElement.style.setProperty('--boltColor', colors[0])
      document.documentElement.style.setProperty('--zapColor', colors[1])
      document.documentElement.style.setProperty('--sparkColor', colors[2])

      setBoltColor(colors[0])
      setZapColor(colors[1])
      setSparkColor(colors[2])
      setBolts(bolts)
      setZaps(zaps)
      setSparks(sparks)
      setCharges(charges)
    }, 100)
    return () => clearInterval(timer)
  }, [])

  const value = {
    boltColor,
    zapColor,
    sparkColor,
    bolts,
    zaps,
    sparks,
    charges
  }
  return (
    <LightningTimeContext.Provider value={value}>
      {props.children}
    </LightningTimeContext.Provider>
  )
}

export default LightningTimeProvider
