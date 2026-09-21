import { randomInt } from "crypto";
import { siteConfig, type PrizeConfig } from "@/config/site.config";

// ---------------------------------------------------------------------------
// Garde-fou de conformite : quoi qu'il arrive, un lot ne doit jamais etre
// conditionne a un avis (Google, TripAdvisor, etc). On verifie ceci au
// demarrage du serveur sur le contenu du fichier de config, en plus de la
// contrainte de type PrizeType qui exclut deja toute categorie "avis".
// ---------------------------------------------------------------------------
const FORBIDDEN_KEYWORDS = [
  "avis",
  "review",
  "google maps",
  "tripadvisor",
  "5 etoiles",
  "5 étoiles",
  "note google",
  "laisser un avis",
];

function assertPrizesAreCompliant(prizes: PrizeConfig[]) {
  for (const prize of prizes) {
    const haystack = `${prize.id} ${prize.label} ${prize.description ?? ""}`.toLowerCase();
    for (const keyword of FORBIDDEN_KEYWORDS) {
      if (haystack.includes(keyword)) {
        throw new Error(
          `Configuration invalide : le lot "${prize.label}" semble conditionne a un avis ` +
            `client (mot-cle detecte: "${keyword}"). C'est interdit par l'article L111-7-2 ` +
            `du Code de la consommation et par la politique de Google. Corrigez ` +
            `config/site.config.ts.`
        );
      }
    }
  }
}

assertPrizesAreCompliant(siteConfig.prizes);

export interface PickedPrize {
  prize: PrizeConfig;
  index: number;
}

/** Tirage pondere cote serveur (le client ne doit jamais decider du lot gagne). */
export function pickWeightedPrize(prizes: PrizeConfig[] = siteConfig.prizes): PickedPrize {
  const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight <= 0) {
    throw new Error("La somme des poids des lots doit etre superieure a 0.");
  }

  let roll = randomInt(0, totalWeight);
  for (let index = 0; index < prizes.length; index++) {
    const prize = prizes[index];
    if (roll < prize.weight) {
      return { prize, index };
    }
    roll -= prize.weight;
  }

  // Filet de securite (ne devrait jamais arriver arithmetiquement).
  const lastIndex = prizes.length - 1;
  return { prize: prizes[lastIndex], index: lastIndex };
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I pour eviter les confusions

function randomCodeSegment(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return out;
}

/** Genere un code lisible du type "AB3K-9F2Q". L'unicite est garantie au niveau DB. */
export function generatePrizeCode(): string {
  return `${randomCodeSegment(4)}-${randomCodeSegment(4)}`;
}

export interface PublicPrize {
  id: string;
  label: string;
  color: string;
  textColor: string;
}

/**
 * Vue publique des lots, envoyee au navigateur pour dessiner la roue.
 * Volontairement sans le "weight" : le client ne doit jamais pouvoir deduire
 * ou influencer les probabilites de tirage, qui restent calculees cote serveur.
 *
 * Couleurs encre/champagne/terracotta (façon roulette) pour la DA premium
 * minimaliste ; un prize.color personnalise dans la config reste prioritaire
 * si defini. Sur un cercle, alterner seulement 2 couleurs echoue des que le
 * nombre de lots est impair (le dernier segment retombe sur la couleur du
 * premier) : on utilise donc 3 tons et on choisit, a chaque segment, une
 * couleur differente de son voisin precedent ET, pour le dernier segment, du
 * premier — garantissant qu'aucun segment adjacent ne partage sa couleur,
 * y compris a la jointure de la roue, quel que soit le nombre de lots.
 */
export function getPublicPrizes(prizes: PrizeConfig[] = siteConfig.prizes): PublicPrize[] {
  const palette = [
    { bg: siteConfig.theme.ink, text: siteConfig.theme.bone },
    { bg: siteConfig.theme.champagne, text: siteConfig.theme.ink },
    { bg: siteConfig.theme.terracotta, text: siteConfig.theme.bone },
  ];
  const total = prizes.length;
  const resolved: { bg: string; text: string }[] = [];

  prizes.forEach((prize, index) => {
    if (prize.color) {
      resolved.push({ bg: prize.color, text: siteConfig.theme.bone });
      return;
    }

    const isLast = index === total - 1;
    const prevBg = resolved[index - 1]?.bg;
    const firstBg = resolved[0]?.bg;
    const rotated = [...palette.slice(index % palette.length), ...palette.slice(0, index % palette.length)];
    const pick =
      rotated.find((c) => (!prevBg || c.bg !== prevBg) && (!isLast || !firstBg || c.bg !== firstBg)) ??
      palette[index % palette.length];
    resolved.push(pick);
  });

  return prizes.map((prize, index) => ({
    id: prize.id,
    label: prize.label,
    color: resolved[index].bg,
    textColor: resolved[index].text,
  }));
}
