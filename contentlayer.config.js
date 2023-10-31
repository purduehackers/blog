import { defineDocumentType, makeSource } from 'contentlayer/source-files'
import rehypePrism from 'rehype-prism-plus'

const Post = defineDocumentType(() => ({
  name: 'Post',
  filePathPattern: `**/*.mdx`,
  contentType: 'mdx',
  fields: {
    title: {
      type: 'string',
      description: 'The title of the post',
      required: true
    },
    date: {
      type: 'date',
      description: 'The date of the post',
      required: true
    },
    authors: {
      type: 'string',
      description: 'The author(s) of the post',
      required: true
    },
    visible: {
      type: 'boolean',
      description: 'Whether this post should appear on the homepage',
      required: false,
      default: true
    },
    ogDescription: {
      type: 'string',
      description: 'The Open Graph description of the post',
      required: false
    },
    color: {
      type: 'json',
      description: 'The color of the post — appears on card and in background',
      required: false
    },
    clientComponent: {
      type: 'boolean',
      description:
        'Whether the content of this post should be rendered as a client component',
      required: false,
      default: false
    }
  },
  computedFields: {
    url: {
      type: 'string',
      resolve: (doc) => `/posts/${doc._raw.flattenedPath}`
    }
  }
}))

export default makeSource({
  contentDirPath: 'posts',
  documentTypes: [Post],
  mdx: {
    rehypePlugins: [rehypePrism]
  }
})
