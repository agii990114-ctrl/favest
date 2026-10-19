import { sectorColor } from '../lib/sectors'

/** 업종별로 고정된 파스텔 색의 종목 아바타. 색이 업종 정보를 담는다. */
export default function Avatar({ name, sector, size }: { name: string; sector: string; size?: 'sm' | 'lg' }) {
  const [bg, fg] = sectorColor(sector)
  return (
    <span className={`ava${size ? ` ${size}` : ''}`} style={{ background: bg, color: fg }} aria-hidden="true">
      {name.charAt(0)}
    </span>
  )
}
