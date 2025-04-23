import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  return (
    <div>
      <nav className="bg-purple-700 text-white p-4 flex justify-around">
        <a href="/" className="hover:underline">Accueil</a>
        <a href="/grilles" className="hover:underline">Grilles</a>
        <a href="/classement" className="hover:underline">Classement</a>
      </nav>
      <Component {...pageProps} />
    </div>
  )
}