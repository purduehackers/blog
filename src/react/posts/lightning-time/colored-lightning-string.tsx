import LightningText, { LightningPart } from "./lightning-text";

const ColoredLightningString = () => {
  return (
    <span className="font-mono font-bold">
      <LightningText part={LightningPart.Bolt} />~
      <LightningText part={LightningPart.Zap} />~
      <LightningText part={LightningPart.Spark} />|
      <LightningText part={LightningPart.Charge} />
    </span>
  );
};

export default ColoredLightningString;
