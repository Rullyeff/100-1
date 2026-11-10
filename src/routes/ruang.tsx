import { createFileRoute, Navigate, Outlet, useMatch } from '@tanstack/react-router';
export const Route = createFileRoute('/ruang')({
  ssr: false,
  head: () => ({ meta: [
    { title: 'Ruang Online — 100 SUARA' },
    { name: 'description', content: 'Buat atau gabung ruang privat 100 SUARA dan bermain bersama dari perangkat berbeda.' },
    { property: 'og:title', content: 'Ruang Online — 100 SUARA' },
    { property: 'og:description', content: 'Bermain demokrasi bersama teman melalui ruang privat.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Rooms,
});
function Rooms() {
  const child = useMatch({ from: '/ruang/$roomId', shouldThrow: false });
  return child ? <Outlet /> : <Navigate to="/main" search={{ mode: 'bersama' }} replace />;
}