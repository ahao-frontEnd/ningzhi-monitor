export type AppType = 'vanilla' | 'react' | 'vue'

export type AppData = {
  type: AppType
  id: string
  name: string
  bugs: number
  transactions: number
  data: {
    date: string
    resting: number
  }[]
}
