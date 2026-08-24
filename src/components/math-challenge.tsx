import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMathChallenge, type MathChallenge } from "@/lib/math-challenge.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface MathChallengeProps {
  onVerify?: (token: string, answer: string) => void;
  className?: string;
  required?: boolean;
}

export const MathChallengeField = forwardRef<{ refresh: () => void }, MathChallengeProps>(
  ({ onVerify, className, required = true }, ref) => {
  const [challenge, setChallenge] = useState<MathChallenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const fetchChallenge = useServerFn(getMathChallenge);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchChallenge();
      setChallenge(res.challenge);
      setAnswer("");
    } catch (error) {
      console.error("Erro ao carregar desafio matemático", error);
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: load
  }));

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (challenge && answer.length > 0) {
      onVerify?.(challenge.id, answer);
    }
  }, [challenge, answer, onVerify]);

  if (!challenge) return null;

  return (
    <div className={`space-y-3 p-4 border rounded-lg bg-secondary/20 ${className}`}>
      <div className="flex items-center justify-between">
        <Label htmlFor="math-answer" className="text-sm font-semibold">
          Desafio de segurança: {challenge.question}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={load}
          disabled={loading}
          title="Novo desafio"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Digite a resposta em números</p>
      <Input
        id="math-answer"
        type="number"
        inputMode="numeric"
        required={required}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Resultado"
        autoComplete="off"
      />
    </div>
  );
}
);
