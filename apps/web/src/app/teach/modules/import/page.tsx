import { TeachJmmImport } from "@/components/teach-jmm-import";
import { TeachTitle } from "@/components/teach-shell";

export const dynamic = "force-dynamic";

export default function ImportModulePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <TeachTitle
        kicker="Teach"
        title="Import module"
        action={
          <a
            className="jose-button jose-button--secondary"
            href="/docs/authoring/jose-module-markup-v1.md"
          >
            Authoring guide
          </a>
        }
      />
      <p className="mb-4 text-sm font-semibold text-slate-600">
        Paste Jose Module Markup v1, validate the preview, then create one new draft.
        Imports never edit an existing module.
      </p>
      <TeachJmmImport />
    </div>
  );
}
