import WatchForm from '@/components/WatchForm';

export default function NewWatchPage() {
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Nouvelle surveillance</h1>
      <p className="text-sm opacity-60">
        Choisissez un ou plusieurs aéroports de départ et d'arrivée, la date cible et la flexibilité.
        FlyDeal vérifiera les prix aux moments stratégiques (nuit, mardi/mercredi, fenêtres J-60/J-21/J-14/J-7).
      </p>
      <WatchForm />
    </div>
  );
}
