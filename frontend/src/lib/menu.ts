import { api } from './api'

export interface SubMenuItem {
  menuId: string
  pgmId: string
  title: string
  desc: string
  seq: number
  favYn: string
}

export interface TopMenuItem {
  menuId: string
  pgmId: string
  title: string
  desc: string
  seq: number
  children: SubMenuItem[]
}

export async function fetchMenus(): Promise<TopMenuItem[]> {
  const { data } = await api.get<TopMenuItem[]>('/menu')
  return data
}
