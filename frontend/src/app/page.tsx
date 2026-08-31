import { redirect } from 'next/navigation'

// redireciona raiz; (protected)/layout redireciona para /login se não autenticado
export default function Home() {
  redirect('/dashboard')
}
