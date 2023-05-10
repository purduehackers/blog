const DiscordChannel = ({ channel }: { channel: string }) => (
  <span className="px-1 bg-discord-vibrant text-white text-base rounded font-mono cursor-pointer">
    #{channel}
  </span>
)

export default DiscordChannel
