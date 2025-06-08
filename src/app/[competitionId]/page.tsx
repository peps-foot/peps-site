'use client'

import dynamic from 'next/dynamic'

const HomePageClient = dynamic(() => import('@/components/HomePageClient'), { ssr: false })

type Props = {
  params: {
    competitionId: string;
  };
};

export default function Page({ params }: Props) {
  return <HomePageClient competitionId={params.competitionId} />
}
