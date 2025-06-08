export default function Page({ params }: { params: { competitionId: string } }) {
  return <h1>Compétition : {params.competitionId}</h1>;
}
