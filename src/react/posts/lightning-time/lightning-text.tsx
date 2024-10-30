import { useLightningTimeClock } from "@purduehackers/time/react";

export enum LightningPart {
  Bolt,
  Zap,
  Spark,
  Charge,
}

const LightningText = ({
  part,
  color = true,
}: {
  part: LightningPart;
  color?: boolean;
}) => {
  const { parts } = useLightningTimeClock();
  const { bolts, zaps, sparks, charges } = parts;
  switch (part) {
    case LightningPart.Bolt: {
      return (
        <span className={`${color ? "bolt" : "font-bold"} font-mono`}>
          {bolts}
        </span>
      );
    }
    case LightningPart.Zap: {
      return (
        <span className={`${color ? "zap" : "font-bold"} font-mono`}>
          {zaps}
        </span>
      );
    }
    case LightningPart.Spark: {
      return (
        <span className={`${color ? "spark" : "font-bold"} font-mono`}>
          {sparks}
        </span>
      );
    }
    case LightningPart.Charge: {
      return <span className="font-bold font-mono">{charges}</span>;
    }
    default: {
      return <span></span>;
    }
  }
};

export default LightningText;
