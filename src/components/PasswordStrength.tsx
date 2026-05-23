"use client";

interface Props {
  password: string;
}

function getStrength(p: string): { score: number; label: string; color: string } {
  if (!p) return { score: 0, label: "", color: "" };
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;

  if (score <= 1) return { score: 1, label: "Très faible", color: "bg-red-500" };
  if (score === 2) return { score: 2, label: "Faible", color: "bg-orange-400" };
  if (score === 3) return { score: 3, label: "Moyen", color: "bg-yellow-400" };
  if (score === 4) return { score: 4, label: "Fort", color: "bg-blue-500" };
  return { score: 5, label: "Très fort", color: "bg-green-500" };
}

export default function PasswordStrength({ password }: Props) {
  if (!password) return null;
  const { score, label, color } = getStrength(password);

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? color : "bg-gray-200"}`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${
        score <= 1 ? "text-red-500" :
        score === 2 ? "text-orange-400" :
        score === 3 ? "text-yellow-500" :
        score === 4 ? "text-blue-500" : "text-green-500"
      }`}>
        {label}
      </p>
    </div>
  );
}
