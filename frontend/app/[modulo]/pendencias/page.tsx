'use client';

import { notFound, redirect, useParams } from 'next/navigation';
import { moduloLegado, moduloValido } from '@/lib/modulos';
import PendenciasView from '@/components/PendenciasView';

export default function PendenciasModuloPage() {
  const params = useParams();
  const modulo = params.modulo as string;
  const legado = moduloLegado(modulo);
  if (legado) redirect(`/${legado}/pendencias`);
  if (!moduloValido(modulo)) notFound();
  return <PendenciasView modulo={modulo} />;
}
