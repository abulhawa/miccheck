import React from "react";
import Link from "next/link";
import { buttonStyles } from "./buttonStyles";
import { buildUseCaseTestHref } from "../lib/useCaseRouting";
import type { UseCase } from "../types";

interface SeoLandingPageProps {
  headline: string;
  description: string;
  useCase: UseCase;
}

export default function SeoLandingPage({ headline, description, useCase }: SeoLandingPageProps) {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8">
      <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">{headline}</h1>
      <p className="text-base text-slate-200">{description}</p>
      <div>
        <Link className={buttonStyles({ variant: "primary" })} href={buildUseCaseTestHref(useCase)}>
          Test your mic
        </Link>
      </div>
    </section>
  );
}
