import { LightningTime } from '@purduehackers/time'
import { createContext, useEffect, useState } from 'react'

const LightningTimeContext = createContext(
  new LightningTime().convertToLightning(new Date()).colors
)

const LightningTimeProvider = ({ ...props }) => {
  const [boltColor, setBoltColor] = useState('#000000')
  const [zapColor, setZapColor] = useState('#000000')
  const [sparkColor, setSparkColor] = useState('#000000')

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()

      const lt = new LightningTime()
      const convertedTime = lt.convertToLightning(now).lightningString
      const colors = Object.values(lt.getColors(convertedTime))

      document.documentElement.style.setProperty('--boltColor', colors[0])
      document.documentElement.style.setProperty('--zapColor', colors[1])
      document.documentElement.style.setProperty('--sparkColor', colors[2])

      setBoltColor(colors[0])
      setZapColor(colors[1])
      setSparkColor(colors[2])
    }, 100)
    return () => clearInterval(timer)
  }, [])

  const value = {
    boltColor,
    zapColor,
    sparkColor
  }
  return (
    <LightningTimeContext.Provider value={value}>
      {...props.children}
    </LightningTimeContext.Provider>
  )
}

export default LightningTimeProvider
