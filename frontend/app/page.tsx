import { redirect } from 'next/navigation';

// Raiz redireciona para o primeiro módulo.
export default function Home() {
  redirect('/convenio');
}
