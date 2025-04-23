import Image from "next/image";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-lightBg p-4">
      <Image
        src="/logo-peps.png"
        alt="Logo PEPS"
        width={200}
        height={200}
        priority
      />
      <h1 className="text-4xl font-bold mt-4 text-violetPeps">
        Bienvenue sur PEPS ⚽
      </h1>
      <p className="text-lg mt-2 text-darkText">Pronos entre poteS</p>
      <button className="mt-6 px-6 py-3 bg-goldPeps text-darkText font-semibold rounded-xl shadow">
        Commencer une grille
      </button>
    </main>
  );
}
