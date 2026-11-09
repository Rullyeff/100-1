import { createFileRoute } from '@tanstack/react-router';
import { RoomPage } from '@/game/online/RoomPage';
export const Route = createFileRoute('/ruang/$roomId')({
  ssr: false,
  head: () => ({ meta: [
    { title: 'Permainan Bersama — 100 SUARA' },
    { name: 'description', content: 'Ruang permainan privat 100 SUARA: giliran, suara, dan papan tersinkron bersama teman.' },
    { property: 'og:title', content: 'Permainan Bersama — 100 SUARA' },
    { property: 'og:description', content: 'Bermain 100 SUARA bersama dari perangkat berbeda.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: () => <RoomPage roomId={Route.useParams().roomId} />,
});