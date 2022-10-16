import { useEffect } from 'react'
import { LightningTime } from '@purduehackers/time'

const LightningGradient = ({ ...props }) => {
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()

      const lt = new LightningTime()
      const convertedTime = lt.convertToLightning(now).lightningString
      const colors = Object.values(lt.getColors(convertedTime))

      document.documentElement.style.setProperty('--boltColor', `#${colors[0]}`)
      document.documentElement.style.setProperty('--zapColor', `#${colors[1]}`)
      document.documentElement.style.setProperty(
        '--sparkColor',
        `#${colors[2]}`
      )
    }, 100)
    return () => clearInterval(timer)
  }, [])

  return <span className="font-bold lightning-gradient">{props.children}</span>
}

export default LightningGradient
