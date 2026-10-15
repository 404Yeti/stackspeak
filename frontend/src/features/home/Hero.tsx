import { Button } from "@/components/ui/Button";
import { CodeEditor } from "@/components/ui/CodeEditor";
import { MicButton } from "@/components/ui/MicButton";
import { Waveform } from "@/components/ui/Waveform";
import { SAMPLE_CHALLENGE_CODE } from "@/lib/sampleChallenge";

export function Hero() {
  return (
    <section className="flex flex-col items-center gap-16 px-6 py-16 lg:flex-row lg:items-center lg:px-[120px] lg:py-[88px]">
      <div className="flex flex-1 flex-col items-start gap-6">
        <p className="font-mono text-sm text-text-muted">Read it. Explain it. Fix it. Defend it.</p>
        <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl lg:text-[64px] lg:leading-[72px] lg:tracking-[-1.5px]">
          Level up your <span className="text-accent-soft">coding</span> and your{" "}
          <span className="text-success">English</span>.
        </h1>
        <p className="max-w-xl text-base leading-[26px] text-text-muted">
          Interactive coding challenges, AI-powered feedback, and real technical
          conversations that help developers understand, explain, and improve
          code with confidence.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button href="/daily-challenge" variant="primary" size="lg">
            Start Learning Free
          </Button>
          <Button href="#how-it-works" variant="secondary" size="lg">
            See How It Works
          </Button>
        </div>
      </div>

      <div className="flex w-full max-w-[560px] flex-col gap-4 drop-shadow-[0_0_12px_rgba(139,92,246,0.35)]">
        <CodeEditor filename="main.py" code={SAMPLE_CHALLENGE_CODE} />
        <div className="flex items-center gap-4 rounded-lg border border-accent bg-elevated p-6">
          <MicButton state="recording" label="Voice input preview (not yet available)" />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-text-primary">
              Explain what this code is trying to do…
            </p>
            <Waveform active />
          </div>
        </div>
      </div>
    </section>
  );
}
