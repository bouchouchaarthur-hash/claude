"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PublicPrize } from "@/lib/prizes";

interface WheelProps {
  prizes: PublicPrize[];
  consentLabel: string;
  redeemInstructions: string;
  /**
   * Lien vers la fiche d'avis Google, propose UNIQUEMENT apres coup (une fois
   * le lot deja attribue et envoye), sans aucune condition. Si vide, l'ecran
   * n'est pas affiche. Ne jamais relier ce lien a l'obtention du lot.
   */
  googleReviewUrl?: string;
}

interface SpinResult {
  prizeLabel: string;
  code: string;
  emailSent: boolean;
}

const CANVAS_SIZE = 260;
const SPIN_DURATION_MS = 4200;
const EXTRA_SPINS = 5;
const LABEL_MAX_WIDTH = 80;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function SparkleIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="sparkle-icon" aria-hidden="true">
      <path d="M12 2L13.8 9.2L21 11L13.8 12.8L12 20L10.2 12.8L3 11L10.2 9.2L12 2Z" fill="currentColor" />
    </svg>
  );
}

export default function Wheel({ prizes, consentLabel, redeemInstructions, googleReviewUrl }: WheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const animationRef = useRef<number | null>(null);

  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);

  const segmentAngle = (2 * Math.PI) / prizes.length;
  const isEmailValid = EMAIL_REGEX.test(email.trim());
  const canSubmit = isEmailValid && consent && !isSpinning && !result;

  function drawWheel(rotation: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const radius = CANVAS_SIZE / 2;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.save();
    ctx.translate(radius, radius);
    ctx.rotate(rotation);

    prizes.forEach((prize, index) => {
      const startAngle = index * segmentAngle;
      const endAngle = startAngle + segmentAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = prize.color;
      ctx.fill();
      ctx.strokeStyle = "#A9843F";
      ctx.lineWidth = 1;
      ctx.stroke();

      const midAngle = startAngle + segmentAngle / 2;
      const normalizedAngle = ((midAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      // Dans la moitie gauche du cadran, le texte serait affiche a l'envers :
      // on retourne son orientation de 180deg pour qu'il reste lisible.
      const flip = normalizedAngle > Math.PI / 2 && normalizedAngle < (3 * Math.PI) / 2;

      ctx.save();
      ctx.rotate(midAngle + (flip ? Math.PI : 0));
      ctx.textAlign = flip ? "left" : "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = prize.textColor;
      ctx.font = "500 11px Arial, sans-serif";
      drawWrappedText(ctx, prize.label, flip ? -(radius - 16) : radius - 16, LABEL_MAX_WIDTH);
      ctx.restore();
    });

    ctx.restore();

    ctx.beginPath();
    ctx.arc(radius, radius, 18, 0, 2 * Math.PI);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#A9843F";
    ctx.stroke();
  }

  useEffect(() => {
    drawWheel(rotationRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prizes]);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  function pickTargetRotationFor(index: number): number {
    const segmentCenter = index * segmentAngle + segmentAngle / 2;
    const pointerAngle = -Math.PI / 2; // le pointeur est fixe en haut du cadran
    const jitter = (Math.random() - 0.5) * segmentAngle * 0.4;
    const current = rotationRef.current % (2 * Math.PI);
    let delta = pointerAngle - segmentCenter + jitter - current;
    delta = ((delta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return rotationRef.current + EXTRA_SPINS * 2 * Math.PI + delta;
  }

  function animateTo(targetRotation: number, onDone: () => void) {
    const startRotation = rotationRef.current;
    const distance = targetRotation - startRotation;
    const startTime = performance.now();

    function frame(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / SPIN_DURATION_MS);
      const eased = easeOutCubic(t);
      rotationRef.current = startRotation + distance * eased;
      drawWheel(rotationRef.current);

      if (t < 1) {
        animationRef.current = requestAnimationFrame(frame);
      } else {
        onDone();
      }
    }

    animationRef.current = requestAnimationFrame(frame);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!isEmailValid) {
      setErrorMessage("Merci de renseigner une adresse e-mail valide pour tourner la roue.");
      return;
    }

    if (!consent) {
      setErrorMessage("Merci de cocher la case de consentement pour continuer.");
      return;
    }

    setIsSpinning(true);
    try {
      const res = await fetch("/api/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || "Une erreur est survenue, reessayez.");
        setIsSpinning(false);
        return;
      }

      const winningIndex = prizes.findIndex((p) => p.id === data.prizeId);
      const targetRotation = pickTargetRotationFor(winningIndex >= 0 ? winningIndex : 0);

      animateTo(targetRotation, () => {
        setIsSpinning(false);
        setResult({
          prizeLabel: data.prizeLabel,
          code: data.code,
          emailSent: Boolean(data.emailSent),
        });
      });
    } catch {
      setErrorMessage("Impossible de contacter le serveur, reessayez.");
      setIsSpinning(false);
    }
  }

  return (
    <>
      <div className="wheel-wrap">
        <div className="wheel-pointer" />
        <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} className="wheel-canvas" />
      </div>

      <form className="spin-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Votre e-mail</label>
          <input
            id="email"
            type="email"
            required
            placeholder="vous@exemple.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSpinning || Boolean(result)}
          />
        </div>

        <label className="consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={isSpinning || Boolean(result)}
          />
          <span>{consentLabel}</span>
        </label>

        {errorMessage && <div className="error-message">{errorMessage}</div>}

        <button type="submit" className="spin-button" disabled={!canSubmit}>
          {isSpinning ? "La roue tourne..." : "Tourner la roue"}
        </button>
      </form>

      {result && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="result-card">
            <div className="result-emoji">
              <SparkleIcon />
            </div>
            <p className="result-title">Felicitations, vous avez gagne</p>
            <p className="result-prize">{result.prizeLabel}</p>
            <div className="result-code-box">
              <p className="result-code-label">Votre code</p>
              <p className="result-code">{result.code}</p>
            </div>
            <p className="result-note">{redeemInstructions}</p>
            <p className="result-email-status">
              {result.emailSent
                ? "Un e-mail recapitulatif vient de vous etre envoye."
                : "Notez bien ce code : l'envoi de l'e-mail a rencontre un probleme."}
            </p>
            <button
              className="close-button"
              onClick={() => {
                setResult(null);
                if (googleReviewUrl) setShowReviewPrompt(true);
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {showReviewPrompt && googleReviewUrl && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="result-card">
            <div className="result-emoji">
              <SparkleIcon />
            </div>
            <p className="result-title">Merci d&apos;avoir joue</p>
            <p className="result-note">
              Votre lot est deja valide et vous a ete envoye par e-mail. Si vous avez apprecie votre
              visite, un avis Google nous aiderait beaucoup — c&apos;est entierement facultatif et
              n&apos;a aucune incidence sur votre lot.
            </p>
            <div className="review-actions">
              <a
                href={googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="spin-button review-link"
                onClick={() => setShowReviewPrompt(false)}
              >
                Laisser un avis Google
              </a>
              <button className="review-skip-button" onClick={() => setShowReviewPrompt(false)}>
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, xPos: number, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeight = 15;
  const startY = -((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, xPos, startY + i * lineHeight);
  });
}
