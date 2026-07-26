import { BookOpen, TrendingUp, Grid3x3, FlaskConical, ShieldCheck } from 'lucide-react';

export default function StrategiesPage() {
  const sections = [
    {
      icon: TrendingUp,
      title: 'Le yield management : des prix qui respirent',
      body: `Les compagnies aériennes ne fixent pas un prix, elles pilotent un revenu. Chaque vol est découpé en "classes de réservation" (buckets tarifaires) : une dizaine de niveaux de prix pour la même cabine. Un algorithme de yield management ouvre ou ferme ces buckets en temps réel selon le rythme de remplissage du vol, la demande historique sur la route, les événements et la concurrence. C'est pourquoi le prix d'un siège peut changer plusieurs fois par jour — souvent la nuit, quand les systèmes recalibrent les prévisions de demande. FlyDeal exploite ces recalibrages en vérifiant vos routes entre 2h et 5h du matin.`,
    },
    {
      icon: Grid3x3,
      title: 'Buckets tarifaires et fenêtres d\'achat',
      body: `Empiriquement, les buckets les moins chers sont ouverts en priorité loin du départ, puis se ferment progressivement. Les analyses sectorielles convergent vers des fenêtres optimales : environ 1 à 3 mois avant le départ en Europe, 2 à 6 mois en long-courrier. Les seuils J-60, J-21, J-14 et J-7 correspondent à des ruptures classiques de grilles (les tarifs "advance purchase" exigent souvent d'acheter 21, 14 ou 7 jours avant). FlyDeal intensifie la fréquence de vérification autour de ces seuils pour capturer les derniers sièges des buckets bon marché avant leur fermeture.`,
    },
    {
      icon: FlaskConical,
      title: 'A/B pricing et discrimination par point de vente',
      body: `Le même billet peut être affiché à des prix différents selon le pays de vente (point of sale), la devise, le canal (site compagnie vs OTA) et parfois le profil utilisateur. Les compagnies mènent aussi des tests A/B : une fraction des visiteurs voit un prix légèrement différent. En revanche, la légende des "cookies qui font monter les prix" est largement exagérée : les variations observées viennent presque toujours de la fermeture d'un bucket, pas de votre historique de navigation. FlyDeal compare les niveaux de prix dans le temps plutôt que de chasser des fantômes.`,
    },
    {
      icon: ShieldCheck,
      title: 'Comment FlyDeal y répond',
      body: `Face à un système de tarification opaque et dynamique, la meilleure arme du voyageur est la donnée historique. FlyDeal relève les prix plusieurs fois par jour à des moments stratégiques (nuit, mardi-mercredi, fenêtres clés), construit un historique par route, puis évalue chaque prix avec le Deal Score : z-score vs moyenne 30 jours, percentile historique, prix au kilomètre, tendance 7 jours et position dans la fenêtre d'achat optimale. S'y ajoutent les tactiques de contournement — dates flexibles, aéroports alternatifs, split ticketing, multi-devises — chacune chiffrée en économie estimée. Vous ne devinez plus : vous décidez avec un score, une confiance et une probabilité de baisse.`,
    },
  ];
  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <span className="bg-accent text-white rounded-xl p-2"><BookOpen size={20} /></span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comment les compagnies fixent leurs prix</h1>
          <p className="text-sm opacity-60">Comprendre le système pour le battre.</p>
        </div>
      </div>
      {sections.map(s => (
        <section key={s.title} className="card">
          <h2 className="font-semibold flex items-center gap-2 mb-2.5">
            <s.icon size={17} className="text-accent" /> {s.title}
          </h2>
          <p className="text-sm leading-relaxed opacity-80">{s.body}</p>
        </section>
      ))}
    </div>
  );
}
