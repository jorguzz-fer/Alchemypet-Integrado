import { redirect } from 'next/navigation';

// Raiz redireciona para o Dashboard (todas as pendências).
export default function Home() {
  redirect('/dashboard');
}
