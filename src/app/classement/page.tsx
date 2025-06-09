import dynamic from 'next/dynamic'

const ClassementClient = dynamic(() => import('./ClassementClient'), { ssr: false })

export default function Page() {
  return <ClassementClient />
}
