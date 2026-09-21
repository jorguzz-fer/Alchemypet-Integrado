'use client';

import { notFound, redirect, useParams } from 'next/navigation';
import { moduloLegado, moduloValido } from '@/lib/modulos';
import DashboardView from '@/components/DashboardView';

export default function DashboardModuloPage() {
  const params = useParams();
  const modulo = params.modulo as string;
  const legado = moduloLegado(modulo);
  if (legado) redirect(`/${legado}`);
  if (!moduloValido(modulo)) notFound();
  return <DashboardView modulo={modulo} />;
}
