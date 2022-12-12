import { Post } from 'contentlayer/generated'
import { compareAsc, compareDesc } from 'date-fns'

export const sortDesc = (posts: Post[]) =>
  posts.sort((a: Post, b: Post) =>
    compareDesc(new Date(a.date), new Date(b.date))
  )
export const sortAsc = (posts: Post[]) =>
  posts.sort((a: Post, b: Post) =>
    compareAsc(new Date(a.date), new Date(b.date))
  )
