import { useContext } from 'react'
import { LightningTimeContext } from './lightning-time-context'

export enum LightningPart {
  Bolt,
  Zap,
  Spark,
  Charge
}

const LightningText = ({ part }: { part: LightningPart }) => {
  const { bolts, zaps, sparks, charges } = useContext(LightningTimeContext)
  switch (part) {
    case LightningPart.Bolt: {
      return <span className="bolt">{bolts}</span>
    }
    case LightningPart.Zap: {
      return <span className="zap">{zaps}</span>
    }
    case LightningPart.Spark: {
      return <span className="spark">{sparks}</span>
    }
    case LightningPart.Charge: {
      return (
        <span className="text-amber-500 font-bold font-mono">{charges}</span>
      )
    }
    default: {
      return <span></span>
    }
  }
}

export default LightningText
