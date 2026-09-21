// ---------------------------------------------------------------------------
// Configuration du commerce
// ---------------------------------------------------------------------------
// C'est le SEUL fichier a modifier pour adapter l'application a un nouveau
// commerce client : nom, couleurs, et liste des lots avec leur poids
// (probabilite relative de tirage). Les secrets (cles API, mot de passe
// admin) restent dans .env, jamais ici.
//
// Pour reutiliser cette appli pour un autre commercant : dupliquer le depot
// (ou juste ce fichier + le .env), modifier les valeurs ci-dessous, deployer.
// ---------------------------------------------------------------------------

export type PrizeType = "discount" | "social" | "newsletter" | "product";

export interface PrizeConfig {
  /** Identifiant stable, utilise en base de donnees. Ne pas changer une fois en prod. */
  id: string;
  /** Texte affiche sur la roue et dans l'e-mail. */
  label: string;
  /** Poids relatif de tirage (plus le nombre est grand, plus le lot sort souvent). */
  weight: number;
  /** Categorie du lot : sert uniquement a la validation de conformite ci-dessous. */
  type: PrizeType;
  /** Courte description affichee dans le mail / l'ecran de resultat (facultatif). */
  description?: string;
  /** Couleur de la portion de roue (hex). Si omis, une couleur du theme est utilisee. */
  color?: string;
}

export const siteConfig = {
  business: {
    name: process.env.NEXT_PUBLIC_BUSINESS_NAME || "Le Petit Bistrot",
    logoUrl: process.env.NEXT_PUBLIC_LOGO_URL || "",
    // Mention affichee sous le lot gagne ("a presenter en caisse", etc.)
    redeemInstructions: "A presenter en caisse lors de votre prochaine visite.",
  },

  theme: {
    cream: "#FBF3E6",
    creamDark: "#F3E6CF",
    amber: "#E6A23C",
    amberDark: "#C9822A",
    coral: "#F2604A",
    coralDark: "#D6472F",
    ink: "#2B2320",
  },

  legal: {
    consentLabel:
      "J'accepte que mon adresse e-mail soit utilisee pour recevoir mon lot et des offres de ce commerce (voir politique de confidentialite). Je peux me desinscrire a tout moment.",
  },

  // -------------------------------------------------------------------------
  // Lots. La somme des "weight" n'a pas besoin de faire 100 : c'est un poids
  // relatif (ex: weight 30 sort 3x plus souvent que weight 10).
  //
  // RAPPEL LEGAL (a ne jamais contourner) : aucun lot ne doit jamais etre
  // conditionne au depot d'un avis Google / TripAdvisor / autre plateforme
  // d'avis. C'est interdit par l'article L111-7-2 du Code de la consommation
  // et par la politique de Google. Les seuls types de lots valides sont :
  // reduction liee a un achat, abonnement reseaux sociaux, inscription
  // newsletter, produit offert (voir le type PrizeType ci-dessus).
  // -------------------------------------------------------------------------
  prizes: [
    {
      id: "discount10",
      label: "-10% sur l'addition",
      weight: 30,
      type: "discount",
      description: "10% de reduction sur votre prochaine addition.",
    },
    {
      id: "follow_instagram",
      label: "Un cafe offert en suivant notre Instagram",
      weight: 25,
      type: "social",
      description: "Abonnez-vous a notre compte Instagram pour recuperer votre cafe offert.",
    },
    {
      id: "newsletter",
      label: "Dessert offert (newsletter)",
      weight: 20,
      type: "newsletter",
      description: "Inscrivez-vous a notre newsletter et recevez un dessert offert.",
    },
    {
      id: "free_product",
      label: "Une boisson offerte",
      weight: 15,
      type: "product",
      description: "Une boisson au choix offerte pour votre prochaine visite.",
    },
    {
      id: "discount20",
      label: "-20% sur l'addition",
      weight: 10,
      type: "discount",
      description: "20% de reduction sur votre prochaine addition.",
    },
  ] satisfies PrizeConfig[],
};

export type SiteConfig = typeof siteConfig;
