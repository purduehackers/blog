import ColoredLightningString from "./colored-lightning-string";
import { useLightningTimeClock } from "@purduehackers/time/react";

const ColorsDemo = () => {
  const { colors } = useLightningTimeClock();
  const { boltColor, zapColor, sparkColor } = colors;

  const [changingBolt, staticBolt] = [
    boltColor.substring(1, 3),
    boltColor.substring(3),
  ];
  const [changingZap, staticZap1, staticZap2] = [
    zapColor.substring(3, 5),
    zapColor.substring(1, 3),
    zapColor.substring(5),
  ];
  const [changingSpark, staticSpark] = [
    sparkColor.substring(5),
    sparkColor.substring(1, 5),
  ];

  return (
    <div className="mx-auto flex flex-col gap-1 border-4 border-black rounded-lg text-center w-full md:w-1/2">
      <p className="text-2xl border-b-black border-b-2">
        <ColoredLightningString />
      </p>
      <p className="font-mono text-xl">
        #<span className="bolt">{changingBolt}</span>
        {staticBolt}
      </p>
      <p className="font-mono text-xl">
        #{staticZap1}
        <span className="zap">{changingZap}</span>
        {staticZap2}
      </p>
      <p className="font-mono text-xl">
        #{staticSpark}
        <span className="spark">{changingSpark}</span>
      </p>
    </div>
  );
};

export default ColorsDemo;
