type Props = {
  params: {
    competitionId: string;
  };
};

export default function Page({ params }: Props) {
  return <h1>Compétition : {params.competitionId}</h1>;
}
