import { format } from 'date-fns'

const Date = ({ date }: { date: Date }) => (
  <div className="rounded-lg border-2 border-black flex flex-col items-center justify-center relative mx-auto px-4">
    <h1 className="font-bold text-2xl">{format(date, 'dd')}</h1>
    <p className="text-gray-800">{format(date, 'LLL')}</p>
  </div>
)

export default Date
