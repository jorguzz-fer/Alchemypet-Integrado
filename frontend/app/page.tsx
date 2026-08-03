import { redirect } from 'next/navigation';

// Raiz redireciona para o Dashboard (dados de triagem).
export default function Home() {
  redirect('/triagem');
}
