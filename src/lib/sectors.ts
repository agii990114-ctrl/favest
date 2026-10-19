/** 업종별 고정 색 [배경, 글자]. 아바타와 비중 막대가 같은 색을 쓴다. */
export const SECTOR_COLOR: Record<string, [string, string]> = {
  semiconductor: ['#dce7ff', '#1f4fd1'],
  battery: ['#d4f7e3', '#08733e'],
  bio: ['#ffdde9', '#b8174f'],
  auto: ['#e3eaf6', '#34507a'],
  finance: ['#ffefc2', '#8f5a00'],
  platform: ['#d2f6f2', '#007a6e'],
  game: ['#ebdfff', '#6a34d1'],
  consumer: ['#ffe3d3', '#b23b0b'],
}

export const sectorColor = (id: string): [string, string] => SECTOR_COLOR[id] ?? ['#eef0f3', '#4a5563']
